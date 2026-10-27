/**
 * 把模型传入的提问参数整理成 userQuestions 服务认识的形状。
 * 只做校验与字段改名，不替用户补任何默认选项。
 */

const MAX_QUESTIONS = 20
const MAX_OPTIONS = 20

/**
 * @param {unknown} input 模型传入的 questions 数组
 * @returns {Array<object>} 服务层问题数组
 */
export function normalizeQuestions(input) {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error('ask_user_question requires at least one question')
  }
  if (input.length > MAX_QUESTIONS) {
    throw new Error(`ask_user_question accepts at most ${MAX_QUESTIONS} questions per call`)
  }

  const seen = new Set()
  return input.map((raw, index) => {
    if (raw === null || typeof raw !== 'object') {
      throw new Error(`question ${index + 1} must be an object`)
    }
    const id = typeof raw.id === 'string' ? raw.id.trim() : ''
    if (!id) throw new Error(`question ${index + 1} needs a non-empty id`)
    if (seen.has(id)) throw new Error(`question id ${JSON.stringify(id)} must be unique within this call`)
    seen.add(id)

    const question = typeof raw.question === 'string' ? raw.question.trim() : ''
    if (!question) throw new Error(`question ${JSON.stringify(id)} needs non-empty text`)

    const options = normalizeOptions(raw.options, id)
    return {
      id,
      question,
      ...(typeof raw.header === 'string' && raw.header.trim() ? { header: raw.header.trim() } : {}),
      ...(options === undefined ? {} : { options }),
      ...(raw.multi_select === true ? { multiSelect: true } : {}),
    }
  })
}

function normalizeOptions(options, id) {
  if (options === undefined || options === null) return undefined
  if (!Array.isArray(options)) throw new Error(`question ${JSON.stringify(id)} has non-array options`)
  if (options.length > MAX_OPTIONS) {
    throw new Error(`question ${JSON.stringify(id)} accepts at most ${MAX_OPTIONS} options`)
  }
  const seen = new Set()
  return options.map((option, index) => {
    if (option === null || typeof option !== 'object') {
      throw new Error(`option ${index + 1} of question ${JSON.stringify(id)} must be an object`)
    }
    const label = typeof option.label === 'string' ? option.label.trim() : ''
    if (!label) throw new Error(`option ${index + 1} of question ${JSON.stringify(id)} needs a label`)
    if (seen.has(label)) {
      throw new Error(`option label ${JSON.stringify(label)} must be unique within question ${JSON.stringify(id)}`)
    }
    seen.add(label)
    return {
      label,
      ...(typeof option.description === 'string' && option.description.trim()
        ? { description: option.description.trim() }
        : {}),
    }
  })
}

/**
 * 回答批次只允许原样回传；缺失的字段不补造。
 * @param {{ answers?: Array<object> }} outcome
 */
export function normalizeAnswers(outcome) {
  const answers = Array.isArray(outcome?.answers) ? outcome.answers : []
  return answers.map((answer) => ({
    id: String(answer.id),
    selected: Array.isArray(answer.selected) ? answer.selected.map(String) : [],
    ...(typeof answer.custom === 'string' ? { custom: answer.custom } : {}),
  }))
}