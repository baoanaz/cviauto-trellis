# Mintlify 中的 ASCII 图表对齐（ASCII-Art Diagram Alignment）

> 如何使方框绘制图表在浏览器中正确渲染，尤其是在含有 CJK 文本时。

---

## 问题概述（Problem Summary）

使用方框绘制字符（`─│┌┐└┘┬┤├┼`）的 ASCII 图表在浏览器中会错位，有两个原因：

| 问题（Problem） | 根本原因（Root Cause） | 受影响对象 |
| ---------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------- |
| 方框绘制字符比 ASCII 更宽 | JetBrains Mono（Mintlify 默认字体）将 `─│┌` 渲染为约 1.8 倍 ASCII 宽度 | 所有语言 |
| CJK 字符并非恰好是 2 倍 ASCII 宽度 | 浏览器的 CJK 回退字体将中文渲染为约 1.7 倍 ASCII 宽度，而非终端标准的 2 倍 | 中文/日文/韩文 |

---

## 方案 1：纯英文图表（字体覆盖）（Solution 1: English-Only Diagrams）

对于仅含 ASCII 文本的图表，将代码块字体切换为 Menlo 即可解决所有问题——Menlo 将方框绘制字符渲染为恰好 1 倍 ASCII 宽度。

**`styles.css` 中的 CSS：**

```css
pre code {
  font-family: Menlo, Monaco, 'Courier New', monospace !important;
}
```

使用标准 markdown 代码块（` ``` `）。无需其他更改。

---

## 方案 2：中文 CJK 图表（2ch inline-block）（Solution 2: Chinese CJK Diagrams）

对于混合中文文本与方框绘制边框的图表，**没有任何字体**可以在浏览器中保证 CJK = 2 倍 ASCII。解决方案是使用 CSS 强制宽度。

### 技术方案

1. 将每个 CJK 字符包裹在 `<b>` 标签中
2. CSS 将 `<b>` 设置为 `display:inline-block;width:2ch` ——恰好 2 个等宽列
3. 使用 `dangerouslySetInnerHTML` 绕过 MDX 解析问题

**`styles.css` 中的 CSS：**

```css
pre.cjk-diagram {
  display: block !important; /* 覆盖 Mintlify 在 <pre> 上的 display:flex */
  padding: 14px 16px;
  border-radius: 16px;
  font-size: 14px;
  line-height: 24px;
  font-family: Menlo, Monaco, 'Courier New', monospace;
  overflow-x: auto;
  white-space: pre;
  margin: 16px 0;
  background: #f8f8f8;
  color: #1e1e1e;
}

.dark pre.cjk-diagram {
  background: #1e1e1e;
  color: #d4d4d4;
}

pre.cjk-diagram b {
  display: inline-block;
  width: 2ch;
  text-align: center;
  font-weight: normal;
}
```

**MDX 用法：**

```mdx
<pre
  className="cjk-diagram"
  dangerouslySetInnerHTML={{
    __html: `┌──────────────┐
│  <b>用</b><b>户</b>          │
└──────────────┘`,
  }}
/>
```

### 生成器脚本

使用 `/tmp/gen_zh_html_diagrams.py` 自动化 CJK 包裹。关键函数：

- `is_cjk(ch)`——检测 CJK 字符（U+4E00-9FFF 等）
- `display_width(s)`——计算终端风格的显示宽度（CJK=2，ASCII=1）
- `cjk_pad(content, width)`——将内容填充到精确的显示宽度
- `wrap_cjk(text)`——将每个 CJK 字符包裹在 `<b>` 标签中

---

## 陷阱（Gotchas，从实际踩坑中学到的）

### 1. Mintlify `<pre>` 具有 `display:flex`

Mintlify 的 CSS 在 `<pre>` 元素上设置了 `display:flex`。这会将 `<b>` 子元素变为 flex 子元素，其中 `display:inline-block` 会变为 `display:block`。**必须**在 `pre.cjk-diagram` 上添加 `display:block !important`。

### 2. MDX 空行会触发 markdown 重新解析

在 MDX v2+ 中，JSX 元素（如 `<pre>`）内部出现空行会导致解析器重新进入 markdown 模式。空行后的内容（如 `# Heading`）会变为 `<h1>` 标签，破坏一切。解决方案：

- 使用 `dangerouslySetInnerHTML`（完全绕过 MDX 解析）**[推荐]**
- 或者确保 `<pre>` 内部没有真正的空行（用单个空格替代）

### 3. `<pre>` 子元素中的 JSX 特殊字符

如果使用直接 JSX 子元素（而非 `dangerouslySetInnerHTML`）：

- `{` 和 `}` 必须转义为 `{"{"}` 和 `{"}"}`
- 空行后的行首 `#` 会变为 heading
- `===` 可能变为 setext 标题标记

`dangerouslySetInnerHTML` 避免了所有这些问题。

### 4. `@font-face` 中的 `size-adjust` 不适用于 CJK

尝试使用 `@font-face { size-adjust: 118% }` 将 CJK 字体宽度缩放到 2 倍 ASCII。失败原因：

- `@font-face` 中的 `local()` 仅匹配系统字体，不匹配 web 字体
- 浏览器从回退字体应用 CJK，而非从 `@font-face` 声明
- 即使应用了，也会缩放所有度量（包括高度），导致行高不均匀

### 5. Web 字体 CJK 子集不保证 2:1 比例

LXGW WenKai Mono web 字体（`@callmebill/lxgw-wenkai-web`）：

- 通过 `unicode-range` 加载 217+ 个子集文件
- ASCII 字形回退到 Menlo（Web 子集中字体不包含 ASCII）
- CJK/ASCII 比例 = 1.84（LXGW CJK + Menlo ASCII），而非 2.0

### 6. 浏览器 CJK 宽度因操作系统而异

| 操作系统（OS） | CJK 回退字体 | CJK/ASCII 比例 |
| ------- | ---------------------- | --------------- |
| macOS   | PingFang SC / Hiragino | ~1.69           |
| Windows | Microsoft YaHei        | ~1.67           |
| Linux   | Noto Sans CJK          | 各有不同       |

字符级填充无法解决此问题，因为比例因字体而异。`2ch` CSS 技术是唯一的跨平台解决方案。

---

## 测量参考（Measurement Reference）

在 `font-size: 14px` 下使用 Menlo：

| 字符（Character） | 宽度 px | 与 ASCII 比例 |
| ------------------- | ---------- | -------------- |
| ASCII `a`           | 8.43       | 1.00           |
| 空格（Space）       | 8.43       | 1.00           |
| 方框 `─`            | 8.43       | 1.00           |
| 方框 `│`            | 8.43       | 1.00           |
| CJK `中`（自然宽度）| 14.28      | 1.69           |
| CJK `中`（使用 2ch）| 16.86      | 2.00           |

---

## 快速决策树（Quick Decision Tree）

````
Need ASCII-art diagram in docs?
├── English only?
│   └── Use standard ``` code block + Menlo font override ✓
└── Contains CJK text?
    └── Use <pre class="cjk-diagram"> + dangerouslySetInnerHTML
        + wrap each CJK char in <b> tags ✓
````
