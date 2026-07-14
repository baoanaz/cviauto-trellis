# 核心脚本（Core Scripts）

Trellis 自动化所需的跨平台 Python 脚本。

---

## 概述

这些脚本在所有平台上均可运行——仅读写文件，不依赖 Claude Code 的 hook 系统。

```
.trellis/scripts/
├── common/                 # 共享工具
│   ├── paths.py
│   ├── developer.py
│   ├── task_utils.py
│   ├── phase.py
│   └── git_context.py
│
├── init_developer.py       # 初始化开发者
├── get_developer.py        # 获取开发者名称
├── get_context.py          # 获取会话运行时
├── task.py                 # 任务管理 CLI
└── add_session.py          # 记录会话
```

---

## 开发者脚本

### `init_developer.py`

初始化开发者身份。

```bash
python3 .trellis/scripts/init_developer.py <name>
```

**创建：**
- `.trellis/.developer`
- `.trellis/workspace/<name>/`
- `.trellis/workspace/<name>/index.md`
- `.trellis/workspace/<name>/journal-1.md`

---

### `get_developer.py`

获取当前开发者名称。

```bash
python3 .trellis/scripts/get_developer.py
# Output: taosu
```

**退出码：**
- `0` - 成功
- `1` - 未初始化

---

## 上下文脚本

### `get_context.py`

获取会话运行时，供 AI 消费。

```bash
python3 .trellis/scripts/get_context.py
```

**输出包含：**
- 开发者身份
- Git 状态和最近提交
- 当前任务（如有）
- 工作区摘要

---

### `add_session.py`

将会话条目记录到日志中。

```bash
python3 .trellis/scripts/add_session.py "Session summary"
```

**操作：**
1. 追加到当前日志
2. 更新索引标记
3. 必要时轮转日志

---

## 任务脚本

### `task.py`

任务管理 CLI。

#### 创建任务

```bash
python3 .trellis/scripts/task.py create "Task name" --slug task-slug
```

**选项：**
- `--slug` - URL 安全标识符
- `--assignee` - 开发者名称（默认：当前）
- `--type` - 开发类型：frontend、backend、fullstack

#### 列出任务

```bash
python3 .trellis/scripts/task.py list
```

**输出：**
```
Active Tasks:
  01-31-add-login-taosu (active)
  01-30-fix-api-cursor-agent (paused)
```

#### 开始任务

```bash
python3 .trellis/scripts/task.py start <task-dir>
```

在 `.trellis/.runtime/sessions/<session-key>.json` 中设置活动任务。
如果没有会话身份或 `TRELLIS_CONTEXT_ID`，此命令会失败，不会创建 `.trellis/.current-task`。

#### 完成任务

```bash
python3 .trellis/scripts/task.py finish
```

仅为当前会话运行时清除活动任务。

#### 初始化上下文

```bash
python3 .trellis/scripts/task.py init-context <task-dir> <dev-type>
```

**开发类型：** `frontend`、`backend`、`fullstack`

创建包含适当规范引用的 JSONL 文件。

#### 设置分支

```bash
python3 .trellis/scripts/task.py set-branch <task-dir> <branch-name>
```

更新 task.json 中的 `branch` 字段。

#### 归档任务

```bash
python3 .trellis/scripts/task.py archive <task-dir>
```

将任务移动到 `.trellis/tasks/archive/YYYY-MM/`。

#### 列出归档

```bash
python3 .trellis/scripts/task.py list-archive [month]
```

---

## 公共工具

### `common/paths.py`

路径常量与工具函数。

```python
from common.paths import (
    TRELLIS_DIR,      # .trellis/
    WORKSPACE_DIR,    # .trellis/workspace/
    TASKS_DIR,        # .trellis/tasks/
    SPEC_DIR,         # .trellis/spec/
)
```

### `common/developer.py`

开发者管理。

```python
from common.developer import (
    get_developer,     # 获取当前开发者名称
    get_workspace_dir, # 获取开发者工作区目录
)
```

### `common/task_utils.py`

任务查找函数。

```python
from common.task_utils import (
    get_current_task,  # 获取活动任务目录
    load_task_json,    # 加载 task.json
    save_task_json,    # 保存 task.json
)
```

### `common/phase.py`

阶段跟踪。

```python
from common.phase import (
    get_current_phase,  # 获取当前阶段编号
    advance_phase,      # 进入下一阶段
)
```

### `common/git_context.py`

Git 上下文生成。

```python
from common.git_context import (
    get_git_status,     # 获取 git 状态
    get_recent_commits, # 获取最近提交信息
    get_branch_name,    # 获取当前分支
)
```

---

## 使用示例

### 初始化新开发者

```bash
cd /path/to/project
python3 .trellis/scripts/init_developer.py john-doe
```

### 创建并开始任务

```bash
# 创建任务
python3 .trellis/scripts/task.py create "Add user login" --slug add-login

# 为全栈工作初始化上下文
python3 .trellis/scripts/task.py init-context \
  .trellis/tasks/01-31-add-login-john-doe fullstack

# 开始任务
python3 .trellis/scripts/task.py start \
  .trellis/tasks/01-31-add-login-john-doe
```

### 记录会话

```bash
python3 .trellis/scripts/add_session.py "Implemented login form, pending API integration"
```

### 归档已完成任务

```bash
python3 .trellis/scripts/task.py archive \
  .trellis/tasks/01-31-add-login-john-doe
```