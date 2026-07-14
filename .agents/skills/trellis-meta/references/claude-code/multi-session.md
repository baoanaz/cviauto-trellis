# 多会话参考（Multi-Session Reference）

使用 Git worktree 实现并行隔离会话的文档。

---

## 概述

多会话（Multi-Session）通过 Git worktree 实现**并行、隔离的开发会话**。每个会话在各自的目录中运行，拥有独立的分支。

**关键区分**：
- **Multi-Agent** = 当前目录下的多个 agent（dispatch → implement → check）
- **Multi-Session** = 独立 worktree 中的并行会话（本文档）

---

## 何时使用多会话

| 场景 | 是否使用 Multi-Session？ |
|----------|-------------------|
| 当前分支上的普通任务 | 否 - 使用 Multi-Agent |
| 长时间运行的任务，希望同时做其他事情 | 是 |
| 多个并行的独立任务 | 是 |
| 任务需要干净的隔离环境 | 是 |
| 快速修复或小改动 | 否 |

---

## 架构

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         主仓库（MAIN REPOSITORY）                            │
│                         （当前目录）                                         │
│                                                                             │
│  /trellis:parallel → 配置任务 → start.py                                   │
│                                           │                                 │
│                                           │ 创建 worktree                   │
│                                           │ 启动 agent                      │
│                                           ▼                                 │
└───────────────────────────────────────────┼─────────────────────────────────┘
                                            │
              ┌─────────────────────────────┼─────────────────────────────────┐
              │                             │                                 │
              ▼                             ▼                                 ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ WORKTREE 1           │  │ WORKTREE 2           │  │ WORKTREE 3           │
│ feature/add-login    │  │ feature/user-profile │  │ fix/api-bug          │
│                      │  │                      │  │                      │
│ ┌──────────────────┐ │  │ ┌──────────────────┐ │  │ ┌──────────────────┐ │
│ │ Dispatch Agent   │ │  │ │ Dispatch Agent   │ │  │ │ Dispatch Agent   │ │
│ │       ↓          │ │  │ │       ↓          │ │  │ │       ↓          │ │
│ │ Implement Agent  │ │  │ │ Implement Agent  │ │  │ │ Implement Agent  │ │
│ │       ↓          │ │  │ │       ↓          │ │  │ │       ↓          │ │
│ │ Check Agent      │ │  │ │ Check Agent      │ │  │ │ Check Agent      │ │
│ │       ↓          │ │  │ │       ↓          │ │  │ │       ↓          │ │
│ │ create_pr.py     │ │  │ │ create_pr.py     │ │  │ │ create_pr.py     │ │
│ └──────────────────┘ │  │ └──────────────────┘ │  │ └──────────────────┘ │
│                      │  │                      │  │                      │
│ Session: abc123      │  │ Session: def456      │  │ Session: ghi789      │
│ PID: 12345           │  │ PID: 12346           │  │ PID: 12347           │
└──────────────────────┘  └──────────────────────┘  └──────────────────────┘

位置：../worktrees/（默认）
```

---

## Git Worktree

### 什么是 Worktree？

Git worktree 允许从一个仓库创建多个工作目录：

```
/project/                              # 主仓库（main 分支）
/project/../worktrees/                 # 默认：../worktrees
├── feature/add-login/                # Worktree 1（独立分支）
├── feature/user-profile/             # Worktree 2（独立分支）
└── fix/api-bug/                      # Worktree 3（独立分支）
```

### 优势

| 优势 | 描述 |
|---------|-------------|
| **真正隔离** | 每个会话有独立的文件系统 |
| **独立分支** | 每个 worktree 在自己的分支上 |
| **并行执行** | 多个 agent 同时工作 |
| **干净状态** | 从零开始，无干扰 |
| **会话持久化** | 每个都有 `.session-id` 用于恢复 |
| **易于清理** | 删除 worktree = 删除所有内容 |

---

## 配置

### worktree.yaml

位置：`.trellis/worktree.yaml`

```yaml
# worktree 创建位置（相对于项目根目录）
# 默认：../worktrees
worktree_dir: ../worktrees

# 要复制到每个 worktree 的文件（默认：[]）
copy:
  - .trellis/.developer      # 开发者身份
  - .env                      # 环境变量
  - .env.local                # 本地覆盖

# worktree 创建后执行的命令（默认：[]）
post_create:
  - npm install               # 安装依赖
  # - pnpm install --frozen-lockfile

# Ralph Loop 的验证命令（默认：[]）
verify:
  - pnpm lint
  - pnpm typecheck
```

### 任务配置

每个会话需要一个已配置的任务：

```json
// task.json
{
  "branch": "feature/add-login",     // worktree 必需
  "base_branch": "main",
  "worktree_path": null,             // 由 start.py 设置
  "current_phase": 0,
  "next_action": [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "check"},
    {"phase": 3, "action": "finish"},
    {"phase": 4, "action": "create-pr"}
  ]
}
```

---

## 脚本

### start.py - 启动会话

创建 worktree 并启动 agent。

```bash
python3 .trellis/scripts/multi_agent/start.py <task-dir>
```

**操作**：
1. 读取 `task.json` 获取分支名称
2. 创建 git worktree：
   ```bash
   git worktree add -b <branch> ../trellis-worktrees/<branch>
   ```
3. 从 `worktree.yaml` 的 copy 列表中复制文件
4. 将任务目录复制到 worktree
5. 运行 `post_create` 钩子
6. 为 worktree 运行设置会话级活动任务
7. 启动 Claude Dispatch Agent：
   ```bash
   claude -p --agent dispatch \
     --session-id <uuid> \
     --dangerously-skip-permissions \
     --output-format stream-json \
     --verbose "Start the pipeline"
   ```
8. 注册到 `registry.json`

**示例**：
```bash
python3 .trellis/scripts/multi_agent/start.py .trellis/tasks/01-31-add-login-taosu
# 输出：Started agent in ../trellis-worktrees/feature/add-login
```

---

### status.py - 监控会话

查看所有运行中的会话。

```bash
# 概览
python3 .trellis/scripts/multi_agent/status.py

# 详细视图
python3 .trellis/scripts/multi_agent/status.py --detail <task-name>

# 监视模式
python3 .trellis/scripts/multi_agent/status.py --watch <task-name>

# 查看日志
python3 .trellis/scripts/multi_agent/status.py --log <task-name>

# 显示注册表
python3 .trellis/scripts/multi_agent/status.py --registry
```

**输出**：
```
Active Sessions:
┌──────────────┬──────────┬────────────────┬──────────┬───────────┐
│ Task         │ Status   │ Phase          │ Elapsed  │ Files     │
├──────────────┼──────────┼────────────────┼──────────┼───────────┤
│ add-login    │ Running  │ 2/4 (check)    │ 15m 32s  │ 5 changed │
│ fix-api      │ Stopped  │ 1/4 (implement)│ 8m 15s   │ 2 changed │
└──────────────┴──────────┴────────────────┴──────────┴───────────┘

Resume stopped sessions:
  cd ../trellis-worktrees/feature/fix-api && claude --resume <session-id>
```

---

### create_pr.py - 创建 PR

从 worktree 的变更创建 PR。

```bash
python3 .trellis/scripts/multi_agent/create_pr.py [--dry-run]
```

**操作**：
1. 暂存变更：`git add -A`
2. 排除：`git reset .trellis/workspace/`
3. 提交：`feat(<scope>): <task-name>`
4. 推送到远程
5. 创建 Draft PR：`gh pr create --draft`
6. 更新 task.json：`status: "completed"`, `pr_url`

---

### cleanup.py - 删除 Worktree

完成后清理。

```bash
# 指定 worktree
python3 .trellis/scripts/multi_agent/cleanup.py <branch-name>

# 所有已合并的 worktree
python3 .trellis/scripts/multi_agent/cleanup.py --merged

# 所有 worktree（需确认）
python3 .trellis/scripts/multi_agent/cleanup.py --all
```

**操作**：
1. 归档任务到 `.trellis/tasks/archive/YYYY-MM/`
2. 从注册表中移除
3. 删除 worktree：`git worktree remove <path>`
4. 可选删除分支

---

### plan.py - 自动配置任务

启动 Plan Agent 来创建任务配置。

```bash
python3 .trellis/scripts/multi_agent/plan.py \
  --name <task-slug> \
  --type <backend|frontend|fullstack> \
  --requirement "<description>"
```

**Plan Agent**：
1. 评估需求（可以 REJECT）
2. 调用 Research Agent
3. 创建 `prd.md`
4. 配置 `task.json`
5. 初始化 JSONL 文件

---

## 会话注册表（Session Registry）

跟踪所有运行中的会话。

**位置**：`.trellis/workspace/<developer>/.agents/registry.json`

```json
{
  "agents": [
    {
      "id": "feature-add-login",
      "worktree_path": "/abs/path/to/trellis-worktrees/feature/add-login",
      "pid": 12345,
      "started_at": "2026-01-31T10:30:00",
      "task_dir": ".trellis/tasks/01-31-add-login-taosu"
    }
  ]
}
```

**API**（`common/registry.py`）：
```python
registry_add_agent(agent_id, worktree_path, pid, task_dir)
registry_remove_by_id(agent_id)
registry_remove_by_worktree(worktree_path)
registry_search_agent(pattern)
registry_list_agents()
```

---

## 完整工作流

### 1. 配置任务

```bash
# 创建任务
python3 .trellis/scripts/task.py create "Add login" --slug add-login

# 配置
python3 .trellis/scripts/task.py init-context <task-dir> fullstack
python3 .trellis/scripts/task.py set-branch <task-dir> feature/add-login

# 编写 prd.md
# ...
```

### 2. 启动会话

```bash
python3 .trellis/scripts/multi_agent/start.py <task-dir>
```

### 3. 监控

```bash
python3 .trellis/scripts/multi_agent/status.py --watch add-login
```

### 4. 完成后

```bash
# PR 自动创建
# 在 GitHub 上审查，合并

# 清理
python3 .trellis/scripts/multi_agent/cleanup.py feature/add-login
```

---

## 并行执行

启动多个会话：

```bash
# 会话 1
python3 .trellis/scripts/multi_agent/start.py .trellis/tasks/01-31-add-login

# 会话 2（立即）
python3 .trellis/scripts/multi_agent/start.py .trellis/tasks/01-31-fix-api

# 会话 3
python3 .trellis/scripts/multi_agent/start.py .trellis/tasks/01-31-update-docs

# 监控全部
python3 .trellis/scripts/multi_agent/status.py
```

每个独立运行：
- 独立的 worktree
- 独立的分支
- 独立的 Claude 进程
- 独立的注册表条目

---

## 恢复会话

如果会话停止：

```bash
# 查找会话信息
python3 .trellis/scripts/multi_agent/status.py --detail <task-name>

# 恢复
cd ../trellis-worktrees/feature/task-name
claude --resume <session-id>
```

---

## Ralph Loop

会话中 Check Agent 的质量保障机制。

**机制**：
1. Check Agent 完成
2. SubagentStop 钩子触发
3. `ralph-loop.py` 运行验证命令
4. 全部通过 → 允许停止
5. 任一失败 → 阻止，继续 agent

**常量**：
| 常量 | 值 | 描述 |
|----------|-------|-------------|
| `MAX_ITERATIONS` | 5 | 最大循环迭代次数 |
| `STATE_TIMEOUT_MINUTES` | 30 | 状态超时时间 |
| Command timeout | 120s | 每个验证命令的超时 |

**配置**（`worktree.yaml`）：
```yaml
verify:
  - pnpm lint
  - pnpm typecheck
```

**状态**（`.trellis/.ralph-state.json`）：
```json
{
  "task": ".trellis/tasks/01-31-add-login",
  "iteration": 2,
  "started_at": "2026-01-31T10:30:00"
}
```

**限制**：最大 5 次迭代（`MAX_ITERATIONS`），30 分钟超时（`STATE_TIMEOUT_MINUTES`），每条命令 120 秒

---

## 故障排查

### 会话无法启动

1. 检查 `worktree.yaml` 是否存在
2. 确认分支名称不存在
3. 检查 `post_create` 钩子
4. 查看 start.py 输出

### 会话卡住

1. 检查 Ralph Loop 迭代次数（最大 5）
2. 验证 `verify` 命令
3. 手动运行验证命令
4. 检查 `.trellis/.ralph-state.json`

### Worktree 问题

```bash
# 强制删除
git worktree remove --force <path>

# 清理过期项
git worktree prune

# 列出全部
git worktree list
```

### 注册表不同步

```bash
# 查看
python3 .trellis/scripts/multi_agent/status.py --registry

# 手动编辑
vim .trellis/workspace/<dev>/.agents/registry.json
```