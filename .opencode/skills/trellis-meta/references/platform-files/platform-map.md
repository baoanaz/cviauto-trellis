# Platform File Map（平台文件映射）

本页列出了各平台在用户项目中的常见 Trellis 文件位置。实际项目中是否存在某个平台目录，取决于用户运行了哪些 `trellis init --<platform>` 命令。

## Matrix（矩阵）

| Platform（平台） | CLI flag（CLI 标志） | Main directory（主目录） | Skill directory（技能目录） | Agent directory（代理目录） | Hooks/extensions（钩子/扩展） |
| --- | --- | --- | --- | --- | --- |
| Claude Code | `--claude` | `.claude/` | `.claude/skills/` | `.claude/agents/` | `.claude/hooks/` + `.claude/settings.json` |
| Cursor | `--cursor` | `.cursor/` | `.cursor/skills/` | `.cursor/agents/` | `.cursor/hooks.json` + `.cursor/hooks/` |
| OpenCode | `--opencode` | `.opencode/` | `.opencode/skills/` | `.opencode/agents/` | `.opencode/plugins/` |
| Codex | `--codex` | `.codex/` | `.agents/skills/` | `.codex/agents/` | `.codex/hooks/` + `.codex/hooks.json` |
| Kilo | `--kilo` | `.kilocode/` | `.kilocode/skills/` | 通常无 | `.kilocode/workflows/` |
| Kiro | `--kiro` | `.kiro/` | `.kiro/skills/` | `.kiro/agents/` | `.kiro/hooks/` |
| Gemini CLI | `--gemini` | `.gemini/` | `.agents/skills/` | `.gemini/agents/` | `.gemini/settings.json` + `.gemini/hooks/` |
| Antigravity | `--antigravity` | `.agent/` | `.agent/skills/` | 通常无 | `.agent/workflows/` |
| Devin | `--devin` | `.devin/` | `.devin/skills/` | 通常无 | `.devin/workflows/` |
| Qoder | `--qoder` | `.qoder/` | `.qoder/skills/` | `.qoder/agents/` | `.qoder/hooks/` + `.qoder/settings.json` |
| CodeBuddy | `--codebuddy` | `.codebuddy/` | `.codebuddy/skills/` | `.codebuddy/agents/` | `.codebuddy/hooks/` + `.codebuddy/settings.json` |
| GitHub Copilot | `--copilot` | `.github/` | `.github/skills/` | `.github/agents/` | `.github/copilot/hooks/` + prompts |
| Factory Droid | `--droid` | `.factory/` | `.factory/skills/` | `.factory/droids/` | `.factory/hooks/` + settings |
| Pi Agent | `--pi` | `.pi/` | `.pi/skills/` | `.pi/agents/` | `.pi/extensions/trellis/`（原生 `trellis_subagent` 工具） + `.pi/settings.json` |
| Reasonix | `--reasonix` | `.reasonix/` | `.reasonix/skills/` | 无 — sub-agent 是带有 `runAs: subagent` 前置元数据的 skills | 无 |
| ZCode | `--zcode` | `.zcode/` | `.agents/skills/` | `.zcode/cli/agents/` | pull-based prelude（拉取模式序言，无 hooks） |

## Capability Groups（能力分组）

### Trellis Sub-Agent Support（Trellis Sub-Agent 支持）

以下平台通常有 `trellis-research`、`trellis-implement` 和 `trellis-check` 文件：

- Claude Code
- Cursor
- OpenCode
- Codex
- Kiro
- Gemini CLI
- Qoder
- CodeBuddy
- GitHub Copilot
- Factory Droid
- Pi Agent
- Reasonix（以带有 `runAs: subagent` 的 skills 形式交付，位于 `.reasonix/skills/` 下，而非独立的 `agents/` 目录）
- ZCode

更改 implementation/check/research 行为时，请先查找对应平台的 agent 文件。

### Native Trellis Sub-Agent Tool（原生 Trellis Sub-Agent 工具）

某些平台暴露了一个宿主运行时理解的一级工具。模型像调用其他工具一样调用它，宿主渲染进度卡片、根据 `.<platform>/agents/` 验证 agent 名称，并强制执行分发模式。

- Pi Agent — `trellis_subagent` 工具，定义在 `.pi/extensions/trellis/index.ts`。支持 `single` / `parallel` / `chain` 分发模式，并发出实时的 `trellis-subagent-progress` 事件。

在这些平台上更改 sub-agent 分发行为时，请编辑扩展文件，**而非** agent 的 markdown 文件 — agent markdown 定义职责，但宿主扩展负责分发、验证和进度渲染。

### Main-Session Workflow Platforms（主会话工作流平台）

以下平台更依赖 workflows/skills 来引导主会话：

- Kilo
- Antigravity
- Devin

更改行为时，请先检查 workflows 和 skills。不要假设存在 Trellis sub-agent。

### Shared `.agents/skills/`（共享 `.agents/skills/`）

Codex 写入共享的 `.agents/skills/` 层。某些支持 agentskills.io 的工具也可以读取此目录。如果用户希望多个兼容工具共享一个 skill，可优先考虑 `.agents/skills/`，但不要假设每个平台都会读取它。

## Decision Rules When Modifying Platform Files（修改平台文件时的决策规则）

1. 用户指定了平台：仅修改该平台目录，除非共享的 workflow/spec 文件也必须更改。
2. 用户说"所有平台都应该这样做"：逐平台同步等效入口点；不要只修改一个目录。
3. 用户只说"我的 AI"：检查项目中实际存在的配置目录，推断当前 AI 平台。
4. 用户想要项目规则：优先使用 `.trellis/spec/` 或项目本地 skill。
5. 用户想要 Trellis 行为：编辑 `.trellis/workflow.md` 以及平台 hooks/agents/skills/commands。

## When Paths Differ（当路径不一致时）

平台生态会变化，用户项目可能已经自定义过。如果此表与本地文件不一致，请以用户项目中实际的 settings/config 为准：

- 检查 settings 注册的 hook。
- 检查 command/prompt/workflow 指向的脚本。
- 根据 agent 文件中当前编写的读取规则判断行为。

不要仅因为某个自定义文件不在本路径表中就将其删除。