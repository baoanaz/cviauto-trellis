# 修改本地上下文加载

上下文加载决定了 AI 何时读取工作流、任务、规范（spec）、调研（research）、工作区（workspace）和 git 状态。当用户说"AI 不知道当前任务"、"代理没有读取规范"或"上下文太多/太少"时，请阅读本页。

## 先阅读这些文件

1. `.trellis/workflow.md`
2. `.trellis/scripts/get_context.py`
3. `.trellis/scripts/common/session_context.py`
4. `.trellis/scripts/common/task_context.py`
5. `.trellis/scripts/common/active_task.py`
6. 当前平台钩子或代理文件
7. 当前任务的 `implement.jsonl` / `check.jsonl`

## 上下文来源

| 来源 | 用途 |
| --- | --- |
| `.trellis/workflow.md` | 工作流和下一步提示。 |
| `.trellis/tasks/<task>/prd.md` | 当前任务需求。 |
| `.trellis/tasks/<task>/design.md` | 复杂任务的技术设计。 |
| `.trellis/tasks/<task>/implement.md` | 复杂任务的执行计划。 |
| `.trellis/tasks/<task>/implement.jsonl` | 实现前要读取的规范/调研。 |
| `.trellis/tasks/<task>/check.jsonl` | 检查期间要读取的规范/调研。 |
| `.trellis/spec/` | 项目规范。 |
| `.trellis/workspace/` | 会话记录。 |
| git status | 当前工作树变更。 |

## 常见需求与编辑点

| 需求 | 编辑点 |
| --- | --- |
| 在新会话中注入更多/更少信息 | `session_context.py` 或平台 `session-start` 钩子。 |
| 修改每次用户输入时的提示 | `.trellis/workflow.md` 中的 `[workflow-state:STATUS]` 块。`inject-workflow-state` 钩子是纯解析器，会逐字读取该块内容。 |
| 代理没有读取规范 | 任务 JSONL、代理 prelude、`inject-subagent-context` 钩子。 |
| 活动任务丢失 | `active_task.py` 和平台会话身份传播。 |
| 修改 JSONL 验证规则 | `task_context.py`。 |

## JSONL 规则

`implement.jsonl` / `check.jsonl` 是关键的上下文加载接口：

```jsonl
{"file": ".trellis/spec/backend/index.md", "reason": "后端约定"}
{"file": ".trellis/tasks/04-28-x/research/api.md", "reason": "API 调研"}
```

仅包含规范/调研文件。不要将将要修改的代码文件放入这些清单中；代理在实现期间会自行读取代码文件。

## 修改会话上下文

如果用户希望每个新会话都能看到更多项目状态，请编辑：

- `.trellis/scripts/common/session_context.py`
- 相应的平台 `session-start` 钩子

上下文不能无限制增长。优先注入索引和路径，使 AI 可以按需读取详细文件。

## 修改子代理上下文

首先确定平台使用哪种模式：

- 钩子推送（hook push）：编辑 `inject-subagent-context` 钩子。
- 代理拉取（agent pull）：编辑对应 `trellis-implement` / `trellis-check` 代理文件中的读取步骤。

两种模式下，确保代理最终读取：

1. 活动任务
2. 对应的 JSONL
3. JSONL 引用的规范/调研
4. `prd.md`
5. `design.md`（如果存在）
6. `implement.md`（如果存在）

## 排查顺序

```bash
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py list-context <task>
python3 ./.trellis/scripts/task.py validate <task>
python3 ./.trellis/scripts/get_context.py --mode packages
```

在编辑钩子/代理之前，先确认任务和 JSONL 是正确的。