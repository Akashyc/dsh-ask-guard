/**
 * 超时结果的用户可读文案。
 * 关键约束：只列选项、不推荐、不预选，超时永远不等于同意。
 */

export const MIN_TIMEOUT_SECONDS = 600
export const MAX_TIMEOUT_SECONDS = 2_147_483

/**
 * 模型可以要求等更久，但不能把 600 秒的下限压短。
 * -1 / 0 / 非整数一律回落到下限。
 * @param {unknown} requested 模型传入的 timeout
 * @param {number} fallback 部署默认值（秒）
 */
export function resolveTimeoutSeconds(requested, fallback = MIN_TIMEOUT_SECONDS) {
  const floor = Math.max(1, Math.trunc(Number.isFinite(fallback) ? fallback : MIN_TIMEOUT_SECONDS))
  if (!Number.isInteger(requested) || requested <= 0) return floor
  return Math.max(floor, Math.min(requested, MAX_TIMEOUT_SECONDS))
}

/**
 * 把问题与选项排成一段可直接贴进对话的提示。
 * @param {Array<object>} questions 已规范化的服务层问题
 * @param {number} seconds 实际等待秒数
 * @returns {string}
 */
export function formatTimeoutMessage(questions, seconds) {
  const lines = [
    `提问超时（${seconds} 秒）：本轮任务已中止，没有替你选择任何选项。`,
    '请直接回复选项编号或选项名；也可以输入自定义答案，收到答复后才会继续。',
  ]

  questions.forEach((question, index) => {
    const heading = question.header ? `【${question.header}】` : `【问题 ${index + 1}】`
    lines.push('', `${heading}${question.question}`)
    if (!question.options || question.options.length === 0) {
      lines.push('  （本题没有给出选项，请直接输入答案）')
      return
    }
    question.options.forEach((option, optionIndex) => {
      const suffix = option.description ? ` — ${option.description}` : ''
      lines.push(`  ${optionIndex + 1}) ${option.label}${suffix}`)
    })
    if (question.multiSelect) lines.push('  （可多选，用逗号分隔编号）')
  })

  lines.push('', 'TIMEOUT: no option was selected. The turn ended. Do not act, do not pick an option, and wait for the user reply.')
  return lines.join('\n')
}

/**
 * 回答被用户跳过时的提示（保留在结果里，便于下一轮模型理解）。
 * @param {Array<object>} answers
 */
export function formatAnswerSummary(answers) {
  if (!answers.some((answer) => answer.selected.length === 0 && answer.custom === undefined)) return ''
  return 'Some questions were skipped by the user; an empty selection is an explicit skip, not consent.'
}