import { normalizeAnswers, normalizeQuestions } from './questions.js'
import { formatTimeoutMessage, resolveTimeoutSeconds } from './format.js'

export const TOOL_NAME = 'ask_user_question'

const QUESTION_SCHEMA = {
  type: 'object',
  additionalProperties: true,
  properties: {
    id: {
      type: 'string',
      description: 'Stable id for this question; echoed back in the answer.',
    },
    question: {
      type: 'string',
      description: 'The specific question to ask the user.',
    },
    header: {
      type: 'string',
      description: 'Optional short heading, such as "Confirm" or "Choose Mode".',
    },
    options: {
      type: 'array',
      description:
        'Optional choices. If you recommend one, put it first and append "(Recommended)" to its label; the user still decides.',
      items: {
        type: 'object',
        additionalProperties: true,
        properties: {
          label: { type: 'string', description: 'Short user-facing option label.' },
          description: { type: 'string', description: 'One sentence explaining the tradeoff.' },
        },
        required: ['label'],
      },
    },
    multi_select: {
      type: 'boolean',
      description: 'Whether the user may select more than one option. Defaults to false.',
    },
  },
  required: ['id', 'question'],
}

const ANSWER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answers: {
      type: 'array',
      description: 'Submitted answer batch, one item per question.',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          selected: { type: 'array', items: { type: 'string' } },
          custom: { type: 'string' },
        },
        required: ['id', 'selected'],
      },
    },
  },
  required: ['answers'],
}

const PENDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    pending: { type: 'boolean', enum: [true], description: 'True when the wait expired before an answer batch arrived.' },
    callId: { type: 'string', description: 'The call whose questions remain answerable.' },
    message: { type: 'string', description: 'The options repeated as text for the user.' },
  },
  required: ['pending', 'callId', 'message'],
}

const DESCRIPTION = [
  'Ask the user a concise question when a decision, a choice, or missing information blocks progress.',
  'The dialog waits 600 seconds. When that wait expires, this call ends the current turn and returns the options as text;',
  'the task stays stopped until the user answers. A timeout is never consent: never pick an option for the user,',
  'never treat silence as approval, and never continue the interrupted work before the user replies.',
].join(' ')

/**
 * 构造替换版 ask_user_question 定义。
 * 名字与 timeout 参数必须保留：会话投影靠这两个特征识别"可继续回答的定时提问"。
 * @param {{ userQuestions: { askTimed: Function }, timeoutSeconds?: number }} options
 */
export function createAskGuardDefinition({ userQuestions, timeoutSeconds = 600 }) {
  return {
    name: TOOL_NAME,
    description: DESCRIPTION,
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        questions: {
          type: 'array',
          description: 'Questions to ask the user.',
          items: QUESTION_SCHEMA,
        },
        timeout: {
          type: 'integer',
          description:
            'Optional longer wait in seconds. This deployment never waits less than 600 seconds and never treats the deadline as an answer.',
        },
      },
      required: ['questions'],
    },
    output: {
      schema: { oneOf: [ANSWER_SCHEMA, PENDING_SCHEMA] },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    async execute(args, exec) {
      const questions = normalizeQuestions(args?.questions)
      const agent = exec.agent
      if (agent === undefined) throw new Error('ask_user_question requires the exact live calling agent')
      const seconds = resolveTimeoutSeconds(args?.timeout, timeoutSeconds)
      const outcome = await userQuestions.askTimed(
        { questions, agent, signal: exec.signal },
        exec.callId,
        seconds * 1000,
      )
      if (outcome !== null && typeof outcome === 'object' && 'pending' in outcome) {
        // 超时：本轮到此为止，不进入下一步，也不替用户挑。
        exec.concludeTurn()
        return {
          pending: true,
          callId: String(exec.callId),
          message: formatTimeoutMessage(questions, seconds),
        }
      }
      return { answers: normalizeAnswers(outcome) }
    },
  }
}