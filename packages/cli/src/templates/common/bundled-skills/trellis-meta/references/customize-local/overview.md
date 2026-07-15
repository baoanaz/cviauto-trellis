# 本地自定义概述

本目录适用于用户项目中通过 npm 安装了 Cviauto 且已运行 `cviauto init` 的本地 AI。AI 应修改项目中生成的 `.cviauto/` 和平台目录，而不是 Cviauto CLI 上游源代码。

## 首先确定用户实际想要修改什么

| 用户表述 | 先阅读 |
| --- | --- |
| "修改 Cviauto 流程 / 阶段 / 下一步提示" | `change-workflow.md` |
| "修改任务创建、状态、归档或钩子" | `change-task-lifecycle.md` |
| "AI 没有读取上下文 / 修改注入内容" | `change-context-loading.md` |
| "平台钩子行为不符合预期" | `change-hooks.md` |
| "修改 implement/check/research 代理行为" | `change-agents.md` |
| "添加 skill/command/workflow/prompt" | `change-skills-or-commands.md` |
| "调整项目 spec 结构" | `change-spec-structure.md` |
| "添加团队约定和本地备注" | `add-project-local-conventions.md` |

## 通用操作顺序

1. **确认平台和目录**：检查哪些目录存在，如 `.claude/`、`.codex/`、`.cursor/`、`.zcode/`。
2. **确认当前活动任务**：运行 `python3 ./.cviauto/scripts/task.py current --source`。
3. **阅读本地权威来源**：优先阅读 `.cviauto/workflow.md`、`.cviauto/config.yaml` 以及相关平台文件。
4. **窄范围修改**：仅编辑与用户请求相关的文件。
5. **同步语义**：如果共享流程变更，检查平台入口点是否也需要变更；如果平台入口变更，检查 `.cviauto/workflow.md` 是否仍然一致。

## 本地文件优先级

| 层级 | 文件 |
| --- | --- |
| 工作流 | `.cviauto/workflow.md` |
| 项目配置 | `.cviauto/config.yaml` |
| 任务材料 | `.cviauto/tasks/<task>/` |
| 项目规范 | `.cviauto/spec/` |
| 运行时脚本 | `.cviauto/scripts/` |
| 平台集成 | `.claude/`、`.codex/`、`.cursor/`、`.opencode/`、`.zcode/` 及类似目录 |
| 共享技能 | `.agents/skills/` |

## 默认不应做的事

- 不要编辑全局 npm 安装目录。
- 不要编辑 `node_modules/@mindfoldhq/cviauto`。
- 不要假设用户拥有 Cviauto GitHub 仓库。
- 不要用默认模板覆盖用户已修改的本地文件。
- 不要将团队项目规则放入公共 `cviauto-meta`；项目规则应放在 `.cviauto/spec/` 或本地 skill 中。

## 何时检视上游源码

仅在用户明确表达以下目标之一时，才切换到上游源码视角：

- "我想向 Cviauto 提交 PR"
- "我想修改 npm 包发布内容"
- "我想 fork Cviauto"
- "我想修改 `cviauto init/update` 的生成逻辑"

否则，默认修改用户项目内的本地 Cviauto 文件。