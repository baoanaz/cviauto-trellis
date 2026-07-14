# 发布技能到文档站（Publish Skill to Docs Site）

将 marketplace 技能（skill）同步到文档站。创建技能详情页（EN/ZH），更新 marketplace 索引，并更新 docs.json 导航。

## 参数（Arguments）

- `$ARGUMENTS` — `marketplace/skills/` 下的技能目录名（例如 `cc-codex-spec-bootstrap`）。如省略，列出可用的技能并询问。

## 步骤（Steps）

### 第 1 步：识别技能（Identify the Skill）

```bash
# 如未提供参数，列出可用的技能
ls marketplace/skills/
```

阅读技能的 `SKILL.md` 以提取：
- **name**（来自 frontmatter）
- **description**（来自 frontmatter）
- 技能的功能（来自正文）
- 前置条件 / 所需工具
- 包含哪些文件

```bash
cat marketplace/skills/<skill-name>/SKILL.md
```

### 第 2 步：检查现有文档（Check Existing Docs）

验证该技能尚未有文档页面：

```bash
ls docs-site/skills-market/<skill-name>.mdx 2>/dev/null
```

如果页面已存在，询问用户是否要更新它们。

### 第 3 步：创建英文详情页（Create EN Detail Page）

创建 `docs-site/skills-market/<skill-name>.mdx`。

遵循现有技能页面的格式（参考 `docs-site/skills-market/trellis-meta.mdx`）：

```markdown
---
title: '<skill-name>'
description: '<one-line description>'
---

<what the skill does - 1-2 paragraphs>

## Install

```bash
npx skills add mindfold-ai/Trellis/marketplace --skill <skill-name>
```

Or install all available skills:

```bash
npx skills add mindfold-ai/Trellis/marketplace
```

Options:

| Flag | Description |
| --- | --- |
| `-g` | Install globally (`~/.claude/skills/`) |
| `-a claude-code` | Target a specific agent |
| `-y` | Non-interactive mode |

## Verify Installation

...

## Usage

<example prompts>

## What's Included

<table of directories/files>
```

### 第 4 步：创建中文详情页（Create ZH Detail Page）

创建 `docs-site/zh/skills-market/<skill-name>.mdx`，内容为英文页面的中文翻译。

### 第 5 步：更新索引页面（Update Index Pages）

在两个页面的 Official Skills 表格中添加该技能：
- `docs-site/skills-market/index.mdx`
- `docs-site/zh/skills-market/index.mdx`

### 第 6 步：更新 docs.json（Update docs.json）

在 `docs-site/docs.json` 的英文和中文 Skills 导航组中添加新页面：

- EN：在 Skills 页面数组中添加 `"skills-market/<skill-name>"`
- ZH：在 ZH Skills 页面数组中添加 `"zh/skills-market/<skill-name>"`

### 第 7 步：提交并推送文档（Commit and Push Docs）

```bash
cd docs-site
git add skills-market/<skill-name>.mdx zh/skills-market/<skill-name>.mdx \
  skills-market/index.mdx zh/skills-market/index.mdx docs.json
git commit -m "docs: add <skill-name> skill to marketplace"
git push
```

### 第 8 步：确保技能在 main 分支上（Ensure Skill on Main Branch）

如果 marketplace 技能尚未在 `main` 分支上（例如提交在功能分支上）：

```bash
# 检查技能是否在 main 分支上存在
git log main --oneline -- marketplace/skills/<skill-name>/ | head -1
```

如果不在 main 上，cherry-pick 该提交：

```bash
# 查找添加技能的那个提交
git log --oneline -- marketplace/skills/<skill-name>/ | head -1

# Cherry-pick 到 main
git stash
git checkout main && git pull
git cherry-pick <commit-hash>
git push origin main
git checkout - && git stash pop
```

### 第 9 步：确认（Confirm）

报告：
- Docs-site 详情页已创建（EN + ZH）
- 索引页面已更新
- docs.json 已更新
- Docs-site 已推送
- Marketplace 技能在 main 分支上可用
