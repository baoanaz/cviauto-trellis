# 操作指南：修改 Hook

更改 Hook 行为以实现上下文注入或验证。

**平台**：仅限 Claude Code

---

## 需要修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| `.claude/hooks/{hook}.py` | 修改 | 是 |
| `.claude/settings.json` | 修改 | 如果更改匹配器（matcher）/超时（timeout） |
| `trellis-local/SKILL.md` | 更新 | 是 |

---

## Hook 类型

| Hook | 文件 | 用途 |
|------|------|---------|
| SessionStart | `session-start.py` | 注入初始上下文 |
| PreToolUse:Task | `inject-subagent-context.py` | 注入 Agent 上下文 |
| SubagentStop:check | `ralph-loop.py` | 质量强制执行 |

---

## 步骤 1：理解 Hook 结构

### 输入（stdin）

Hook 接收 JSON 输入：

```json
{
  "hook_event": "PreToolUse",
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "implement",
    "prompt": "..."
  }
}
```

### 输出（stdout）

Hook 输出 JSON：

```json
{
  "result": "continue",
  "message": "Optional message to inject",
  "updatedInput": {
    "prompt": "Modified prompt..."
  }
}
```

### 结果类型

| 结果 | 效果 |
|--------|--------|
| `continue` | 允许操作，可选修改 |
| `block` | 阻止操作 |

---

## 步骤 2：修改 Hook 逻辑

### 示例：向会话启动添加上下文

编辑 `.claude/hooks/session-start.py`：

```python
def get_additional_context():
    """Add custom context."""
    context = []

    # Add custom file
    custom_path = os.path.join(repo_root, ".trellis/custom.md")
    if os.path.exists(custom_path):
        with open(custom_path) as f:
            context.append(f"## Custom Context\n{f.read()}")

    return "\n".join(context)

# In main():
additional = get_additional_context()
message = f"{existing_message}\n\n{additional}"
```

### 示例：添加 Agent 验证

编辑 `.claude/hooks/inject-subagent-context.py`：

```python
def validate_agent_input(subagent_type, prompt):
    """Validate agent invocation."""
    if subagent_type == "implement":
        if "git commit" in prompt.lower():
            return False, "Implement agent cannot commit"
    return True, None

# In main():
valid, error = validate_agent_input(subagent_type, prompt)
if not valid:
    output = {"result": "block", "message": error}
    print(json.dumps(output))
    return
```

### 示例：添加验证命令

编辑 `.claude/hooks/ralph-loop.py`：

```python
# Add to verify commands list
ADDITIONAL_COMMANDS = ["pnpm test:unit"]

def get_verify_commands():
    commands = read_worktree_yaml_verify()
    commands.extend(ADDITIONAL_COMMANDS)
    return commands
```

---

## 步骤 3：修改设置（如需要）

编辑 `.claude/settings.json`：

### 更改超时

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Task",
        "hooks": [
          {
            "type": "command",
            "command": "python3 ...",
            "timeout": 60  // Increase from 30
          }
        ]
      }
    ]
  }
}
```

### 更改匹配器

```json
{
  "hooks": {
    "SubagentStop": [
      {
        "matcher": "check|my-agent",  // Add new agent
        "hooks": [...]
      }
    ]
  }
}
```

---

## 步骤 4：在 trellis-local 中记录

更新 `.claude/skills/trellis-local/SKILL.md`：

```markdown
## Hooks Changed

#### session-start.py
- **Hook Event**: SessionStart
- **Change**: Added custom context injection
- **Lines modified**: 45-60
- **Date**: 2026-01-31
- **Reason**: Need to inject project-specific context

#### inject-subagent-context.py
- **Hook Event**: PreToolUse:Task
- **Change**: Added validation for implement agent
- **Lines modified**: 120-135
- **Date**: 2026-01-31
- **Reason**: Prevent accidental git commits
```

---

## 测试

### 手动测试

```bash
# Test session-start
python3 .claude/hooks/session-start.py

# Test inject-subagent-context
echo '{"tool_input":{"subagent_type":"implement","prompt":"test"}}' | \
  python3 .claude/hooks/inject-subagent-context.py

# Test ralph-loop
echo '{"subagent_type":"check","output":"test"}' | \
  python3 .claude/hooks/ralph-loop.py
```

### 集成测试

1. 启动新的 Claude Code 会话
2. 验证 session-start 输出
3. 调用 Subagent
4. 验证上下文注入
5. 验证 Ralph Loop（针对 check agent）

---

## 常见修改

### 向会话上下文添加文件

```python
# session-start.py
files_to_inject = [
    ".trellis/workflow.md",
    ".trellis/custom-context.md",  # Add this
]
```

### 跳过对某些 Agent 的注入

```python
# inject-subagent-context.py
SKIP_INJECTION = ["research"]

if subagent_type in SKIP_INJECTION:
    print(json.dumps({"result": "continue"}))
    return
```

### 添加自定义验证

```python
# ralph-loop.py
def custom_check():
    """Custom verification logic."""
    # Check something
    return True, None

# In verify():
ok, error = custom_check()
if not ok:
    return False, error
```

---

## 检查清单

- [ ] Hook 逻辑已修改
- [ ] 设置已更新（如需要）
- [ ] 手动测试通过
- [ ] 集成测试通过
- [ ] 已在 trellis-local 中记录