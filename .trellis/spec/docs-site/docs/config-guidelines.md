# 配置指南（Configuration Guidelines）

> docs.json 的配置模式和规范。

---

## 文件位置（File Location）

主配置文件：`docs.json`（项目根目录）

---

## Schema 参考（Schema Reference）

```json
{
  "$schema": "https://mintlify.com/docs.json"
}
```

始终包含 schema 以获得编辑器自动补全。

---

## 核心配置（Core Configuration）

### 主题与品牌（Theme and Branding）

```json
{
  "theme": "mint",
  "name": "Project Name",
  "colors": {
    "primary": "#16A34A",
    "light": "#07C983",
    "dark": "#15803D"
  },
  "favicon": "/favicon.svg",
  "logo": {
    "light": "/logo/light.svg",
    "dark": "/logo/dark.svg"
  }
}
```

### 颜色指南（Color Guidelines）

| 颜色（Color） | 用途（Purpose） | 格式（Format） |
| --------- | ----------------- | --------------------- |
| `primary` | 主品牌色 | Hex（如 `#16A34A`） |
| `light`   | 浅色模式强调色 | Hex |
| `dark`    | 深色模式强调色 | Hex |

---

## 导航（Navigation）

### 基于 Tab 的导航（Tab-Based Navigation）

```json
{
  "navigation": {
    "tabs": [
      {
        "tab": "Guides",
        "groups": [
          {
            "group": "Getting Started",
            "pages": ["index", "quickstart", "development"]
          }
        ]
      },
      {
        "tab": "API Reference",
        "groups": [
          {
            "group": "Endpoints",
            "pages": ["api-reference/introduction"]
          }
        ]
      }
    ]
  }
}
```

### 基于分组的导航（Group-Based Navigation）

```json
{
  "navigation": {
    "groups": [
      {
        "group": "Getting Started",
        "pages": ["index", "quickstart"]
      },
      {
        "group": "Guides",
        "pages": ["essentials/settings", "essentials/navigation"]
      }
    ]
  }
}
```

### 页面引用（Page References）

| 格式（Format） | 示例（Example） |
| ---------------- | --------------------------- |
| 根页面           | `"index"`                   |
| 嵌套页面         | `"essentials/settings"`     |
| OpenAPI 端点     | `"openapi.json GET /users"` |

### 可折叠的嵌套分组（Collapsible Nested Groups）

要使导航分组可折叠（默认折叠），在**嵌套分组**（分组内的分组）上使用 `expanded` 属性：

```json
{
  "navigation": {
    "groups": [
      {
        "group": "Community",
        "pages": [
          "showcase/index",
          "contribute/index",
          {
            "group": "Blog",
            "expanded": false,
            "pages": ["blog/index", "blog/post-one", "blog/post-two"]
          }
        ]
      }
    ]
  }
}
```

> **警告**：`expanded` 属性**仅适用于嵌套分组**（分组内的分组）。顶层分组始终展开且不可折叠。如果你在顶层分组上设置 `expanded: false`，它会被静默忽略。

**常见错误**：尝试折叠顶层分组：

```json
// ❌ 错误——这不起作用
{
  "group": "Blog",
  "expanded": false, // 被忽略！顶层分组无法折叠
  "pages": ["blog/index", "blog/post-one"]
}
```

```json
// ✅ 正确——将其嵌套在父分组下
{
  "group": "Community",
  "pages": [
    "showcase/index",
    {
      "group": "Blog",
      "expanded": false, // 有效！这是一个嵌套分组
      "pages": ["blog/index", "blog/post-one"]
    }
  ]
}
```

---

## 全局元素（Global Elements）

### 锚点链接 / 侧边栏链接（Anchors）

```json
{
  "navigation": {
    "global": {
      "anchors": [
        {
          "anchor": "Documentation",
          "href": "https://example.com/docs",
          "icon": "book-open-cover"
        },
        {
          "anchor": "GitHub",
          "href": "https://github.com/example",
          "icon": "github"
        }
      ]
    }
  }
}
```

### 导航栏（Navbar）

```json
{
  "navbar": {
    "links": [
      {
        "label": "Support",
        "href": "mailto:support@example.com"
      }
    ],
    "primary": {
      "type": "button",
      "label": "Dashboard",
      "href": "https://dashboard.example.com"
    }
  }
}
```

### 页脚（Footer）

```json
{
  "footer": {
    "socials": {
      "x": "https://x.com/example",
      "github": "https://github.com/example",
      "linkedin": "https://linkedin.com/company/example"
    }
  }
}
```

---

## API 文档（API Documentation）

### OpenAPI 集成

```json
{
  "navigation": {
    "tabs": [
      {
        "tab": "API Reference",
        "groups": [
          {
            "group": "Endpoints",
            "openapi": "api-reference/openapi.json"
          }
        ]
      }
    ]
  }
}
```

---

## 上下文选项（Contextual Options）

代码块右键菜单选项：

```json
{
  "contextual": {
    "options": ["copy", "view", "chatgpt", "claude", "perplexity", "mcp", "cursor", "vscode"]
  }
}
```

---

## 国际化（i18n）

### 基于语言的导航（Language-Based Navigation）

对于多语言支持，使用 `navigation.languages` 替代 `navigation.tabs`：

```json
{
  "navigation": {
    "languages": [
      {
        "language": "en",
        "tabs": [
          {
            "tab": "Guides",
            "groups": [
              {
                "group": "Getting Started",
                "pages": ["index", "quickstart"]
              }
            ]
          }
        ]
      },
      {
        "language": "zh",
        "tabs": [
          {
            "tab": "指南",
            "groups": [
              {
                "group": "开始使用",
                "pages": ["zh/index", "zh/quickstart"]
              }
            ]
          }
        ]
      }
    ]
  }
}
```

### i18n 文件结构

```
docs/
├── index.mdx           # 英文首页
├── quickstart.mdx      # 英文快速开始
├── zh/
│   ├── index.mdx       # 中文首页
│   └── quickstart.mdx  # 中文快速开始
└── docs.json           # 两种语言均已配置
```

> **重要**：每种语言都需要自己完整的导航结构。`zh/` 中的页面在导航中必须引用为 `"zh/pagename"`。

### i18n 命名规范（Naming Conventions）

跨语言对常见页面类型使用一致的命名：

| English      | 中文       | 用法（Usage） |
| ------------ | ---------- | -------------------------------- |
| `Overview`   | `概览`     | 章节的索引/入口页面 |
| `Guides`     | `指南`     | 操作指南文档章节 |
| `Quickstart` | `快速开始` | 入门指南 |
| `FAQ`        | `常见问题` | 常见问题解答 |

**frontmatter 示例**：

```yaml
# English (templates/specs-index.mdx)
---
title: 'Overview'
description: 'Spec templates for common stacks'
---
# Chinese (zh/templates/specs-index.mdx)
---
title: '概览'
description: '常见技术栈的规范模板'
---
```

> **规则**：不要在标题中混合语言。英文页面使用英文标题，中文页面使用中文标题。

### 内容章节的 i18n（博客、Changelog 等）

当内容章节（如 Blog）有按语言区分的文章时，**按目录分离内容**：

```
docs/
├── blog/                        # 英文博客
│   ├── index.mdx                # 仅列出英文文章
│   ├── post-one.mdx
│   └── post-two.mdx
├── zh/
│   └── blog/                    # 中文博客
│       ├── index.mdx            # 仅列出中文文章
│       ├── post-one.mdx         # 相同文件名，不同内容
│       └── post-two.mdx
└── docs.json
```

**导航配置**：

```json
{
  "navigation": {
    "languages": [
      {
        "language": "en",
        "groups": [
          {
            "group": "Blog",
            "pages": ["blog/index", "blog/post-one", "blog/post-two"]
          }
        ]
      },
      {
        "language": "zh",
        "groups": [
          {
            "group": "Blog",
            "pages": ["zh/blog/index", "zh/blog/post-one", "zh/blog/post-two"]
          }
        ]
      }
    ]
  }
}
```

> **常见错误**：将所有博客文章（两种语言）放在一个 `blog/` 文件夹中，并在两个导航中都显示它们。这会用他们无法阅读的文章混乱每种语言的视图。

**核心原则**：每种语言的内容章节应**自包含**——拥有自己的目录、自己的索引、自己的导航条目。

---

## 自定义样式（Custom Styling）

### 覆盖默认样式

在项目根目录创建 `styles.css` 来自定义 Mintlify 外观：

```css
/* 示例：隐藏语言切换器的旗帜图标 */
img[src*='cloudfront.net/flags'] {
  display: none !important;
}

/* 示例：自定义按钮样式 */
button[aria-haspopup='menu'] > div:first-child {
  display: none !important;
}
```

> **提示**：使用浏览器 DevTools 检查 Mintlify 元素并找到正确的选择器。

---

## 最佳实践（Best Practices）

### DO

- 包含 `$schema` 以获得自动补全
- 按逻辑组织导航（以用户旅程为导向）
- 使用描述性的分组名称
- 保持合理的 tab 数量（2-4 个 tab）

### DON'T

- 创建过深的嵌套导航
- 在页面和导航之间使用不一致的命名
- 忘记将新页面添加到导航中
- 不必要地混合不同的导航模式

---

## 检查清单：添加新内容（Checklist: Adding New Content）

1. [ ] 创建 `.mdx` 文件
2. [ ] 添加带有 title 和 description 的 frontmatter
3. [ ] 将页面添加到 `docs.json` 的相应分组中
4. [ ] 验证导航顺序合理
5. [ ] 使用 `mintlify dev` 本地测试
