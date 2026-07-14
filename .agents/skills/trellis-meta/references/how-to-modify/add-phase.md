# How To：添加工作流阶段

向任务工作流流水线添加新阶段。

**平台**：仅 Claude Code

---

## 需修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| 任务 `task.json` | 修改 | 是 |
| `.claude/agents/dispatch.md` | 修改 | 是 |
| `.claude/agents/{new-agent}.md` | 创建 | 如有新 agent |
| `inject-subagent-context.py` | 修改 | 如有新 agent |
| `trellis-local/SKILL.md` | 更新 | 是 |

---

## 标准阶段

默认工作流：

```
implement → check → finish → create-pr
```

---

## 步骤 1：更新 task.json

修改 task.json 中的 `next_action` 数组：

### 在 implement 之后添加阶段

```json
{
  "next_action": [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "review"},      // 新阶段
    {"phase": 3, "action": "check"},
    {"phase": 4, "action": "finish"},
    {"phase": 5, "action": "create-pr"}
  ]
}
```

### 在 implement 之前添加阶段

```json
{
  "next_action": [
    {"phase": 1, "action": "design"},      // 新阶段
    {"phase": 2, "action": "implement"},
    {"phase": 3, "action": "check"},
    {"phase": 4, "action": "finish"}
  ]
}
```

---

## 步骤 2：更新 Dispatch Agent

编辑 `.claude/agents/dispatch.md`：

### 添加阶段处理

```markdown
## 阶段处理

### implement 阶段
...现有内容...

### review 阶段（新增）
- 用途：在 check 之前审查实现
- 调用：`Task(subagent_type="review")`
- 下一步：进入 check 阶段

### check 阶段
...现有内容...
```

### 更新工作流描述

```markdown
## 工作流

1. 读取 task.json 获取 next_action
2. 按顺序执行各阶段：
   - implement：编写代码
   - review：审查实现（新增）
   - check：质量验证
   - finish：最终审查
   - create-pr：创建 Pull Request
```

---

## 步骤 3：创建 Agent（如有新 Agent）

如果该阶段使用新的 agent，则创建 agent 定义。

→ 详见 `add-agent.md`。

快速版本：

```markdown
---
name: review
description: 在 check 阶段之前审查实现。
tools: Read, Glob, Grep
---

# Review Agent

## 核心职责
1. 审查代码变更
2. 对照需求检查
3. 在 check 阶段之前识别问题

## 禁止操作
- 编写代码（那是 implement 的工作）
- Git 操作
```

---

## 步骤 4：更新 Hook（如有新 Agent）

如果使用新 agent，更新 `inject-subagent-context.py`：

```python
AGENT_REVIEW = "review"
AGENTS_ALL = (..., AGENT_REVIEW)

def get_review_context(repo_root, task_dir):
    # 加载 review.jsonl
    ...

elif subagent_type == AGENT_REVIEW:
    context = get_review_context(repo_root, task_dir)
    ...
```

---

## 步骤 5：更新任务模板

更新 `task.py` 中默认的 task.json 创建逻辑：

```python
default_next_action = [
    {"phase": 1, "action": "implement"},
    {"phase": 2, "action": "review"},     # 添加新阶段
    {"phase": 3, "action": "check"},
    {"phase": 4, "action": "finish"},
]
```

---

## 步骤 6：在 trellis-local 中记录

```markdown
## 工作流变更

### 已添加 review 阶段
- **位置**: implement 之后，check 之前
- **Agent**: review
- **用途**: 审查实现质量
- **日期**: 2026-01-31
- **原因**: 在 check 阶段之前发现问题
```

---

## 常见阶段模式

### Design → Implement → Check

```json
"next_action": [
  {"phase": 1, "action": "design"},
  {"phase": 2, "action": "implement"},
  {"phase": 3, "action": "check"}
]
```

### Implement → Test → Check

```json
"next_action": [
  {"phase": 1, "action": "implement"},
  {"phase": 2, "action": "test"},
  {"phase": 3, "action": "check"}
]
```

### Research → Implement → Check

```json
"next_action": [
  {"phase": 1, "action": "research"},
  {"phase": 2, "action": "implement"},
  {"phase": 3, "action": "check"}
]
```

---

## 测试

1. 创建包含新阶段 next_action 的任务
2. 设为当前任务
3. 运行 dispatch agent
4. 验证各阶段按顺序执行
5. 验证新阶段正常工作

---

## 检查清单

- [ ] task.json 已更新，包含新阶段
- [ ] dispatch.md 已更新阶段处理逻辑
- [ ] Agent 已创建（如有新 agent）
- [ ] Hook 已更新（如有新 agent）
- [ ] 任务模板已更新
- [ ] 已在 trellis-local 中记录
- [ ] 已测试工作流