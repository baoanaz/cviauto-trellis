# Claude Code 功能概述

这些功能需要 **Claude Code**，在 Cursor 或其他平台上无法使用。

---

## 为什么仅限 Claude Code？

Claude Code 提供了独特的能力：

| 功能 | Claude Code | 为何必需 |
|---------|-------------|--------------|
| Hooks | 支持 | 生命周期事件的 hook 系统 |
| Task 工具 | 支持 | 带上下文的 Subagent 调用 |
| `--agent` 标志 | 支持 | 加载 Agent 定义 |
| `--resume` | 支持 | 会话持久化 |
| CLI 脚本 | 支持 | 使用 `claude` 命令实现自动化 |

---

## 功能分类

### Hooks 系统
自动上下文注入和质量强制执行。

| Hook | 何时触发 | 用途 |
|------|------|---------|
| `SessionStart` | 会话开始时 | 注入工作流上下文 |
| `PreToolUse:Task` | Subagent 调用前 | 通过 JSONL 注入规范 |
| `SubagentStop:check` | Check Agent 停止时 | Ralph Loop 强制执行 |

→ 参见 [hooks.md](./hooks.md)

### Agent 系统
针对不同开发阶段的专用 Agent。

| Agent | 用途 |
|-------|---------|
| `dispatch` | 编排流水线 |
| `implement` | 编写代码 |
| `check` | 审查并自我修复 |
| `debug` | 修复问题 |
| `research` | 查找模式 |
| `plan` | 评估需求 |

→ 参见 [agents.md](./agents.md)

### Ralph Loop
针对 Check Agent 的质量强制执行。

- 当 Check Agent 停止时运行验证命令
- 阻止完成直到全部通过
- 最多 5 次迭代，30 分钟超时

→ 参见 [ralph-loop.md](./ralph-loop.md)

### 多会话（Multi-Session）
使用 Git worktree 的并行隔离会话。

- 每个会话在独立的 worktree 中
- 各自拥有分支、各自的 Claude 进程
- 自动创建 PR

→ 参见 [multi-session.md](./multi-session.md)

### worktree.yaml
多会话（Multi-Session）和 Ralph Loop 的配置。

→ 参见 [worktree-config.md](./worktree-config.md)

---

## 本目录中的文档

| 文档 | 内容 |
|----------|---------|
| `hooks.md` | Hook 系统、上下文注入 |
| `agents.md` | Agent 类型、调用、上下文 |
| `ralph-loop.md` | 质量强制执行机制 |
| `multi-session.md` | 并行 worktree 会话 |
| `worktree-config.md` | worktree.yaml 配置 |
| `scripts.md` | 仅限 Claude Code 的脚本 |

---

## 架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      CLAUDE CODE 集成                                    │
│                                                                          │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐        │
│  │  SessionStart  │    │  PreToolUse    │    │  SubagentStop  │        │
│  │     Hook       │    │     Hook       │    │     Hook       │        │
│  └───────┬────────┘    └───────┬────────┘    └───────┬────────┘        │
│          │                     │                     │                  │
│          ▼                     ▼                     ▼                  │
│  ┌────────────────┐    ┌────────────────┐    ┌────────────────┐        │
│  │ session-start  │    │ inject-context │    │  ralph-loop    │        │
│  │     .py        │    │     .py        │    │     .py        │        │
│  └───────┬────────┘    └───────┬────────┘    └───────┬────────┘        │
│          │                     │                     │                  │
│          ▼                     ▼                     ▼                  │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                     核心系统（基于文件）                           │   │
│  │  Workspace  │  Tasks  │  Specs  │  Commands  │  Scripts          │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 检查 Claude Code 可用性

```bash
# Check if Claude Code is installed
claude --version

# Verify hooks are configured
cat .claude/settings.json | grep -A 5 '"hooks"'
```

如果 hooks 不存在，Claude Code 功能将无法使用。