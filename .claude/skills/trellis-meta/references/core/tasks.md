# 任务系统（Task System）

基于阶段执行跟踪工作项。

---

## 目录结构

```
.trellis/tasks/
├── {MM-DD-slug}/               # 活动任务目录
│   ├── task.json               # 元数据、阶段、分支
│   ├── prd.md                  # 需求文档
│   ├── design.md               # 复杂任务的技术设计
│   ├── implement.md            # 复杂任务的执行计划
│   ├── implement.jsonl         # 实现阶段的上下文
│   ├── check.jsonl             # 检查阶段的上下文
│   └── debug.jsonl             # 调试阶段的上下文
│
└── archive/                    # 已完成任务
    └── {YYYY-MM}/
        └── {task-dir}/
```

---

## 任务目录命名

格式：`{MM-DD}-{slug}`

示例：
- `01-31-add-login`
- `02-01-fix-api-bug`

---

## task.json

任务元数据与工作流配置。

```json
{
  "id": "add-login",
  "name": "add-login",
  "title": "Add user login",
  "description": "",
  "status": "planning",
  "dev_type": null,
  "scope": null,
  "priority": "P2",
  "creator": "taosu",
  "assignee": "taosu",
  "createdAt": "2026-01-31",
  "completedAt": null,
  "branch": null,
  "base_branch": "main",
  "worktree_path": null,
  "current_phase": 0,
  "next_action": [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "check"},
    {"phase": 3, "action": "finish"},
    {"phase": 4, "action": "create-pr"}
  ],
  "commit": null,
  "pr_url": null,
  "subtasks": [],
  "children": [],
  "parent": null,
  "relatedFiles": [],
  "notes": "",
  "meta": {}
}
```

### 字段

| 字段 | 类型 | 说明 |
|-------|------|-------------|
| `id` | string | Slug 标识符 |
| `name` | string | Slug 标识符（与 id 相同） |
| `title` | string | 人类可读的任务标题 |
| `description` | string | 任务描述 |
| `status` | string | `planning`、`in_progress`、`completed`、`rejected` |
| `dev_type` | string\|null | `frontend`、`backend`、`fullstack`、`test`、`docs` |
| `scope` | string\|null | PR 标题的 scope |
| `priority` | string | `P0`、`P1`、`P2`、`P3` |
| `creator` | string | 创建任务的开发者 |
| `assignee` | string | 被分配任务的开发者 |
| `createdAt` | string | 创建日期（YYYY-MM-DD） |
| `completedAt` | string\|null | 完成日期 |
| `branch` | string\|null | Git 分支名称 |
| `base_branch` | string | 合并目标分支 |
| `worktree_path` | string\|null | Git worktree 路径（多智能体） |
| `current_phase` | number | 当前工作流阶段 |
| `next_action` | array | 工作流阶段列表 |
| `commit` | string\|null | 提交哈希 |
| `pr_url` | string\|null | Pull Request URL |
| `subtasks` | array | 已废弃（旧版引导格式） |
| `children` | string[] | 子任务目录名称列表 |
| `parent` | string\|null | 父任务目录名称 |
| `relatedFiles` | string[] | 相关文件路径 |
| `notes` | string | 自由文本备注 |
| `meta` | object | 可扩展的集成元数据（如 `linear_id`、`jira_ticket`） |

---

## prd.md

任务的需求文档。

```markdown
# Add User Login

## Goal
Implement user authentication with email/password.

## Requirements
- Login form with email and password fields
- Form validation
- API endpoint for authentication

## Acceptance Criteria
- [ ] User can log in with valid credentials
- [ ] Error shown for invalid credentials

## Research References
- Link to relevant research/spec notes
```

---

## JSONL 上下文文件

列出每个阶段要注入为上下文的文件。

### 格式

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "Backend guidelines"}
{"file": "src/services/auth.ts", "reason": "Existing auth service"}
{"file": ".trellis/tasks/01-31-add-login/prd.md", "reason": "Requirements"}
```

### 文件

| 文件 | 阶段 | 用途 |
|------|-------|---------|
| `implement.jsonl` | implement | 开发规范、需遵循的模式 |
| `check.jsonl` | check | 质量标准、审查规范 |
| `debug.jsonl` | debug | 调试上下文、错误报告 |

---

## 会话范围的活动任务

### `.trellis/.runtime/sessions/<session-key>.json`

存储单个 AI 会话/窗口的活动任务。

```json
{
  "current_task": ".trellis/tasks/01-31-add-login"
}
```

### 设置活动任务

```bash
python3 .trellis/scripts/task.py start <task-dir>
```

### 清除当前任务

```bash
python3 .trellis/scripts/task.py finish
```

---

## 任务 CLI

### 创建任务

```bash
python3 .trellis/scripts/task.py create "Task name" --slug task-slug
python3 .trellis/scripts/task.py create "Child task" --slug child --parent <parent-dir>
```

选项：`--assignee <name>`、`--priority P0|P1|P2|P3`、`--description "text"`、`--parent <dir>`

### 列出任务

```bash
python3 .trellis/scripts/task.py list
python3 .trellis/scripts/task.py list --mine
python3 .trellis/scripts/task.py list --status planning
```

有父任务的条目会缩进显示在父任务下方。
父任务显示子任务进度：`(planning) [2/3 done]`。

### 开始任务

```bash
python3 .trellis/scripts/task.py start <task-dir>
```

### 完成（清除当前任务）

```bash
python3 .trellis/scripts/task.py finish
```

### 初始化上下文

```bash
python3 .trellis/scripts/task.py init-context <task-dir> <dev-type>
```

开发类型：`frontend`、`backend`、`fullstack`、`test`、`docs`

### 添加子任务

```bash
python3 .trellis/scripts/task.py add-subtask <parent-dir> <child-dir>
```

将已有任务链接为另一个任务的子任务。如果子任务已有父任务则报错。

### 移除子任务

```bash
python3 .trellis/scripts/task.py remove-subtask <parent-dir> <child-dir>
```

移除两个任务之间的父子链接。

### 归档任务

```bash
python3 .trellis/scripts/task.py archive <task-dir>
```

归档子任务时，子任务名称仍保留在父任务的 `children` 列表中。该列表为历史记录，以便已完成子任务移入 `archive/` 后父任务进度保持稳定。

归档父任务时，活动子任务保留在原位并保留其自身任务数据。请勿将归档父任务作为完成或审查其子任务交付物的替代手段。

### 其他命令

```bash
python3 .trellis/scripts/task.py set-branch <dir> <branch>
python3 .trellis/scripts/task.py set-base-branch <dir> <branch>
python3 .trellis/scripts/task.py set-scope <dir> <scope>
python3 .trellis/scripts/task.py add-context <dir> <jsonl> <path> [reason]
python3 .trellis/scripts/task.py validate <dir>
python3 .trellis/scripts/task.py list-context <dir>
python3 .trellis/scripts/task.py list-archive [month]
python3 .trellis/scripts/task.py create-pr [dir] [--dry-run]
```

---

## get_context.py

显示会话运行时，包含任务信息。

```bash
python3 .trellis/scripts/get_context.py                      # 默认文本（完整上下文）
python3 .trellis/scripts/get_context.py --json                # 默认 JSON
python3 .trellis/scripts/get_context.py --mode record         # 记录文本（聚焦我的任务）
python3 .trellis/scripts/get_context.py --mode record --json  # 记录 JSON
```

`--mode` 控制内容范围，`--json` 控制输出格式。可以组合使用。

---

## 工作流阶段

标准阶段推进：

```
1. implement  →  编写代码
2. check      →  审查与修复
3. finish     →  最终验证
4. create-pr  →  创建 Pull Request（仅多智能体模式）
```

### 自定义阶段

修改 task.json 中的 `next_action`：

```json
"next_action": [
  {"phase": 1, "action": "research"},
  {"phase": 2, "action": "implement"},
  {"phase": 3, "action": "check"}
]
```

---

## 最佳实践

1. **会话本地聚焦** - 在每个 AI 会话/窗口中使用 `task.py start`
2. **清晰的 PRD** - 编写具体、可测试的需求
3. **相关上下文** - 只在 JSONL 中包含需要的文件
4. **归档已完成任务** - 保持任务目录整洁
5. **使用子任务** - 将复杂任务拆分为可独立验证的子任务；在子任务产物中写明依赖顺序，而不仅仅依赖树形结构