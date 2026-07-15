# Workers 与 Agent 卡片（Agent Cards）

当需要让一个对等 agent 独立执行并通过通道事件日志（channel event log）回传结果时，使用 worker。一个 worker 是注册到通道上的子进程（claude 或 codex）；supervisor 将收件箱消息转发给它，并将它的输出转换回通道事件。

## Spawn（启动）

```bash
cviauto channel create impl-task --by dispatcher --cwd /path/to/repo
cviauto channel spawn impl-task --provider codex --as codex-impl --timeout 30m

echo "Implement the schema for table X per .cviauto/.../prd.md" \
  | cviauto channel send impl-task --as dispatcher --to codex-impl --stdin

cviauto channel wait impl-task --as dispatcher --from codex-impl --kind done --timeout 30m
```

`spawn` 会 fork 一个 `channel __supervisor` worker，它会发出 `spawned` 事件、流式输出 `progress`，并最终以 `done`、`error` 或 `killed` 结束。worker 在收到 `send --to <worker>`（或设置了 `--inbox-policy broadcastAndExplicit` 时的广播）之前会保持收件箱空闲状态。

`spawn` 的关键参数：

- `--agent <name>` — 加载 `.cviauto/agents/<name>.md`（provider/model/as 等系统提示默认值）。
- `--provider <claude|codex>` — 覆盖 agent 卡片中的设置；会根据适配器注册表进行校验。
- `--as <name>` — 通道中 worker 的句柄；默认与 agent 名称相同。
- `--cwd <path>` — worker 的工作目录（同时也是 `--file`/`--jsonl` 的 jail 根目录）。
- `--model <id>` — 模型覆盖。
- `--resume <id>` — 恢复已有的 claude 会话 / codex 线程。
- `--timeout <duration>` — 超时自动 kill，如 `30s` / `2m` / `1h`。
- `--warn-before <duration>` — supervisor_warning 提前通知时间（默认 `5m`；`0ms` 禁用）。
- `--file <path>`（可重复，支持 glob）— 将文件内容注入系统提示。
- `--jsonl <path>`（可重复）— Cviauto jsonl 清单（每行 `{file, reason}`）。
- `--by <agent>` — `spawned` 事件的作者（默认 `$TRELLIS_CHANNEL_AS` 或 `main`）。
- `--inbox-policy <explicitOnly|broadcastAndExplicit>` — 默认 `explicitOnly`。
- `--idle-timeout <duration>` — OOM guard 空闲 TTL（默认 `5m`；`0` 禁用）。
- `--max-live-workers <n>` — spawn 时的存活 worker 数量上限（默认 `6`；`0` 禁用）。

成功事件 `spawned` 会记录 `pid`、`provider`、`agent`、注入的 `files` 以及解析后的 `manifests`，以便后续观察者审计上下文。

## Agent 卡片（Agent Cards）

`--agent <name>` 解析到 `.cviauto/agents/<name>.md`。卡片名称必须匹配 `[A-Za-z0-9._-]+`。Cviauto 默认安装附带两张卡片：

- `.cviauto/agents/check.md` — 代码质量审查（code-quality reviewer）。
- `.cviauto/agents/implement.md` — 用于实现任务的编码 worker。

```yaml
---
name: check
description: Code quality check expert.
provider: claude
---
```

frontmatter 中的字段会填充 `spawn` 的默认值（provider、model、`as`）；markdown 正文会成为 worker 的系统提示（system-prompt）角色。卡片**不会**自动附加任务文件——上下文必须在每次 spawn 时显式注入（见下文）。

在启动命名 agent 之前，始终先检查项目中的卡片：

```bash
ls .cviauto/agents
sed -n '1,100p' .cviauto/agents/check.md
```

## 上下文注入（Context Injection）

两个参数可将内容注入 worker 的系统提示中的 `# CONTEXT FILES` 代码块，由 `context-loader` 负责组装：

- `--file <path>` — 可重复，支持 glob（`*`、`**`）。每个匹配到的文件都会被读取并拼接。
- `--jsonl <path>` — 可重复的 Cviauto 清单，每行为 `{"file":"<path>","reason":"<why>"}`。reason 会作为头部注释保留在每个文件内容之前。

加载器强制执行的限制：

- 单文件 1 MB 硬上限（超出 → 报错）。
- 单文件 200 KB 时向 stderr 输出警告。
- 组装上下文总量 500 KB 时向 stderr 输出警告。
- 路径穿越 jail：所有解析后的路径必须位于 `--cwd` 之下。

针对任务目录启动 check agent 的示例：

```bash
TASK=.cviauto/tasks/05-13-example
cviauto channel spawn cr-example --agent check --provider codex --as check-cx \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --jsonl "$TASK/check.jsonl" \
  --cwd "$PWD" --timeout 30m
```

`spawned` 事件会同时记录字面的 `files` 数组以及从 `--jsonl` 展开的所有 `manifests`，因此审计追踪会完整捕获 worker 实际看到的内容。

## 命名与路由（Names And Routing）

`--as` 有两种含义：

- `send` / `wait` / `interrupt`：发言人身份（生成事件的作者）。
- `spawn`：worker 句柄，其他 agent 通过 `--to` 来寻址。

当多个 worker 或 provider 在同一个通道中参与时，使用显式命名：

```bash
cviauto channel spawn cr-feature --agent check --as check-claude
cviauto channel spawn cr-feature --agent check --provider codex --as check-cx

cviauto channel wait cr-feature --as main \
  --from check-claude,check-cx --kind done --all --timeout 15m
```

`--all` 需要 `--from`，会阻塞直到列表中所有 worker 都产生了匹配的事件；超时则退出码为 **124** 并向 stderr 输出 `timeout: still waiting on ...`。

## 软中断 — `interrupt`

`channel interrupt` 是协作式重定向：它会追加一个 `interrupt` 事件（reason 为 `"user"`），并在适配器支持的情况下，发出 provider 级别的 turn interrupt，携带替代指令。当需要 worker 丢弃当前 turn 并立即根据新输入采取行动，同时不丢失其会话时，使用此命令。

```bash
echo "Stop refactoring the parser — switch to fixing the failing test in src/foo.ts" \
  | cviauto channel interrupt impl-task --as dispatcher --to codex-impl --stdin
```

参数：

- `--as <agent>` **（必需）** — 调用者身份。
- `--to <agent>` **（必需）** — 目标 worker。
- `--scope <project|global>` — 通道作用域。
- `--stdin` / `--text-file <path>` / `[text]` — 替代指令正文。

追加的事件具有 `kind: "interrupt"` — 下游的 `wait` / `messages` 过滤器可以通过 `--kind interrupt` 订阅以响应重定向（例如记录重新路由，或在协调者的纠正之后阻塞其他 worker）。

对于应等待 worker 下一个 turn 的低优先级提示，改用带标签的普通消息：

```bash
echo "Check this when you reach the next turn." \
  | cviauto channel send impl-task --as dispatcher --to codex-impl \
      --stdin --tag question
```

## 硬中断 — `kill` + `--resume`

当 worker 需要**立即**停止时使用 `kill`（例如失控循环、已发出的错误指令，或适配器不响应 `interrupt`）。supervisor 会按 SIGTERM → 8 秒宽限期 → SIGKILL 逐步升级；CLI 在需要 SIGKILL 时会写入 `killed` 事件，确保事件日志如实记录。

```bash
cviauto channel kill impl-task --as codex-impl
cviauto channel spawn impl-task --as codex-impl --provider codex \
  --resume "$(cat ~/.cviauto/channels/<bucket>/impl-task/worker.session-id)"

echo "STOP — new instructions: ..." \
  | cviauto channel send impl-task --as dispatcher --to codex-impl --stdin
```

`kill` 参数：

- `--as <agent>` **（必需）** — 指定 worker 名称（位置参数 `<name>` 是通道名）。
- `--scope <project|global>`。
- `--force` — 立即 SIGKILL（同时也会 kill 内部 worker 进程）。

副作用：清理 `pid`、`worker-pid`、`config`、`spawnlock` 附属文件；保留 `log`、`session-id`、`thread-id` 用于取证和恢复。

当 `interrupt` 无法收敛时，kill + `--resume` 是保证重定向的路径。

## Worker OOM Guard（内存溢出防护）

OOM guard 防止孤儿/空闲 worker 不断累积并耗尽宿主机资源。它在每次 `spawn` 时运行，对每个项目 bucket 执行两项策略：

- **空闲 TTL（Idle TTL）** — 清理最后活动时间超过配置阈值（默认 `5m`；`0` 禁用）的 worker。
- **存活 worker 数量上限（Live-worker budget）** — 如果同一项目 bucket 中已有超过 N 个 worker 存活，则拒绝新的 spawn（默认 `6`；`0` 禁用）。

优先级（从高到低）：

1. CLI 参数：`spawn` 上的 `--idle-timeout`、`--max-live-workers`。
2. 环境变量：`TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT`、`TRELLIS_CHANNEL_MAX_LIVE_WORKERS`。
3. `.cviauto/config.yaml` 中的 `channel.worker_guard`。
4. 内置默认值（`5m`、`6`）。

清理通知会在 spawn 时写入 stderr，以便运维人员查看哪些空闲 worker 被清理，以及新 spawn 被拒绝的原因。guard 对临时 worker / `channel run` worker 没有特殊对待——它们同样受空闲 TTL 和数量上限约束。

要审计当前状态，可通过 `channel list`（`WORKERS` 列）列出 worker，并检查 `~/.cviauto/channels/<bucket>/<channel>/` 下的 `pid` / `worker-pid` 附属文件。

## Worker 收件箱 API（Worker Inbox APIs）

收件箱是 worker 在通道中醒来时面对的界面。路由由两个旋钮控制：

- **收件箱策略（Inbox policy）**（`spawn --inbox-policy`）：
  - `explicitOnly`（默认）— worker 仅在 `send --to <worker>` 或 `interrupt --to <worker>` 时醒来。
  - `broadcastAndExplicit` — 同时也会在广播（不带 `--to` 的 `send`）时醒来。
- **投递模式（Delivery mode）**（`send --delivery-mode`）：
  - `appendOnly` — 无论 worker 状态如何，始终追加事件。
  - `requireKnownWorker` — 如果 `--to` 指定的 worker 从未被 spawn 过，则失败。
  - `requireRunningWorker` — 如果指定 worker 当前不在运行，则失败。

更严格的投递模式可防止调用方期望对等 worker 正在运行但消息被静默丢弃的情况。

收件箱相关子命令：

- `send <channel> [text]` — 追加一条 `message` 事件。
  - `--as <agent>` **（必需）** — 作者。
  - `--to <agents>` — CSV 格式；单个 → 字符串，多个 → 数组；省略则广播。
  - `--stdin` / `--text-file <path>` / `[text]` — 消息正文来源。
  - `--delivery-mode <appendOnly|requireKnownWorker|requireRunningWorker>`。
- `interrupt <channel> [text]` — 软中断重定向（见上文）。
- `wait <channel>` — 阻塞直到匹配的事件到达。
  - `--as <agent>` **（必需）** — 用于过滤器上下文的 `self`。
  - `--from <agents>` — CSV 格式的作者列表。
  - `--kind <kind[,kind...]>` — CSV（OR 语义）；支持 `interrupt`、`done`、`progress` 等。
  - `--to <target>` — 默认为自己的 agent（广播 + 显式发给自己的）。
  - `--include-progress` — 同时也在 progress 事件上醒来。
  - `--all` — 要求 `--from` 中的每个 agent 都匹配（超时 → 退出码 **124**）。
  - `--timeout <duration>` — `30s` / `2m` / `1h` / `1000ms`。
- `messages <channel>` — 查看 / 过滤 / 跟踪事件流。
  - `--follow` 持续跟踪，`--kind` / `--from` / `--to` 过滤，`--raw` 输出每行 JSON，`--no-progress` 隐藏 progress 噪声。

典型的 dispatcher 循环：

```bash
# 1. 唤醒 worker。
echo "Run the failing test and report." \
  | cviauto channel send impl-task --as dispatcher --to codex-impl --stdin \
      --delivery-mode requireRunningWorker

# 2. 阻塞直到它完成。
cviauto channel wait impl-task --as dispatcher \
  --from codex-impl --kind done,error --timeout 30m

# 3. 读取最终结果。
cviauto channel messages impl-task --from codex-impl --last 1 --raw
```

所有产生事件的子命令（`send`、`interrupt`、`post`、`context add` / `delete`、`title set` / `clear`、`thread rename`）都会将追加的事件以单行 JSON 输出到 stdout，使收件箱层便于脚本化操作。