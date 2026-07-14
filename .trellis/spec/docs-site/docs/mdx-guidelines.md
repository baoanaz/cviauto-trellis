# MDX 指南（MDX Guidelines）

> MDX 语法、frontmatter 和组件使用模式。

---

## Frontmatter

每个 MDX 文件必须以 frontmatter 开头：

```yaml
---
title: 'Page Title'
description: 'Brief description for SEO (150-160 characters)'
---
```

### 可选的 Frontmatter 字段

| 字段（Field） | 用途（Purpose） | 示例（Example） |
| -------------- | ------------------------- | --------------- |
| `sidebarTitle` | 侧边栏中较短的标题 | `"Quick Start"` |
| `icon`         | 导航图标 | `"rocket"` |
| `tag`          | 徽章/标签 | `"NEW"` |
| `mode`         | 页面模式 | `"wide"` |

### 包含所有字段的示例

```yaml
---
title: 'Getting Started with the API'
description: 'Learn how to authenticate and make your first API call'
sidebarTitle: 'Getting Started'
icon: 'play'
tag: 'Updated'
---
```

---

## 组件（Components）

### Card

用于导航链接和功能亮点：

```mdx
<Card title="Quick Start" icon="rocket" href="/quickstart">
  Get up and running in 5 minutes.
</Card>
```

**水平变体：**

```mdx
<Card title="Start Here" icon="rocket" href="/quickstart" horizontal>
  Follow our quickstart guide.
</Card>
```

### Columns

用于多列布局：

```mdx
<Columns cols={2}>
  <Card title="First" icon="star" href="/first">
    First card content.
  </Card>
  <Card title="Second" icon="star" href="/second">
    Second card content.
  </Card>
</Columns>
```

### Tabs

用于替代内容视图：

````mdx
<Tabs>
  <Tab title="npm">```bash npm install package-name ```</Tab>
  <Tab title="yarn">```bash yarn add package-name ```</Tab>
</Tabs>
````

### Accordion

用于可折叠内容：

```mdx
<AccordionGroup>
  <Accordion title="What is Mintlify?">Mintlify is a documentation platform.</Accordion>
  <Accordion title="How much does it cost?">
    Free tier available, Pro starts at $300/month.
  </Accordion>
</AccordionGroup>
```

### CodeGroup

用于多语言代码示例：

````mdx
<CodeGroup>
```javascript Node.js
const response = await fetch('/api/users');
```

```python Python
response = requests.get('/api/users')
```

```bash cURL
curl https://api.example.com/users
```

</CodeGroup>
````

### Snippet

用于可复用内容：

```mdx
<Snippet file="api-key-setup.mdx" />
```

---

## 代码块（Code Blocks）

### 基本语法

````markdown
```language filename
code here
```
````

### 带文件名

````markdown
```javascript app.js
const express = require('express');
const app = express();
```
````

### 支持的语言

常见：`javascript`、`typescript`、`python`、`bash`、`json`、`yaml`、`sql`、`go`、`rust`

---

## 标注（Callouts）

### Note

```mdx
<Note>This is important information.</Note>
```

### Warning

```mdx
<Warning>Be careful with this action.</Warning>
```

### Info

```mdx
<Info>Additional context here.</Info>
```

### Tip

```mdx
<Tip>Helpful suggestion here.</Tip>
```

---

## 常见错误（Common Mistakes）

### 模板中嵌套代码块

**问题**：使用转义反引号显示代码块语法时渲染异常：

```mdx
<!-- 不要这样做：这会字面显示转义的反引号 -->

\`\`\`bash
npm install
\`\`\`
```

**解决方案**：使用 `<CodeGroup>` 组件替代：

````mdx
<!-- 应该这样做：包裹在 CodeGroup 中以正确渲染 -->

<CodeGroup>```bash Install npm install ```</CodeGroup>
````

### 模板示例中的重复标题

**问题**：展示多个模板示例时使用相同标题会触发 MD024 lint 错误。

**解决方案**：在文件开头添加 lint 禁用注释：

```mdx
---
title: 'Templates'
---

<!-- markdownlint-disable MD024 -->

## Template 1

### Project structure

...

## Template 2

### Project structure <!-- 相同标题，但 lint 已忽略 -->

...
```

### 混合内联/块级 JSX 闭合标签

**症状**：整个页面渲染为 `A parsing error occurred. Please contact the owner of this website.`。标题也会回退为文件 slug（例如 "Ch12 multi platform" 而非 frontmatter 中的 title），这证实了 MDX 对整个文件（而非仅该块）编译失败。

**原因**：标注组件（`<Note>`、`<Warning>`、`<Info>`、`<Tip>`）接受内联形式（标签 + 内容 + 闭合在同一行）或块级形式（标签独占一行）。混合使用会导致 MDX 解析器出错。

```mdx
<!-- 不要：开头独占一行，闭合标签紧贴内容 -->
<Note>
  Don't pick **Full re-initialize** — it overwrites existing config.</Note>

<!-- 不要：开头紧贴内容，闭合标签独占一行 -->
<Note>Don't pick **Full re-initialize** — it overwrites existing config.
</Note>
```

```mdx
<!-- 正确：完全内联（内容较短时） -->
<Note>Don't pick **Full re-initialize** — it overwrites existing config.</Note>

<!-- 正确：完全块级（多行或含较多 markdown 的内容时） -->
<Note>
  Don't pick **Full re-initialize** — it overwrites existing config.
</Note>
```

**预防**：每个标注选择一种形式并保持两个标签一致。当正文包含反引号代码段、加粗文本或超过一句话时，默认使用块级形式以提高可读性。

### `<Note>` / `<Warning>` / `<Info>` / `<Tip>` 内部的列表

**症状**：与上述混合内联/块级相同——页面渲染为 `A parsing error occurred`，标题回退为 slug。

**原因**：Prettier 会重新格式化 JSX 块体内部的 Markdown。缩进在开标签下的列表会被拉到第 0 列；闭合标签则被缩进 2 个空格。Mintlify 将列表项视为 `<Note>` 外部的内容，闭合标签被视为错位。解析失败。

```mdx
<!-- 编写时： -->
<Note>
  Hook support varies by platform:

  - **SessionStart** ships on Claude Code, Cursor, OpenCode...
  - **PreToolUse** ships on a smaller subset...
</Note>

<!-- Prettier 重写为（已损坏）： -->
<Note>
  Hook support varies by platform:

- **SessionStart** ships on Claude Code, Cursor, OpenCode...
- **PreToolUse** ships on a smaller subset...
  </Note>
```

**预防**：不要在标注内部放置列表。将标注保持为单行内联摘要；将列表放在外部。

```mdx
<!-- 正确做法 -->
<Note>Hook support varies by platform and by event — see the per-event matrix below.</Note>

- **SessionStart** ships on Claude Code, Cursor, OpenCode...
- **PreToolUse** ships on a smaller subset...
```

如果列表确实必须在标注内部（罕见——通常内联摘要 + 外部列表的形式读起来更好），使用原始 HTML `<ul><li>` 替代 Markdown 列表，这样 Prettier 不会重新格式化它们。

**为什么 `prettier --check` 或 `markdownlint-cli2` 没有捕获到此问题**：两者在损坏的输出上均通过。只有 `mintlify broken-links`（或在 Mintlify 开发服务器中渲染页面）才能发现解析失败。值得将其接入 CI。

### 表格列对齐

**问题**：markdownlint MD060 要求一致的表格管道符对齐。

**解决方案**：确保所有列对齐：

```markdown
<!-- 不要：不一致的间距 -->

| Command  | What it does                                      |
| -------- | ------------------------------------------------- |
| `/start` | Start session. Loads context, shows current task. |

<!-- 正确：所有管道符对齐 -->

| Command  | What it does                                      |
| -------- | ------------------------------------------------- |
| `/start` | Start session. Loads context, shows current task. |
```

---

## 最佳实践（Best Practices）

### DO

- 始终在 frontmatter 中包含 `title` 和 `description`
- 使用组件构建视觉结构（Cards、Tabs）
- 将 description 保持在 160 字符以内以满足 SEO 要求
- 使用适当的标注类型（Note、Warning、Tip）
- 包含带有语言标识符的代码示例
- 在示例中展示代码块语法时使用 `<CodeGroup>`

### DON'T

- 跳过 frontmatter
- 在有组件可用时使用原始 HTML
- 编写过长的 description
- 不一致地混合组件风格
- 代码块不加语言提示
- 使用转义反引号来展示嵌套代码块
