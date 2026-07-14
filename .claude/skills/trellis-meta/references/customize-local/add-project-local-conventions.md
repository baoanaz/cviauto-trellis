# 添加项目本地约定

用户通常不需要更改 Trellis 机制本身；他们需要让本地 AI 理解其团队的约定。在这种情况下，优先使用 `.trellis/spec/` 或项目本地 skill，而非编辑 `trellis-meta`。

## 各类内容放置位置

| 内容类型 | 位置 |
| --- | --- |
| 代码必须遵循的规则 | `.trellis/spec/<layer>/` |
| 跨层思维方法 | `.trellis/spec/guides/` |
| 项目特定流程的 AI 能力 | 平台本地 skill |
| 一次性任务材料 | `.trellis/tasks/<task>/` |
| 会话摘要 | `.trellis/workspace/<developer>/journal-N.md` |

## 创建项目本地 Skill

如果用户希望 AI 了解「本项目如何自定义 Trellis」，创建一个本地 skill：

```text
.claude/skills/trellis-local/
└── SKILL.md
```

示例：

```md
---
name: trellis-local
description: "Project-local Trellis customizations for this repository. Use when changing this project's Trellis workflow, hooks, local agents, or team-specific conventions."
---

# Trellis Local

## Local Scope

This skill documents this repository's Trellis customizations only.

## Custom Workflow Rules

- ...

## Local Hook Changes

- ...

## Local Agent Changes

- ...
```

对于多平台项目，在其他平台 skill 目录中放置等效版本，或在支持共享层的平台上使用 `.agents/skills/`。

## 写入 `.trellis/spec/`

如果内容是编码约定，将其写入 spec。示例：

```text
.trellis/spec/backend/error-handling.md
.trellis/spec/frontend/components.md
.trellis/spec/guides/cross-platform-thinking-guide.md
```

写入后，更新对应的 `index.md`，以便 AI 能从入口点找到新规则。

## 让当前 Task 使用新约定

写入 spec 后，将其添加到当前 task 上下文中：

```bash
python3 ./.trellis/scripts/task.py add-context <task> implement ".trellis/spec/backend/error-handling.md" "Error handling conventions"
python3 ./.trellis/scripts/task.py add-context <task> check ".trellis/spec/backend/error-handling.md" "Review error handling"
```

## 不要将项目私有规则存储在 `trellis-meta` 中

`trellis-meta` 是一个用于理解 Trellis 架构和本地自定义入口点的公共 skill。将项目私有内容放在：

- `.trellis/spec/`
- 项目本地 skill
- 当前 task
- workspace journal

这可以防止未来 Trellis 内置的 `trellis-meta` 更新覆盖团队自己的约定。