# Hooks 系统

Claude Code hooks 用于自动上下文注入和质量强制执行。

---

## 概述

Hooks 拦截 Claude Code 生命周期事件，以注入上下文并强制执行质量。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           HOOK 生命周期                                  │
│                                                                          │
│  会话开始 ──► SessionStart hook ──► 注入工作流上下文                     │
│                                                                          │
│  Task() 被调用 ──► PreToolUse:Task hook ──► 从 JSONL 注入规范           │
│                                                                          │
│  Agent 停止 ──► SubagentStop hook ──► Ralph Loop 验证                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 配置

### `.claude/settings.json`

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/session-start.py\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/inject-subagent-context.py\"",
            "timeout": 30
          }
        ]
      }
    ],
    "SubagentStop": [
      {
        "matcher": "check",
        "hooks": [
          {
            "type": "command",
            "command": "python3 \"$CLAUDE_PROJECT_DIR/.claude/hooks/ralph-loop.py\"",
            "timeout": 300
          }
        ]
      }
    ]
  }
}
```

---

## SessionStart Hook

### 用途

在 Claude Code 会话开始时注入初始上下文。

### 脚本：`session-start.py`

**注入内容：**
- 来自 `.trellis/.developer` 的开发者身份
- Git 状态和最近的提交
- 当前任务（如果会话作用域的解析器找到了）
- `workflow.md` 内容
- 所有 `spec/*/index.md` 文件
- 启动指令

**输出格式：**
```json
{
  "result": "continue",
  "message": "# Session Context\n\n## Developer\ntaosu\n\n## Git Status\n..."
}
```

---

## PreToolUse:Task Hook

### 用途

当调用 Subagent 时注入相关规范。

### 脚本：`inject-subagent-context.py`

**触发条件：** 当 `Task(subagent_type="...")` 被调用时。

**流程：**
1. 从工具输入中读取 `subagent_type`
2. 通过会话作用域解析器找到活动任务
3. 从任务目录加载 `{subagent_type}.jsonl`
4. 读取 JSONL 中列出的每个文件
5. 构建带有上下文的增强提示词
6. 用当前阶段更新 `task.json`

**输出格式：**
```json
{
  "result": "continue",
  "updatedInput": {
    "prompt": "# Implement Agent Task\n\n## Context\n...\n\n## Your Task\n..."
  }
}
```

### JSONL 格式

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "Backend guidelines"}
{"file": "src/services/auth.ts", "reason": "Existing pattern"}
{"file": ".trellis/tasks/01-31-add-login/prd.md", "reason": "Requirements"}
```

---

## SubagentStop Hook

### 用途

通过 Ralph Loop 进行质量强制执行。

### 脚本：`ralph-loop.py`

**触发条件：** 当 Check Agent 尝试停止时。

**流程：**
1. 从 `worktree.yaml` 读取验证命令
2. 执行每个命令（pnpm lint、pnpm typecheck 等）
3. 如果全部通过 → 允许停止
4. 如果有任何失败 → 阻止停止，Agent 继续运行

→ 详见 [ralph-loop.md](./ralph-loop.md)。

---

## Hook 脚本位置

```
.claude/hooks/
├── session-start.py           # SessionStart 处理器
├── inject-subagent-context.py # PreToolUse:Task 处理器
└── ralph-loop.py              # SubagentStop:check 处理器
```

---

## 环境变量

Hook 脚本中可用的变量：

| 变量 | 描述 |
|----------|-------------|
| `CLAUDE_PROJECT_DIR` | 项目根目录 |
| `HOOK_EVENT` | 事件类型（SessionStart、PreToolUse 等） |
| `TOOL_NAME` | 被调用的工具（用于 PreToolUse） |
| `TOOL_INPUT` | 工具输入的 JSON 字符串 |
| `SUBAGENT_TYPE` | Agent 类型（用于 SubagentStop） |

---

## Hook 响应格式

### Continue（允许操作）

```json
{
  "result": "continue",
  "message": "Optional message to inject"
}
```

### Continue 并修改输入

```json
{
  "result": "continue",
  "updatedInput": {
    "prompt": "Modified prompt..."
  }
}
```

### Block（阻止操作）

```json
{
  "result": "block",
  "message": "Reason for blocking"
}
```

---

## 调试 Hooks

### 查看 Hook 输出

```bash
# Check if hooks are configured
cat .claude/settings.json | grep -A 20 '"hooks"'

# Test session-start manually
python3 .claude/hooks/session-start.py

# Test inject-context (needs TOOL_INPUT env var)
TOOL_INPUT='{"subagent_type":"implement","prompt":"test"}' \
  python3 .claude/hooks/inject-subagent-context.py
```

### 常见问题

| 问题 | 原因 | 解决方案 |
|-------|-------|----------|
| Hook 未运行 | 匹配器错误 | 检查 settings.json 中的 matcher |
| 超时 | 脚本太慢 | 增加 timeout 或优化 |
| 未注入上下文 | 缺少会话活动任务 | 使用会话身份运行 `task.py start` |
| 未找到 JSONL | 错误的任务目录 | 检查 `task.py current --source` |