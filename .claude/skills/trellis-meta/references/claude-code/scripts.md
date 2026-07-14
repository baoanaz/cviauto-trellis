# Claude Code 脚本

需要 Claude Code CLI 和钩子系统的脚本。

---

## 概述

这些脚本需要：
- `claude` CLI 命令
- 用于上下文注入的钩子系统
- `--resume` 用于会话持久化

```
.trellis/scripts/
├── common/
│   ├── worktree.py         # Worktree 工具
│   └── registry.py         # Agent 注册表
│
└── multi_agent/            # 多会话（Multi-Session）脚本
    ├── plan.py             # 启动 Plan agent
    ├── start.py            # 启动 worktree agent
    ├── status.py           # 监控 agent
    ├── create_pr.py        # 创建 Pull Request
    └── cleanup.py          # 清理 worktree
```

---

## 多会话脚本

### `multi_agent/plan.py`

启动 Plan Agent 来创建任务配置。

```bash
python3 .trellis/scripts/multi_agent/plan.py \
  --name <task-name> \
  --type <dev-type> \
  --requirement "<requirement text>"
```

**选项：**
- `--name` - 任务标识（slug）
- `--type` - `frontend`、`backend`、`fullstack`
- `--requirement` - 任务描述

**操作：**
1. 创建任务目录
2. 通过 `claude` 启动 Plan Agent
3. Plan Agent 可以 REJECT 不明确的需求
4. 创建 `prd.md`、`task.json`、JSONL 文件

---

### `multi_agent/start.py`

在新 worktree 中启动 agent。

```bash
python3 .trellis/scripts/multi_agent/start.py <task-dir>
```

**操作：**
1. 读取 `task.json` 获取分支名称
2. 创建 git worktree：
   ```bash
   git worktree add -b <branch> ../worktrees/<branch>
   ```
3. 从 `worktree.yaml` 的 copy 列表中复制文件
4. 将任务目录复制到 worktree
5. 运行 `post_create` 命令
6. 设置会话级活动任务
7. 启动 Claude Dispatch Agent：
   ```bash
   claude -p --agent dispatch \
     --session-id <uuid> \
     --dangerously-skip-permissions \
     --output-format stream-json \
     "Start the pipeline"
   ```
8. 注册到 `registry.json`

---

### `multi_agent/status.py`

监控运行中的会话。

```bash
# 所有会话概览
python3 .trellis/scripts/multi_agent/status.py

# 详细视图
python3 .trellis/scripts/multi_agent/status.py --detail <task-name>

# 监视模式（自动刷新）
python3 .trellis/scripts/multi_agent/status.py --watch <task-name>

# 查看日志
python3 .trellis/scripts/multi_agent/status.py --log <task-name>

# 显示注册表
python3 .trellis/scripts/multi_agent/status.py --registry
```

**输出：**
```
Active Sessions:
┌──────────────┬──────────┬────────────────┬──────────┬───────────┐
│ Task         │ Status   │ Phase          │ Elapsed  │ Files     │
├──────────────┼──────────┼────────────────┼──────────┼───────────┤
│ add-login    │ Running  │ 2/4 (check)    │ 15m 32s  │ 5 changed │
│ fix-api      │ Stopped  │ 1/4 (implement)│ 8m 15s   │ 2 changed │
└──────────────┴──────────┴────────────────┴──────────┴───────────┘
```

---

### `multi_agent/create_pr.py`

从 worktree 的变更创建 Pull Request。

```bash
python3 .trellis/scripts/multi_agent/create_pr.py [--dry-run]
```

**操作：**
1. 暂存变更：`git add -A`
2. 排除 workspace：`git reset .trellis/workspace/`
3. 使用约定式提交格式提交
4. 推送到远程
5. 通过 `gh pr create --draft` 创建 Draft PR
6. 用 `pr_url` 更新 task.json

---

### `multi_agent/cleanup.py`

清理已完成的 worktree。

```bash
# 指定 worktree
python3 .trellis/scripts/multi_agent/cleanup.py <branch-name>

# 所有已合并的 worktree
python3 .trellis/scripts/multi_agent/cleanup.py --merged

# 所有 worktree（需确认）
python3 .trellis/scripts/multi_agent/cleanup.py --all
```

**操作：**
1. 归档任务到 `.trellis/tasks/archive/YYYY-MM/`
2. 从注册表中移除
3. 删除 worktree：`git worktree remove <path>`
4. 可选删除分支

---

## 通用工具

### `common/worktree.py`

Worktree 管理工具。

```python
from common.worktree import (
    read_worktree_config,  # 读取 worktree.yaml
    get_worktree_path,     # 获取分支路径
    create_worktree,       # 创建新 worktree
    remove_worktree,       # 删除 worktree
)
```

### `common/registry.py`

用于跟踪运行中会话的 Agent 注册表。

```python
from common.registry import (
    registry_add_agent,       # 添加 agent 到注册表
    registry_remove_by_id,    # 按 agent ID 移除
    registry_remove_by_worktree,  # 按路径移除
    registry_search_agent,    # 按模式搜索
    registry_list_agents,     # 列出所有 agent
)
```

**注册表文件：** `.trellis/workspace/<developer>/.agents/registry.json`

```json
{
  "agents": [
    {
      "id": "feature-add-login",
      "worktree_path": "/abs/path/to/worktrees/feature/add-login",
      "pid": 12345,
      "started_at": "2026-01-31T10:30:00",
      "task_dir": ".trellis/tasks/01-31-add-login-taosu"
    }
  ]
}
```

---

## Claude CLI 用法

### Agent 模式

```bash
claude --agent dispatch "Start the pipeline"
```

### Print 模式（非交互）

```bash
claude -p "Do something"
```

### 会话恢复

```bash
claude --resume <session-id>
```

### 自动化模式

```bash
claude --dangerously-skip-permissions -p "..."
```

### JSON 输出

```bash
claude --output-format stream-json -p "..."
```

---

## 恢复已停止的会话

```bash
# 查找会话信息
python3 .trellis/scripts/multi_agent/status.py --detail <task-name>

# 在 worktree 中恢复
cd ../worktrees/feature/task-name
claude --resume <session-id>
```