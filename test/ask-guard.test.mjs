import test from 'node:test'
import assert from 'node:assert/strict'

import { createAskGuardDefinition } from '../src/ask-guard.js'
import { normalizeAnswers, normalizeQuestions } from '../src/questions.js'
import { formatTimeoutMessage, resolveTimeoutSeconds } from '../src/format.js'

test('normalizeQuestions keeps the caller order and maps multi_select', () => {
  const questions = normalizeQuestions([
    {
      id: 'mode',
      question: 'Which mode?',
      header: 'Choose Mode',
      options: [{ label: 'Fast' }, { label: 'Careful', description: 'Slower but safer.' }],
      multi_select: true,
    },
  ])
  assert.equal(questions.length, 1)
  assert.equal(questions[0].id, 'mode')
  assert.equal(questions[0].multiSelect, true)
  assert.deepEqual(questions[0].options, [
    { label: 'Fast' },
    { label: 'Careful', description: 'Slower but safer.' },
  ])
})

test('normalizeQuestions refuses an empty or duplicated batch', () => {
  assert.throws(() => normalizeQuestions([]), /at least one question/)
  assert.throws(
    () => normalizeQuestions([{ id: 'a', question: 'A?' }, { id: 'a', question: 'B?' }]),
    /unique/,
  )
  assert.throws(() => normalizeQuestions([{ id: '', question: 'A?' }]), /non-empty id/)
  assert.throws(() => normalizeQuestions([{ id: 'a', question: '' }]), /non-empty text/)
})

test('resolveTimeoutSeconds enforces the 600-second floor', () => {
  assert.equal(resolveTimeoutSeconds(undefined), 600)
  assert.equal(resolveTimeoutSeconds(-1), 600)
  assert.equal(resolveTimeoutSeconds(30), 600)
  assert.equal(resolveTimeoutSeconds(600), 600)
  assert.equal(resolveTimeoutSeconds(900), 900)
  assert.equal(resolveTimeoutSeconds(3_000_000), 2_147_483)
})

test('timeout message lists every option and never recommends one', () => {
  const message = formatTimeoutMessage(
    [
      {
        id: 'mode',
        question: 'Which mode?',
        header: 'Choose Mode',
        options: [{ label: 'Fast' }, { label: 'Careful', description: 'Slower but safer.' }],
      },
    ],
    600,
  )
  assert.match(message, /600/)
  assert.match(message, /Which mode\?/)
  assert.match(message, /1\) Fast/)
  assert.match(message, /2\) Careful — Slower but safer\./)
  assert.match(message, /TIMEOUT/)
  assert.doesNotMatch(message, /Recommended/)
})

test('answers are copied without inventing selections', () => {
  assert.deepEqual(normalizeAnswers({ answers: [{ id: 'q', selected: ['A'] }] }), [
    { id: 'q', selected: ['A'] },
  ])
  assert.deepEqual(normalizeAnswers({ answers: [{ id: 'q', selected: [], custom: 'mine' }] }), [
    { id: 'q', selected: [], custom: 'mine' },
  ])
})

function fakeExec(callId, onConclude) {
  return {
    agent: { id: 'agent-1' },
    callId,
    signal: new AbortController().signal,
    concludeTurn: onConclude,
  }
}

const QUESTIONS = [{ id: 'q', question: 'Which one?', options: [{ label: 'A' }, { label: 'B' }] }]

test('tool keeps the projection-visible name and timeout parameter', () => {
  const definition = createAskGuardDefinition({ userQuestions: {} })
  assert.equal(definition.name, 'ask_user_question')
  assert.ok(Object.hasOwn(definition.parameters.properties, 'timeout'))
})

test('timeout ends the turn and returns no fabricated answer', async () => {
  let concluded = false
  const requests = []
  const definition = createAskGuardDefinition({
    userQuestions: {
      askTimed: async (request, callId, timeoutMs) => {
        requests.push({ request, callId, timeoutMs })
        return { pending: true, callId }
      },
    },
  })
  const value = await definition.execute({ questions: QUESTIONS }, fakeExec('call-1', () => { concluded = true }))

  assert.equal(concluded, true)
  assert.equal(value.pending, true)
  assert.equal('answers' in value, false)
  assert.equal(value.callId, 'call-1')
  assert.match(value.message, /1\) A/)
  assert.equal(requests[0].timeoutMs, 600_000)
  assert.equal(requests[0].request.agent.id, 'agent-1')
})

test('an answer returns the batch and does not end the turn', async () => {
  let concluded = false
  const definition = createAskGuardDefinition({
    userQuestions: {
      askTimed: async () => ({ answers: [{ id: 'q', selected: ['A'] }] }),
    },
  })
  const value = await definition.execute({ questions: QUESTIONS }, fakeExec('call-2', () => { concluded = true }))

  assert.equal(concluded, false)
  assert.deepEqual(value, { answers: [{ id: 'q', selected: ['A'] }] })
})

test('model-provided timeout can only extend the 600-second floor', async () => {
  let seen = 0
  const definition = createAskGuardDefinition({
    userQuestions: {
      askTimed: async (_request, _callId, timeoutMs) => {
        seen = timeoutMs
        return { answers: [] }
      },
    },
  })
  await definition.execute({ questions: QUESTIONS, timeout: 30 }, fakeExec('call-3', () => {}))
  assert.equal(seen, 600_000)
  await definition.execute({ questions: QUESTIONS, timeout: 900 }, fakeExec('call-4', () => {}))
  assert.equal(seen, 900_000)
})