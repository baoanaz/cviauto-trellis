# 平台兼容性参考

详细介绍 Trellis 功能在不同 AI 编码平台上的可用性。

---

## 概述

Trellis 主要为 **Claude Code** 设计，但对 **Cursor** 提供部分支持。未来考虑支持 **OpenCode**。

关键区别在于 **hooks 支持**——Claude Code 的 hook 系统可实现自动上下文注入和质量强制执行，而其他平台需要手动变通方案。

---

## 平台架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRELLIS 功能分层                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │                    第 3 层：自动化                                   │ │
│  │  Hooks、Ralph Loop、自动注入、多会话（Multi-Session）               │ │
│  │  ─────────────────────────────────────────────────────────────────│ │
│  │  平台：仅限 Claude Code                                             │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌────────────────────────────────▼───────────────────────────────────┐ │
│  │                    第 2 层：Agent                                    │ │
│  │  Agent 定义、Task 工具、Subagent 调用                               │ │
│  │  ─────────────────────────────────────────────────────────────────│ │
│  │  平台：Claude Code（完整）、Cursor（手动）                          │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                    │                                     │
│  ┌────────────────────────────────▼───────────────────────────────────┐ │
│  │                    第 1 层：持久化                                   │ │
│  │  工作区（Workspace）、任务（Tasks）、规范（Specs）、命令（Commands）、│ │
│  │  JSONL 文件                                                         │ │
│  │  ─────────────────────────────────────────────────────────────────│ │
│  │  平台：全部（基于文件，可移植）                                      │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 详细功能分解

### 第 1 层：持久化（所有平台）

这些功能在所有平台上均可使用，因为它们基于文件。

| 功能 | 位置 | 描述 |
|---------|----------|-------------|
| 工作区系统 | `.trellis/workspace/` | 日志、会话历史 |
| 任务系统 | `.trellis/tasks/` | 任务跟踪、需求 |
| 规范系统 | `.trellis/spec/` | 编码指南 |
| 斜杠命令 | `.claude/commands/` | 命令提示词（在 Cursor 上需手动读取） |
| JSONL 上下文 | 任务目录中的 `*.jsonl` | 上下文文件列表 |
| 开发者身份 | `.trellis/.developer` | 谁在操作 |
| 当前任务 | `.trellis/.runtime/sessions/` | 会话作用域的活动任务状态 |

**Cursor 变通方案**：在会话开始时手动读取这些文件。

### 第 2 层：Agent（Claude Code 完整，Cursor 有限）

| 功能 | Claude Code | Cursor |
|---------|-------------|--------|
| Agent 定义 | 通过 `--agent` 标志自动加载 | 手动读取 `.claude/agents/*.md` |
| Task 工具 | 完整 Subagent 支持 | 无 Task 工具 |
| 上下文注入 | 通过 hooks 自动注入 | 手动复制粘贴 |
| Agent 限制 | 由定义强制执行 | 仅靠自觉遵守 |

**Cursor 变通方案**：
1. 手动读取 Agent 定义文件
2. 从 JSONL 文件中复制相关上下文
3. 手动遵守 Agent 限制

### 第 3 层：自动化（仅限 Claude Code）

| 功能 | 依赖 | 为何仅限 Claude Code |
|---------|------------|---------------------|
| SessionStart hook | `.claude/settings.json` | Claude Code hook 系统 |
| PreToolUse hook | Hook 系统 | 拦截工具调用 |
| SubagentStop hook | Hook 系统 | 控制 Agent 生命周期 |
| 自动上下文注入 | PreToolUse:Task | Hook 注入 JSONL 内容 |
| Ralph Loop | SubagentStop:check | 阻止 Agent 直到验证通过 |
| 多会话（Multi-Session） | claude CLI + hooks | `claude --resume`、worktree 脚本 |

**无变通方案**：这些功能从根本上依赖 Claude Code 的 hook 系统。

---

## 使用的 Claude Code 功能

### Hook 系统

```json
// .claude/settings.json
{
  "hooks": {
    "SessionStart": [...],
    "PreToolUse": [...],
    "SubagentStop": [...]
  }
}
```

Claude Code 在特定生命周期节点执行这些 hooks。目前没有其他平台支持此功能。

### CLI 功能

| 命令 | 用途 |
|---------|---------|
| `claude --agent <name>` | 加载 Agent 定义 |
| `claude --resume <id>` | 恢复会话 |
| `claude -p` | 打印模式（非交互） |
| `claude --dangerously-skip-permissions` | 自动化模式 |
| `claude --output-format stream-json` | 机器可读输出 |

### Task 工具

```javascript
Task(
  subagent_type: "implement",
  prompt: "...",
  model: "opus"
)
```

Claude Code 的 Task 工具可以在隔离上下文中生成 Subagent。PreToolUse hook 拦截此操作以注入规范。

---

## Cursor 使用指南

对于使用 Cursor 的团队，以下是获取部分 Trellis 优势的方法：

### 可用的功能

1. **工作区跟踪**：日志和会话正常工作
2. **任务组织**：任务目录和 PRD 正常工作
3. **规范读取**：在会话开始时手动读取规范
4. **命令作为提示词**：将命令文件作为参考读取

### 推荐工作流

```
1. 会话开始
   - 读取 .trellis/workflow.md
   - 从 .trellis/spec/ 读取相关规范
   - 运行 `task.py current --source`

2. 实现前
   - 读取 implement.jsonl 获取会话文件
   - 手动读取列出的每个文件
   - 遵循规范指南

3. 提交前
   - 手动运行验证命令（pnpm lint、pnpm typecheck）
   - 对照 check.jsonl 规范进行自我审查
```

### 不可用的功能

- 无自动规范注入
- 无 Ralph Loop（仅手动验证）
- 无多会话（Multi-Session）（无 worktree 自动化）
- 无会话恢复

---

## OpenCode 考虑（未来）

### 支持所需的条件

要支持 OpenCode，我们需要：

1. **Hook 等价物**：某种拦截 Agent 生命周期事件的方式
2. **Agent 系统**：带上下文的 Subagent 调用
3. **CLI 集成**：脚本和自动化支持

### 潜在方案

| 方案 | 优点 | 缺点 |
|----------|------|------|
| 原生集成 | 最佳 UX，完整功能 | 需要 OpenCode 更改 |
| 适配器层 | 与当前 OpenCode 兼容 | 维护负担 |
| 基于文件的轮询 | 无需 OpenCode 更改 | 取巧，延迟问题 |
| MCP 服务器 | 标准协议 | 可能无法覆盖所有 hooks |

### 最低可行支持

如果 OpenCode 添加了类似 Claude Code 的 hook 支持：

1. 将 `session-start.py` 移植到 OpenCode 格式
2. 移植 `inject-subagent-context.py` 用于上下文注入
3. 移植 `ralph-loop.py` 用于质量强制执行

没有 hooks，只有第 1 层（持久化）功能可用。

---

## 版本兼容性矩阵

| Trellis 版本 | Claude Code | Cursor | OpenCode |
|-----------------|-------------|--------|----------|
| 0.3.x | 完整支持 | 部分支持 | 不支持 |
| 0.4.x（计划中） | 完整支持 | 部分支持 | 待定 |

### 破坏性变更

| 版本 | 变更 | 影响 |
|---------|--------|--------|
| 0.3.0 | 新 hook 格式 | 更新 settings.json |
| 0.3.0-beta.3 | worktree.yaml 架构 | 更新配置 |

---

## 检查你的平台

### Claude Code

```bash
# Check Claude Code version
claude --version

# Verify hooks are loaded
cat .claude/settings.json | grep -A 5 '"hooks"'
```

### Cursor

```bash
# No CLI check available
# Verify by checking if hooks execute (they won't)
```

### 判断支持级别

```
Is hooks system available?
├── YES → 完整 Trellis 支持（Claude Code）
└── NO  → 仅部分支持
         ├── 可读取文件 → 第 1 层可用
         └── 有 Agent 系统 → 第 2 层部分可用
```