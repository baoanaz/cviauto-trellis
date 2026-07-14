# Mintlify 文档指南（Mintlify Documentation Guidelines）

> 在本 Mintlify 项目中编写和维护文档的最佳实践。

---

## 概述（Overview）

本项目使用 **Mintlify** 作为文档平台。所有内容均以 MDX（Markdown + JSX）编写，并通过 `docs.json` 进行配置。

---

## 指南索引（Guidelines Index）

| 指南（Guide） | 描述（Description） | 状态（Status） |
| ----------------------------------------------- | ---------------------------------------- | ------ |
| [目录结构（Directory Structure）](./directory-structure.md) | 文件组织和命名规范 | 就绪（Ready） |
| [MDX 指南（MDX Guidelines）](./mdx-guidelines.md) | MDX 语法、frontmatter、组件 | 就绪（Ready） |
| [配置指南（Config Guidelines）](./config-guidelines.md) | docs.json 配置模式 | 就绪（Ready） |
| [插件指南（Plugin Guidelines）](./plugin-guidelines.md) | Claude Code 插件清单（plugin manifest）模式 | 就绪（Ready） |
| [风格指南（Style Guide）](./style-guide.md) | 写作风格 + changelog/release-notes 语调 | 就绪（Ready） |
| [ASCII 图表对齐（ASCII-Art Alignment）](./ascii-art-alignment.md) | 图表中的方框绘制与 CJK 对齐 | 就绪（Ready） |
| [变更同步（Sync on Change）](./sync-on-change.md) | 当 Trellis 工作流 / 平台 / 命令 / 技能变更时，应更新哪些 docs-site 页面 | 就绪（Ready） |
| [发布生命周期（Release Lifecycle）](./release-lifecycle.md) | `docs-site/scripts/` 生命周期（release-only / +beta / +rc），何时以及如何使用它们 | 就绪（Ready） |

---

## 快速参考（Quick Reference）

### 本地开发（Local Development）

```bash
# 启动开发服务器
mintlify dev

# 自定义端口
mintlify dev --port 3333
```

### 文件类型（File Types）

| 扩展名（Extension） | 用途（Purpose） |
| ----------- | ------------------------------------------ |
| `.mdx`      | 文档页面 |
| `.json`     | 配置（docs.json）或 OpenAPI 规范 |
| `.svg/.png` | 图片和 logo |

### 关键文件（Key Files）

| 文件（File） | 用途（Purpose） |
| ---------------- | ------------------ |
| `docs.json`      | 主配置文件 |
| `index.mdx`      | 首页 |
| `snippets/*.mdx` | 可复用内容 |

---

## 部署（Deployment）

- **预览（Preview）**：创建 PR 时自动触发
- **生产（Production）**：推送到 `main` 分支触发部署

---

**语言（Language）**：除非另有说明，所有文档应使用**英文（English）**编写。
