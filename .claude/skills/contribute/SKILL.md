---
name: contribute
description: "Guide for contributing to Trellis documentation and marketplace. Covers adding spec templates, marketplace skills, documentation pages, and submitting PRs across both the Trellis main repo and docs repo. Use when someone wants to add a new spec template, add a new skill to the marketplace, add or update documentation pages, or submit a PR to this project."
---

# 为 Trellis 做贡献

贡献分散在两个仓库中：

| 内容 | 仓库 | 用途 |
|------|------|---------|
| 文档页面 | [mindfold-ai/docs](https://github.com/mindfold-ai/docs) | Mintlify 文档站点 |
| Skills + Spec 模板 | [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) | `marketplace/` 目录 |

## Docs 仓库结构

```
docs/
├── docs.json              # 导航配置（新增页面必须更新）
│
├── index.mdx              # 英文首页
├── quickstart.mdx         # 英文快速入门
├── zh/index.mdx           # 中文首页
├── zh/quickstart.mdx      # 中文快速入门
│
├── guides/                # 英文指南页面
├── zh/guides/             # 中文指南页面
│
├── templates/             # 英文模板页面
├── zh/templates/          # 中文模板页面
│
├── skills-market/         # 英文 Skill 市场页面
├── zh/skills-market/      # 中文 Skill 市场页面
│
├── blog/                  # 英文技术博客
├── zh/blog/               # 中文技术博客
│
├── changelog/             # 英文变更日志
├── zh/changelog/          # 中文变更日志
│
├── contribute/            # 英文贡献指南
├── zh/contribute/         # 中文贡献指南
│
├── showcase/              # 英文项目展示
└── zh/showcase/           # 中文项目展示
```

## Trellis 主仓库 Marketplace 结构

```
marketplace/
├── index.json             # 模板注册表（列出所有可用模板）
├── README.md              # Marketplace 概览
├── specs/                 # Spec 模板
│   └── electron-fullstack/
│       ├── README.md
│       ├── frontend/
│       ├── backend/
│       ├── guides/
│       └── shared/
└── skills/                # Skills
    └── trellis-meta/
        ├── SKILL.md
        └── references/
```

## 理解 docs.json

导航使用**基于语言的结构**：

```json
{
  "navigation": {
    "languages": [
      {
        "language": "en",
        "groups": [
          {
            "group": "Getting started",
            "pages": ["index", "quickstart"]
          },
          {
            "group": "Guides",
            "pages": ["guides/specs", "guides/tasks", ...]
          },
          {
            "group": "Resource Marketplace",
            "pages": [
              {
                "group": "Skills",
                "expanded": false,
                "pages": ["skills-market/index", "skills-market/trellis-meta"]
              },
              {
                "group": "Spec Templates",
                "expanded": false,
                "pages": ["templates/specs-index", "templates/specs-electron"]
              }
            ]
          }
        ]
      },
      {
        "language": "zh",
        "groups": [
          // 相同结构，使用 zh/ 前缀
        ]
      }
    ]
  }
}
```

**关键点**：

- 英文页面：无前缀（如 `guides/specs`）
- 中文页面：`zh/` 前缀（如 `zh/guides/specs`）
- 支持嵌套分组（如 Skills 放在 Resource Marketplace 内）
- `expanded: false` 默认折叠分组

## 贡献 Spec 模板

Spec 模板存放在 **Trellis 主仓库**的 `marketplace/specs/` 中。

### 1. 创建模板目录

```
marketplace/specs/your-template-name/
├── README.md              # 模板概览（必需）
├── frontend/              # 前端指南
│   ├── index.md
│   └── ...
├── backend/               # 后端指南
│   ├── index.md
│   └── ...
├── guides/                # 思维指南
│   └── ...
└── shared/                # 跨领域关注（可选）
    └── ...
```

结构因技术栈而异。包含与模板相关的目录即可。

### 2. 在 index.json 中注册

在 Trellis 仓库的 `marketplace/index.json` 中添加你的模板：

```json
{
  "id": "your-template-id",
  "type": "spec",
  "name": "Your Template Name",
  "description": "模板的简要描述",
  "path": "marketplace/specs/your-template-name",
  "tags": ["relevant", "tags"]
}
```

### 3. 创建文档页面（两种语言，在 docs 仓库中）

**英文**：`templates/specs-your-template.mdx`
**中文**：`zh/templates/specs-your-template.mdx`

使用以下 frontmatter：

```yaml
---
title: '你的模板名称'
description: '简要描述'
---
```

### 4. 更新 docs.json 中的导航

找到 `Spec Templates` 嵌套分组，添加你的页面：

```json
{
  "group": "Spec Templates",
  "expanded": false,
  "pages": ["templates/specs-index", "templates/specs-electron", "templates/specs-your-template"]
}
```

对中文做同样的操作，在 `"language": "zh"` 下：

```json
{
  "group": "Spec Templates",
  "expanded": false,
  "pages": [
    "zh/templates/specs-index",
    "zh/templates/specs-electron",
    "zh/templates/specs-your-template"
  ]
}
```

### 5. 更新概览页面

将你的模板添加到以下页面的表格中：

- `templates/specs-index.mdx`
- `zh/templates/specs-index.mdx`

## 贡献 Skill

Skills 存放在 **Trellis 主仓库**的 `marketplace/skills/` 中。

### 1. 创建 Skill 目录

```
marketplace/skills/your-skill/
├── SKILL.md               # Skill 定义（必需）
└── references/            # 参考文档（可选）
```

SKILL.md 格式参见 [Codex Skills 文档](https://code.Codex.com/docs/en/skills)。

### 2. 在 index.json 中注册

在 Trellis 仓库的 `marketplace/index.json` 中添加你的 skill：

```json
{
  "id": "your-skill-id",
  "type": "skill",
  "name": "Your Skill Name",
  "description": "简要描述",
  "path": "marketplace/skills/your-skill",
  "tags": ["relevant", "tags"]
}
```

### 3. 创建文档页面（在 docs 仓库中）

**英文**：`skills-market/your-skill.mdx`
**中文**：`zh/skills-market/your-skill.mdx`

### 4. 更新 docs.json 中的导航

找到 `Skills` 嵌套分组，在两种语言中都添加你的页面。

### 5. 更新概览页面

将你的 skill 添加到以下页面的表格中：

- `skills-market/index.mdx`
- `zh/skills-market/index.mdx`

### 安装

用户通过以下命令安装 skills：

```bash
npx skills add mindfold-ai/Trellis/marketplace -s your-skill
```

## 贡献展示项目

### 1. 复制模板

```bash
cp showcase/template.mdx showcase/your-project.mdx
cp zh/showcase/template.mdx zh/showcase/your-project.mdx
```

### 2. 填写项目详情

- 将 `sidebarTitle` 更新为你的项目名称
- 添加项目描述
- 将 GitHub OG 图片 URL 替换为你的仓库
- 描述你如何使用 Trellis

### 3. 更新 docs.json 中的导航

找到 `Showcase` / `项目展示` 分组，添加你的页面：

```json
{
  "group": "Showcase",
  "expanded": false,
  "pages": ["showcase/index", "showcase/open-typeless", "showcase/your-project"]
}
```

对中文做同样操作。

### 4. 在概览页面添加卡片

添加 Card 组件展示你的项目：

**英文** (`showcase/index.mdx`)：

```mdx
<Card title="Project Name" icon="icon-name" href="/showcase/your-project">
  一行描述
</Card>
```

**中文** (`zh/showcase/index.mdx`)：

```mdx
<Card title="项目名" icon="icon-name" href="/zh/showcase/your-project">
  一句话描述
</Card>
```

## 贡献文档

### 添加新指南

1. 在 `guides/your-guide.mdx` 创建页面
2. 在 `zh/guides/your-guide.mdx` 创建中文版本
3. 更新 `docs.json` — 在两种语言中添加到 `Guides` 分组

### 添加博客文章

1. 在 `blog/your-post.mdx` 创建页面
2. 在 `zh/blog/your-post.mdx` 创建中文版本
3. 更新 `docs.json` — 在两种语言中添加到 `Tech Blog` 分组

### 更新现有页面

1. 在相应目录中找到文件
2. 进行修改
3. 确保两种语言版本保持同步

## 双语要求

**所有面向用户的内容必须有英文和中文两个版本。**

| 内容类型 | 英文路径              | 中文路径                 |
| ------------ | --------------------- | ------------------------ |
| 首页         | `index.mdx`           | `zh/index.mdx`           |
| 指南         | `guides/*.mdx`        | `zh/guides/*.mdx`        |
| 模板         | `templates/*.mdx`     | `zh/templates/*.mdx`     |
| Skills       | `skills-market/*.mdx` | `zh/skills-market/*.mdx` |
| 项目展示     | `showcase/*.mdx`      | `zh/showcase/*.mdx`      |
| 博客         | `blog/*.mdx`          | `zh/blog/*.mdx`          |
| 变更日志     | `changelog/*.mdx`     | `zh/changelog/*.mdx`     |

## 开发设置

```bash
# 安装依赖
pnpm install

# 启动本地开发服务器
pnpm dev

# 检查 markdown lint
pnpm lint:md

# 验证文档结构
pnpm verify

# 格式化文件
pnpm format
```

**Pre-commit hooks**：项目使用 husky 配合 lint-staged。提交时：

- Markdown 文件自动 lint 和格式化
- `verify-docs.py` 检查 docs.json 和 frontmatter

## MDX 组件

Mintlify 支持 MDX 组件。常用组件：

```mdx
<Card title="标题" icon="download" href="/path">
  卡片内容在此
</Card>

<CardGroup cols={2}>
  <Card>...</Card>
  <Card>...</Card>
</CardGroup>

<Accordion title="点击展开">隐藏内容</Accordion>

<AccordionGroup>
  <Accordion>...</Accordion>
</AccordionGroup>
```

允许内联 HTML（MDX）。所有组件参见 [Mintlify 文档](https://mintlify.com/docs/components)。

## 提交 PR

**文档变更**（docs 仓库）：

1. Fork：`https://github.com/mindfold-ai/docs`
2. Clone：`git clone https://github.com/YOUR_USERNAME/docs.git`
3. 安装：`pnpm install`
4. 分支：`git checkout -b feat/your-contribution`
5. 按照本指南进行修改
6. 测试：`pnpm dev`
7. 使用约定式消息提交（如 `docs: add xxx template`）
8. Push 并创建 PR

**Skills/Spec 模板**（Trellis 仓库）：

1. Fork：`https://github.com/mindfold-ai/Trellis`
2. Clone：`git clone https://github.com/YOUR_USERNAME/Trellis.git`
3. 在 `marketplace/` 下添加你的 skill/模板
4. 更新 `marketplace/index.json`
5. Push 并创建 PR

## PR 前检查清单

- [ ] 中英文版本都已创建（文档页面）
- [ ] `docs.json` 两种语言都已更新（文档页面）
- [ ] `marketplace/index.json` 已更新（skills/模板）
- [ ] 概览/索引页面已添加新条目
- [ ] 本地预览已测试（`pnpm dev`）
- [ ] 没有损坏的链接
- [ ] 代码块有正确的语言标签
- [ ] Frontmatter 包含 title 和 description
- [ ] 图片放在 `images/` 目录中（如有）