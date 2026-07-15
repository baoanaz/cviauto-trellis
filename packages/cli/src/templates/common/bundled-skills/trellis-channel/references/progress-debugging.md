# 进度与调试（Progress And Debugging）

格式化输出（pretty output）面向运维人员。原始输出（raw output）是审计日志。子命令（`forum`、`thread`、`messages`、`context`）是审计的**接口**——在手动 grep `events.jsonl` 之前，请优先使用它们。

## Pretty 输出 vs `--raw`

`cviauto channel messages <channel>` 渲染紧凑、人类可读的视图：时间戳、身份标识、kind 和简短正文。它面向扫描通道的运维人员，而非诊断用途。

Pretty 输出会且将会截断以下内容：

- 较长的 progress 增量（`text_delta`、部分工具参数）
- 工具名称和命令行
- 多行状态字段和结构化的 `detail` 数据块
- 超出列宽限制的 forum 线程标题

当某些内容看起来"不对劲"——worker 看起来卡住了、progress 行在单词中间截断、action 字段显示 `...`——请切换到 `--raw`。Raw 模式每行输出一条 JSON 事件，与 `events.jsonl` 中的内容完全一致，因此不会有任何内容被丢弃。

```bash
# Pretty（运维视图）
cviauto channel messages <channel> --kind done --last 10
cviauto channel messages <channel> --kind error --last 10

# Raw（诊断视图）— 每行一条 JSON
cviauto channel messages <channel> --raw --kind progress --last 20
cviauto channel messages <channel> --raw --last 50
```

经验法则：永远不要根据截断的 progress 行来诊断 worker。

### 重建流式文本

要重建模型在某个 turn 中实际流式输出的内容，将 progress 事件中的 `detail.text_delta` 拼接起来：

```bash
cviauto channel messages <channel> --raw --kind progress --last 80 \
  | python3 -c 'import json,sys; [print((json.loads(l).get("detail") or {}).get("text_delta",""), end="") for l in sys.stdin if l.strip()]'
```

## 停滞 Worker 诊断

症状：`cviauto channel list` 显示 worker 正在运行，但 `messages` 中没有新事件出现，且 `wait` 持续超时。

排查顺序：

1. **定位通道文件。** 如果不确定通道属于哪个 bucket，使用 `list --all --all-projects`。

   ```bash
   cviauto channel list --all --all-projects
   CHAN=~/.cviauto/channels/<bucket>/<channel>
   ```

2. **确认 supervisor 和 worker 的 PID 仍在运行。**

   ```bash
   cat "$CHAN/<worker>.pid"            # supervisor PID
   cat "$CHAN/<worker>.worker-pid"     # 实际 CLI 子进程 PID
   ps -p "$(cat "$CHAN/<worker>.pid")"
   ps -p "$(cat "$CHAN/<worker>.worker-pid")"
   ```

   如果 supervisor PID 已不存在但通道仍列出该 worker，说明存在幽灵条目——使用
   `cviauto channel kill <name> --as <worker> --force` 清理。

3. **跟踪 worker 日志。** 这是查看 provider / MCP / 工具启动输出（这些输出永远不会出现在通道上）的权威位置。

   ```bash
   tail -f "$CHAN/<worker>.log"
   ```

4. **检查最后几条 raw 事件。** 一个发出了 `progress` 但没有 `message`/`done` 的 worker 通常处于流式输出中或被工具调用阻塞：

   ```bash
   cviauto channel messages <channel> --raw --last 50
   ```

常见的"存活但静默"原因：

- Provider 在首个 token 之前的冷启动（耗时较长，但最终会推进）。
- 启动期间有阻塞的 MCP 服务器——可在 worker 日志中看到。
- Worker 正在等待工具调用结果，但其子进程已挂起。
- 提示词过大 / 模型被限速；检查 worker 日志中的 provider 侧错误。

## Progress 事件解读

`progress` 事件表示进行中的工作。其形态随 `action` 字段变化，但核心字段始终在 `detail` 下：

- `detail.text_delta` — 增量模型输出（跨事件拼接可重建流式回复）。
- `detail.tool_name`、`detail.tool_input` — 即将运行或正在运行的工具调用。
- `detail.status` — 长耗时操作使用的简短字符串（`starting`、`running`、`flushing`、`done`）。
- `detail.action` — 语义标签（例如线程心跳使用 `status`）。

Progress 事件**在设计上就是嘈杂的**。`wait` 默认忽略它们，除非传入 `--include-progress`。当确实需要查看它们时，推荐使用：

```bash
cviauto channel messages <channel> --raw --kind progress --last 80
```

一个以稳定节奏持续发出 progress 但从未以 `done`/`error`/`message` 结束的流，是工具调用挂起的典型形态——检查 worker 日志中的子进程。

## Wait 语义（快速参考）

`channel wait` 从 EOF 开始监视 `events.jsonl`，并在以下事件上醒来：

- `message`
- `done`
- `error`
- `killed`
- `progress`（仅当带 `--include-progress` 时）

实用过滤器：

```bash
cviauto channel wait T --as main --from check --kind done --timeout 15m
cviauto channel wait T --as main --from check,check-cx --kind done --all --timeout 15m
cviauto channel wait T --as worker --tag interrupt --timeout 1h
cviauto channel wait T --as main --thread release-note --action status --timeout 10m
```

退出码：`0` 匹配成功，`124` 超时，`1`/`2` 错误。在 `wait --all` 超时时，stderr 会列出仍然缺失的 worker。

## 审计 `events.jsonl` — 使用子命令，而非 `grep`

每个通道的完整历史记录持久化在 `$CHAN/events.jsonl` 中。调试时直接对该文件使用 `tail` / `grep` / `jq` 是很有诱惑力的。不要养成这个习惯，并且**绝对不要**对 forum 通道这样做。

优先使用子命令的原因：

- `messages` 已经可以带过滤器（`--kind`、`--from`、`--last`、`--tag`、`--thread`、`--action`）重放文件，并提供 `--raw` 获取精确的 JSON。任何你想用一行命令完成的事情，`messages` 已经做到了。
- `wait` 以 EOF 语义消费同一个文件——用 `tail -f | jq` 重新实现会在线程压力下丢失事件，并在轮转时乱序。
- `context` 可以物化 worker 的收件箱视图，包括游标状态。手工编写的过滤器不会遵循 `<worker>.inbox-cursor`。

### Forum 通道：永远不要直接解析 `events.jsonl`

Forum 通道将多个逻辑线程多路复用到一个 `events.jsonl` 上。每个事件都携带 `thread`、`action` 和标签字段，forum 子命令知道如何将它们整合在一起。手工解析该文件会：

- 将线程混在一起，使某个线程看起来不连贯。
- 遗漏线程生命周期事件（open / status / close），这些事件会改变后续事件的解读方式。
- 忽略 worker 收件箱游标，因此你会"看到" worker 已经消费过的事件，并误以为它们仍是待处理的。

请改用 forum 感知的视图：

```bash
# 列出 forum 通道内的逻辑线程
cviauto channel forum list <channel>

# 端到端检查一个线程
cviauto channel thread show <channel> <thread>

# 重放某线程的消息（支持 --raw、--kind、--last）
cviauto channel messages <channel> --thread <thread> --raw --last 100

# 某个特定 worker 仍未处理的内容
cviauto channel context <channel> --as <worker>
```

直接读取 `events.jsonl` 仅保留用于 CLI 本身可疑的场景——例如确认某个事件确实已持久化，或在调试 supervisor 时对比 `<worker>.inbox-cursor`。

## 常见故障

| 症状 | 原因 | 修复方法 |
|---|---|---|
| `cviauto: command not found` | CLI 未全局安装 | `npm install -g @mindfoldhq/cviauto` |
| `wait` 立即退出 | 错误的过滤器或身份冲突 | 使用不同的 `--as`，检查 raw 消息 |
| zsh 对消息文本报错 | shell 解释了标点符号 | 使用 `--stdin` 或 `--text-file` |
| progress 行被截断 | pretty 输出截断 | 使用 `messages --raw --kind progress` |
| worker 永远不会发言 | provider 启动 / 提示词 / MCP 延迟 | 检查 `<worker>.log`、`ps`、raw 事件 |
| 在另一个 cwd 中找不到通道 | 项目 bucket 不匹配 | `cd` 到项目目录，使用 `--scope global`，或 `list --all-projects` |
| 列表中显示幽灵 worker | supervisor 已退出但未清理 | `cviauto channel kill <name> --as <worker> --force` |
| forum 线程看起来混乱 | 直接解析了 `events.jsonl` | 使用 `forum`、`thread`、`messages --thread` |

## 存储布局

```text
~/.cviauto/channels/
└── <bucket>/
    └── <channel-name>/
        ├── events.jsonl
        ├── <channel>.lock
        ├── <worker>.log
        ├── <worker>.pid
        ├── <worker>.worker-pid
        ├── <worker>.config
        ├── <worker>.session-id
        ├── <worker>.thread-id
        ├── <worker>.inbox-cursor
        └── <worker>.spawnlock
```

Agent 通常使用 CLI 而非直接读取文件。直接读取文件仅用于 CLI 视图不足以满足需求的调试场景——即便如此，也绝对不要直接读取 forum 通道的 `events.jsonl`。