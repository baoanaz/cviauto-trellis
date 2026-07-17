# 结束工作（Finish Work）

结束当前会话（session）：归档活跃任务（及用户希望清理的其他已完成但未归档的任务）并记录会话日志（session journal）。代码提交不在此处进行——提交发生在工作流第 3.4 阶段，在调用本命令之前。

## 第 1 步：检查当前状态（Survey current state）

```bash
python3 ./.cviauto/scripts/get_context.py --mode record
```

输出内容包括：

- **我的活跃任务（My active tasks）** — 审查除了当前任务外，是否有其他任务实际上已完成（代码已合并、验收标准已满足），应在本轮归档。
- **Git 状态（Git status）** — 快速查看哪些内容未提交。
- **最近提交（Recent commits）** — 在第 4 步中需要这些提交的哈希值来传递给 `--commit` 参数。

如果 `--mode record` 显示了其他已完成但与当前会话无关的任务，请以一次性确认的方式呈现给用户："以下 N 个任务看起来已完成——本轮是否一并归档？[y/N]"。默认为否；当前活跃任务无论确认与否都会在第 3 步归档。

## 第 2 步：完整性检查——对未提交路径进行分类（Sanity check — classify dirty paths）

运行：

```bash
git status --porcelain
```

过滤掉 `.cviauto/workspace/` 和 `.cviauto/tasks/` 下的路径——这些由 `add_session.py` 和 `task.py archive` 自动提交管理，会作为本技能自身工作的一部分显示为未提交状态。

对于每个剩余的未提交路径，判断它属于**当前任务**还是**其他并行工作**（例如另一个终端窗口正在编辑同一仓库）。判断依据：

- 路径在当前任务的 `prd.md` / `implement.jsonl` / `check.jsonl` 中被引用 → 属于当前任务
- 路径所在代码区域与任务声明的范围匹配，或者你记得本会话中编辑过 → 属于当前任务
- 路径位于无关区域，且你没有任何本会话中接触过的印象 → 属于其他并行工作

然后按以下方式路由：

- **任何剩余路径看起来属于当前任务的工作** — 中断并提示：
  > "工作树中存在未提交的本任务代码变更：`<list>`。请先返回工作流第 3.4 阶段将其提交，再运行 `cviauto:finish-work`（skill command）。"

  不要在此处运行 `git commit`。不要提示用户提交。用户应返回第 3.4 阶段，由 AI 在此处驱动批量提交。
- **所有剩余路径看起来无关**（属于其他并行窗口的工作）— 报告一次并继续第 3 步：
  > "FYI，以下未提交文件不在本任务范围内——留待其他窗口处理：`<list>`。"
- **确实无法判断** — 询问用户一次："`<list>` 是本任务我忘记提交的工作，还是其他窗口的？（commit / ignore）"— 然后按照用户的回答进行路由。

## 第 3 步：归档任务（Archive task(s)）

```bash
python3 ./.cviauto/scripts/task.py archive <task-name>
```

至少归档：当前活跃任务（如有）。加上第 1 步中用户确认的任何额外任务。每次归档都会通过脚本的自动提交生成一个 `chore(task): archive ...` 的提交。

如果没有活跃任务且用户未确认任何清理归档，则跳过此步骤。

## 第 4 步：记录会话日志（Record session journal）

```bash
python3 ./.cviauto/scripts/add_session.py \
  --title "Session Title" \
  --commit "hash1,hash2" \
  --summary "Brief summary"
```

将第 3.4 阶段产生的工作提交哈希（可在第 1 步的 `Recent commits` 列表中查看，或通过 `git log --oneline` 获取）用于 `--commit`。不要包含第 3 步的归档提交哈希。此操作会生成一个 `chore: record journal` 的提交。

最终的 git log 顺序：`<第 3.4 阶段的工作提交>` → `chore(task): archive ...`（一个或多个）→ `chore: record journal`。
