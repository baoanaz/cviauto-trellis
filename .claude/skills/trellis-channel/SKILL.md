---
name: trellis-channel
description: Use Trellis channel for live multi-agent collaboration, spawned workers, cross-agent review, progress inspection, forum channels, and channel log debugging.
---

# trellis-channel

`trellis channel` 是本地多 Agent 协作运行时。当 Agent 需要通过持久事件日志对话、当需要将 worker 作为对等进程启动、当运行中的 worker 需要中断/调试、或当需要在持久的 `--type forum` 频道上记录反馈时使用。

典型用户信号："和 codex/claude 讨论"、"brainstorm with another agent"、"spawn an implement/check worker"、"let agent review"、"开一个 issue 区 / changelog 论坛"、"看看这个 thread"、"channel 卡住了 / 没输出"、"进度被截断了"、"怎么写那个 channel 命令"。

此技能是一个索引。仅加载当前任务需要的参考文件——不要全部预加载。

## 首要命令

```bash
trellis --version
trellis channel --help
trellis channel list --all
trellis channel list --scope global --all
```

如果用户提到了某个频道或线程，先检查再询问背景：

```bash
trellis channel forum <board> --scope global
trellis channel thread <board> <thread> --scope global
trellis channel context list <board> --scope global --thread <thread>
```

## 按用户意图路由

| 用户意图 | 阅读 |
|---|---|
| "和 codex/claude 讨论一下"、"brainstorm with another agent" | `references/workflows.md` |
| "派一个 implement/check agent"、"让 agent review"、"spawn a worker" | `references/workflows.md`，然后 `references/workers.md` |
| "开 issue 区 / topic 群 / changelog / board"、"make a forum" | `references/forum.md` |
| "看看这个 thread / linked context"、"inspect a thread" | `references/forum.md` |
| "channel 卡住了 / 没输出 / progress 被截断"、"worker stalled" | `references/progress-debugging.md` |
| "具体命令怎么写"、"what flags does X take" | `references/command-reference.md` |

## 核心规则

- 新建 forum 频道使用 `--type forum`。`thread` 是 forum 频道内的一个条目。
- 使用 `--context-file` / `--context-raw` 和 `trellis channel context add/delete/list`。`--linked-context-*` 是已弃用的术语。
- 使用 `--stdin` 或 `--text-file` 传递长消息。不要把包含中英混合的长文本放在 shell 位置参数中。
- 美化的 `messages` 输出是运维仪表盘，可能截断进度。使用 `--raw` 进行审计。
- `--as` 是发言者或 worker 句柄，取决于具体命令。当涉及多个 Agent 或会话时，使用明确、稳定的名称。
- `--scope project`（默认）操作当前 cwd 的项目桶；`--scope global` 操作共享的 `__global__` 桶。有意识地选择 scope——global board 在项目列表中不可见，除非传入 `--scope global`。
- 对于 brainstorm，进行多轮压力测试。一次回答加一次确认是审查，不是 brainstorm。
- **分发器等待模式**：使用 `--kind done` / `--kind turn_finished`（trellis 发出的系统事件），而非用户 `--tag` 作为完成信号。CLI 帮助将 `phase_done` / `question` 列为 `--tag` 示例，但只有 `interrupt` 是具有硬编码 trellis 行为的保留 tag；其他的是不透明的用户标签。依赖 worker 运行 `send --tag <my_signal>` 是不可靠的——LLM worker 通常将 tag 字符串写入散文而非运行实际的 CLI 命令。参见 `references/command-reference.md` "tag vs kind"。
- Forum 频道是事件溯源的。不要先解析 `events.jsonl`；使用 `forum`、`thread`、`messages --thread` 和 `context list`。
- `@mindfoldhq/trellis-core` 拥有可复用的频道/线程状态、事件追加、序列号分配、上下文/标题投影、reducer 和任务辅助函数。CLI 拥有标志位、终端渲染、prompt、worker 生命周期和进程退出。

## 参考文件

- `references/workflows.md` — 规范协作模式 A–F（peer brainstorm、spawned review、dispatch-and-wait、forum issue capture、interrupt-and-redirect、one-shot run）。
- `references/forum.md` — forum 频道、上下文、标题、重命名、changelog 论坛、线程过滤。
- `references/workers.md` — spawn、Agent 卡片、上下文注入（`--file` / `--jsonl`）、中断、kill 语义。
- `references/progress-debugging.md` — 进度/原始检查、停滞 worker 诊断、OOM 守护、退出码。
- `references/command-reference.md` — 当前 CLI 命令参考（每个子命令、每个标志位、输出约定、scope/type 模型）。

## 不适用于

- 一个 markdown 文件和 prompt 就足够的静态审查。
- 用自记录替代正常的工具调用。
- 长期记忆检索。使用持久 forum 频道记录可操作的 issue，使用 `trellis mem`（`trellis-session-insight` 技能）进行会话/历史搜索。