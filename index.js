import { createAskGuardDefinition } from './src/ask-guard.js'

export const name = 'ask-guard'
export const inject = ['tools', 'userQuestions', 'agents']

const DEFAULT_TIMEOUT_SECONDS = 600

/**
 * 给每个活着的 agent 装一份按 agent 隔离的 ask_user_question 变体：
 * 600 秒后超时即结束本轮，选项原文回给用户，绝不替用户选。
 */
export function apply(ctx, config = {}) {
  const timeoutSeconds = Number.isInteger(config.timeoutSeconds) && config.timeoutSeconds >= 600
    ? config.timeoutSeconds
    : DEFAULT_TIMEOUT_SECONDS
  const installed = new Map()

  const install = (agent) => {
    const key = agent?.id
    if (key === undefined || installed.has(key) || agent?.ctx?.tools === undefined) return
    let dispose
    try {
      dispose = agent.ctx.effect(() => {
        const off = agent.ctx.tools.register(
          createAskGuardDefinition({ userQuestions: ctx.userQuestions, timeoutSeconds }),
        )
        return () => off()
      })
    } catch (error) {
      ctx.logger?.warn?.('ask-guard: cannot install on agent %s: %s', key, error?.message ?? error)
      return
    }
    installed.set(key, { agent, dispose })
  }

  for (const agent of ctx.agents.list()) install(agent)
  ctx.on('agent/created', (payload) => install(payload?.agent ?? payload))

  ctx.effect(() => () => {
    for (const entry of installed.values()) entry.dispose()
    installed.clear()
  })
}