---
name: trellis-session-insight
description: "Reach into past AI conversation history through the `trellis mem` CLI. Use whenever the user asks 'how did we solve X last time', 'have we discussed this before', 'what was the decision on X', 'remind me what we did in this task', '上次怎么解的', '之前讨论过吗', '想起一段对话', or when starting a brainstorm that overlaps prior work, debugging a familiar bug, continuing a task across sessions, or doing a finish-work review. Returns raw past dialogue; decide for the moment whether to update spec, append to task notes, quote inline in the answer, or just internalize."
---

# Trellis 会话洞察

此技能教 AI **如何调用 `trellis mem`**——项目的跨会话记忆原料——以及**何时使用它是正确的选择**。

它有意设计为**能力技能，而非工作流**。没有固定的输出文件，没有必需的写回步骤，没有"始终在 finish-work 后运行"的规则。如何处理 `mem` 返回的内容是在对话当下做出的判断。此技能的存在是为了让 AI 知道这个能力的存在并可以自行决定。

## `trellis mem` 是什么

一个本地 CLI，索引用户过去的 Claude Code、Codex 和 Pi Agent 对话日志（每个平台存储在 `~/.claude/projects/`、`~/.codex/sessions/` 和 `~/.pi/agent/sessions/` 下的 JSONL 文件），并允许你列出、搜索、按 Trellis 任务边界切片，以及从中导出清洗后的对话内容。OpenCode 日志尚不可索引（provider adapter 待完成）——当 OpenCode 会话是明显目标时，应说明此限制而非猜测。

`mem` 中的任何内容都不会上传。所有读取都在本地。

## 何时使用它

标准是"资深同事会不会问'我们不是已经讨论过这个了吗？'"——那些就是使用的时刻。一些具体模式：

- **Brainstorm 重复风险。** 开始一个涉及用户之前接触过的领域的新任务时，你想在重新询问用户之前检查是否已经做过决定。
- **熟悉的 bug 调试。** 当前的 bug 模式感觉像是用户之前报告/修复过的。拉取相关的过往会话可以节省整个调试循环。
- **跨会话续接。** 用户在中断后恢复工作，说"我们上次做到哪了"/"继续上次的"，但没有具体说明。
- **决策检索。** 用户提到"我们关于 X 做的决定"，但该决定存在于旧的 brainstorm 中，而非任何 `prd.md` / `spec/` 中。
- **Finish-work 回顾。** 当用户明确要求总结此任务中决定了什么/什么令人痛苦/什么令人惊讶——不是每次 finish-work 的强制步骤。
- **跨过往工作的模式发现。** 用户问"我是不是一直在犯同样的 X 错误"/"我每次都踩这个坑吗"——跨会话搜索可以回答。

如果以上都不适用，不要调用 `mem`。它是一个工具，不是仪式。

## 何时不使用它

- 相关上下文已经在当前轮次、`prd.md`、`design.md`、最近的 `git log` 或打开的文件中。`mem` 用于已经脱离即时范围的内容。
- 用户问的是代码中的事实，而非过往对话中的事实。`git log -p` / `grep` / 直接读文件更快且更权威。
- 你在 sub-agent（`trellis-implement` / `trellis-check`）中，其分发 prompt 已包含整理好的 `implement.jsonl` / `check.jsonl` 上下文。在此基础上加 `mem` 通常只会增加杂乱。
- 用户明确表示"不要翻历史，按我问的回答"。

## 如何处理 `mem` 返回的内容

将输出视为**原材料**，而非交付物。获得之后，根据实时对话决定：

- **在你的回复中内联引用**，如果具体的过往交流能回答用户当前的问题——并引用 session-id / phase 以便用户验证。
- **更新 `<task>/prd.md` 或 `<task>/design.md`**，如果 `mem` 发现了一个应当被记录但未记录的关键决策。先向用户展示建议的编辑。
- **追加到任务本地笔记文件**（如 `<task>/notes.md` 或扩展现有文件），如果发现的内容属于当前任务记录但不适合放入 PRD。
- **更新 `.trellis/spec/`**，如果发现的是项目级约定或陷阱，会对未来任务有帮助。运行 `trellis-update-spec` 技能来处理——`session-insight` 止步于发现。
- **仅吸收**，在接下来的几轮中更好地回答，而不写入任何内容。这对一次性回忆通常是正确的做法。

Trellis 不规定单一目的地。把每次回忆强制写入固定文件会让文件膨胀成噪音。让情境决定。

## 如何调用

完整 CLI 参考在 `references/cli-quick-reference.md`。80% 的情况是以下之一：

```bash
# 查找内容包含关键词的会话（project-scope 是默认；
# 添加 --global 搜索此机器上的所有项目）。
trellis mem search "<关键词>"

# 导出一个会话的对话内容，可选按阶段或关键词过滤。
trellis mem extract <session-id> --phase brainstorm
trellis mem extract <session-id> --grep "<关键词>"

# 深入一个会话：top-N 命中轮次 + 周围上下文。
trellis mem context <session-id> --turns 3 --around 2

# 当还不知道 session id 时，从 list + filter 开始。
trellis mem list --cwd <project-path>
trellis mem projects   # → 列出活动项目 cwd，然后缩小范围
```

阶段切片（`--phase brainstorm|implement|all`）在 `task.py create` 和 `task.py start` 边界处切割会话。对当前任务的 finish-work 回顾，`--phase brainstorm` 恢复规划讨论，`--phase implement` 恢复执行循环。默认为 `all`。

## 触发模式

`references/triggering-patterns.md` 列出了更多应当让你想到"使用 `mem`"的逐字用户表述（英文 + 中文）——在训练直觉时随时参考。

## 超出范围

- `mem` 不编辑代码或更新文件。任何写回是你在当下做出的决定。
- `mem` 对平台 JSONL 存储是只读的。它不推送或同步到远程。
- 此技能不替代 `trellis-update-spec`（后者是将发现推广为项目级指南的正确工具）或平台原生的 task / spec 工作流。