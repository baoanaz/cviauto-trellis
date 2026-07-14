---
name: trellis-continue
description: "Resume work on the current task. Loads the workflow Phase Index, figures out which phase/step to pick up at, then pulls the step-level detail via get_context.py --mode phase. Use when coming back to an in-progress task and you need to know what to do next."
---

# 继续当前任务

恢复当前任务的工作——从 `.trellis/workflow.md` 中正确的阶段/步骤继续。

---

## 步骤 1：加载当前上下文

```bash
python3 ./.trellis/scripts/get_context.py
```

确认：当前任务、git 状态、最近提交。

## 步骤 2：加载阶段索引

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
```

显示阶段索引（Plan / Execute / Finish），包含路由和 skill 映射。

## 步骤 3：判断当前所处位置

`get_context.py` 显示活动任务的 `status` 字段。按 `status` + 文档存在情况路由。此命令代替用户记忆 Trellis 流程；它本身不批准实现。

- `status=planning` + 无 `prd.md` → **1.1**（加载 `trellis-brainstorm`）
- `status=planning` + 仅有 `prd.md` → 判断任务是轻量级还是复杂任务。轻量级可进入 **1.4** 审查；复杂任务返回 **1.1** 添加 `design.md` + `implement.md`。
- `status=planning` + 复杂文档齐全 + sub-agent jsonl 未整理（仅种子 `_example` 行）→ **1.3**
- `status=planning` + 所需文档齐全 + 所需 jsonl 已整理或 inline 模式 → **1.4**（请求开始审查；仅在用户确认后运行 `task.py start`）
- `status=in_progress` + 实现未开始 → **2.1**
- `status=in_progress` + 实现完成，尚未检查 → **2.2**
- `status=in_progress` + 检查通过 → **3.3**（spec 更新）→ **3.4**（提交）
- `status=completed`（罕见；通常立即归档）→ 归档流程

阶段规则（完整细节在 `.trellis/workflow.md`）：

1. 在阶段内**按顺序**运行步骤——`[required]` 步骤不得跳过
2. `[once]` 步骤如果所需输出已存在，则已完成。仅 `prd.md` 只对轻量级任务足够；复杂任务还需要 `design.md` 和 `implement.md`。
3. 如果发现需要，可以回到更早的阶段

## 步骤 4：加载具体步骤

一旦知道从哪个步骤恢复：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.X> --platform codex
```

按照加载的指令执行。每个 `[required]` 步骤完成后，进入下一个。

---

## 参考

完整的工作流和详细的阶段步骤在 `.trellis/workflow.md` 中。此命令只是入口点——权威指导在那里。