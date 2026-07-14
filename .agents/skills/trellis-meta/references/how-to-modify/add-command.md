# How To：添加斜杠命令

添加新的 `/trellis:my-command` 命令。

**平台**：All（Claude Code + Cursor）

---

## 需修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| `.claude/commands/trellis/my-command.md` | 创建 | 是 |
| `.cursor/commands/my-command.md` | 创建 | 可选 |
| `trellis-local/SKILL.md` | 更新 | 是 |

---

## 步骤 1：创建命令文件

创建 `.claude/commands/trellis/my-command.md`：

```markdown
---
name: my-command
description: 命令功能的简短描述
---

# My Command

## 用途

命令用途的详细描述。

## 使用场景

- 场景 1
- 场景 2

## 工作流

1. 第一步
2. 第二步
3. 第三步

## 输出

命令产出的内容。
```

### 命令命名规范

- 使用 kebab-case：`my-command`，而非 `myCommand`
- 按需添加分类前缀：`check-cross-layer`、`before-dev`

---

## 步骤 2：镜像到 Cursor（可选）

如需支持 Cursor，复制到 `.cursor/commands/my-command.md`。

**注意**：Cursor 命令没有 `trellis:` 前缀。

---

## 步骤 3：在 trellis-local 中记录

更新 `.claude/skills/trellis-local/SKILL.md`：

```markdown
## 命令

### 已添加的命令

#### /trellis:my-command
- **文件**: `.claude/commands/trellis/my-command.md`
- **平台**: [ALL]
- **用途**: 功能描述
- **添加日期**: 2026-01-31
- **原因**: 添加原因
```

---

## 示例

### 简单命令

```markdown
---
name: check-types
description: 运行 TypeScript 类型检查
---

# Check Types

运行 `pnpm typecheck` 并报告结果。

## 使用方式

在修改代码后运行此命令以验证类型安全。
```

### 带参数的命令

命令可以引用用户输入或上下文：

```markdown
---
name: review-file
description: 审查指定文件的代码质量
---

# Review File

## 输入

用户应指定要审查的文件。

## 工作流

1. 读取指定文件
2. 对照相关 spec 检查
3. 报告发现的问题
```

---

## 测试

1. 运行命令：`/trellis:my-command`
2. 验证行为符合描述
3. 测试边界情况

---

## 检查清单

- [ ] 命令文件已创建，frontmatter 正确
- [ ] 已镜像到 Cursor（如需要）
- [ ] 已在 trellis-local 中记录
- [ ] 已测试命令