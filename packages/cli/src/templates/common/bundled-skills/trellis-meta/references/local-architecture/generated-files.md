# 初始化后生成的本地文件

`cviauto init` 将 Cviauto 运行时写入用户项目。之后，`cviauto update` 尝试更新 Cviauto 管理的模板文件，但会使用 `.cviauto/.template-hashes.json` 来判断哪些文件已被用户修改。

此页面仅描述用户项目中可见且可编辑的文件。

## `.cviauto/`

```text
.cviauto/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| 路径 | 通常可编辑？ | 备注 |
| --- | --- | --- |
| `.cviauto/workflow.md` | 是 | 本地工作流文档和 AI 路由规则。 |
| `.cviauto/config.yaml` | 是 | 项目配置、hooks、packages、日志行数限制及相关设置。 |
| `.cviauto/spec/` | 是 | 项目 spec，预期由用户和 AI 定期更新。 |
| `.cviauto/tasks/` | 是 | 任务材料和研究产出物，由任务工作流维护。默认通过 `.cviauto/.gitignore` 仅在本地；仅当项目明确希望将 Cviauto 记录纳入 git 时才发布。 |
| `.cviauto/workspace/` | 是 | 会话记录，通常由 `add_session.py` 写入。默认通过 `.cviauto/.gitignore` 仅在本地；仅当项目明确希望将 Cviauto 记录纳入 git 时才发布。 |
| `.cviauto/scripts/` | 谨慎 | 本地运行时。可以自定义，但需在理解调用链之后。 |
| `.cviauto/.runtime/` | 否 | 运行时状态，通常由 hooks/scripts 自动写入。 |
| `.cviauto/.developer` | 谨慎 | 当前开发者身份。 |
| `.cviauto/.version` | 否 | 由更新/迁移逻辑使用的 Cviauto 版本记录。 |
| `.cviauto/.template-hashes.json` | 否 | 模板哈希记录。不要在此手写业务规则。 |

## 平台目录

不同平台生成不同的目录。常见类别：

| 类别 | 示例路径 | 用途 |
| --- | --- | --- |
| hooks | `.claude/hooks/`、`.codex/hooks/`、`.cursor/hooks/` | 注入会话上下文、工作流状态和 sub-agent 上下文。 |
| settings | `.claude/settings.json`、`.codex/hooks.json`、`.qoder/settings.json` | 告诉平台何时运行 hooks 或插件。 |
| agents | `.claude/agents/`、`.codex/agents/`、`.kiro/agents/`、`.zcode/cli/agents/` | 定义如 `cviauto-research`、`cviauto-implement` 和 `cviauto-check` 等 Agent。 |
| skills | `.claude/skills/`、`.agents/skills/`、`.qoder/skills/` | 自动触发或可被 AI 读取的技能。 |
| commands/prompts/workflows | `.cursor/commands/`、`.github/prompts/`、`.devin/workflows/`、`.zcode/commands/` | 用户显式调用的命令或工作流入口点。 |

修改平台目录时，也要确认 `.cviauto/workflow.md` 是否仍然描述相同的流程。

## 模板哈希的含义

`.cviauto/.template-hashes.json` 记录了 Cviauto 上次写入模板文件时的内容哈希。`cviauto update` 使用它来区分三种情况：

| 情况 | 更新行为 |
| --- | --- |
| 文件未被用户修改 | 可以自动更新。 |
| 文件已被用户修改 | 提示用户选择覆盖、保留或生成 `.new`。 |
| 文件不再是当前模板 | 可能根据迁移规则被删除、重命名或保留。 |

当 AI 自定义本地 Cviauto 文件时，无需手动维护哈希。Cviauto update 将结果识别为"已被用户修改"是正常的。

## 本地自定义边界

默认可编辑：

- `.cviauto/workflow.md`
- `.cviauto/config.yaml`
- `.cviauto/spec/**`
- `.cviauto/scripts/**`
- 平台 hooks、settings、agents、skills、commands、prompts 和 workflows

默认不可编辑：

- 全局 npm 安装目录
- `node_modules/@mindfoldhq/cviauto`
- Cviauto GitHub 仓库源码
- `.cviauto/.runtime/**` 下的具体状态文件
- `.cviauto/.template-hashes.json` 内的哈希内容

仅在用户明确希望向上游贡献时，才切换到 Cviauto CLI 源码视角。