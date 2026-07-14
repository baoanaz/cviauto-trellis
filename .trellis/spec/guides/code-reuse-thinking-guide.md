# 代码复用思维指南（Code Reuse Thinking Guide）

> **用途**：在创建新代码之前停下来想一想——是否已经存在？

---

## 问题所在（The Problem）

**重复代码是不一致性 bug 的第一大来源。**

当你复制粘贴或重写现有逻辑时：
- Bug 修复不会传播
- 行为随时间推移产生分歧
- 代码库变得更难理解

---

## 在编写新代码之前

### 第 1 步：先搜索

```bash
# 搜索类似的函数名
grep -r "functionName" .

# 搜索类似的逻辑
grep -r "keyword" .
```

### 第 2 步：问自己这些问题

| 问题（Question） | 如果是…… |
|----------|-----------|
| 类似的函数是否已存在？ | 使用或扩展它 |
| 这个模式是否在其他地方使用？ | 遵循现有模式 |
| 这能否成为共享工具函数？ | 在正确的位置创建它 |
| 我是否在从另一个文件复制代码？ | **停止**——提取为共享 |

---

## 常见重复模式

### 模式 1：复制粘贴函数

**坏做法**：将一个验证函数复制到另一个文件

**好做法**：提取到共享工具函数中，在需要的地方导入

### 模式 2：相似组件

**坏做法**：创建一个与现有组件 80% 相似的新组件

**好做法**：使用 props/variants 扩展现有组件

### 模式 3：重复常量

**坏做法**：在多个文件中定义相同的常量

**好做法**：单一真实来源，到处导入

### 模式 4：重复的有效负载字段提取

**坏做法**：多个消费者各自本地转换相同的 JSON/event 字段：

```typescript
const description = (ev as { description?: string }).description;
const context = (ev as { context?: ContextEntry[] }).context;
```

这是重复的契约逻辑，即使代码只有两行。每个消费者现在都有自己对有效负载含义的定义。

**好做法**：将解码器、类型守卫或投影放在数据所有者旁边：

```typescript
if (isThreadEvent(ev)) {
  renderThreadEvent(ev);
}
```

**规则**：如果相同的非类型化有效负载字段在 2 个以上地方被读取，在添加第三个读取者之前创建共享的类型守卫 / 标准化器 / 投影。

---

## 何时抽象

**抽象当：**
- 相同代码出现 3 次以上
- 逻辑足够复杂，可能存在 bug
- 多个人可能需要这个

**不要抽象当：**
- 仅使用一次
- 简单的单行代码
- 抽象比重复更复杂

---

## 批量修改之后

当你对多个文件进行了类似的修改后：

1. **审查**：你是否捕获了所有实例？
2. **搜索**：运行 grep 查找遗漏项
3. **考虑**：这是否应该被抽象？

### Reducer 应使用穷举结构

当状态从类似动作的值（`action`、`kind`、`status`、`phase`）派生时，优先使用一个带有 `switch` 的 reducer，而非分散的 `if/else` 更新。

```typescript
// 坏——特定于动作的状态转换难以审计
if (action === "opened") { ... }
else if (action === "comment") { ... }
else if (action === "status") { ... }

// 好——一个 reducer 拥有转换表
switch (event.action) {
  case "opened":
    ...
    return;
  case "comment":
    ...
    return;
}
```

这在事件日志作为真实来源时很重要。Reducer 是文档化的重放模型；显示代码和命令不应重复该重放模型的片段。

---

## 提交前检查清单

- [ ] 搜索了现有的类似代码
- [ ] 没有应该共享的复制粘贴逻辑
- [ ] 没有在共享解码器之外对非类型化有效负载字段进行重复提取
- [ ] 常量定义在一个地方
- [ ] 相似模式遵循相同的结构
- [ ] Reducer/action 转换位于一个 reducer 或命令分派器中

---

## 陷阱：Python if/elif/else 穷举检查

**问题**：Python 的 if/elif/else 链没有编译期穷举检查。当你向 `Literal` 类型（如 `Platform`）添加新值时，现有的 if/elif/else 链会静默地回退到 `else` 并使用错误的默认值。

**症状**：新平台部分工作——某些方法返回 Claude 默认值而非平台特定值。没有错误被抛出。

**示例**（`cli_adapter.py`）：
```python
# 坏："gemini" 回退到 else，返回 "claude"
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    else:
        return "claude"  # gemini 静默地获得 "claude"！

# 好：为每个平台显式分支
@property
def cli_name(self) -> str:
    if self.platform == "opencode":
        return "opencode"
    elif self.platform == "gemini":
        return "gemini"
    else:
        return "claude"
```

**预防**：当向 Python `Literal` 类型添加新值时，搜索所有在该类型上切换的 if/elif/else 链，并添加显式分支。不要依赖 `else` 对新值是正确的。

---

## 陷阱：产生相同输出的非对称机制

**问题**：当两种不同机制必须产生相同的文件集（例如，用于 init 的递归目录复制 vs 用于 update 的手动 `files.set()`），结构变更（重命名、移动、添加子目录）只通过自动机制传播。手动机制会静默漂移。

**症状**：Init 完美运行，但 update 在错误路径创建文件或完全遗漏文件。

**预防**：
- **最佳**：消除非对称性——让手动路径调用自动路径（例如，`collectTemplateFiles()` 调用 `getAllScripts()` 而非维护自己的列表）
- **如果非对称不可避免**：添加一个回归测试来比较两种机制的输出
- 在迁移目录结构时，搜索引用旧结构的所有代码路径

**真实示例**：`trellis update` 有一个手动 `files.set()` 列表，包含 11 个 `getAllScripts()` 已经追踪的脚本。修复：用 `for..of getAllScripts()` 循环替换手动列表。参见 v0.4.0-beta.3 中的 `update.ts` 重构。

---

## 模板文件注册（Trellis 特有）

在向 `src/templates/trellis/scripts/` 添加新文件时：

**单一注册点**：`src/templates/trellis/index.ts`

1. 添加 `export const xxxScript = readTemplate("scripts/path/file.py");`
2. 添加到 `getAllScripts()` Map

就是这样。`commands/update.ts` 直接使用 `getAllScripts()`——无需手动同步。

**为什么这很重要**：没有在 `getAllScripts()` 中注册，`trellis update` 就不会将文件同步到用户项目。Bug 修复和功能不会传播。

**历史**：在 v0.4.0-beta.3 之前，`update.ts` 有自己的手动维护的文件列表，经常与 `getAllScripts()` 不同步。这导致 11 个 Python 文件在 `trellis update` 期间被静默跳过。修复方法是消除重复列表，使用 `getAllScripts()` 作为唯一的真实来源。

### 新脚本快速检查清单

```bash
# 添加新的 .py 文件后，验证它在 getAllScripts() 中：
grep -l "newFileName" src/templates/trellis/index.ts  # 应该匹配
```

### 模板同步规范

`.trellis/scripts/`（自用/dogfooded）和 `packages/cli/src/templates/trellis/scripts/`（模板）必须保持相同。编辑 `.trellis/scripts/` 后，始终同步：

```bash
rsync -av --delete --exclude='__pycache__' .trellis/scripts/ packages/cli/src/templates/trellis/scripts/
```

**陷阱**：使用错误的源/目标路径运行 rsync 可能会创建嵌套的垃圾目录（例如 `.trellis/scripts/packages/cli/...`）。运行前始终仔细检查路径。
