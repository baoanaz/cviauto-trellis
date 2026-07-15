# 本地 Cviauto 架构概述

`cviauto-meta` 面向已运行过 `cviauto init` 的用户项目。用户机器通常只有通过 npm 安装的 `cviauto` 命令以及项目中生成的 Cviauto 文件；可能没有 Cviauto CLI 源码。

因此，当 AI 使用此技能时，默认的自定义目标是用户项目中的本地文件：

- `.cviauto/`：工作流、任务、spec、记忆、脚本和运行时状态。
- 平台目录：`.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.kiro/`、`.gemini/`、`.qoder/`、`.codebuddy/`、`.github/`、`.factory/`、`.pi/`、`.kilocode/`、`.agent/`、`.devin/`、`.reasonix/`、`.zcode/` 及类似目录。
- 共享技能层：`.agents/skills/`。

不要默认引导用户 fork Cviauto CLI 仓库。仅当用户明确说要更改 Cviauto 上游源码、发布 npm 包或提交 PR 时，才将上游源码视为操作目标。

## 本地系统模型

Cviauto 在用户项目内提供三层：

1. **工作流层**：`.cviauto/workflow.md` 定义阶段、路由、下一步操作和 prompt 块。
2. **持久化层**：`.cviauto/tasks/`、`.cviauto/spec/` 和 `.cviauto/workspace/` 存储任务、spec 和会话记忆。
3. **平台集成层**：平台目录中的 hooks、settings、agents、skills、commands、prompts 和 workflows 将 Cviauto 工作流连接到不同的 AI 工具。

所有三层都位于用户项目内，因此 AI 可以直接读取和修改它们。

## 核心路径

| 路径 | 用途 |
| --- | --- |
| `.cviauto/workflow.md` | 工作流阶段、技能路由和工作流状态 prompt 块。 |
| `.cviauto/config.yaml` | 项目配置、任务生命周期 hooks、monorepo 包配置和日志配置。 |
| `.cviauto/spec/` | 用户的项目特定编码规范和思维指南。 |
| `.cviauto/tasks/` | 每个任务的 PRD、技术笔记、研究文件和 JSONL 上下文。 |
| `.cviauto/workspace/` | 每个开发者的日志和跨会话记忆。 |
| `.cviauto/scripts/` | 由命令、hooks 和上下文注入使用的本地 Python 运行时。 |
| `.cviauto/.runtime/` | 会话级运行时状态，如当前任务指针。 |
| `.cviauto/.template-hashes.json` | Cviauto 管理文件的模板哈希值，由 update 用于判断本地文件是否被用户修改。 |

## AI 自定义原则

1. **首先找到本地唯一权威来源**：不要凭记忆编辑。先读取 `.cviauto/workflow.md`、`.cviauto/config.yaml`、相关的平台目录和相关任务文件。
2. **编辑用户项目，而非 npm 包缓存**：修改项目内生成的文件，而非 `node_modules` 或全局 npm 安装目录。
3. **保持平台文件与 `.cviauto/` 一致**：如果工作流路由发生变化，同时检查平台技能或命令是否仍描述相同的流程。
4. **将项目特定规则放入 `.cviauto/spec/` 或本地技能**：不要将团队约定放入 `cviauto-meta`。
5. **保留用户更改**：如果文件已在本地被修改，以当前内容为基准工作，而非用默认模板覆盖。

## 如何使用本目录

- 要了解 init 后存在哪些文件，阅读 `generated-files.md`。
- 要更改阶段、路由或下一步操作，阅读 `workflow.md`。
- 要更改任务模型、JSONL 上下文或活动任务行为，阅读 `task-system.md`。
- 要更改编码规范注入，阅读 `spec-system.md`。
- 要了解日志和跨会话记忆，阅读 `workspace-memory.md`。
- 要更改 hooks 或 sub-agent 上下文加载，阅读 `context-injection.md`。