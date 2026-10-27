# dsh-ask-guard

把 `ask_user_question` 换成「等足 600 秒、超时就停、绝不替你选」的版本。

## 行为

1. **弹窗照旧**：仍然走 Harness 自带的提问卡片（`ctx.userQuestions`），问题、选项、自定义输入都不变。
2. **给足 600 秒**：前台等待固定 10 分钟；模型只能要求更久，不能压短。
3. **超时即停**：600 秒没有答复时，工具调用以 `pending` 结束，并调用 `exec.concludeTurn()` 结束本轮。后续工具调用不会发生。
4. **原样列选项**：超时结果里的 `message` 包含每个问题的全部选项（编号、标签、说明），提示用户回复编号或选项名。
5. **不替用户决定**：超时结果不包含任何 `answers`，也不预选、不推荐；超时永远不等于同意。

用户在下一条消息里回复编号 / 选项名（或直接点仍然挂着的提问卡片）后，模型才继续工作。

## 安装

```js
plugin_manager({
  action: 'install_bundle',
  target: '/Users/yu/Documents/deepseek-harness/dsh-ask-guard'
})
```

已经装进当前 profile（`desktop`）。安装时会给当时活着的 agent 立即装上，之后每个新 agent 通过 `agent/created` 继续装。

## 配置

目前不需要配置。`index.js` 的 `DEFAULT_TIMEOUT_SECONDS` 是 600；`config.timeoutSeconds` 只接受不小于 600 的整数（当前没有导出 Config，所以等同于固定 600）。

## 结构

```
index.js              插件入口：给每个 agent 注册按 agent 隔离的工具
src/ask-guard.js      工具定义、超时收尾
src/questions.js      提问参数校验与规范化
src/format.js         超时文案与 600 秒下限
test/                  node:test 单测
docs/design.md         设计与边界说明
locale/                插件管理页显示用的中英文元数据
```

## 验证

```bash
node --test test/ask-guard.test.mjs
node --check index.js
```

工具是否真的换上了：调用 `cordis_inspect_query`（provider `Tool`，method `listTools`），看 `ask_user_question` 的 schema 里是否带 `timeout` 参数，且描述里写着 600 秒超时即结束本轮。

## 开源说明

- **许可证**：MIT，全文见 [LICENSE](LICENSE)。可以自由使用、修改、分发、商用，保留版权与许可声明即可。
- **版权**：Copyright (c) 2026 Akashyc。
- **图标**：`icon.svg` 为本项目原创，随插件一起以 MIT 授权，没有使用第三方美术素材。
- **第三方代码**：本插件只通过 DSH（DeepSeek Harness）的公开插件接口注册工具，不包含、也不再分发 DSH 或其官方包的源码；提问卡片 UI 由 DSH 本体提供，本插件只调用它的服务。
- **`private: true`**：只是防止误执行 `npm publish`，不影响源码开放；真要发布时改成 `false` 即可。
- **打包**：`package.json` 的 `files` 已包含 `LICENSE`，打包或链接安装都会带上它。