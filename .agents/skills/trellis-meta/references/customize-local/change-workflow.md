# 修改本地工作流

当用户想要修改 Trellis 阶段、下一步提示、是否创建任务、是否使用子代理，或何时检查/收尾时，首先编辑 `.trellis/workflow.md`。

## 先阅读这些文件

1. `.trellis/workflow.md`
2. 当前平台的入口文件，如 skills/commands/prompts/workflows
3. 当前任务的 `task.json` 和 `prd.md`

## 常见需求与编辑点

| 需求 | 编辑点 |
| --- | --- |
| 修改阶段名称或阶段顺序 | `Phase Index` 及对应的 Phase 章节。 |
| 修改无任务时是否创建任务 | `[workflow-state:no_task]` 状态块。 |
| 修改规划期间的下一步 | Phase 1 和 `[workflow-state:planning]`。 |
| 修改 in_progress 期间是否需要代理 | Phase 2 和 `[workflow-state:in_progress]`。 |
| 修改完成后的收尾 | Phase 3 和 `[workflow-state:completed]`。 |
| 修改用户意图触发哪个 skill | `Skill Routing` 表格。 |

## 修改步骤

1. 在 `.trellis/workflow.md` 中找到相关章节。
2. 修改规则时，保留明确的触发条件和下一步操作。
3. 如果添加或重命名 skill/agent，同步更新平台目录中的对应文件。
4. 工作流状态变更只需编辑 `.trellis/workflow.md` 中的 `[workflow-state:STATUS]` 块。钩子是纯解析器——它会读取你在块中放入的任何内容。保持开始和结束标签的 STATUS 字符串一致（`[workflow-state:foo]…[/workflow-state:foo]`）；不匹配的 STATUS 对会被静默丢弃。
5. 让 AI 重新读取 `.trellis/workflow.md`；不要继续使用旧对话中的规则。

## 示例：放宽任务创建要求

要修改可以跳过任务创建的情形，通常编辑 `[workflow-state:no_task]`：

```md
[workflow-state:no_task]
当答案是单次回复说明、不涉及文件变更且无需调研时，不需要创建任务。
[/workflow-state:no_task]
```

如果正式的 Phase 1 流程也需要变更，同步修改 Phase 1 章节。

## 示例：某个平台不使用子代理

如果用户只想让某个平台避免使用子代理，首先确认该平台在工作流中是否有独立的分组。然后修改该平台分组的 Phase 2 路由，而不是跨平台删除所有 `trellis-implement` / `trellis-check` 指令。

## `/trellis:continue` 路由表

`/trellis:continue` 通过决定下一步加载哪个阶段步骤来恢复任务。决策结合了 `task.json.status` 与任务目录中工件（artifact）的存在情况。映射关系在命令本身中固定；添加自定义状态的 fork 必须同时扩展 workflow.md 标签块和此路由表。

| `status` | 工件状态 | 恢复到 |
| --- | --- | --- |
| `planning` | `prd.md` 缺失 | Phase 1.1（加载 `trellis-brainstorm`） |
| `planning` | 轻量任务且 `prd.md` 已完成 | 询问开始审查，然后运行 `task.py start` |
| `planning` | 复杂任务缺少 `design.md` 或 `implement.md` | 补全缺失的规划工件 |
| `planning` | 复杂任务包含 `prd.md`、`design.md` 和 `implement.md` | 询问开始审查，然后运行 `task.py start` |
| `in_progress` | 对话历史中无实现记录 | Phase 2.1（`trellis-implement`） |
| `in_progress` | 实现已完成，未运行 `trellis-check` | Phase 2.2（`trellis-check`） |
| `in_progress` | 检查已通过，无显式的 spec 提升请求 | Phase 3.4（commit） |
| `in_progress` | 检查已通过，用户显式要求将知识提升到 spec | Phase 3.3（spec 更新提案）→ 3.4（commit） |
| `completed` | 任务仍在活动树中 | Phase 3.5（运行 `/trellis:finish-work` 进行归档） |

当你添加自定义状态（如 `in-review`）时，在 `.trellis/workflow.md` 中为每轮面包屑导航添加 `[workflow-state:in-review]` 块，并扩展此路由表——通常通过编辑 `/trellis:continue` 命令文件（`{platform}/commands/trellis/continue.md` 或等效文件）来添加一行，决定从何处恢复。没有路由条目时，`/trellis:continue` 会落入默认分支，用户将无法到达你预期的步骤。

## 注意事项

`.trellis/workflow.md` 是本地项目工作流，而非不可变的模板。用户可以根据团队习惯进行调整。编辑后，平台入口文件可能仍包含旧描述，因此也需要检查它们。