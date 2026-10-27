# 设计说明

## 为什么不是「timed 模式 + 模型自己停」

Harness 自带的 `tool-ask-user` 在 `mode: timed` 下超时只返回 `{ pending: true }`，并明确告诉模型「可以继续做独立的活」。这满足不了「超时必须中断当前任务」。

模型侧的自律（提示词里写「超时就停」）也不是硬保证：模型仍然可以在同一轮继续调用工具。所以这里用运行时提供的 `concludeTurn()`：工具返回成功结果的同时声明本轮结束，循环不会进入下一次模型请求。

## 为什么工具名必须还是 ask_user_question

`dsh-user-questions` 的会话投影按名字 + schema 识别可继续回答的定时提问：

- `event.data.name === 'ask_user_question'`
- 记录的 schema 的 `parameters.properties` 里必须有 `timeout`

改名或删掉 `timeout` 参数，问题卡片就不会被识别为「超时后仍可回答」，用户只能靠文字回复。因此替换版保留同名工具，并保留 `timeout` 参数（只允许把等待变长，不允许压到 600 秒以下）。

## 为什么按 agent 注册

预设里的 `tool-ask-user` 是每个 agent 自己的工具。替换版在 `agent/created` 时通过 `agent.ctx.effect()` 注册同名工具，作用域比预设更具体，卸载时随 agent 一起释放；插件自己的 effect 也保存了一份 disposer，插件卸载时兜底清理。

## 超时之后

- 工具结果是 `pending: true`，不包含 `answers`。
- 问题卡片仍可回答；点选后走 `userQuestions.answer`，以用户消息进入下一轮。
- 用户也可以直接打字回复编号 / 选项名。
- 超时结果里的 `message` 是给用户看的选项清单，也是下一轮模型理解「刚才问到哪」的依据。

## 明确不做的事

- 不自动选任何选项，不把「推荐」当默认。
- 不把超时当同意，不在超时后继续原来的工具链。
- 不新增自己的弹窗 UI：沿用 Harness 自带提问卡片，避免和现有主题、倒计时、无障碍行为打架。