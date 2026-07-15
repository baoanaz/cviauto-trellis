# Platform Files Overview（平台文件概览）

Cviauto 将同一套本地架构连接到不同的 AI 工具。`.cviauto/` 存放共享运行时；platform 目录存放适配器文件，定义每个 AI 工具如何进入 Cviauto。

当本地 AI 修改 Cviauto 时，应首先区分两类文件：

- **Shared files（共享文件）**：`.cviauto/workflow.md`、`.cviauto/tasks/`、`.cviauto/spec/`、`.cviauto/scripts/`。
- **Platform files（平台文件）**：`.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.kiro/`、`.gemini/`、`.qoder/`、`.codebuddy/`、`.github/`、`.factory/`、`.pi/`、`.kilocode/`、`.agent/`、`.devin/`、`.reasonix/`、`.zcode/` 以及类似目录。

平台文件不存储业务状态。它们让对应的 AI 工具能够读取 Cviauto 状态、调用 Cviauto 脚本，并加载 Cviauto skills/agents/hooks。

## Platform File Categories（平台文件分类）

| Category（类别） | Common paths（常见路径） | Purpose（用途） |
| --- | --- | --- |
| settings/config（设置/配置） | `.claude/settings.json`、`.codex/hooks.json`、`.qoder/settings.json` | 注册 hooks、plugins、extensions 或平台行为。 |
| hooks/plugins/extensions（钩子/插件/扩展） | `.claude/hooks/`、`.opencode/plugins/`、`.pi/extensions/` | 在会话启动、用户输入、agent 启动、shell 执行等事件时注入上下文。 |
| agents（代理） | `.claude/agents/`、`.codex/agents/`、`.kiro/agents/` | 定义 `cviauto-research`、`cviauto-implement` 和 `cviauto-check`。 |
| skills（技能） | `.claude/skills/`、`.agents/skills/`、`.qoder/skills/` | 能力描述，可自动触发或按需读取。 |
| commands/prompts/workflows（命令/提示/工作流） | `.cursor/commands/`、`.github/prompts/`、`.devin/workflows/` | 用户显式调用的入口点。 |

## Three Platform Integration Modes（三种平台集成模式）

### 1. Hook / Extension Driven（钩子/扩展驱动）

这些平台可以在特定事件上触发脚本或插件，并主动将 Cviauto 上下文注入 AI。

常见能力：

- 会话启动时注入 `.cviauto/` 概览。
- 每次用户对话轮次的工作流状态提示。
- sub-agent 启动时注入 PRD/spec/research。
- Shell 命令继承会话身份。

要改变"AI 何时知道什么"，请先检查 hooks/plugins/extensions 和 settings。

### 2. Agent Prelude / Pull-Based（Agent 序言 / 拉取模式）

某些平台无法可靠地让 hooks 重写 sub-agent 的 prompt，因此 agent 文件本身会指示 agent 在启动后读取当前任务、PRD 和 JSONL 上下文。

要改变 sub-agent 加载上下文的方式，请检查 agent 文件本身。

### 3. Main-Session Workflow（主会话工作流）

某些平台没有 Cviauto sub-agent 或 hook 能力。它们依赖 workflows/skills/commands 来引导主会话 AI 读取文件、运行脚本和推进任务。

要改变行为，请检查平台 workflows/skills/commands 和 `.cviauto/workflow.md`。

## Local Modification Order（本地修改顺序）

当用户要求为某个平台自定义行为时，AI 应按以下顺序检查文件：

1. 读取 `.cviauto/workflow.md` 确认共享流程。
2. 读取目标平台的 settings/config 查看注册了哪些 hooks/agents/skills/commands。
3. 读取目标平台的 agents/skills/commands/hooks。
4. 修改最贴近用户需求的本地文件。
5. 如果改动影响共享流程，同步更新 `.cviauto/workflow.md` 或 `.cviauto/spec/`。

不要只修改平台文件而忘记共享工作流。不要只修改 `.cviauto/workflow.md` 而忘记平台入口点可能仍包含旧描述。