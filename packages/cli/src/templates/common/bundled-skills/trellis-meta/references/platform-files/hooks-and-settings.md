# Hooks And Settings（钩子与设置）

Hooks/settings 是将平台连接到 Cviauto 的入口层。它们决定平台在哪些事件上运行哪些脚本、插件或扩展。

## Settings Responsibilities（Settings 的职责）

settings/config 文件通常注册：

- session-start hook（会话启动钩子）：在新会话启动或上下文重置时注入 Cviauto 概览。
- workflow-state hook（工作流状态钩子）：解析 `.cviauto/workflow.md` 中的 `[workflow-state:STATUS]` 块，在每次用户输入时输出与当前任务 `status` 匹配的正文。仅做解析；脚本不嵌入回退内容。
- sub-agent context hook（子代理上下文钩子）：在 implementation/check/research agent 启动时注入任务上下文。
- shell/session bridge（shell/会话桥接）：让 shell 命令看到相同的 Cviauto 会话身份。
- platform plugin or extension entry points（平台插件或扩展入口点）。

常见文件：

| Platform（平台） | settings/config（设置/配置） |
| --- | --- |
| Claude Code | `.claude/settings.json` |
| Cursor | `.cursor/hooks.json` |
| Codex | `.codex/hooks.json`, `.codex/config.toml` |
| OpenCode | `.opencode/package.json`, `.opencode/plugins/*` |
| Kiro | `.kiro/hooks/` + platform config |
| Gemini CLI | `.gemini/settings.json` |
| Qoder | `.qoder/settings.json` |
| CodeBuddy | `.codebuddy/settings.json` |
| GitHub Copilot | `.github/copilot/hooks.json` |
| Factory Droid | `.factory/settings.json` |
| Pi Agent | `.pi/settings.json`, `.pi/extensions/cviauto/` |

Reasonix 和 ZCode 是拉取模式平台，不使用 hooks 或 settings 文件；它们的 agent 文件包含启动后读取上下文的序言指令。

这些文件是否存在于项目中，取决于用户运行了哪些 `cviauto init --<platform>` 标志。

## Hook Script Types（Hook 脚本类型）

| Script（脚本） | Purpose（用途） |
| --- | --- |
| `session-start.py` | 生成会话启动上下文。 |
| `inject-workflow-state.py` | 解析 `.cviauto/workflow.md` 中的 `[workflow-state:STATUS]` 块，输出与当前任务状态匹配的正文。当没有匹配块时，回退到 `Refer to workflow.md for current step.`。 |
| `inject-subagent-context.py` | 将 PRD、JSONL 上下文及相关 spec/research 注入 sub-agent。 |
| `inject-shell-session-context.py` | 让 shell 命令继承 Cviauto 会话身份。 |

并非每个平台都有所有 hook。不要因为某个平台缺少 hook 就从其他平台复制文件；先确认该平台是否支持相应的事件。

## Local Change Scenarios（本地修改场景）

| User need（用户需求） | Edit location（编辑位置） |
| --- | --- |
| AI 在新会话中应看到更多/更少上下文 | 平台 `session-start` hook。 |
| 每轮提示策略应更改 | `.cviauto/workflow.md` 中的 `[workflow-state:STATUS]` 块。hook 逐字解析 workflow.md — 无需编辑脚本。 |
| Sub-agent 无法读取 PRD/spec | `inject-subagent-context` hook 或 agent 序言。 |
| shell 中 `task.py current` 无当前任务 | Shell/session bridge hook 或平台环境变量配置。 |
| 禁用自动注入 | settings/config 中对应的 hook 注册。 |

## Modification Principles（修改原则）

1. **Settings wire things up; hooks define behavior（Settings 负责接线；hooks 定义行为）**。如果只改了 hook，平台可能根本不会调用它。如果只改了 settings，行为可能不会改变。
2. **Confirm platform event names first（先确认平台事件名称）**。不同平台对 SessionStart、UserPromptSubmit、AgentSpawn、shell 执行及类似事件使用不同的名称。
3. **Hooks read local `.cviauto/`, not upstream source（Hooks 读取本地 `.cviauto/`，而非上游源）**。用户项目中的 `.cviauto/scripts/` 和 `.cviauto/workflow.md` 是默认目标。
4. **Errors must be visible（错误必须可见）**。Hook 失败时应告知用户什么没有被注入，而不是静默地让 AI 缺少上下文。

## Troubleshooting Path（排查路径）

如果用户说"AI 没有读取 Cviauto 状态"：

1. 检查平台 settings 是否注册了该 hook。
2. 检查 hook 文件是否存在。
3. 手动运行该 hook 依赖的 `.cviauto/scripts/get_context.py` 或 `task.py current --source` 命令。
4. 检查 `.cviauto/.runtime/sessions/` 中是否存在当前任务状态。
5. 检查平台 shell 是否传递了会话身份。