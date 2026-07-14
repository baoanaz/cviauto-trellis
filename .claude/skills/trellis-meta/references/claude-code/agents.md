# Agents 参考

Trellis Agent 系统的文档——用于不同开发阶段的专用 AI Agent。

---

## 概述

Trellis 使用**专用 Agent** 来执行不同的任务。每个 Agent 具有特定的能力、限制和上下文注入。

**关键洞察**：Agent 在**当前目录**中工作——无需 worktree。多会话（Multi-Session，worktree 隔离）是一个独立的概念。

---

## Agent 类型

| Agent | 用途 | 可写 | Git 提交 |
|-------|---------|-----------|------------|
| `dispatch` | 编排阶段 | 否 | 仅通过脚本 |
| `plan` | 评估需求 | 是（任务目录） | 否 |
| `research` | 查找模式 | 否 | 否 |
| `implement` | 编写代码 | 是 | 否 |
| `check` | 审查和自修复 | 是 | 否 |
| `debug` | 修复问题 | 是 | 否 |

---

## Agent 定义

位置：`.claude/agents/*.md`

### 格式

```markdown
---
name: agent-name
description: |
  What this agent does.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
# Agent Name

## Core Responsibilities
...

## Workflow
...

## Forbidden Operations
...
```

---

## Dispatch Agent

**文件**：`.claude/agents/dispatch.md`

**用途**：纯编排器——按顺序调用其他 Agent。

**关键原则**：不直接读取规范。Hooks 向 Subagent 注入上下文。

**工具**：`Read, Bash`

**工作流**：
```
1. 运行 task.py current --source → 找到会话活动任务目录
2. 读取 task.json → 获取 next_action 数组
3. 对每个阶段：
   - implement → Task(subagent_type="implement")
   - check → Task(subagent_type="check")
   - finish → Task(subagent_type="check", prompt="[finish]...")
   - create-pr → Bash("python3 ... create_pr.py")
```

**禁止**：
- 直接读取规范文件
- 修改代码
- Git 操作（除通过 create-pr 脚本外）

---

## Plan Agent

**文件**：`.claude/agents/plan.md`

**用途**：评估需求并配置任务目录。

**工具**：`Read, Bash, Glob, Grep, Task`

**能力**：
- **拒绝**不清晰/模糊的需求
- 调用 Research Agent 分析代码库
- 创建包含需求的 `prd.md`
- 配置 `task.json`（branch、scope、phases）
- 初始化 JSONL 会话文件

**拒绝标准**：
- 模糊的需求（"让它更好"）
- 信息不完整
- 超出范围
- 可能有害
- 太大（应拆分）

**输出**：
```
task-dir/
├── task.json      # 已配置 branch、scope、dev_type
├── prd.md         # 清晰的需求
├── implement.jsonl
├── check.jsonl
└── debug.jsonl
```

---

## Research Agent

**文件**：`.claude/agents/research.md`

**用途**：查找和解释代码模式。纯研究，不修改。

**工具**：`Read, Glob, Grep, web search, chrome-devtools`

**允许**：
- 描述存在什么
- 描述它在哪里
- 描述它如何工作
- 描述交互

**禁止**（除非明确要求）：
- 建议改进
- 批评实现
- 推荐重构
- 修改任何文件
- Git 操作

**输出格式**：
```markdown
## Query Summary
...

## Files Found
- path/to/file.ts - description

## Code Patterns
...

## Related Specs
...
```

---

## Implement Agent

**文件**：`.claude/agents/implement.md`

**用途**：遵循注入的规范编写代码。

**工具**：`Read, Write, Edit, Bash, Glob, Grep`

**工作流**：
1. 理解规范（来自注入的上下文）
2. 理解任务产物（prd.md、design.md（如存在）、implement.md（如存在））
3. 实现功能
4. 自我检查（运行 lint/typecheck）

**禁止**：
- `git commit`
- `git push`
- `git merge`

**上下文注入**：Hook 注入 `implement.jsonl` 条目 + `prd.md` + `design.md`（如存在）+ `implement.md`（如存在）

---

## Check Agent

**文件**：`.claude/agents/check.md`

**用途**：审查代码并**自我修复**问题。

**工具**：`Read, Write, Edit, Bash, Glob, Grep`

**关键原则**：自己修复问题，而不仅仅是报告它们。

**工作流**：
1. 获取更改：`git diff`
2. 对照规范检查
3. 直接自我修复问题
4. 运行验证（lint、typecheck）
5. 输出完成标记

**控制者**：Ralph Loop（SubagentStop hook）

**完成标记**：
```
TYPECHECK_FINISH
LINT_FINISH
CODEREVIEW_FINISH
```

---

## Debug Agent

**文件**：`.claude/agents/debug.md`

**用途**：修复特定报告的问题。

**工具**：`Read, Write, Edit, Bash, Glob, Grep`

**工作流**：
1. 解析问题（优先级 P1 > P2 > P3）
2. 如需要则进行研究
3. 逐一修复
4. 验证每个修复（运行 typecheck）

**禁止**：
- 重构周围代码
- 添加新功能
- 修改无关文件
- 使用非空断言（`x!`）
- Git commit

---

## 调用 Agent

使用 `Task` 工具并指定 `subagent_type`：

```javascript
Task(
  subagent_type: "implement",
  prompt: "Implement the login feature",
  model: "opus",
  run_in_background: true  // optional
)
```

### Agent 解析

1. Claude Code 查找 `.claude/agents/{subagent_type}.md`
2. 加载 Agent 定义（工具、模型、指令）
3. **PreToolUse hook 触发** → `inject-subagent-context.py`
4. Hook 从 JSONL 文件注入上下文
5. Agent 在完整上下文中运行

---

## 上下文注入

### 工作原理

```
Task(subagent_type="implement") 被调用
            │
            ▼
    PreToolUse hook 触发
            │
            ▼
inject-subagent-context.py 运行
            │
            ├── 解析会话活动任务
            │
            ├── 从 .runtime/sessions/<session-key>.json 找到任务目录
            │
            ├── 加载 implement.jsonl
            │   {"file": ".trellis/spec/cli/backend/index.md", "reason": "..."}
            │   {"file": "src/services/auth.ts", "reason": "..."}
            │
            ├── 读取每个文件内容
            │
            └── 构建新提示词：
                # Implement Agent Task
                ## Your Context
                === .trellis/spec/cli/backend/index.md ===
                [content]
                === src/services/auth.ts ===
                [content]
                ## Your Task
                [original prompt]
```

### JSONL 文件

| 文件 | Agent | 用途 |
|------|-------|---------|
| `implement.jsonl` | implement | 开发规范、要遵循的模式 |
| `check.jsonl` | check | 检查规范、质量标准 |
| `debug.jsonl` | debug | 调试上下文、错误报告 |
| `research.jsonl` | research | （可选）研究范围 |

---

## 多 Agent 工作流

在**当前目录**中（无需 worktree）：

```
用户请求
    │
    ▼
编排器（你或 dispatch）
    │
    ├── Task(subagent_type="research")
    │   └── 返回：代码模式、相关文件
    │
    ├── Task(subagent_type="implement")
    │   └── 返回：实现的代码
    │
    ├── Task(subagent_type="check")
    │   └── 返回：审查并修复后的代码
    │
    └── 人工提交
```

### 任务工作流（来自 /trellis:start）

```
1. 用户描述任务
2. AI 分类（Question / Trivial / Development Task）
3. 对于 Development Task：
   a. Research Agent → 分析代码库
   b. 创建任务目录 + JSONL 文件
   c. task.py start → 设置会话活动任务
   d. Implement Agent → 编写代码
   e. Check Agent → 审查并修复
   f. 人工测试并提交
```

---

## 添加自定义 Agent

### 1. 创建定义

`.claude/agents/my-agent.md`：
```markdown
---
name: my-agent
description: |
  What this agent specializes in.
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---
# My Agent

## Core Responsibilities
1. ...

## Workflow
1. ...

## Forbidden Operations
- ...
```

### 2. 更新 Hook

编辑 `.claude/hooks/inject-subagent-context.py`：

```python
# Add constant
AGENT_MY_AGENT = "my-agent"

# Add to list
AGENTS_ALL = (..., AGENT_MY_AGENT)

# Add context function
def get_my_agent_context(repo_root, task_dir):
    # Load my-agent.jsonl or fallback
    ...

# Add to main switch
elif subagent_type == AGENT_MY_AGENT:
    context = get_my_agent_context(repo_root, task_dir)
    new_prompt = build_my_agent_prompt(original_prompt, context)
```

### 3. 创建 JSONL

在任务目录中创建 `my-agent.jsonl`：
```jsonl
{"file": ".trellis/spec/my-spec.md", "reason": "My agent spec"}
```

### 4.（可选）添加到 Dispatch

更新 `task.json` 默认阶段：
```json
"next_action": [
  {"phase": 1, "action": "my-agent"},
  ...
]
```

---

## 与多会话（Multi-Session）的对比

| 方面 | 多 Agent（Multi-Agent） | 多会话（Multi-Session） |
|--------|-------------|---------------|
| **是什么** | 多个 Agent 按顺序执行 | 并行隔离会话 |
| **在哪里** | 当前目录 | 独立的 worktree |
| **隔离性** | 共享文件系统 | 独立文件系统 |
| **用例** | 常规开发 | 并行任务 |
| **Worktree** | 不需要 | 必需 |

多 Agent（Multi-Agent）是 **Agent 系统**——dispatch 调用 implement、check 等。

多会话（Multi-Session）是**并行执行**——多个 worktree 同时运行。

它们可以组合使用：多会话（Multi-Session）在每个 worktree 中运行多 Agent（Multi-Agent）工作流。