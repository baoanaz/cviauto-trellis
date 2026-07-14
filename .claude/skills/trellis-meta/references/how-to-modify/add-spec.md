# How To：添加 Spec 分类

添加新的 spec 分类，如 `mobile/`。

**平台**：All

---

## 需修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| `.trellis/spec/mobile/index.md` | 创建 | 是 |
| `.trellis/spec/mobile/*.md` | 创建 | 是 |
| 任务 JSONL 模板 | 更新 | 是 |
| `trellis-local/SKILL.md` | 更新 | 是 |

---

## 步骤 1：创建分类目录

```bash
mkdir -p .trellis/spec/mobile
```

---

## 步骤 2：创建索引文件

创建 `.trellis/spec/mobile/index.md`：

```markdown
# Mobile Specifications

移动端开发指南。

## 快速参考

| 主题 | 指南 |
|-------|-----------|
| 架构 | MVVM 模式 |
| 状态 | 使用 StateFlow |
| 导航 | Jetpack Navigation |

## 规范

1. [架构指南](./architecture.md)
2. [UI 指南](./ui-guidelines.md)
3. [状态管理](./state-management.md)

## 核心原则

- 原则 1
- 原则 2
- 原则 3
```

---

## 步骤 3：创建 Spec 文件

在分类目录中创建各个 spec 文件：

### 示例：`architecture.md`

```markdown
# Mobile Architecture

## 概述

架构方案说明。

## 指南

### 1. 使用 MVVM 模式

说明...

**Do:**
```kotlin
// 良好示例
```

**Don't:**
```kotlin
// 不良示例
```

### 2. 另一条指南

...

## 相关 Spec

- [UI 指南](./ui-guidelines.md)
```

---

## 步骤 4：更新 JSONL 模板

将新 spec 添加到相关 JSONL 模板中。

### 选项 A：更新 task.py

修改 `init-context` 以包含 mobile spec：

```python
def init_mobile_context(task_dir):
    jsonl_path = os.path.join(task_dir, "implement.jsonl")
    with open(jsonl_path, "a") as f:
        f.write(json.dumps({
            "file": ".trellis/spec/mobile/index.md",
            "reason": "移动端指南"
        }) + "\n")
```

### 选项 B：添加到现有模板

编辑现有 JSONL 文件：

```jsonl
{"file": ".trellis/spec/mobile/index.md", "reason": "移动端指南"}
{"file": ".trellis/spec/mobile/architecture.md", "reason": "架构模式"}
```

---

## 步骤 5：在 trellis-local 中记录

更新 `.claude/skills/trellis-local/SKILL.md`：

```markdown
## 已定制的 Spec

### 已添加的分类

#### mobile/
- **路径**: `.trellis/spec/mobile/`
- **用途**: 移动端开发指南
- **添加日期**: 2026-01-31
- **文件**:
  - `index.md` - 概述
  - `architecture.md` - 架构模式
  - `ui-guidelines.md` - UI 模式
```

---

## Spec 文件最佳实践

### 结构

```markdown
# [Spec 标题]

## 概述
简要描述。

## 指南

### 1. [指南名称]
带示例的说明。

### 2. [另一条指南]
...

## 相关 Spec
到相关 spec 的链接。
```

### 命名

- 使用 kebab-case：`ui-guidelines.md`
- 描述性命名：`state-management.md` 而非 `state.md`

### 交叉引用

在 spec 之间建立链接：

```markdown
详见 [State Management](./state-management.md)。
```

---

## 测试

1. 验证索引链接正常工作
2. 创建包含新 spec 的 JSONL 任务
3. 验证 spec 注入正确（Claude Code）
4. 验证 spec 可读（Cursor）

---

## 检查清单

- [ ] 分类目录已创建
- [ ] 索引文件已创建，包含概述
- [ ] Spec 文件已创建，格式正确
- [ ] JSONL 模板已更新
- [ ] 已在 trellis-local 中记录
- [ ] 交叉引用已验证