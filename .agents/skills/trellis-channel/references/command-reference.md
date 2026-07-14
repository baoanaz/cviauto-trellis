# 命令参考（Command Reference）

`trellis channel` 子命令的权威当前命令参考，对照 `packages/cli/src/commands/channel/` 目录下的源码验证（`index.ts` 的 Commander 接线以及各子命令处理函数）。

除非另有说明，每个子命令都接受 `--scope <project|global>`；`project` 为默认值，会基于当前工作目录的项目桶进行解析。

## 顶层命令

```
trellis channel <subcommand>
```

> 多智能体协作运行时（Multi-agent collaboration runtime）—— 通过共享事件日志来生成（spawn）/ 协调（coordinate）/ 中断（interrupt）工作智能体（worker agent）。

---

## 创建 / 列表

### `create <name>`

```bash
trellis channel create <name>
  [--scope project|global]                # 默认：project
  [--type chat|forum]                     # 默认：chat
  [--task <path>]                         # 关联的 Trellis 任务目录
  [--project <slug>]
  [--labels a,b,c]
  [--description <text>]                  # 稳定的频道描述
  [--context-file <abs-path>] ...         # 可重复
  [--context-raw  <text>]      ...        # 可重复
  [--linked-context-file <abs-path>]      # [已弃用的别名]
  [--linked-context-raw  <text>]          # [已弃用的别名]
  [--cwd <path>]                          # 记录在 create 事件中
  [--by <agent>]                          # 默认：main
  [--force]                               # 覆盖已存在的频道
  [--ephemeral]                           # 在默认列表中隐藏，可被清理
```

行为：
- 追加一条 `create` 事件；`type` 不可变（创建后无法在 forum 与 chat 之间切换）。
- `--ephemeral` 频道默认在 `channel list` 中隐藏，同时也是 `channel prune --ephemeral` 的清理目标。
- `--linked-context-*` 会被合并到 `--context-*` 中；使用时会输出弃用提示。

### `list`

```bash
trellis channel list
  [--scope project|global]
  [--json]
  [--project <slug>]                      # 对 task 字段做子串匹配
  [--all]                                 # 包含临时频道（后缀 '*'）
  [--all-projects]                        # 扫描所有项目桶
```

行为：
- 默认范围：当前工作目录的项目。`--all-projects` 会扫描所有桶。
- 美化模式（pretty mode）打印 `NAME WORKERS EVENTS LAST KIND TYPE TASK`，按最近时间排序，并在页脚显示隐藏的临时频道数量。
- `--json` 切换为 JSON 数组输出。

---

## 聊天消息（Chat Messages）

### `send <name> [text]`

```bash
trellis channel send <name> [text]
  --as <agent>                            # 必填 — 作者
  [--scope project|global]
  [--to <agents,csv>]                     # 默认：广播（broadcast）
  [--stdin | --text-file <path>]          # 从标准输入或文件读取消息体
  [--delivery-mode appendOnly|requireKnownWorker|requireRunningWorker]
```

行为：
- 消息体优先级：位置参数 `[text]` → `--stdin` → `--text-file`。
- `--to` 只有一个条目时存储为字符串；多个时存储为数组；省略时表示广播。
- `--delivery-mode` 选择定向投递验证方式：
  - `appendOnly`（默认行为 — 仅记录），
  - `requireKnownWorker`（指定目标必须有 `spawned` 事件），
  - `requireRunningWorker`（该 worker 当前必须处于活跃状态）。
- 将追加的事件以单行 JSON 打印到 stdout。

> **注意：** `send` **没有** `--tag` 和 `--kind` 标志。参见下文 [tag-vs-kind](#tag-vs-kind--事件形态的实际控制方式)。

### `messages <name>`

```bash
trellis channel messages <name>
  [--scope project|global]
  [--raw]                                 # 每行一个 JSON 事件
  [--follow]                              # 流式推送新事件
  [--last <N>]                            # 最近 N 条匹配事件
  [--since <seq>]                         # seq > N
  [--kind <kind>]                         # 必须是 CHANNEL_EVENT_KINDS 之一
  [--from <csv>]                          # 作者过滤
  [--to <target>]                         # 路由目标过滤
  [--thread <key>]                        # 仅 forum 频道
  [--action <thread-action>]              # 仅 forum 频道
  [--no-progress]                         # 隐藏进度事件
```

行为：
- 自动检测 forum 频道：无过滤器时渲染线程面板而非事件流。`--thread` / `--action` 仅限 forum 频道，对 chat 频道使用会报错。
- `--kind` 会按 `CHANNEL_EVENT_KINDS` 进行校验（单个值，非 CSV — `wait` 那边才是 CSV）。

### `wait <name>`

```bash
trellis channel wait <name>
  --as <agent>                            # 必填 — 用于过滤器上下文的自身标识
  [--scope project|global]
  [--timeout <Ns|Nm|Nh|Nms>]              # 由 parseDuration 解析
  [--from <a,b>]                          # 作者 CSV
  [--kind <k1,k2>]                        # CSV，OR 语义
  [--thread <key>]                        # forum 过滤
  [--action <thread-action>]              # forum 过滤
  [--to <target>]                         # 默认：自身智能体（广播 + 我）
  [--include-progress]                    # 遇到进度事件也唤醒
  [--all]                                 # 要求所有 --from 都匹配
```

行为：
- 以 JSON 流式输出匹配的事件，每行一个。
- 默认 `--to` 过滤器为调用者自身智能体（广播事件也会匹配 — 广播 + 显式发送给我）。
- `--all` 要求指定 `--from`，并且会阻塞直到所有列出的智能体都产生了匹配事件。
- **超时退出码为 124**，当使用了 `--all` 时，会在 stderr 打印 `timeout: still waiting on ...`。

---

## tag-vs-kind — 事件形态的实际控制方式

v0.6.0 的 channel CLI 中**任何地方都没有 `--tag` 标志**；`--kind` 也不是任何 `--tag` 标志的旧版别名。

当前源码中的具体模型：

- `--kind` 是唯一的事件类型过滤器，且被限制为 Trellis 发出的白名单（`packages/core/src/channel/internal/store/events.ts` 中的 `CHANNEL_EVENT_KINDS`）：
  - `create`、`join`、`leave`、`message`、`thread`、`context`、`channel`、`spawned`、`killed`、`respawned`、`progress`、`done`、`error`、`waiting`、`awake`、`undeliverable`、`interrupt_requested`、`turn_started`、`turn_finished`、`interrupted`、`supervisor_warning`
  - 传入其他值会抛出 `Invalid --kind '<x>'. Must be one of: …`。
- `--kind` 用于 `wait`（CSV，OR 语义）和 `messages`（单个值）。`send` 和 `run` 不能发送自定义 kind — 每次 `send` 写入的都是 `message` 事件。
- 中途终止 worker **不是**一个 tag，而是专用的 `channel interrupt` 命令，它会追加一对 `interrupt_requested` / `interrupted` 事件，并在 provider 层级对 worker 进行中断。

调度者（dispatcher）等待 worker 的实用规则：

- 使用 `--kind done,turn_finished` 来表示"worker 完成了一个回合" — 这些是 supervisor 自动触发的系统事件。不要依赖 worker 的 LLM 记得发出任何自定义信号。
- 只有当你确实需要中途终止行为时，才使用 `trellis channel interrupt`（该命令）。
- **不要**凭空发明用户侧标签作为完成信号。没有 `--tag` 过滤器；worker 在最终消息中写入的自定义字符串只是 `message` 事件中的文本，无法被 `wait` 匹配到。

长消息体始终通过标准输入或文件传递：

```bash
trellis channel send T --as A --stdin < /tmp/message.md
trellis channel send T --as A --text-file /tmp/message.md
```

---

## 中断（Interrupt）

### `interrupt <name> [text]`

```bash
trellis channel interrupt <name> [text]
  --as <agent>                            # 必填 — 调用者
  --to <agent>                            # 必填 — 目标 worker
  [--scope project|global]
  [--stdin | --text-file <path>]
```

行为：
- 追加一条 `interrupt` 事件，其中 `reason: "user"` 并附带替代指令正文；supervisor 在 provider 支持的情况下执行 provider 级中断（Claude 的 `/interrupt`、Codex 的 turn cancel）。
- 将追加的事件 JSON 打印到 stdout。

---

## 工作智能体（Workers）

### `spawn <name>`

```bash
trellis channel spawn <name>
  [--scope project|global]
  [--agent <agent-name>]                  # 加载 .trellis/agents/<name>.md
  [--provider claude|codex]               # 覆盖 agent 文件中的配置
  [--as <worker-name>]                    # 默认：agent 名称
  [--cwd <path>]
  [--model <id>]
  [--resume <id>]                         # 恢复会话/线程 ID
  [--timeout <Ns|Nm|Nh>]                  # 超时后自动 kill
  [--warn-before <Ns|Nm|Nh>]              # supervisor_warning 提前量
                                          # 默认 5m，0ms 表示禁用
  [--file <path>] ...                     # 支持 glob，可重复；注入文件内容
  [--jsonl <path>] ...                    # Trellis 清单文件，可重复
  [--by <agent>]                          # spawn 事件作者
                                          # 默认：TRELLIS_CHANNEL_AS 环境变量或 'main'
  [--inbox-policy explicitOnly|broadcastAndExplicit]
                                          # 默认 explicitOnly
  [--idle-timeout <Ns|Nm|Nh>]             # OOM 防护的空闲 TTL
                                          # 默认 5m，0 表示禁用
  [--max-live-workers <n>]                # 启动时的活跃 worker 数量预算
                                          # 默认 6，0 表示禁用
```

行为：
- Provider 按适配器注册表进行校验（`packages/cli/src/commands/channel/adapters/`）；当前：`claude`、`codex`。
- Worker 在收到第一条 `send --to <worker>` 之前保持收件箱空闲状态。
- 记录一条 `spawned` 事件，包含 `pid`、`provider`、`agent`、`files`、`manifests`。
- OOM 防护优先级：CLI 标志 → 环境变量（`TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT`、`TRELLIS_CHANNEL_MAX_LIVE_WORKERS`）→ `.trellis/config.yaml#channel.worker_guard` → 内置默认值。

### `run [name]`

```bash
trellis channel run [name?]
  [--agent <name>]
  [--provider claude|codex]
  [--as <worker-name>]
  [--cwd <path>]
  [--model <id>]
  [--file <path>] ...                     # 可重复，支持 glob
  [--jsonl <path>] ...                    # 可重复
  [--message <text> | --message-file <path> | --stdin]
  [--timeout <Ns|Nm|Nh>]                  # 默认 5m
```

行为：
- 一次性执行（one-shot）。省略 `name` 时自动生成 `run-<hex>`。
- 创建临时频道（`createMode=run`），启动单个 worker，发送提示词，等待 `done`，将最终的助手文本打印到 stdout，成功后删除频道。失败时保留频道以供检查，退出码为 1。

> `run` **没有** `--tag` 标志。完成检测通过 supervisor 发出的 `done` 事件实现。

### `kill <name>`

```bash
trellis channel kill <name>
  --as <agent>                            # 必填 — worker 智能体名称
  [--scope project|global]
  [--force]                               # 立即 SIGKILL
```

行为：
- 默认路径：SIGTERM → 8 秒宽限期 → SIGKILL 升级；CLI 在需要 SIGKILL 时会写入 `killed` 事件，确保日志记录保持真实。
- 清理 `pid`、`worker-pid`、`config`、`spawnlock` 附属文件；保留 `log`、`session-id`、`thread-id` 用于取证 / 恢复。

### `rm <name>`

```bash
trellis channel rm <name>
  [--scope project|global]
```

行为：
- 终止所有活跃 worker，然后删除整个频道目录。
- 打印 `Removed channel '<name>'`。

### `prune`

```bash
trellis channel prune
  [--scope project|global]                # 省略：扫描所有项目
  [--all | --empty | --idle <Ns|Nm|Nh|Nd> | --ephemeral]   # 互斥选项
  [--yes]                                 # 实际执行删除（默认：干运行）
  [--dry-run]                             # 默认 true；与默认值重复
  [--keep <names,csv>]                    # 排除列表
```

行为：
- 过滤标志互斥 — 否则报错。
- 默认为干运行（dry-run）；`--yes` 切换为实际删除。
- 不指定 `--scope` 时，扫描**所有**项目桶（有意为之，用于仓库级清理）；指定 `--scope project|global` 时仅限该桶。
- 有活跃 worker 的频道无论过滤条件如何始终跳过。
- 输出：逐条候选行 `name  last-ts  (reason)` 加上最终汇总。

---

## Forum 频道

### `post <name> <action>`

```bash
trellis channel post <name> <action>
  --as <agent>                            # 必填
  [--scope project|global]
  [--thread <key>]                        # 除 action=opened 外必填
  [--title <text>]
  [--text <text> | --stdin | --text-file <path>]
  [--description <text>]                  # 稳定的线程描述
  [--status <status>]
  [--labels a,b]                          # 替换（REPLACE）线程标签
  [--assignees a,b]                       # 替换（REPLACE）指派人
  [--summary <text>]
  [--context-file <abs-path>] ...
  [--context-raw  <text>]      ...
  [--linked-context-file <abs-path>]      # [已弃用的别名]
  [--linked-context-raw  <text>]          # [已弃用的别名]
```

行为：
- `<action>` 在 CLI 层面是自由格式；常用值包括 `opened`、`comment`、`status`、`labels`、`assignees`、`summary`、`processed`。
- `action=rename` 会被拒绝 — 请改用 `thread rename`。
- `--labels` / `--assignees` 是替换语义，非追加。
- 输出：追加的事件 JSON 到 stdout。

### `forum <name>`

```bash
trellis channel forum <name>
  [--scope project|global]
  [--status <status>]
  [--raw]
```

行为：
- 列出线程（简化状态）。`--status` 按当前线程状态过滤。`--raw` 每条线程打印一行 JSON。

### `thread <name> <thread>` / `thread rename`

```bash
trellis channel thread <name> <thread-key>
  [--scope project|global]
  [--raw]

trellis channel thread rename <name> <old-thread> <new-thread>
  --as <agent>                            # 必填
  [--scope project|global]
```

行为：
- `thread <name> <key>` 显示单条线程的时间线：头部 `<thread> [<status>] <title>`，然后是 description / labels / assignees / summary / timeline 行。`--raw` 切换为原始事件。
- `thread rename` 是唯一的变更操作；`post --action rename` 会被拒绝。

---

## 上下文 / 标题（Context / Title）

### `context add` / `context delete` / `context list`

```bash
trellis channel context add <name>
  [--as <agent>]                          # 默认：main
  [--scope project|global]
  [--thread <key>]                        # 线程级而非频道级
  [--file <abs-path>] ...                 # 可重复
  [--raw <text>]      ...                 # 可重复
                                          # --file 与 --raw 至少指定其一

trellis channel context delete <name>
  [--as <agent>]                          # 默认：main
  [--scope project|global]
  [--thread <key>]
  [--file <abs-path>] ...
  [--raw <text>]      ...

trellis channel context list <name>
  [--scope project|global]
  [--thread <key>]
  [--raw]                                 # 每行一条 JSON 条目
```

行为：
- `add` / `delete` 追加一条 `context` 事件并打印事件 JSON。
- `list` 投影当前上下文条目；美化输出为 `file <path>` / `raw <截断文本>` 行，为空时显示 `(no context)`。

### `title set <name>` / `title clear <name>`

```bash
trellis channel title set <name>
  --title <text>                          # 必填
  [--as <agent>]                          # 默认：main
  [--scope project|global]

trellis channel title clear <name>
  [--as <agent>]                          # 默认：main
  [--scope project|global]
```

行为：
- 追加一条 `title` 事件，将稳定的显示标题投影到频道上。输出：事件 JSON。

---

## 隐藏 / 内部命令

| 命令 | 用途 |
|---|---|
| `channel __supervisor <channel> <worker> <config>` | 由 `spawn` 调用的 fork 入口点。请勿直接调用。 |
| `channel __parse-trace <adapter> <file>` | 开发辅助工具 — 将记录的 stream-json / wire trace 通过匹配的适配器重放，并打印生成的频道事件。适配器按 provider 注册表进行校验。 |

---

## 事件模型（Event Model）

`CHANNEL_EVENT_KINDS`（由 `parseChannelKind` 强制校验的白名单）：

`create`、`join`、`leave`、`message`、`thread`、`context`、`channel`、`spawned`、`killed`、`respawned`、`progress`、`done`、`error`、`waiting`、`awake`、`undeliverable`、`interrupt_requested`、`turn_started`、`turn_finished`、`interrupted`、`supervisor_warning`。

`MEANINGFUL_EVENT_KINDS`（`wait` / `messages` 未显式指定 `--kind` 时使用的默认可见子集）：

`create`、`join`、`leave`、`message`、`thread`、`context`、`channel`、`spawned`、`killed`、`respawned`、`done`、`error`。

非有意义事件类型（non-meaningful kinds，如 `progress`、`waiting`、`awake`、`supervisor_warning`、`turn_*` / `interrupt*` 系列）仍会在存储中流转；通过 `--kind` 或 `--include-progress` 选择加入。

Forum 频道采用事件溯源（event-sourced）模式；请使用 CLI 的 reducer（`forum`、`thread`、`context list`）进行状态投影。

---

## 输出约定（Output Conventions）

- **变更操作**（mutation：`send`、`interrupt`、`post`、`context add/delete`、`title set/clear`、`thread rename`）将追加的事件以单行 JSON 打印到 **stdout**。
- **流式读取**（`wait`、`messages --follow`）每行打印一个 JSON 事件到 stdout。
- **美化读取**（`list`、`messages`、`forum`、`thread`、`context list`）打印带颜色、对齐的表格 / 时间线。
- **`run`** 仅将最终的助手文本打印到 stdout（以便调用方管道连接）；诊断信息发送到 stderr。
- **错误**通过 `chalk.red("Error:")` 输出到 stderr 并以 `exit 1` 退出。
- **`wait` 超时**特别以 **124** 退出。