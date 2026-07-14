# Trellis 文件参考

`.trellis/` 目录下所有文件的完整参考。

---

## 目录结构

```
.trellis/
├── .developer              # 开发者身份（gitignored）
├── .runtime/               # 会话级运行时状态（gitignored）
├── .current-task           # 旧版忽略指针，非活动任务来源
├── .ralph-state.json       # Ralph Loop 状态（gitignored）
├── .template-hashes.json   # 模板版本跟踪
├── .version                # 已安装的 Trellis 版本
├── .gitignore              # Git 忽略规则
├── workflow.md             # 主要工作流文档
├── worktree.yaml           # 多会话配置
│
├── workspace/              # 开发者工作区
├── tasks/                  # 任务跟踪
├── spec/                   # 编码规范
└── scripts/                # 自动化脚本
```

---

## 根目录文件

### `.developer`

**用途**：存储当前开发者身份。

**创建者**：`init_developer.py`

**格式**：纯文本，单行开发者名称。

```
taosu
```

**Gitignored**：是 - 每台机器有自己的身份。

---

### `.runtime/sessions/<session-key>.json`

**用途**：存储一个 AI 会话/窗口的活动任务状态。

**创建者**：`task.py start <task-dir>`

**格式**：JSON 运行时上下文。

```json
{
  "current_task": ".trellis/tasks/01-31-add-login-taosu",
  "current_run": null,
  "platform": "claude",
  "last_seen_at": "2026-04-27T00:00:00Z"
}
```

**Gitignored**：是 - 每个会话/窗口有自己的活动任务。

**使用者**：
- 钩子通过 `common.active_task` 解析此文件
- 脚本使用此文件进行活动任务操作

### `.current-task`

**用途**：旧版 Trellis 版本遗留的忽略指针。

**活动任务行为**：不作为回退方案读取或写入。当前 Trellis 仅使用 `.runtime/sessions/<session-key>.json`。

---

### `.ralph-state.json`

**用途**：跟踪 Ralph Loop 迭代状态。

**创建者**：`ralph-loop.py`（仅 Claude Code）

**格式**：JSON

```json
{
  "task": ".trellis/tasks/01-31-add-login",
  "iteration": 2,
  "started_at": "2026-01-31T10:30:00"
}
```

**Gitignored**：是 - 运行时状态。

**字段**：
| 字段 | 类型 | 描述 |
|-------|------|-------------|
| `task` | string | 任务目录路径 |
| `iteration` | number | 当前迭代次数（1-5） |
| `started_at` | ISO 日期 | 循环开始时间 |

---

### `.template-hashes.json`

**用途**：跟踪模板文件版本，用于 `trellis update`。

**创建者**：`trellis init` 或 `trellis update`

**格式**：JSON 对象，将文件路径映射到 SHA-256 哈希值。

```json
{
  ".trellis/workflow.md": "028891d1fe839a266...",
  ".claude/hooks/session-start.py": "0a9899e80f6bfe15...",
  ".claude/commands/start.md": "d1276dcbff880299..."
}
```

**使用者**：
- `trellis update` - 检测哪些文件已被修改
- 判断文件是否可以自动更新或需要冲突解决

**行为**：
- 文件哈希匹配模板 → 可以安全更新
- 文件哈希不同 → 用户已修改，需要手动合并

---

### `.version`

**用途**：跟踪已安装的 Trellis CLI 版本。

**创建者**：`trellis init` 或 `trellis update`

**格式**：纯文本，semver 版本字符串。

```
0.3.0-beta.5
```

**使用者**：
- `trellis update` - 判断是否需要更新
- 版本不匹配检测

---

### `.gitignore`

**用途**：定义要从 git 中排除的文件。

**默认内容**：
```gitignore
# 开发者身份（仅本地）
.developer

# 旧版当前任务指针
.current-task

# 会话运行时状态
.runtime/

# Ralph Loop 状态
.ralph-state.json

# Agent 运行时文件
.agents/
.agent-log
.agent-runner.sh
.session-id

# 任务目录运行时文件
.plan-log

# 原子更新临时文件
*.tmp
.backup-*
*.new

# Python 缓存
**/__pycache__/
**/*.pyc
```

---

### `workflow.md`

**用途**：面向开发者和 AI 的主要工作流文档。

**创建者**：`trellis init`

**内容章节**：
1. 快速入门指南
2. 工作流概述
3. 会话启动流程
4. 开发流程
5. 会话结束
6. 文件说明
7. 最佳实践

**注入者**：`session-start.py` 钩子（Claude Code）

**对于 Cursor**：在会话开始时手动读取。

---

### `worktree.yaml`

**用途**：配置 Multi-Session 和 Ralph Loop。

**创建者**：`trellis init`

**格式**：YAML

```yaml
worktree_dir: ../worktrees
copy:
  - .trellis/.developer
  - .env
post_create:
  - npm install
verify:
  - pnpm lint
  - pnpm typecheck
```

→ 详见 `claude-code/worktree-config.md`。

---

## 运行时文件（Gitignored）

### `.agents/`

**用途**：Multi-Session 的 Agent 注册表。

**位置**：`.trellis/workspace/{developer}/.agents/`

**内容**：跟踪运行中 agent 的 `registry.json`。

---

### `.session-id`

**用途**：存储 Claude Code 会话 ID，用于恢复。

**创建者**：Multi-Session `start.py`

**格式**：UUID 字符串。

---

### `.agent-log`

**用途**：Agent 执行日志。

**创建者**：Multi-Session 脚本。

---

### `.plan-log`

**用途**：Plan Agent 执行日志。

**位置**：任务目录。

---

## 目录

### `workspace/`

带日志和索引的开发者工作区。

→ 详见 `core/workspace.md`

### `tasks/`

带 PRD 和会话文件的任务目录。

→ 详见 `core/tasks.md`

### `spec/`

编码规范和规格说明。

→ 详见 `core/specs.md`

### `scripts/`

自动化脚本。

→ 详见 `core/scripts.md` 和 `claude-code/scripts.md`

---

## 模板文件

以下文件由 `trellis update` 管理：

| 文件 | 用途 |
|------|---------|
| `.trellis/workflow.md` | 工作流文档 |
| `.trellis/worktree.yaml` | 多会话配置 |
| `.trellis/.gitignore` | Git 忽略规则 |
| `.claude/hooks/*.py` | 钩子脚本 |
| `.claude/commands/*.md` | 斜杠命令 |
| `.claude/agents/*.md` | Agent 定义 |
| `.cursor/commands/*.md` | Cursor 命令（镜像） |

**更新行为**：
1. 将文件哈希与 `.template-hashes.json` 比较
2. 如果未修改 → 自动更新
3. 如果已修改 → 创建 `.new` 文件供手动合并
4. 成功更新后更新哈希值

---

## 文件生命周期

### 由 `trellis init` 创建

```
.trellis/
├── .template-hashes.json
├── .version
├── .gitignore
├── workflow.md
├── worktree.yaml
├── spec/
│   ├── frontend/
│   ├── backend/
│   └── guides/
└── scripts/
```

### 在运行时创建

```
.trellis/
├── .developer           # init_developer.py
├── .runtime/sessions/   # task.py start
├── .current-task        # 旧版忽略文件，非活动任务来源
├── .ralph-state.json    # ralph-loop.py
├── workspace/{dev}/     # init_developer.py
│   ├── index.md
│   ├── journal-1.md
│   └── .agents/
└── tasks/{task}/        # task.py create
    ├── task.json
    ├── prd.md
    └── *.jsonl
```

### 清理

```
# 任务完成后
.trellis/tasks/{task}/ → .trellis/tasks/archive/YYYY-MM/

# Worktree 删除后
.agents/registry.json 中的条目被移除
```