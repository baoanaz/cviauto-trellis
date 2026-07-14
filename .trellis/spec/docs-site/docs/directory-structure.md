# 目录结构（Directory Structure）

> 本 Mintlify 文档项目的文件组织和命名规范。

---

## ⚠️ 关键提醒：需要手动更新导航

**Mintlify 不会自动发现页面。** 每个新页面都必须手动添加到 `docs.json` 中。

```json
// docs.json——添加页面时必须更新导航
{
  "navigation": {
    "languages": [
      {
        "language": "en",
        "groups": [
          {
            "group": "Spec Templates",
            "pages": [
              "templates/specs-index",
              "templates/specs-node", // ← 在此处添加新页面
              "templates/specs-python"
            ]
          }
        ]
      },
      {
        "language": "zh",
        "groups": [
          // 中文采用相同结构
        ]
      }
    ]
  }
}
```

**新页面检查清单：**

1. [ ] 创建 `.mdx` 文件
2. [ ] 添加到 `docs.json` 的英文导航中
3. [ ] 在 `zh/` 目录中创建中文版本
4. [ ] 添加到 `docs.json` 的中文导航中

---

## 项目结构（Project Structure）

```
docs/
├── docs.json              # 主配置文件
├── index.mdx              # 首页
├── quickstart.mdx         # 快速开始指南
├── development.mdx        # 开发环境搭建
│
├── essentials/            # 核心文档
│   ├── settings.mdx
│   ├── navigation.mdx
│   ├── markdown.mdx
│   ├── code.mdx
│   ├── images.mdx
│   └── reusable-snippets.mdx
│
├── api-reference/         # API 文档
│   ├── introduction.mdx
│   ├── openapi.json       # OpenAPI 规范
│   └── endpoint/
│       ├── get.mdx
│       ├── create.mdx
│       ├── delete.mdx
│       └── webhook.mdx
│
├── ai-tools/              # AI 工具指南
│   ├── cursor.mdx
│   ├── claude-code.mdx
│   └── devin.mdx
│
├── snippets/              # 可复用的内容片段
│   └── snippet-intro.mdx
│
├── images/                # 图片资源
│   └── *.png|jpg|gif
│
└── logo/                  # 品牌资源
    ├── light.svg
    └── dark.svg
```

---

## 命名规范（Naming Conventions）

### 文件（Files）

| 类型（Type） | 规范（Convention） | 示例（Example） |
| ----------- | ---------------- | --------------------- |
| MDX 页面    | `kebab-case.mdx` | `getting-started.mdx` |
| 目录        | `kebab-case/`    | `api-reference/`      |
| 图片        | `kebab-case.png` | `hero-image.png`      |
| 代码片段    | `kebab-case.mdx` | `api-key-setup.mdx`   |

### 目录组织（Directory Organization）

| 目录（Directory） | 用途（Purpose） | 何时使用 |
| ---------------- | ------------------ | --------------------------------------- |
| 根目录（`/`）    | 顶级页面           | 首页、快速开始、主要入口点 |
| `essentials/`    | 核心平台文档       | 设置、导航、markdown 语法 |
| `api-reference/` | API 文档           | 端点、OpenAPI 规范 |
| `snippets/`      | 可复用内容         | 在多个页面中使用的内容 |
| `images/`        | 图片资源           | 截图、图表 |
| `logo/`          | 品牌资源           | 浅色/深色模式 logo |

---

## 规则（Rules）

### DO

- 将相关页面按目录分组
- 使用描述性的、SEO 友好的文件名
- 保持目录嵌套较浅（最多 2 层）
- 将可复用内容放在 `snippets/` 中

### DON'T

- 在文件名中使用下划线（使用连字符）
- 创建过深的嵌套目录
- 在同一目录中混合不同类型的内容
- 在名称中使用空格或特殊字符

---

## 国际化（i18n）结构

对于双语文档，遵循以下模式：

```
docs/
├── index.mdx              # 英文首页
├── quickstart.mdx         # 英文快速开始
├── guides/                # 英文指南
│   └── *.mdx
├── blog/                  # 英文博客（仅含英文文章）
│   ├── index.mdx          # 仅列出英文文章
│   └── *.mdx
│
├── zh/                    # 中文内容根目录
│   ├── index.mdx          # 中文首页
│   ├── quickstart.mdx     # 中文快速开始
│   ├── guides/            # 中文指南
│   │   └── *.mdx
│   └── blog/              # 中文博客（仅含中文文章）
│       ├── index.mdx      # 仅列出中文文章
│       └── *.mdx
│
├── changelog.mdx          # 共享（无需翻译）
└── docs.json
```

### i18n 规则

| 内容类型（Content Type） | 英文路径 | 中文路径 |
| -------------- | ------------------ | --------------------------- |
| 主页面         | `page.mdx`         | `zh/page.mdx`               |
| 章节页面       | `section/page.mdx` | `zh/section/page.mdx`       |
| 博客文章       | `blog/post.mdx`    | `zh/blog/post.mdx`          |
| 共享内容       | `changelog.mdx`    | `changelog.mdx`（同一文件）|

### 常见错误

**不要**：在一个文件夹中混合语言

```
blog/
├── post-en.mdx      # ❌ 会混乱两种语言视图
└── post-zh.mdx
```

**要**：按语言目录分离

```
blog/
└── post.mdx         # ✅ 仅英文
zh/blog/
└── post.mdx         # ✅ 仅中文
```

---

## 添加新内容（Adding New Content）

### 新页面（双语）

| 步骤（Step） | 操作（Action） | 文件（File） |
| ---- | ------------------------ | ----------------------------------- |
| 1    | 创建英文页面             | `section/page.mdx`                  |
| 2    | 创建中文页面             | `zh/section/page.mdx`               |
| 3    | **更新英文导航**         | `docs.json` → `languages[0].groups` |
| 4    | **更新中文导航**         | `docs.json` → `languages[1].groups` |
| 5    | 本地测试                 | `pnpm dev`                          |

> ⚠️ **步骤 3-4 是强制性的。** 没有导航条目，页面不会出现在侧边栏中。

### 新章节（New Section）

1. 创建具有描述性名称的新目录
2. 在目录内添加页面
3. 在 `docs.json` 导航中创建分组（英文和中文都要）

### 新代码片段（New Snippet）

1. 在 `snippets/` 中创建 `.mdx` 文件
2. 使用 `<Snippet file="filename.mdx" />` 引用
