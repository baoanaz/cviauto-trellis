# 本地工作流系统

`.trellis/workflow.md` 是用户项目内的 Trellis 工作流权威来源。AI 不需要 Trellis 源码就能理解当前项目应如何推进任务；有此文件足矣。

## 文件职责

`.trellis/workflow.md` 有三个职责：

1. **解释工作流阶段**：Plan、Execute、Finish。
2. **定义 skill 路由**：当用户表达某种意图时，AI 应使用哪个 skill 或 Agent。
3. **提供工作流状态 prompt 块**：hooks 可以将当前状态的 prompt 块注入对话。

## 当前阶段模型

```text
阶段 1：Plan    -> 明确构建内容，产出 prd.md 和所需研究
阶段 2：Execute -> 根据 PRD 和 spec 实现，然后检查
阶段 3：Finish  -> 最终验证，保存经验，收尾
```

每个阶段包含编号步骤，如 `1.3 Configure context`。这些编号不是 `task.json` 中的运行时字段；它们是供 AI 和人类阅读的工作流结构。

## Skill 路由

`workflow.md` 按平台能力分离路由：

- 支持 sub-agent 的平台：默认分派 `trellis-implement` 进行实现，`trellis-check` 进行检查。
- 不支持 sub-agent 的平台：主会话阅读 `trellis-before-dev` 等 skill，然后直接执行。

当改变本地 AI 行为时，首先更新 `workflow.md` 中的路由描述，然后检查相应的平台 skill、command 或 Agent 文件是否需要保持同步。

## 工作流状态 Prompt 块

`workflow.md` 底部可以包含如下状态块：

```text
[workflow-state:no_task]
...
[/workflow-state:no_task]
```

Hooks 根据当前任务状态选择正确的块并注入到对话中。常见状态包括：

| 状态 | 含义 |
| --- | --- |
| `no_task` | 当前会话没有活动任务。 |
| `planning` | 任务仍在需求、研究或上下文配置阶段。 |
| `in_progress` | 任务已进入实现和检查阶段。 |
| `completed` | 任务已完成，等待收尾或归档。 |

如果用户想更改诸如"没有任务时是否创建任务"、"何时可以跳过任务创建"或"是否需要 sub-agent"等策略，编辑这些状态块及其上方的路由表。

## 本地修改模式

常见变更：

| 目标 | 编辑点 |
| --- | --- |
| 添加阶段 | 更新阶段索引、阶段正文、路由和状态块。 |
| 更改任务创建策略 | 更新 `no_task` 状态块和阶段 1 描述。 |
| 更改默认实现/检查路径 | 更新阶段 2 和 skill 路由。 |
| 更改收尾流程 | 更新阶段 3 和 `finish-work` 相关描述。注意当前拆分：阶段 3.3 = 可选的人工门禁 spec 推广，阶段 3.4 = AI 驱动的工作提交（批量，用户确认），阶段 3.5 = `/finish-work`（本地归档 + 会话日志）。如果有未提交的任务代码，`/finish-work` 拒绝运行。 |
| 更改平台差异 | 更新按平台分组的路由描述。 |

编辑后，让 AI 重新读取 `.trellis/workflow.md`；不要假设旧对话中的流程仍然有效。

## 与平台文件的关系

`workflow.md` 是本地工作流的语义中心，但每个平台也可以有自己的入口文件：

- skills，如 `trellis-brainstorm` 和 `trellis-check`。
- commands/prompts/workflows，如 continue 和 finish-work。
- hooks，如 session-start 或 workflow-state 注入。

如果只改了 `workflow.md`，平台入口文件可能仍然包含旧的语言。当用户想要改变"AI 实际做什么"时，也要检查相关平台目录。