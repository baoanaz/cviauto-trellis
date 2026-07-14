# 继续当前任务（Continue Current Task）

恢复当前任务的工作——在 `.trellis/workflow.md` 中的正确阶段/步骤处接续。

---

## 第 1 步：加载当前上下文（Load Current Context）

```bash
python3 ./.trellis/scripts/get_context.py
```

确认：当前任务、git 状态、最近提交。

## 第 2 步：加载阶段索引（Load the Phase Index）

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
```

显示阶段索引（Phase Index：Plan / Execute / Finish）以及路由和技能映射。

## 第 3 步：确定你当前所处位置（Decide Where You Are）

`get_context.py` 会显示活跃任务的 `status` 字段。根据 `status` + 产物存在情况进行路由。此命令替代用户自行记忆 Trellis 流程的需要；它本身并不批准实现。

- `status=planning` + 无 `prd.md` → **1.1**（加载 `trellis-brainstorm`）
- `status=planning` + 仅有 `prd.md` → 判断任务是轻量级还是复杂型。轻量级可转入 **1.4** 评审；复杂型则返回 **1.1** 补充 `design.md` + `implement.md`。
- `status=planning` + 复杂产物已完成 + 子代理 jsonl 未编排（仅有种子行 `_example`）→ **1.3**
- `status=planning` + 必需产物已完成 + 必需的 jsonl 已编排或采用内联模式 → **1.4**（询问是否开始评审；仅在用户确认后运行 `task.py start`）
- `status=in_progress` + 尚未开始实现 → **2.1**
- `status=in_progress` + 实现已完成，尚未检查 → **2.2**
- `status=in_progress` + 检查已通过 → **3.3**（更新 spec）→ **3.4**（提交）
- `status=completed`（罕见；通常立即归档）→ 归档流程

阶段规则（详见 `.trellis/workflow.md`）：

1. 在阶段内**按顺序**执行步骤——`[required]` 步骤不得跳过
2. `[once]` 步骤在所需输出已存在时即视为已完成。仅 `prd.md` 本身只对轻量级任务足够；复杂型任务还需要 `design.md` 和 `implement.md`。
3. 如果发现需要，可以回溯到更早的阶段

## 第 4 步：加载具体步骤（Load the Specific Step）

确定从哪个步骤接续后：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.X> --platform claude
```

按照加载的指令执行。每个 `[required]` 步骤完成后，进入下一步。

---

## 参考（Reference）

完整工作流和详细的阶段步骤位于 `.trellis/workflow.md`。本命令仅为一个入口点——权威指引在那里。
