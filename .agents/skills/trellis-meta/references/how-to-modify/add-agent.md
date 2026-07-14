# How To：添加 Agent

添加新的 agent 类型，如 `my-agent`。

**平台**：仅 Claude Code

---

## 需修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| `.claude/agents/my-agent.md` | 创建 | 是 |
| `.claude/hooks/inject-subagent-context.py` | 修改 | 是 |
| `.trellis/tasks/{template}/my-agent.jsonl` | 创建 | 是 |
| `trellis-local/SKILL.md` | 更新 | 是 |
| `.claude/agents/dispatch.md` | 修改 | 如需加入流水线 |

---

## 步骤 1：创建 Agent 定义

创建 `.claude/agents/my-agent.md`：

```markdown
---
name: my-agent
description: |
  此 agent 专精于什么。
  应在何时使用。
tools: Read, Write, Edit, Bash, Glob, Grep
model: opus
---

# My Agent

## 核心职责

1. 首要职责
2. 次要职责
3. ...

## 工作流

1. 第一步
2. 第二步
3. ...

## 禁止操作

- 事项 1（禁止原因）
- 事项 2（禁止原因）
- git commit（除非明确允许）

## 输出格式

Agent 应产出的内容。
```

### Agent 定义字段

| 字段 | 是否必需 | 描述 |
|-------|----------|-------------|
| `name` | 是 | Agent 标识符 |
| `description` | 是 | Agent 的功能描述 |
| `tools` | 是 | 允许使用的工具 |
| `model` | 否 | 使用的模型（opus、sonnet） |

---

## 步骤 2：更新 Hook

编辑 `.claude/hooks/inject-subagent-context.py`：

### 添加常量

```python
# 在其他 agent 常量附近
AGENT_MY_AGENT = "my-agent"

# 添加到列表
AGENTS_ALL = (..., AGENT_MY_AGENT)
```

### 添加上下文函数

```python
def get_my_agent_context(repo_root: str, task_dir: str) -> list:
    """获取 my-agent 的上下文。"""
    context_files = []

    # 从 JSONL 加载
    jsonl_path = os.path.join(task_dir, "my-agent.jsonl")
    if os.path.exists(jsonl_path):
        context_files.extend(load_jsonl_context(jsonl_path))

    # 添加其他附加文件
    # context_files.append({"file": "...", "reason": "..."})

    return context_files
```

### 添加到主 switch

```python
elif subagent_type == AGENT_MY_AGENT:
    context = get_my_agent_context(repo_root, task_dir)
    new_prompt = build_agent_prompt(
        agent_name="My Agent",
        original_prompt=original_prompt,
        context=context
    )
```

---

## 步骤 3：创建 JSONL 模板

为任务目录创建上下文模板。

**选项 A**：添加到 `task.py init-context`：

```python
def init_my_agent_context(task_dir, dev_type):
    jsonl_path = os.path.join(task_dir, "my-agent.jsonl")
    with open(jsonl_path, "w") as f:
        # 添加相关 spec
        f.write(json.dumps({
            "file": ".trellis/spec/guides/index.md",
            "reason": "思考指南"
        }) + "\n")
```

**选项 B**：手动创建模板：

```jsonl
{"file": ".trellis/spec/guides/index.md", "reason": "思考指南"}
{"file": ".trellis/tasks/{task}/prd.md", "reason": "需求文档"}
```

---

## 步骤 4：加入流水线（可选）

如果此 agent 应是标准工作流的一部分：

### 更新 task.json 模板

```json
"next_action": [
  {"phase": 1, "action": "implement"},
  {"phase": 2, "action": "my-agent"},  // 添加此处
  {"phase": 3, "action": "check"},
  {"phase": 4, "action": "finish"}
]
```

### 更新 dispatch.md

添加对新阶段的处理：

```markdown
## 阶段处理

...

### my-agent 阶段
- 调用 `Task(subagent_type="my-agent")`
- 等待完成
- 进入下一阶段
```

---

## 步骤 5：在 trellis-local 中记录

更新 `.claude/skills/trellis-local/SKILL.md`：

```markdown
## Agents

### 已添加的 Agent

#### my-agent
- **文件**: `.claude/agents/my-agent.md`
- **平台**: [CC]
- **用途**: 功能描述
- **工具**: Read, Write, Edit, Bash, Glob, Grep
- **添加日期**: 2026-01-31
- **原因**: 添加原因

### 已修改的 Hook

#### inject-subagent-context.py
- **变更**: 添加了对 `my-agent` 类型的支持
- **修改行**: XX-YY
- **日期**: 2026-01-31
```

---

## 测试

1. 创建包含 my-agent.jsonl 的任务
2. 设为当前任务：`task.py start <task-dir>`
3. 调用 agent：`Task(subagent_type="my-agent", prompt="Test")`
4. 验证上下文注入正常
5. 验证 agent 行为符合定义

---

## 检查清单

- [ ] Agent 定义已创建，frontmatter 正确
- [ ] Hook 已更新 agent 常量
- [ ] Hook 已更新上下文函数
- [ ] Hook 已更新主 switch 分支
- [ ] JSONL 模板已创建
- [ ] 已加入流水线（如需要）
- [ ] 已在 trellis-local 中记录
- [ ] 已测试 agent