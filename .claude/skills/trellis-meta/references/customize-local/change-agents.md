# 修改本地 Agents

当用户想更改 `trellis-research`、`trellis-implement` 或 `trellis-check` 的行为时，编辑用户项目中的平台 agent 文件。

## 先阅读这些文件

1. 目标平台的 agent 目录
2. `.trellis/workflow.md` Phase 2 / research 路由
3. 当前 task 的 `prd.md`
4. 当前 task 的 `implement.jsonl` / `check.jsonl`
5. 相关的 hook 或 agent 前置部分

## 常见路径

| 平台 | 路径 |
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

以用户项目中的实际路径为准。

## 常见需求

| 需求 | 应编辑哪个 agent |
| --- | --- |
| Research 必须写入文件，而不能仅在聊天中回复 | `trellis-research` |
| 实现前必须读取某些本地 spec | `trellis-implement` + `implement.jsonl` 配置规则 |
| 检查阶段必须运行特定命令 | `trellis-check` |
| Agent 不得修改某些目录 | 对应 agent 的写入边界指令 |
| Agent 输出格式必须固定 | 对应 agent 的最终/报告指令 |

## 修改原则

1. **保持角色边界**：research 负责调研并持久化；implement 负责编写实现；check 负责审查和修复。
2. **不要在 agent 中硬编码项目 spec**：长期 spec 应放在 `.trellis/spec/` 中；agent 负责读取它们。
3. **明确读取顺序**：active task -> PRD -> info -> JSONL -> spec/research。
4. **明确写入边界**：哪些目录可写、哪些不可写。
5. **跨平台同步**：当用户配置了多个平台时，决定是仅修改当前平台还是修改所有平台的 agent。

## Agent Pull（拉取）平台

如果 agent 文件中包含「启动后读取 task/context」的前置步骤，编辑时不要删除这些步骤。否则 agent 将仅依赖聊天上下文工作，绕过 Trellis 的核心机制。

## Hook Push（推送）平台

如果上下文由 hook 注入，agent 文件仍应保留职责边界。不要因为 hook 注入了上下文就从 agent 中移除 PRD/spec 要求。