# 修改本地任务生命周期

任务生命周期包括创建、启动、上下文配置、完成、归档、父子任务以及生命周期钩子。默认的自定义目标是 `.cviauto/tasks/`、`.cviauto/config.yaml` 和 `.cviauto/scripts/`。

## 先阅读这些文件

1. `.cviauto/workflow.md`
2. `.cviauto/config.yaml`
3. `.cviauto/scripts/task.py`
4. `.cviauto/scripts/common/task_store.py`
5. `.cviauto/scripts/common/task_utils.py`
6. 当前任务的 `.cviauto/tasks/<task>/task.json`

## 常见需求与编辑点

| 需求 | 编辑点 |
| --- | --- |
| 任务创建后自动同步外部系统 | `.cviauto/config.yaml` 中的 `hooks.after_create`。 |
| 任务启动后自动更新状态 | `.cviauto/config.yaml` 中的 `hooks.after_start`。 |
| 任务完成后运行脚本 | `.cviauto/config.yaml` 中的 `hooks.after_finish`。 |
| 归档后清理外部资源 | `.cviauto/config.yaml` 中的 `hooks.after_archive`。 |
| 修改默认任务字段 | `.cviauto/scripts/common/task_store.py`。 |
| 修改任务解析/搜索 | `.cviauto/scripts/common/task_utils.py`。 |
| 修改活动任务行为 | `.cviauto/scripts/common/active_task.py`。 |

## 生命周期钩子

`.cviauto/config.yaml` 支持：

```yaml
hooks:
  after_create:
    - "python3 .cviauto/scripts/hooks/my_sync.py create"
  after_start:
    - "python3 .cviauto/scripts/hooks/my_sync.py start"
  after_finish:
    - "python3 .cviauto/scripts/hooks/my_sync.py finish"
  after_archive:
    - "python3 .cviauto/scripts/hooks/my_sync.py archive"
```

钩子命令接收 `TASK_JSON_PATH` 环境变量，指向当前任务的 `task.json`。钩子失败通常应发出警告，但不应阻塞主任务操作。

## 修改任务字段

如果用户想要添加项目本地字段，建议将其放在 `task.json` 的 `meta` 下，以避免破坏现有脚本对标准字段的假设。

示例：

```json
"meta": {
  "linearIssue": "ENG-123",
  "risk": "high"
}
```

如果确实需要修改标准字段，请检查所有读取 `task.json` 的本地脚本。

## 修改活动任务

活动任务是存储在 `.cviauto/.runtime/sessions/` 中的会话级状态。不要回退到全局 `.current-task` 模型。如果用户想要修改活动任务行为，请编辑：

- `.cviauto/scripts/common/active_task.py`
- 平台钩子或 shell 会话桥接
- `.cviauto/workflow.md` 中的活动任务描述

### `task.py create` 设置活动指针

`.cviauto/scripts/common/task_store.py` 中的 `cmd_create` 在写入新任务目录后立即尽最大努力（best-effort）调用 `set_active_task`。其行为如下：

- 当调用 shell 携带会话身份标识（`TRELLIS_CONTEXT_ID` 环境变量，或 `resolve_context_key` 能识别的任何平台特定会话环境变量——参见 `active_task.py:_ENV_SESSION_KEYS`）时，`.cviauto/.runtime/sessions/<context_key>.json` 中的按会话指针会被重写为指向新任务。任务 `status=planning`，且 `[workflow-state:planning]` 会在紧接着的 `UserPromptSubmit` 时触发。
- 当会话身份不可用时（AI 会话之外的原始 CLI 调用，或不传播身份到 shell 的平台），任务目录仍会被创建，`status=planning` 仍会被写入，但活动指针保持不变。用户可以在回到 AI 会话后通过 `task.py start <dir>` 附加该任务。

这使得 `[workflow-state:planning]` 成为 `task.py create` 之后的头脑风暴和 JSONL 整理工作中的实时面包屑导航。R7 之前的行为会将面包屑卡在 `no_task` 直到 `task.py start`，因此 planning 块实际上是一段死文本。

如果你 fork `task.py` 添加新的创建路径（例如绕过 `cmd_create` 的外部导入），请检查你的路径是否也调用了 `set_active_task`。没有该调用，你创建的任务将不会作为活动任务出现。完整的状态写入表位于 `.cviauto/spec/cli/backend/workflow-state-contract.md`。

## 修改步骤

1. 使用 `python3 ./.cviauto/scripts/task.py current --source` 确认当前任务。
2. 读取当前任务的 `task.json` 并确认状态和字段。
3. 对于配置需求，首先编辑 `.cviauto/config.yaml`。
4. 对于脚本行为需求，然后编辑 `.cviauto/scripts/`。
5. 如果 AI 流程发生变化，同步更新 `.cviauto/workflow.md`。

## 不要做的事

- 不要直接编辑 `.cviauto/.runtime/sessions/` 来"修复"业务状态。
- 不要将项目私有字段硬编码到脚本中；优先使用 `meta`。
- 不要默认让用户 fork Cviauto CLI。