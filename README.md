# dsh-ask-guard

DSH 插件：把 `ask_user_question` 换成「等足 600 秒、超时就停、绝不替你选」的版本。

## 安装

从 GitHub 仓库直接安装，不打包、不发 npm、不用下载 tgz。

| 方式 | 做法 |
| --- | --- |
| 让 Agent 装（推荐） | 对 agent 说：安装插件 `github:Akashyc/dsh-ask-guard` |
| 插件管理页 | 插件 → 添加插件 → 地址填 `github:Akashyc/dsh-ask-guard` → 安装 |
| 手动写 profile | 见下一节 |

`github:` 前缀由 pnpm 解析，公开仓库不用登录；装的是仓库默认分支的当前提交。
装完刷新页面，提示需要重启时再重启 DSH。

### 手动写 profile

编辑 `~/.dsh/profiles/<profile>/package.json`（默认 profile 是 `desktop`），加两处：

```json
{
  "dependencies": {
    "dsh-ask-guard": "github:Akashyc/dsh-ask-guard"
  },
  "dsh": {
    "profile": {
      "bundles": ["dsh-ask-guard"]
    }
  }
}
```

`bundles` 里已有内容就追加，不要整段替换。然后在 profile 目录执行：

```bash
pnpm install
```

重启 DSH，启动日志里不应再出现这个包的安装失败或 patch 找不到的报错。

> 更新：先卸载再按同一地址安装。`plugin_manager` 的 `install_bundle` 对已安装的包会直接拒绝，不会覆盖升级。

## 效果

| 行为 | 说明 |
| --- | --- |
| 弹窗照旧 | 仍走 Harness 自带的提问卡片（`ctx.userQuestions`），问题、选项、自定义输入都不变 |
| 给足 600 秒 | 前台等待固定 10 分钟；模型只能要求更久，不能压短 |
| 超时即停 | 600 秒没有答复，工具调用以 `pending` 结束，并调用 `exec.concludeTurn()` 结束本轮；后续工具调用不会发生 |
| 原样列选项 | 超时结果的 `message` 列出每个问题的全部选项（编号、标签、说明），提示回复编号或选项名 |
| 不替用户决定 | 超时结果不含 `answers`，不预选、不推荐；超时永远不等于同意 |

用户在之后回复编号、选项名或自定义答案（也可以直接点仍然挂着的提问卡片），模型才继续工作。

## 卸载

| 方式 | 做法 |
| --- | --- |
| 让 Agent 卸 | 对 agent 说：卸载插件 `dsh-ask-guard` |
| 插件管理页 | 插件 → 已安装 → 该插件 → 卸载 |
| 手动 | 删掉 `dependencies` 和 `dsh.profile.bundles` 里的那两行，`pnpm install`，重启 DSH |

移除后 `ask_user_question` 回到 Harness 自带的版本。

## 配置

| 项 | 默认 | 说明 |
| --- | --- | --- |
| `DEFAULT_TIMEOUT_SECONDS` | `600` | `index.js` 里的常量，决定默认等待时长 |
| `config.timeoutSeconds` | 未启用 | 只接受 ≥ 600 的整数；插件没有注册 Config 项，写进配置不会生效 |

要改等待时长就改 `index.js`，改完重启 DSH。模型传进来的 `timeout` 只会在 600 之上加长；负数、0、非整数都回落到下限。

## 文件

```text
index.js              插件入口：给每个 agent 装一份按 agent 隔离的工具
src/ask-guard.js      工具定义、超时收尾
src/questions.js      提问参数校验与规范化
src/format.js         超时文案与 600 秒下限
locale/               插件管理页显示用的中英文元数据
icon.svg              图标
test/                 node:test 单测
docs/design.md        设计与边界说明
```

## 验证

```bash
node --test test/ask-guard.test.mjs
node --check index.js
```

工具是否真的换上了：调用 `cordis_inspect_query`（provider `Tool`，method `listTools`），看 `ask_user_question` 的 schema 里是否带 `timeout` 参数、描述是否写明 600 秒超时结束本轮。

## 许可

MIT，全文见 [LICENSE](LICENSE)。Copyright (c) 2026 Akashyc。

只通过 DSH 公开插件接口注册工具，不包含、也不再分发 DSH 或其官方包的源码；提问卡片 UI 由 DSH 本体提供。`private: true` 只防误执行 `npm publish`，不影响源码开放。