---
name: trellis-finish-work
description: "Wrap up the current session: verify quality gate passed, remind user to commit, archive completed tasks, and record session progress to the developer journal. Use when done coding and ready to end the session."
---

# 完成工作

结束当前会话：归档活动任务（以及用户想要清理的其他已完成但未归档的任务）并记录会话日志。代码提交不在此处进行——在调用此命令之前，已在工作流阶段 3.4 中完成。

## 步骤 1：调查当前状态

```bash
python3 ./.trellis/scripts/get_context.py --mode record
```

输出内容包括：

- **我的活动任务** — 审查当前任务之外是否有其他任务实际已完成（代码已合并、验收标准已满足），应在本轮归档。
- **Git 状态** — 快速查看哪些文件有变更。
- **最近提交** — 步骤 4 中 `--commit` 需要用到这些 hash。

如果 `--mode record` 显示了与当前会话无关的其他已完成任务，向用户一次性确认："这 N 个任务看起来已完成——本轮一并归档？[y/N]"。默认为否；当前活动任务始终在步骤 3 中归档。

## 步骤 2：健全性检查——分类脏路径

运行：

```bash
git status --porcelain
```

过滤掉 `.trellis/workspace/` 和 `.trellis/tasks/` 下的路径——这些由 `add_session.py` 和 `task.py archive` 自动提交管理，会作为本技能自身工作的一部分显示为脏。

对每个剩余的脏路径，判断它属于**当前任务**还是**其他并行工作**（如另一个终端窗口在编辑同一仓库）。启发式规则：

- 当前任务的 `prd.md` / `implement.jsonl` / `check.jsonl` 中引用的路径 → 当前任务
- 与任务声明范围匹配的代码区域中的路径，或你记得本会话编辑过的 → 当前任务
- 不相关区域中、你完全不记得本会话碰过的路径 → 其他并行工作

然后路由：

- **任何剩余路径看起来是当前任务的工作** — 退出并提示：
  > "工作树中有来自此任务的未提交代码变更：`<list>`。返回工作流阶段 3.4 提交它们，然后再运行 ``finish-work`（Trellis 命令）`。"

  不要在此处运行 `git commit`。不要提示用户提交。用户回到阶段 3.4，AI 在那里驱动批量提交。
- **所有剩余路径看起来不相关**（其他并行窗口的工作）— 报告一次然后继续步骤 3：
  > "FYI，此任务范围之外的脏文件——留给另一个窗口：`<list>`。"
- **确实不确定** — 询问用户一次："`<list>` 是我忘记提交的此任务的工作，还是另一个窗口的？（commit / ignore）"——然后按其回答路由。

## 步骤 3：归档任务

```bash
python3 ./.trellis/scripts/task.py archive <task-name>
```

至少：当前活动任务（如有）。加上步骤 1 中用户确认的任何额外任务。每次归档通过脚本的自动提交产生一个 `chore(task): archive ...` 提交。

如果没有活动任务且用户未确认任何清理归档，跳过此步骤。

## 步骤 4：记录会话日志

```bash
python3 ./.trellis/scripts/add_session.py \
  --title "会话标题" \
  --commit "hash1,hash2" \
  --summary "简要摘要"
```

使用阶段 3.4 中产生的工作提交 hash（在步骤 1 的 `Recent commits` 列表中可见，或通过 `git log --oneline`）作为 `--commit`。不包括步骤 3 中的归档提交 hash。这会产生一个 `chore: record journal` 提交。

最终 git log 顺序：`<3.4 的工作提交>` → `chore(task): archive ...`（一个或多个）→ `chore: record journal`。