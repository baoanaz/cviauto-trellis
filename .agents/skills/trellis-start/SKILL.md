---
name: trellis-start
description: "Initializes an AI development session by reading workflow guides, developer identity, git status, active tasks, and project guidelines from .trellis/. Classifies incoming tasks and routes to brainstorm, direct edit, or task workflow. Use when beginning a new coding session, resuming work, starting a new task, or re-establishing project context."
---

# 开始会话

初始化一个 Trellis 管理的开发会话。此平台没有会话启动 hook，因此按以下步骤手动加载等效的紧凑上下文。

---

## 步骤 1：当前状态
身份、git 状态、当前任务、活动任务、日志位置。

```bash
python3 ./.trellis/scripts/get_context.py
```

如果输出中包含以 `Trellis update available:` 开头的行，在总结会话上下文时逐字复制整行。不要缩短操作命令提示。

## 步骤 2：工作流概览
紧凑的阶段索引、请求分类规则、规划文档契约、以及步骤详情命令。

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
```

完整指南在 `.trellis/workflow.md`（按需阅读）。

## 步骤 3：指南索引
发现 package 和 spec 层级，然后阅读每个相关索引文件。

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
cat .trellis/spec/guides/index.md
cat .trellis/spec/<package>/<layer>/index.md   # 对每个相关 layer
```

索引文件列出了实际编码时需要阅读的具体指南文档。

## 步骤 4：决定下一步行动
从步骤 1 中你知道了当前任务和状态。检查任务目录：

- **活动任务状态 `planning` + 无 `prd.md`** → 阶段 1.1。加载 `trellis-brainstorm` skill。
- **活动任务状态 `planning` + `prd.md` 存在** → 留在阶段 1。轻量级任务可以只有 PRD；复杂任务需要 `design.md` + `implement.md`。在 `task.py start` 之前加载相关阶段 1 步骤详情。
- **活动任务状态 `in_progress`** → 阶段 2 步骤 2.1。加载步骤详情：
  ```bash
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform codex
  ```
- **无活动任务** → 先分类。对于简单对话/小任务，仅询问本轮是否应创建 Trellis 任务。对于复杂工作，询问是否允许创建 Trellis 任务并进入规划。如果用户说不，则跳过 Trellis。

---

## Skill 路由（快速参考）

| 用户意图 | Skill |
|---|---|
| 新功能 / 需求不明确 | `trellis-brainstorm` |
| 即将编写代码 | `trellis-before-dev` |
| 编码完成 / 质量检查 | `trellis-check` |
| 卡住了 / 同一个 bug 修复了多次 | `trellis-break-loop` |
| 学到了值得沉淀的内容 | `trellis-update-spec` |

完整规则和反合理化表格在 `.trellis/workflow.md` 中。