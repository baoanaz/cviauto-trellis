# 工作区系统（Workspace System）

跨会话跟踪开发进度，按开发者隔离。

---

## 目录结构

```
.trellis/workspace/
├── index.md                    # 全局概览
└── {developer}/                # 按开发者划分的目录
    ├── index.md                # 个人索引，含 @@@auto 标记
    ├── journal-1.md            # 会话日志（最多 2000 行）
    ├── journal-2.md            # 达到上限时轮转
    └── ...
```

---

## 开发者身份

### `.trellis/.developer`

存储当前开发者名称。由 `init_developer.py` 创建。

```
taosu
```

### 初始化开发者

```bash
python3 .trellis/scripts/init_developer.py <name>
```

创建：
- `.trellis/.developer` - 身份文件
- `.trellis/workspace/<name>/` - 个人工作区
- `.trellis/workspace/<name>/index.md` - 个人索引
- `.trellis/workspace/<name>/journal-1.md` - 首个日志

---

## 日志

### 用途

跟踪会话历史、决策和上下文。

### 格式

```markdown
# Journal 1

## Session: 2026-01-31 10:30

### Context
- Working on: [task description]
- Branch: feature/add-login

### Progress
- [x] Completed step 1
- [ ] Working on step 2

### Notes
Key decisions and learnings...

---
```

### 日志轮转

日志超过 2000 行时：
1. 归档当前日志（追加到索引）
2. 创建新的 journal-N.md
3. 继续写入

---

## 个人索引

### `workspace/{developer}/index.md`

跟踪所有会话并提供快速参考。

```markdown
# Developer Workspace - taosu

## Active Work
- Current task: `.trellis/tasks/01-31-add-login-taosu`
- Branch: feature/add-login

## Recent Sessions
<!-- @@@auto-sessions-start -->
- 2026-01-31: Implemented login UI
- 2026-01-30: Set up auth service
<!-- @@@auto-sessions-end -->

## Journals
- journal-1.md (lines 1-2000)
- journal-2.md (current)
```

### @@@auto 标记

脚本使用这些标记来自动更新段落：
- `@@@auto-sessions-start/end` - 最近会话列表
- `@@@auto-tasks-start/end` - 任务摘要

---

## 全局索引

### `workspace/index.md`

所有开发者与项目状态的概览。

```markdown
# Project Workspace

## Developers
- taosu - Last active: 2026-01-31
- cursor-agent - Last active: 2026-01-30

## Recent Activity
...
```

---

## 脚本

| 脚本 | 用途 |
|--------|---------|
| `init_developer.py` | 初始化开发者身份 |
| `get_developer.py` | 获取当前开发者名称 |
| `add_session.py` | 记录会话到日志 |
| `get_context.py` | 获取 AI 会话上下文 |

---

## 最佳实践

1. **每台机器一个开发者** - 身份存储在 `.developer` 中
2. **定期记录日志** - 记录决策和上下文
3. **使用标记** - 让脚本自动更新索引
4. **回顾日志** - 在开始新会话之前