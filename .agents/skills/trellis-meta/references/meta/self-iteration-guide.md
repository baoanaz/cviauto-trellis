# Trellis 自我迭代指南

如何在自定义 Trellis 时维护技能文档。

---

## 核心原则

**每次 Trellis 修改都必须在相应的技能中记录。**

```
对 Trellis 的修改 → 更新 trellis-local（项目技能）
对 Trellis 本身的更新 → 更新 trellis-meta（元技能）
```

---

## 决策树

```
这是对 Trellis 的修改吗？
│
├── 是：哪种类型？
│   │
│   ├── 项目特定的自定义
│   │   └── 更新 .claude/skills/trellis-local/SKILL.md
│   │
│   ├── 核心 Trellis 的 Bug 修复
│   │   └── 更新 ~/.claude/skills/trellis-meta/
│   │       （或先审查时使用项目副本）
│   │
│   └── 核心 Trellis 的新功能
│       └── 发布后更新 trellis-meta
│
└── 否：仅使用 Trellis
    └── 无需更新技能
```

---

## 自我迭代工作流

### 步骤 1：做出更改之前

```bash
# Check if project skill exists
ls .claude/skills/trellis-local/SKILL.md

# If not, create it from template
mkdir -p .claude/skills/trellis-local
# Copy template from trellis-meta/references/trellis-local-template.md
```

### 步骤 2：做出 Trellis 修改

执行你的工作：添加命令、修改 hook 等。

### 步骤 3：在项目技能中记录

打开 `.claude/skills/trellis-local/SKILL.md` 并：

1. **找到正确的部分**（Commands/Agents/Hooks/Specs/Workflow）
2. **使用模板添加条目**
3. **更新变更日志**
4. **更新摘要计数**

### 步骤 4：验证文档

问自己：
- [ ] 另一个 AI 能理解什么被更改了吗？
- [ ] "为什么"被记录了吗？
- [ ] 受影响的文件被列出来了吗？
- [ ] 日期被记录了吗？

---

## 文档模板

### 新命令

```markdown
#### /trellis:my-command
- **File**: `.claude/commands/trellis/my-command.md`
- **Purpose**: Brief description of what it does
- **Added**: 2026-01-31
- **Reason**: Why this command was needed

**Usage**:
```
/trellis:my-command [args]
```

**Example**:
User asks "..." → Command does "..."
```

### 新 Agent

```markdown
#### my-agent
- **File**: `.claude/agents/my-agent.md`
- **Purpose**: What this agent specializes in
- **Tools**: Read, Write, Edit, Bash, Glob, Grep
- **Model**: opus
- **Added**: 2026-01-31
- **Reason**: Why this agent was needed

**Hook Integration**:
- Added to `inject-subagent-context.py` at line X
- Uses `my-agent.jsonl` for context

**Invocation**:
```
Task(subagent_type="my-agent", prompt="...")
```
```

### Hook 修改

```markdown
#### inject-subagent-context.py
- **Hook Event**: PreToolUse:Task
- **Change**: Added handling for `my-agent` subagent type
- **Lines Modified**: 45-67, 120-135
- **Date**: 2026-01-31
- **Reason**: Support new agent type

**Code Changes**:

```python
# Added constant
AGENT_MY_AGENT = "my-agent"

# Added to agent list
AGENTS_ALL = (..., AGENT_MY_AGENT)

# Added context function
def get_my_agent_context(repo_root, task_dir):
    ...
```
```

### 规范类别添加

```markdown
#### security/
- **Path**: `.trellis/spec/security/`
- **Purpose**: Security guidelines for the project
- **Files**:
  - `index.md` - Category overview
  - `auth-guidelines.md` - Authentication patterns
  - `input-validation.md` - Validation requirements
- **Added**: 2026-01-31
- **Reason**: Project requires security-focused development

**JSONL Integration**:
```jsonl
{"file": ".trellis/spec/security/index.md", "reason": "Security guidelines"}
```
```

### 工作流更改

```markdown
#### Custom Phase Order
- **What**: Changed default task phases to include research phase
- **Files Affected**:
  - `.trellis/scripts/task.py` (init-context function)
  - Default task.json template
- **Date**: 2026-01-31
- **Reason**: All tasks in this project need research first

**New Default next_action**:
```json
[
  {"phase": 1, "action": "research"},
  {"phase": 2, "action": "implement"},
  {"phase": 3, "action": "check"},
  {"phase": 4, "action": "finish"},
  {"phase": 5, "action": "create-pr"}
]
```
```

---

## 变更日志格式

```markdown
### 2026-01-31 - Feature: Custom Research Phase
- Added research phase as default first phase
- Modified task.py init-context
- Updated task.json template
- Reason: Project complexity requires upfront research

### 2026-01-30 - Bugfix: Hook Timeout
- Increased ralph-loop.py timeout from 10s to 30s
- Reason: Complex verification commands were timing out

### 2026-01-29 - Initial Setup
- Initialized trellis-local skill
- Base Trellis version: 0.3.0
```

---

## 多项目场景

当使用多个 Trellis 项目时：

```
~/projects/
├── project-a/
│   └── .claude/skills/trellis-local/   # 项目 A 自定义
├── project-b/
│   └── .claude/skills/trellis-local/   # 项目 B 自定义
└── project-c/
    └── .claude/skills/trellis-local/   # 项目 C 自定义

~/.claude/skills/
└── trellis-meta/                        # 共享元技能（原始 Trellis）
```

**每个项目有自己的 `trellis-local`**，记录该项目特定的自定义。

**元技能是共享的**，记录原始 Trellis。

---

## 升级工作流

升级 Trellis 到新版本时：

### 1. 审查新版本变更

```bash
# Compare new meta-skill with current
diff -r ~/.claude/skills/trellis-meta/references/ \
        ./new-trellis-meta/references/
```

### 2. 检查冲突

审查 `trellis-local` 中的每个自定义：
- 新版本是否原生包含此功能？
- 新版本是否会破坏此自定义？
- 此自定义是否可以简化？

### 3. 谨慎合并

```bash
# Backup current meta-skill
cp -r ~/.claude/skills/trellis-meta ~/.claude/skills/trellis-meta.backup

# Update meta-skill
cp -r ./new-trellis-meta/* ~/.claude/skills/trellis-meta/
```

### 4. 更新项目技能

向 `trellis-local` 添加迁移说明：

```markdown
### 2026-02-01 - Upgraded to Trellis 0.4.0
- Updated meta-skill to 0.4.0
- Kept custom `security-agent` (not in vanilla)
- Migrated `my-command` to new command format
- Removed `old-hook` customization (now in vanilla)
```

---

## AI 指令

当 AI 修改 Trellis 时，必须：

1. **检查**项目中是否存在 `trellis-local`
2. 如果缺失，从模板**创建**
3. 在做出更改后立即**记录**
4. **更新**变更日志，包含日期和描述
5. **验证**文档是否完整

**绝不要**为项目特定的更改修改 `trellis-meta`。

**始终**告知用户记录了哪些内容。

示例 AI 响应：
> "我已添加 `/trellis:deploy` 命令，并在 `.claude/skills/trellis-local/SKILL.md` 的 Commands 部分中记录。"