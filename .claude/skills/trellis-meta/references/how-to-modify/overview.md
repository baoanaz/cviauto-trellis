# How-To 修改指南

常见 Trellis 定制场景及需要修改的文件。

---

## 快速参考

| 任务 | 需修改的文件 | 平台 |
|------|-----------------|----------|
| [添加斜杠命令](#添加斜杠命令) | commands/、trellis-local | All |
| [添加 Agent](#添加-agent) | agents/、hook、jsonl、trellis-local | CC |
| [修改 Hook](#修改-hook) | hooks/、settings.json、trellis-local | CC |
| [添加 Spec 分类](#添加-spec-分类) | spec/、jsonl、trellis-local | All |
| [修改验证命令](#修改验证命令) | worktree.yaml | CC |
| [添加工作流阶段](#添加工作流阶段) | task.json、dispatch、trellis-local | CC |
| [添加 post_create 步骤](#添加-post_create-步骤) | worktree.yaml | CC |
| [修改会话启动](#修改会话启动) | session-start.py、trellis-local | CC |
| [添加核心脚本](#添加核心脚本) | scripts/、trellis-local | All |
| [修改任务类型](#修改任务类型) | task.py、jsonl 模板 | All |

**平台**：`All` = 所有平台 | `CC` = 仅 Claude Code

---

## 详细指南

### 添加斜杠命令

**场景**：添加新的 `/trellis:my-command` 命令。

**需修改的文件**：

```
.claude/commands/trellis/my-command.md    # 创建：命令提示词
.cursor/commands/my-command.md            # 创建：Cursor 镜像（可选）
.trellis-local/SKILL.md                   # 更新：记录变更
```

**步骤**：
1. 创建带 YAML frontmatter 的命令文件
2. 按需镜像到 Cursor
3. 在 trellis-local 中记录

→ 详见 `add-command.md`。

---

### 添加 Agent

**场景**：添加新的 agent 类型，如 `my-agent`。

**需修改的文件**：

```
.claude/agents/my-agent.md                          # 创建：Agent 定义
.claude/hooks/inject-subagent-context.py            # 修改：添加 agent 处理逻辑
.trellis/tasks/{template}/my-agent.jsonl            # 创建：上下文模板
.trellis-local/SKILL.md                             # 更新：记录变更
```

**可选**：
```
.claude/agents/dispatch.md                          # 修改：如需加入流水线
task.json 模板                                      # 修改：添加到 next_action
```

→ 详见 `add-agent.md`。

---

### 修改 Hook

**场景**：修改 hook 行为（上下文注入、校验等）。

**需修改的文件**：

```
.claude/hooks/{hook-name}.py              # 修改：Hook 逻辑
.claude/settings.json                     # 修改：如修改 matcher/timeout
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `modify-hook.md`。

---

### 添加 Spec 分类

**场景**：添加新的 spec 分类，如 `mobile/`。

**需修改的文件**：

```
.trellis/spec/mobile/index.md             # 创建：分类索引
.trellis/spec/mobile/*.md                 # 创建：Spec 文件
.trellis/tasks/{template}/*.jsonl         # 更新：引用新 spec
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `add-spec.md`。

---

### 修改验证命令

**场景**：添加或修改 Ralph Loop 验证命令。

**需修改的文件**：

```
.trellis/worktree.yaml                    # 修改：verify 部分
```

**示例**：
```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test        # 添加此行
```

→ 详见 `change-verify.md`。

---

### 添加工作流阶段

**场景**：向任务工作流添加新阶段。

**需修改的文件**：

```
task.json（任务目录中）                    # 修改：next_action 数组
.claude/agents/dispatch.md                # 修改：处理新阶段
.claude/agents/{new-phase}.md             # 创建：如需新 agent
.claude/hooks/inject-subagent-context.py  # 修改：如有新 agent
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `add-phase.md`。

---

### 添加 post_create 步骤

**场景**：在 worktree 创建后添加设置步骤。

**需修改的文件**：

```
.trellis/worktree.yaml                    # 修改：post_create 部分
```

**示例**：
```yaml
post_create:
  - pnpm install
  - pnpm db:migrate    # 添加此行
```

---

### 修改会话启动

**场景**：修改会话启动时注入的上下文内容。

**需修改的文件**：

```
.claude/hooks/session-start.py            # 修改：注入逻辑
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `modify-session-start.md`。

---

### 添加核心脚本

**场景**：添加新的自动化脚本。

**需修改的文件**：

```
.trellis/scripts/my-script.py             # 创建：脚本
.trellis/scripts/common/*.py              # 创建/修改：共享工具
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `add-script.md`。

---

### 修改任务类型

**场景**：添加或修改任务 dev_type（frontend、backend 等）。

**需修改的文件**：

```
.trellis/scripts/task.py                  # 修改：init-context 逻辑
.trellis/tasks/{template}/*.jsonl         # 创建：新 JSONL 模板
.trellis-local/SKILL.md                   # 更新：记录变更
```

→ 详见 `change-task-types.md`。

---

## 本目录文档

| 文档 | 场景 |
|----------|----------|
| `add-command.md` | 添加斜杠命令 |
| `add-agent.md` | 添加新的 agent 类型 |
| `modify-hook.md` | 修改 hook 行为 |
| `add-spec.md` | 添加 spec 分类 |
| `change-verify.md` | 修改验证命令 |
| `add-phase.md` | 添加工作流阶段 |
| `modify-session-start.md` | 修改会话启动注入 |
| `add-script.md` | 添加自动化脚本 |
| `change-task-types.md` | 添加任务类型 |