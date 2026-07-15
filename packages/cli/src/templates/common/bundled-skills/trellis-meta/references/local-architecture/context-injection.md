# 本地上下文注入系统（Local Context Injection System）

Cviauto 上下文注入旨在让 AI 在恰当的时机读取恰当的文件，而非依赖模型记忆。在用户项目中，注入由 `.cviauto/` 脚本配合平台 hooks、agents 和 skills 共同实现。

## 注入的上下文类型（Injected Context Types）

| 类型 | 来源 | 用途 |
| --- | --- | --- |
| 会话上下文（session context） | `.cviauto/scripts/get_context.py` | 当前开发者、git 状态、活跃任务、活跃任务列表、日志、依赖包。 |
| 工作流上下文（workflow context） | `.cviauto/workflow.md` | 当前 Cviauto 流程和下一步动作。 |
| 规范上下文（spec context） | `.cviauto/spec/` + task JSONL | 在实现/检查过程中必须遵循的规范。 |
| 任务上下文（task context） | `.cviauto/tasks/<task>/prd.md`、`design.md`、`implement.md`、`research/` | 当前任务的需求、设计、执行计划和研究。 |
| 平台上下文（platform context） | 平台 hooks/设置/agents | 让不同 AI 工具通过各自的机制读取上述文件。 |

## session-start

支持 session-start 的平台会在会话启动、清空、压缩或收到类似事件时注入 Cviauto 概览。注入的内容通常包括：

- 工作流摘要。
- 当前任务状态。
- 活跃任务。
- spec 索引路径。
- 开发者身份和 git 状态。

如果用户发现在新会话中 AI 不知道当前任务，请首先检查平台的 session-start hook 或等效机制是否已安装并正在运行。

## workflow-state

workflow-state 是一个轻量级提示，在每次用户对话轮次前后注入。它根据当前任务状态，从 `.cviauto/workflow.md` 中选择一个状态块，例如 `no_task`、`planning`、`in_progress` 或 `completed`。

如果用户想更改「AI 在给定状态下接下来应该做什么」，请首先编辑 `.cviauto/workflow.md` 中对应的状态块。

## 子代理上下文（sub-agent context）

Implement 和 Check 代理需要任务上下文。Cviauto 有两种加载模式：

1. **hook push**：平台 hook 在代理启动前注入 jsonl 引用的文件，以及 `prd.md`、`design.md`（如果存在）和 `implement.md`（如果存在）。
2. **agent pull**：代理定义指示代理在启动后自行读取活跃任务、jsonl 上下文和任务产物。

在这两种模式下，任务目录中的 JSONL 文件是 spec/research 上下文的清单。任务产物按以下顺序单独读取：`prd.md` -> `design.md（如果存在）` -> `implement.md（如果存在）`。

## JSONL 读取规则（JSONL Reading Rules）

`implement.jsonl` 和 `check.jsonl` 每行包含一个 JSON 对象：

```jsonl
{"file": ".cviauto/spec/backend/index.md", "reason": "Backend rules"}
```

读取器应跳过没有 `file` 字段的种子行。在配置 JSONL 时，AI 应仅包含 spec/research 文件，不要预先注册将被修改的代码文件。

## 活跃任务与上下文键（Active Task And Context Key）

活跃任务状态存储在 `.cviauto/.runtime/sessions/` 中，按会话隔离。Hooks 尝试从平台事件、环境变量、对话记录路径或 `TRELLIS_CONTEXT_ID` 解析上下文键。

如果 shell 命令无法看到相同的上下文键，`task.py current --source` 可能会报告没有活跃任务。此时应检查平台是否将会话身份传递到 shell 中，而非手动编写全局 current-task 文件。

## 本地自定义点（Local Customization Points）

| 需求 | 编辑位置 |
| --- | --- |
| 更改 session-start 注入的内容 | 平台的 `session-start` hook 或插件文件。 |
| 更改每轮 workflow-state 规则 | `.cviauto/workflow.md` 中的 `[workflow-state:STATUS]` 块。平台的 workflow-state hook 逐字解析这些块，不嵌入任何回退文本。 |
| 更改子代理读取上下文的方式 | 平台代理定义、`inject-subagent-context` hook 或代理前置指令。 |
| 更改 JSONL 验证/显示 | `.cviauto/scripts/common/task_context.py`。 |
| 更改活跃任务解析 | `.cviauto/scripts/common/active_task.py`。 |

修改上下文注入时，请验证两件事：新会话能看到正确的任务，以及子代理能看到正确的任务产物/spec/research。