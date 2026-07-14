# Skills（技能）、Commands（命令）、Prompts（提示）与 Workflows（工作流）

Skills 和 commands 是用户与 Trellis 交互的文本入口。不同平台使用不同的名称，但它们的核心目的相同：告诉 AI 在用户表达特定意图时如何进入 Trellis 流程。

## 概念差异

| 类型 | 触发方式 | 最适合 |
| --- | --- | --- |
| skill | AI 自动匹配或用户显式提及 | 长期能力、工作流规则、修改指南。 |
| command | 用户显式调用 | 明确的操作入口，如 continue、finish-work。 |
| prompt | 用户显式调用或平台选择 | 与 command 类似，但采用平台 prompt 格式。 |
| workflow | 用户显式选择或平台自动匹配 | 在无子代理/钩子时引导主会话。 |

Trellis 工作流技能通常共享一套语义集合：brainstorm、before-dev、check、update-spec、break-loop。多文件内置技能如 `trellis-meta` 使用分层引用。

## 常见路径

| 平台 | 常见入口 |
| --- | --- |
| Claude Code | `.claude/skills/`、`.claude/commands/` |
| Cursor | `.cursor/skills/`、`.cursor/commands/` |
| OpenCode | `.opencode/skills/`、`.opencode/commands/` |
| Codex | `.agents/skills/`、`.codex/skills/` |
| Kilo | `.kilocode/skills/`、`.kilocode/workflows/` |
| Kiro | `.kiro/skills/` |
| Gemini CLI | `.agents/skills/`、`.gemini/commands/` |
| Antigravity | `.agent/skills/`、`.agent/workflows/` |
| Devin | `.devin/skills/`、`.devin/workflows/` |
| Qoder | `.qoder/skills/`、`.qoder/commands/` |
| CodeBuddy | `.codebuddy/skills/`、`.codebuddy/commands/` |
| GitHub Copilot | `.github/skills/`、`.github/prompts/` |
| Factory Droid | `.factory/skills/`、`.factory/commands/` |
| Pi Agent | `.pi/skills/` |
| Reasonix | `.reasonix/skills/` |
| ZCode | `.agents/skills/`、`.zcode/commands/` |

在用户项目中，以 `init` 实际生成的文件为准。

## Skill 结构

一个常见的 skill 是一个目录：

```text
trellis-meta/
├── SKILL.md
└── references/
```

`SKILL.md` 应告诉 AI：

- 何时使用此技能。
- 当前任务应首先阅读哪个参考文件。
- 不应做什么。

references 存放较长的说明，使入口文件不必包含所有内容。

## Command/Prompt/Workflow 结构

Commands、prompts 和 workflows 通常是单个文件。其内容应包括：

- 何时使用。
- 要读取哪些 `.trellis/` 文件。
- 要运行哪些脚本。
- 完成后如何报告。

它们不应存储任务状态；任务状态属于 `.trellis/tasks/` 和 `.trellis/.runtime/`。

## 本地修改场景

| 用户需求 | 编辑位置 |
| --- | --- |
| 修改 AI 自动触发规则 | 对应 skill 的 frontmatter 描述。 |
| 修改用户命令行为 | 对应的 command/prompt/workflow 文件。 |
| 添加项目本地 skill | 平台 skill 目录，或共享的 `.agents/skills/`。 |
| 让多个平台共享一个能力 | 在各平台 skill 目录中编写等效 skill，或在支持 `.agents/skills/` 共享层的平台上使用该层。 |
| 修改 finish/continue 入口 | 平台的 commands/prompts/workflows。 |

## 修改原则

1. **保持入口文件简短；references 承载长内容**。这对 `trellis-meta` 等多文件技能尤为重要。
2. **让触发描述具体明确**。过于宽泛的描述可能误触发；过于狭窄可能无法触发。
3. **跨平台保持语义一致**。文件格式可以不同，但行为描述应匹配。
4. **将项目特定能力放在本地 skill 中**。不要将团队私有流程放入公共 `trellis-meta`。

如果用户只想让本地 AI 多了解一条项目规则，通常应创建项目本地 skill 或更新 `.trellis/spec/`，而不是修改 Trellis 内置工作流技能。