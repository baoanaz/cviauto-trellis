# 规范系统（Spec System）

维护用于指导 AI 开发的编码规范。

---

## 目录结构

```
.trellis/spec/
├── cli/                        # 按包划分的规范（如 packages/cli/）
│   ├── frontend/               # 前端规范
│   │   ├── index.md
│   │   ├── component-guidelines.md
│   │   ├── hook-guidelines.md
│   │   ├── state-management.md
│   │   └── ...
│   │
│   ├── backend/                # 后端规范
│   │   ├── index.md
│   │   ├── directory-structure.md
│   │   ├── error-handling.md
│   │   ├── api-patterns.md
│   │   └── ...
│   │
│   └── unit-test/              # 单元测试规范
│       ├── index.md
│       └── ...
│
└── guides/                     # 思维指南（跨包）
    ├── index.md
    ├── cross-layer-thinking-guide.md
    ├── code-reuse-thinking-guide.md
    └── cross-platform-thinking-guide.md
```

---

## 规范分类

### Frontend (`cli/frontend/`)

UI 与客户端模式：
- 组件结构
- React hooks 用法
- 状态管理
- 样式约定
- 无障碍访问

### Backend (`cli/backend/`)

服务端模式：
- 目录结构
- API 设计
- 错误处理
- 数据库访问
- 安全

### Guides (`guides/`)

跨领域思维指南：
- 如何思考跨层变更
- 代码复用策略
- 平台考量

---

## 索引文件

每个分类都有一个 `index.md`，用于：
1. 提供分类概览
2. 列出该分类下的所有规范
3. 提供常见模式的快速参考

### 示例：`frontend/index.md`

```markdown
# Frontend Specifications

## Quick Reference

| Topic | Guideline |
|-------|-----------|
| Components | Functional components only |
| State | Use React Query for server state |
| Styling | Tailwind CSS |

## Specifications

1. [Component Guidelines](./component-guidelines.md)
2. [Hook Guidelines](./hook-guidelines.md)
3. [State Management](./state-management.md)
```

---

## 规范文件格式

```markdown
# [规范标题]

## 概述
简要描述本规范涵盖的内容。

## 规范细则

### 1. [规范名称]
详细说明...

**推荐：**
```typescript
// 好的示例
```

**避免：**
```typescript
// 不好的示例
```

### 2. [另一条规范]
...

## 相关规范
- [Related Spec 1](./related-spec.md)
```

---

## 使用规范

### 在 JSONL 上下文文件中

在任务上下文中引用规范：

```jsonl
{"file": ".trellis/spec/cli/frontend/index.md", "reason": "Frontend overview"}
{"file": ".trellis/spec/cli/frontend/component-guidelines.md", "reason": "Component patterns"}
```

### 手动读取（Cursor）

在会话开始时读取规范：
```
1. Read .trellis/spec/{category}/index.md
2. Read specific guidelines as needed
3. Follow patterns in your code
```

---

## 创建新规范

### 1. 选择分类

- 前端 UI 模式 → `frontend/`
- 后端/API 模式 → `backend/`
- 跨领域指南 → `guides/`

### 2. 创建规范文件

```bash
touch .trellis/spec/cli/frontend/new-pattern.md
```

### 3. 遵循格式

使用上述规范文件格式。

### 4. 更新索引

添加到分类的 `index.md`：

```markdown
## Specifications
...
N. [New Pattern](./new-pattern.md)
```

### 5. 在 JSONL 中引用

添加到相关任务上下文文件中。

---

## 添加新分类

### 1. 创建目录

```bash
mkdir .trellis/spec/mobile
```

### 2. 创建索引

```bash
touch .trellis/spec/mobile/index.md
```

### 3. 添加分类规范

创建各个规范文件。

### 4. 更新任务模板

确保新分类在 JSONL 模板中可用。

---

## 最佳实践

1. **保持规范聚焦** - 每个文件一个主题
2. **使用示例** - 展示推荐/避免模式
3. **关联相关规范** - 交叉引用
4. **定期更新** - 规范随代码库演进
5. **索引一切** - 保持索引文件最新