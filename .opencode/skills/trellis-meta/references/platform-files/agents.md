# Agents（代理）

Trellis Agent 文件定义专门的角色。用户项目中常见的 Trellis Agent 有：

- `trellis-research`
- `trellis-implement`
- `trellis-check`

文件位置和格式因平台而异，但职责边界应保持一致。

## Agent Responsibilities（Agent 职责）

| Agent（代理） | Responsibility（职责） |
| --- | --- |
| `trellis-research` | 调查问题并将发现写入当前任务的 `research/`。 |
| `trellis-implement` | 根据 `prd.md`、可选的 `design.md` / `implement.md`、`implement.jsonl` 及相关 spec/research 进行实现。 |
| `trellis-check` | 审查变更、修复发现的问题，并运行必要的检查。 |

Agent 文件不应变成通用的聊天提示。它们应定义输入来源、写入边界、是否可以修改代码，以及如何报告结果。

## Common Paths（常见路径）

| Platform（平台） | Agent path（代理路径） |
| --- | --- |
| Claude Code | `.claude/agents/trellis-*.md` |
| Cursor | `.cursor/agents/trellis-*.md` |
| OpenCode | `.opencode/agents/trellis-*.md` |
| Codex | `.codex/agents/trellis-*.toml` |
| Kiro | `.kiro/agents/trellis-*.json` |
| Gemini CLI | `.gemini/agents/trellis-*.md` |
| Qoder | `.qoder/agents/trellis-*.md` |
| CodeBuddy | `.codebuddy/agents/trellis-*.md` |
| Factory Droid | `.factory/droids/trellis-*.md` |
| Pi Agent | `.pi/agents/trellis-*.md` |
| Reasonix | `.reasonix/skills/trellis-*/SKILL.md`（subagent frontmatter） |
| ZCode | `.zcode/cli/agents/trellis-*.md` |

GitHub Copilot 的 agent/prompt 支持由 `.github/agents/`、`.github/prompts/` 和 `.github/skills/` 等目录组合提供；请检查用户项目中实际生成的文件。

主会话工作流平台如 Kilo、Antigravity 和 Devin 可能没有 Trellis sub-agent 文件。它们通常依赖 workflows/skills 来引导主会话。

## Two Context Loading Modes（两种上下文加载模式）

### hook push（钩子推送）

平台 hook 在 agent 启动前注入任务上下文。agent 文件本身可以更专注于职责和边界。

常见于支持 agent hooks 的平台。

### agent pull（agent 拉取）

agent 文件指示 agent 在启动后读取：

- `python3 ./.trellis/scripts/task.py current --source`
- `implement.jsonl` 或 `check.jsonl`
- JSONL 引用的 spec/research 文件
- 当前任务的 `prd.md`
- `design.md`（如有）
- `implement.md`（如有）

此模式适用于 hooks 无法可靠地重写 sub-agent prompt 的平台。

## Local Change Scenarios（本地修改场景）

| User need（用户需求） | Edit location（编辑位置） |
| --- | --- |
| Implement agent 必须遵循额外限制 | 平台的 `trellis-implement` agent 文件。 |
| Check agent 必须运行项目特定命令 | `trellis-check` agent 文件，以及 `.trellis/spec/`（如需要）。 |
| Research agent 必须输出固定格式 | `trellis-research` agent 文件。 |
| Agent 无法读取任务上下文 | Agent 序言或 `inject-subagent-context` hook。 |
| 添加项目特定 agent | 平台 agent 目录 + 相关 workflow/command/skill 入口点。 |

## Modification Principles（修改原则）

1. **Keep responsibilities single-purpose（保持职责单一）**。不要将 research、implement 和 check 职责混入一个 agent。
2. **Specify the read order（指定读取顺序）**。Agent 必须知道从当前任务开始，读取 jsonl/spec 上下文，然后读取 `prd.md`、`design.md`（如有）和 `implement.md`（如有）。
3. **Specify write boundaries（指定写入边界）**。Research 通常只写入 `research/`；implement 可以写代码；check 可以修复问题。
4. **Keep semantics synchronized in multi-platform projects（多平台项目中保持语义同步）**。如果用户同时配置了 Claude、Codex 和 Cursor，请决定对某个平台 agent 的更改是否也需要应用到其他平台。

## Do Not Default To Editing Upstream Templates（不要默认编辑上游模板）

本地 AI 应默认修改用户项目内的平台 agent 文件。仅当用户明确希望将更改回馈给 Trellis 时，才讨论上游模板源。