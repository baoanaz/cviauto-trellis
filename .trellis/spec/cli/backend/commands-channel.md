# `trellis channel` — 多智能体协作运行时（代码规范）

`packages/cli/src/commands/channel/` 的可执行契约。在编辑该路径下的任何文件之前，请阅读本文。触发器满足强制性代码规范深度要求（新增命令接口 + 跨层事件契约 + 通过环境变量注入和存储布局的基础设施集成）。

---

## 1. 范围 / 触发器

| 触发器 | 为什么需要代码规范深度 |
|---------|------------------------------------|
| 新增顶层 `channel` 命令树（14 个子命令） | 新增 CLI 接口 — 签名必须锁定 |
| 事件流协议（events.jsonl，固定 kind 分类） | 跨组件契约：worker、supervisor、CLI 都解析相同的负载 |
| 每个 worker 的子进程监督（claude / codex） | 基础设施集成：进程生命周期 + 信号处理 |
| 磁盘布局迁移（遗留平面结构 → 项目桶） | 基础设施：不可逆的文件系统移动 + 跨工具路径约定（与 claude code 保持一致） |
| Worker 提供者插件（`WorkerAdapter`） | 扩展契约：未来的提供者依赖于形状稳定性 |
| 环境变量注入（`TRELLIS_CHANNEL_ROOT/PROJECT/AS`） | 跨进程配置 |

### 当前 Core / CLI 边界

`@baoanaz/cviauto-core/channel` 拥有可复用的 channel 领域行为：
事件模式（schema）、归约器（reducer）、持久化变更 API、幂等性（idempotency）、
worker 注册表、收件箱策略（inbox policy）以及公共 SDK 契约。

`packages/cli/src/commands/channel/store/*` 仍然存在且为当前代码，不是死代码。某些文件是对 core 的薄层重导出 / 兼容模块
（`schema.ts`、`filter.ts`、`thread-state.ts`）；其他文件在 supervisor 迁移期间仍然是 CLI 本地
运行时原语，用于 supervisor / spawn / kill / wait 路径
（`events.ts`、`paths.ts`、`lock.ts`、`watch.ts`）。在调用方迁移到 core API 之前不要删除这些包装器。新的可复用行为属于 core；CLI 本地文件应仅处理终端 UX、进程
监督、pid/cursor 附属文件和迁移粘合代码。

---

## 2. 签名

### CLI 命令（`commands/channel/index.ts`）

```
trellis channel create <name> [opts]
  --scope <scope>        : project | global（默认 project）
  --type <type>          : chat | forum（默认 chat）
  --task <path>          : 关联的 Trellis 任务目录（string）
  --project <slug>       : 项目元数据标签（string；不是桶键）
  --labels <csv>         : 逗号分隔的标签
  --description <text>   : 稳定的 channel 描述
  --context-file <abs-path> : 绝对上下文文件（可重复）
  --context-raw <text>      : 原始上下文文本（可重复）
  --cwd <path>           : 在创建事件中记录的 cwd（默认 process.cwd()）
  --by <agent>           : 创建者身份（默认 "main"）
  --force                : 如果 channel 存在，kill worker + rmrf + 重新创建
  --ephemeral            : 标记为从列表中隐藏 + prune --ephemeral
  → stdout: "Created channel '<name>' at <abs-path>"
  → stderr（如果 --ephemeral）: 关于 list --all / prune --ephemeral 的提示
  → exit 0 成功；如果 --force=false 且 channel 存在则抛出异常

trellis channel spawn <name> [opts]
  --scope <scope>        : project | global
  --agent <name>         : 加载 .trellis/agents/<name>.md（设置 provider / as / 系统提示）
  --provider <p>         : claude | codex（覆盖 agent）
  --as <worker-name>     : worker 标识符（默认 = agent name）
  --cwd <path>           : worker cwd（默认 process.cwd()）
  --model <id>           : 模型覆盖
  --resume <id>          : 恢复现有会话/线程 id
  --timeout <duration>   : 指定时长后自动 kill（如 "30m"、"1h"、"7200s"）
                           — 无默认值；需主动选择硬截止
  --warn-before <duration>: 在超时前发出 `supervisor_warning` 事件
                           （默认 "5m"；"0ms" 禁用警告）
  --file <path>          : 上下文文件（可重复，支持 glob）
  --jsonl <path>         : {file, reason} 条目清单（可重复）
  --by <agent>           : 记录在 `spawned` 事件上的调用者身份
  --inbox-policy <policy>: explicitOnly | broadcastAndExplicit（默认 explicitOnly）
                           — 记录在 `spawned` 上的持久化 worker 收件箱投递策略
  --idle-timeout <duration>: 此 worker 的 OOM-guard 空闲清理 TTL
                           （默认 5m，来自 .trellis/config.yaml；"0" 禁用空闲清理；
                           当连续空闲超出 TTL 时 supervisor 以 `killed{reason:"idle-timeout"}`
                           自行终止 — 从不在回合中途）
  --max-live-workers <n> : 此项目/范围的 spawn 时活跃 worker 预算
                           （默认 6，来自 .trellis/config.yaml；"0" 禁用预算检查；
                           先清理已过期的空闲 worker，
                           如果仍然超出则 `spawn` 拒绝并给出可操作的错误）
  → stdout（一行 JSON）：{"pid": number, "log": string, "worker": string}
  → 如果 worker 名称已被占用、agent 未找到、provider 缺失、channel 未找到，
    或在清理已过期空闲 worker 后活跃 worker 预算耗尽，则抛出异常

trellis channel send <name> [text] [opts]
  --as <agent>           : 发送者身份（必需）
  --scope <scope>        : project | global
  --to <agents>          : 目标 worker 名称的 CSV 列表（默认：广播）
  --stdin                : 从 stdin 读取正文
  --text-file <path>     : 从文件读取正文
  --delivery-mode <mode> : appendOnly | requireKnownWorker | requireRunningWorker
  [text] positional      : 内联正文
  → stdout: 追加的事件，JSON 格式
  → 如果 stdin/textFile/[text] 均未提供则抛出异常

trellis channel interrupt <name> [text] [opts]
  --as <agent>           : 请求者身份（必需）
  --to <agent>           : 目标 worker 名称（必需）
  --scope <scope>        : project | global
  --stdin                : 从 stdin 读取替换指令
  --text-file <path>     : 从文件读取替换指令
  [text] positional      : 内联替换指令
  → stdout: 追加的 `interrupt_requested` 事件，JSON 格式
  → supervisor 追加 `interrupted` 并将替换指令发送给 worker

trellis channel wait <name> [opts]
  --as <agent>           : 调用者身份（必需，也是 --to 的默认值）
  --scope <scope>        : project | global
  --timeout <duration>   : 最大等待时间（无超时 = 无限等待）
  --from <agents>        : CSV — 仅唤醒来自这些作者的事件
  --kind <kind[,kind...]> : 仅唤醒这些事件 kind（CSV，OR 语义）
  --thread <key>         : 仅唤醒此 thread key 的事件
  --action <action>      : 仅唤醒此 thread action 的事件
  --to <target>          : 仅唤醒发送给此 target 的事件（默认 = --as）
  --include-progress     : 也唤醒 progress 事件
  --all                  : 要求 --from 中的每个 agent 都发出匹配（默认：首个匹配即胜）
  → stdout: 匹配的事件 JSON（每行一个）
  → exit 0 已满足；exit 124 超时
  → --all 超时时: stderr "timeout: still waiting on <csv>"

trellis channel messages <name> [opts]
  --scope <scope>        : project | global
  --raw                  : 每行一个 JSON 事件
  --follow               : 在历史记录之后 tail 新事件（Ctrl-C 停止）
  --last <N>             : 仅显示最近 N 个匹配
  --since <seq>          : 仅显示 seq > N 的事件
  --kind <kind>          : 按 kind 过滤
  --from <agents>        : 按作者过滤（CSV）
  --to <target>          : 按路由目标过滤
  --thread <key>         : 按 thread key 过滤
  --action <action>      : 按 thread action 过滤
  --no-progress          : 隐藏 progress 事件
  → stdout: 格式化（默认）或原始 JSON 事件流；forum channel 默认显示线程列表视图，除非设置了事件过滤器

trellis channel list [opts]
  --scope <scope>        : project | global
  --json                 : 输出 JSON 数组而不是表格
  --project <slug>       : 按 `task` 字段子串过滤
  --all                  : 包含临时 channel（标记为 " *"）
  --all-projects         : 扫描每个项目桶（默认：仅当前工作目录的项目）
  → stdout: 表格或 JSON
  → footer（如果隐藏了临时 channel）: "(N ephemeral channels hidden — use --all to show)"

trellis channel kill <name> [opts]
  --as <agent>           : worker 名称（必需）
  --scope <scope>        : project | global
  --force                : 立即 SIGKILL（跳过优雅关闭）
  → exit 0 已发送；如果不存在该 worker 则非零

trellis channel rm <name> [opts]
  --scope <scope>        : project | global
  → kill 所有活跃 worker，rmrf channel 目录
  → exit 0 已移除；未找到则抛出异常

trellis channel title set <name> [opts]
  --scope <scope>        : project | global
  --as <agent>           : 作者身份（默认 "main"）
  --title <text>         : 显示标题；不改变 channel 地址
  → stdout: 追加的 `channel` title 事件，JSON 格式

trellis channel title clear <name> [opts]
  --scope <scope>        : project | global
  --as <agent>           : 作者身份（默认 "main"）
  → stdout: 追加的 `channel` title 清除事件，JSON 格式

trellis channel prune [opts]
  --scope <scope>        : project | global
  --all                  : 移除所有 channel（活跃 + --keep 的除外）
  --empty                : 移除仅包含创建事件的 channel
  --idle <duration>      : 移除最后事件早于指定时长的 channel
  --ephemeral            : 仅移除临时 channel
  --keep <csv>           : 白名单 channel 名称
  --yes                  : 实际删除（默认是 dry-run）
  --dry-run              : 显示将要移除的内容（默认行为）
  → 如果 --all/--empty/--idle/--ephemeral 指定了多个则抛出异常
  → stdout: 候选列表 + "(dry-run) would remove N" 或 "Removed N"

trellis channel run [name] [opts]
  （如未提供则自动生成名称 "run-<8hex>"，隐含 --ephemeral）
  --agent / --provider / --as / --cwd / --model / --file / --jsonl  : 同 spawn
  --message <text>       : 内联提示
  --message-file <path>  : 从文件读取提示
  --stdin                : 从 stdin 读取提示
  --timeout <duration>   : 等待 done 的最大时间（默认 5m）
  → 成功时: stdout = worker 最终消息正文，channel 自动删除，exit 0
  → 失败时（error/killed/timeout）: channel 保留，stderr "channel kept for inspection: <path>"，exit 1

trellis channel post <name> <action> [opts]
  --as <agent>           : 作者身份（必需）
  --scope <scope>        : project | global
  --thread <key>         : thread key（action=opened 时除外，否则必需）
  --title <text>         : 线程标题（opened）
  --text <text>          : 事件正文（comment/opened）
  --stdin                : 从 stdin 读取事件正文
  --text-file <path>     : 从文件读取事件正文
  --description <text>   : 稳定的线程描述
  --status <status>      : 线程状态
  --labels <csv>         : 替换线程标签
  --assignees <csv>      : 替换线程分配人
  --summary <text>       : 线程摘要
  --context-file <abs-path> : 绝对上下文文件（可重复）
  --context-raw <text>      : 原始上下文文本（可重复）
  → stdout: 追加的 `thread` 事件，JSON 格式
  → 除非 channel `type` 是 `forum`，否则抛出异常

trellis channel context add <name> [opts]
  --scope <scope>        : project | global
  --as <agent>           : 作者身份（默认 "main"）
  --thread <key>         : 变更线程级上下文而非 channel 级上下文
  --file <abs-path>      : 绝对上下文文件（可重复）
  --raw <text>           : 原始上下文文本（可重复）
  → stdout: 追加的 `context` 事件，JSON 格式

trellis channel context delete <name> [opts]
  --scope <scope>        : project | global
  --as <agent>           : 作者身份（默认 "main"）
  --thread <key>         : 变更线程级上下文而非 channel 级上下文
  --file <abs-path>      : 绝对上下文文件（可重复）
  --raw <text>           : 原始上下文文本（可重复）
  → stdout: 追加的 `context` 事件，JSON 格式

trellis channel context list <name> [opts]
  --scope <scope>        : project | global
  --thread <key>         : 显示线程级上下文而非 channel 级上下文
  --raw                  : 每行一个上下文条目 JSON
  → stdout: 投影后的当前上下文

trellis channel forum <name> [opts]
  --scope <scope>        : project | global
  --status <status>      : 按状态过滤归约后的线程列表
  --raw                  : 每行一个归约后的线程状态 JSON
  → stdout: 线程列表摘要

trellis channel thread <name> <thread> [opts]
  --scope <scope>        : project | global
  --raw                  : 每行一个原始 `thread` 事件
  → stdout: 一个线程时间线摘要

trellis channel thread rename <name> <old-thread> <new-thread> [opts]
  --as <agent>           : 作者身份（必需）
  --scope <scope>        : project | global
  → stdout: 追加的 `thread` rename 事件，JSON 格式

```

### 内部模块

```ts
// store/paths.ts (存储层签名)
channelRoot(): string                                       // TRELLIS_CHANNEL_ROOT ?? ~/.trellis/channels
projectKey(cwd: string): string                             // 清理: /[\\/_]/g→"-" 然后 /[^A-Za-z0-9.-]/g→"-"
currentProjectKey(): string                                 // TRELLIS_CHANNEL_PROJECT env ?? projectKey(process.cwd())
projectDir(project?: string): string                        // <root>/<project>
channelDir(name, project?: string): string                  // <root>/<project>/<name>
eventsPath(name, project?): string                          // <channelDir>/events.jsonl
lockPath(name, project?): string                            // <channelDir>/<name>.lock
workerFile(name, worker, suffix, project?): string          // <channelDir>/<worker>.<suffix>
workerLockPath(name, worker, project?): string              // <channelDir>/<worker>.spawnlock
migrateLegacyChannels(): void                               // 幂等；将平面结构移动 → _legacy/
ensureBucketMarker(project: string): void                   // touch <project>/.bucket
listProjects(): string[]                                    // 桶名称（有 .bucket 或为保留名称）
selectExistingChannelProject(name: string): string          // 未找到/模糊匹配时抛出异常
resolveChannelProjectForCreate(name, opts?): ChannelRef      // 将 --scope 映射到项目桶
resolveExistingChannelRef(name, opts?): ChannelRef           // 解析 --scope 并拒绝 global/project 模糊匹配

// store/events.ts
appendEvent(name, partial: Omit<ChannelEvent,'seq'|'ts'>, project?): Promise<ChannelEvent>
  // 在 withLock(lockPath(name)) 下原子执行。
  // 通过 `.seq` 附属文件和 JSONL 尾部验证/修复分配 seq。
  // 如果 partial.idempotencyKey 存在，在同一个 channel 锁内检查持久化的 JSONL，
  // 并返回相同的同种事件而不追加重复行。空键和跨 kind 键重用为错误。
  // 在正常追加路径上不得全量扫描 events.jsonl。
  // 返回带 ts (ISO) 和 seq (单调递增) 的事件。
readChannelEvents(name, project?): Promise<ChannelEvent[]>
readChannelMetadata(name, project?): Promise<ChannelMetadata>
reduceChannelMetadata(events): ChannelMetadata
  // Channel 元数据投影的唯一权威来源。
  // 重放 create metadata、legacy linkedContext、channel 级 context
  // add/delete 和 display title set/clear。Legacy type:"thread" /
  // type:"threads" 不会被升级为 "forum" — 它们投影为 "chat"。
isCreateEvent(ev): ev is CreateChannelEvent
isThreadEvent(ev): ev is ThreadChannelEvent
metadataFromCreateEvent(ev?): ChannelMetadata
  // 仅供内部遗留兼容性辅助函数使用。不得从
  // @baoanaz/cviauto-core/channel 导出，CLI 渲染器不得调用。

watchEvents(name, filter: WatchFilter, opts?: {signal?, fromStart?, sinceSeq?, project?}): AsyncGenerator<ChannelEvent>
  // 默认：从 EOF（实时 tail）。fromStart: 从字节 0。sinceSeq: 跳过 seq <= N。
  // 由 fs.watch + 200ms 轮询回退驱动。

// store/filter.ts
matchesEventFilter(ev, filter): boolean
  // kind/thread/action/from/to/progress 匹配的唯一权威来源。
  // 被历史 `messages` 读取和实时 `watchEvents` 共同使用。

// store/thread-state.ts
reduceThreads(events): ThreadState[]
formatThreadList(states): string[]
  // 重放线程状态和渲染线程列表行的唯一权威来源。
  // ThreadState 包含 `lastSeq`，因此归约后的状态可以指向最后一个事件。

// adapters/index.ts
interface WorkerAdapter {
  readonly provider: Provider;                              // "claude" | "codex"
  buildArgs(view: SupervisorView): string[];                // spawn() 的 CLI 参数
  createCtx(): AdapterCtx;                                  // 每个 worker 的状态
  handshake?(args: {child, ctx, view}): Promise<void>;      // 可选的前置通信初始化
  isReady(ctx: AdapterCtx): boolean;                        // 现在可以安全地转发收件箱了吗？
  parseLine(line: string, ctx: AdapterCtx): ParseResult;    // stdout 行 → 事件 + 副作用
  encodeUserMessage(text: string, ctx: AdapterCtx): string;
  encodeInterruptMessage(text: string, ctx: AdapterCtx): string;
}

// supervisor/shutdown.ts
interface ShutdownController {
  request(signal: NodeJS.Signals, reason: "explicit-kill"|"timeout"|"crash"|"idle-timeout"): Promise<void>;
  claim(reason): boolean;                                   // 同步意图锁存（无梯级）
  isShuttingDown(): boolean;
  reason(): ShutdownReason | null;
  markTerminalEmitted(): void;                              // 在 await appendEvent({kind:"done"|"error"}) 之前调用
  hasTerminalEvent(): boolean;
  finalizeOnExit(code: number|null, signal: NodeJS.Signals|null): Promise<void>;
  awaitFinalize(): Promise<void>;
}
```

---

## 3. 契约

### 事件负载契约（events.jsonl）

所有事件都携带：`seq: number`（单调递增，≥ 1）、`ts: string`（ISO 8601）、
`by: string`（作者身份）、`kind: ChannelEventKind`。任何额外字段按 kind 各自定义。

```ts
type ChannelEventKind = "create" | "join" | "leave" | "message" | "thread" | "context" | "channel" | "spawned"
  | "killed" | "respawned" | "progress" | "done" | "error" | "waiting" | "awake"
  | "undeliverable" | "interrupt_requested" | "turn_started" | "turn_finished" | "interrupted"
  | "supervisor_warning";
```

| Kind | 必填（基础字段之外） | 可选 | 生产者 |
|------|------------------------|----------|----------|
| `create` | `cwd: string`, `scope: "project"\|"global"`, `type: "chat"\|"forum"` | `task: string`, `project: string`, `labels: string[]`, `description: string`, `context: ContextEntry[]`, `ephemeral: true`, `origin: "cli"`, `meta: object` | CLI |
| `spawned` | `as: string`, `provider: "claude"\|"codex"`, `pid: number` | `agent: string`, `files: string[]`, `manifests: string[]`, `inboxPolicy: "explicitOnly"\|"broadcastAndExplicit"` | supervisor / core `spawnWorker` |
| `message` | `text: string` | `to: string \| string[]` | 任意 |
| `thread` | `action: ThreadAction`, `thread: string` | `title`, `text`, `description`, `status`, `labels`, `assignees`, `summary`, `context`, `newThread` | CLI / agents |
| `context` | `target: "channel"\|"thread"`, `action: "add"\|"delete"`, `context: ContextEntry[]` | `thread`（当 `target="thread"` 时） | CLI / agents |
| `channel` | `action: "title"` | `title: string \| null` | CLI / agents |
| `progress` | `detail: object`（自由格式） | — | adapter |
| `done` | — | `duration_ms: number`, `total_cost_usd: number`, `num_turns: number`, `synthesized: true`, `exit_code: number` | adapter（真实）/ supervisor（合成） |
| `error` | `message: string` | `detail: object`, `provider: string`, `synthesized: true`, `exit_code`, `exit_signal` | supervisor / adapter |
| `killed` | `reason: "explicit-kill"\|"timeout"\|"crash"\|"idle-timeout"`, `signal: NodeJS.Signals` | `timeout_ms: number`（如果 reason="timeout"），`idle_timeout_ms: number`（如果 reason="idle-timeout"），`worker: string` | supervisor / cli:kill |
| `supervisor_warning` | `worker: string`, `reason: "approaching_timeout"`, `timeout_ms: number`, `remaining_ms: number` | — | supervisor |
| `respawned` | （保留，暂无字段） | — | （未来） |
| `undeliverable` | `targetWorker: string`, `messageSeq: number`, `reason: "worker-terminal"\|"worker-unknown"` | — | core `sendMessage`（仅严格投递模式） |
| `interrupt_requested` | `worker: string` | `turnId: string`, `reason: "user"\|"system"\|"timeout"\|"superseded"`, `message: string` | core `requestInterrupt` / `interruptWorker` |
| `turn_started` | `worker: string`, `inputSeq: number` | `turnId: string` | adapter / supervisor |
| `turn_finished` | `worker: string` | `inputSeq: number`, `turnId: string`, `outcome: "done"\|"error"\|"aborted"` | adapter / supervisor |
| `interrupted` | `worker: string`, `method: "provider"\|"stdin"\|"signal"\|"none"`, `outcome: "interrupted"\|"queued"\|"unsupported"\|"no-active-turn"\|"failed"` | `turnId: string`, `reason`, `message: string` | core `interruptWorker` / CLI supervisor |

**作者身份（`by`）形状**：`"main"`、`"<worker-name>"`、`"supervisor:<worker>"` 或 `"cli:<command>"`（例如 `cli:kill`）。

**Worker 生命周期 / 收件箱 / 投递契约**（由 `@baoanaz/cviauto-core` 拥有）：

- `reduceWorkerRegistry(events, channel?)` 是 SOT worker 投影。Worker
  生命周期（`starting`/`running`/`done`/`error`/`killed`/`crashed`）和回合
  活动（`idle`/`mid-turn`）纯粹从持久化事件投影 — 绝不
  从 pid 文件或收件箱游标。`pendingMessageCount` 计算可投递的
  `message` 事件，这些事件的 seq 大于对应 worker 最新已消费的
  `turn_started.inputSeq`。Pid 文件仅供给 `probeWorkerRuntime` /
  `reconcileWorkerLiveness`；`reconcileWorkerLiveness` 除非
  `appendTerminalEvents: true` 否则不执行持久化写入。
- 收件箱策略仅适用于 `kind:"message"`。`explicitOnly`（默认）
  仅消费 `to` 目标为 worker 自身的消息；`broadcastAndExplicit`
  也消费广播。没有 `inboxPolicy` 的旧 `spawned` 事件投影
  为 `explicitOnly`。`matchesInboxPolicy` 是 worker
  归约器和 supervisor 收件箱观察器共用的 SOT。
- `sendMessage` 投递模式：`appendOnly`（默认 — 仅追加 / 与 pre-spawn
  积压兼容）、`requireKnownWorker`、`requireRunningWorker`。严格模式
  先追加 `message` 事件，然后为不满足所选条件的目标
  worker 追加 `undeliverable`。广播消息永不产生
  `undeliverable`。CLI 通过 `trellis channel send
  --delivery-mode <mode>` 暴露此功能。
- Interrupt 是一等 API，不是魔法标签。`requestInterrupt` 仅追加
  `interrupt_requested`；`interruptWorker(input, runtime)` 追加
  `interrupt_requested`，调用注入的 `WorkerRuntime`，然后追加
  `interrupted` 并携带 `method` / `outcome`。CLI 通过
  `trellis channel interrupt` 暴露此功能；消息标签不是 interrupt 路径。
- Worker 收件箱读取/观察由 core 拥有。`readWorkerInbox(input)` 返回
  指定 worker 的匹配 `message` 事件，通过组合
  `resolveChannelRef`、`readChannelEvents`、`reduceWorkerRegistry` 和
  `matchesInboxPolicy` 实现；`limit` 是在收件箱过滤之后应用的
  非负整数（`0` 返回 `[]`），`afterSeq` 是排他的，每个返回消息的
  `cursor` 等于消息 `seq`。
  `watchWorkerInbox(input)` 是一个返回
  `AsyncGenerator<WorkerInboxMessage>` 的 `async` 函数 — 前置验证和
  `lastSeq` 快照在外层调用时发生，因此未知/终结 worker
  错误是即时的，且观察不会与后续追加产生竞态。
  当被观察的 worker 的终结事件（`killed`、合成的 `done`、
  或 supervisor / 合成的 `error`）到达时生成器结束，并且
  不会跨越相同 id 的 respawn — 要观察未来的 respawn，调用方
  必须先通过 `watchWorkers` 重新解析。`fromStart` / 显式 `sinceSeq`
  被钳制到当前 worker 生成（generation）的起点（当前 `spawned` 之前的最新
  终结事件），因此旧生成的消息不会
  重放，而 post-terminal / pre-spawn 积压仍然可消费。
  取消仅通过 `AbortSignal`；core 不提供 `timeoutMs`。
  稳定的错误类型
  `WorkerInboxError` 携带 `code`、`channel`、`workerId`；code 为
  `WORKER_INBOX_WORKER_NOT_FOUND` 和 `WORKER_INBOX_WORKER_TERMINAL`。Core
  仅从持久化事件日志推断原因；它不声称 OS 进程
  活跃性，也不持久化游标状态。CLI supervisor 收件箱
  整合（`packages/cli/src/commands/channel/supervisor/inbox.ts`）
  被有意推迟 — adapter 就绪状态、stdin 编码、回合
  排队、interrupt 兼容性和 `<worker>.inbox-cursor` 仍然是
  CLI 本地关注的问题。

### Core channel 持久化幂等性

#### 1. 范围 / 触发器

- 触发器：`@baoanaz/cviauto-core` 变更 API 需要为可能重试逻辑命令的
  守护进程/API 调用方提供重放安全性（replay safety）。
- 这是一个事件日志存储契约：物理 `events.jsonl` 追加
  和 seq 分配边界必须决定一个带键的写入是新的还是
  重放。
- 范围：core channel 变更 API 和追加原语。CLI 标志和
  worker 生命周期行为不是此契约的一部分。

#### 2. 签名

```ts
interface BaseChannelEvent {
  seq: number;
  ts: string;
  kind: ChannelEventKind;
  by: string;
  idempotencyKey?: string;
}

interface SendMessageOptions {
  idempotencyKey?: string;
  text: string;
  to?: string | string[];
}

interface PostThreadOptions {
  idempotencyKey?: string;
  action: ThreadAction;
  thread: string;
}

appendEvent(
  name: string,
  partial: Omit<ChannelEvent, "seq" | "ts">,
  project?: string,
): Promise<ChannelEvent>;
```

`idempotencyKey` 在持久化它的公共变更选项上是显式的。
不要将其添加到共享变更选项类型中，除非每个继承的变更
API 都写入该键并有重放测试。

#### 3. 契约

- 幂等性限定在一个已解析的 channel 事件日志中。相同键在
  不同 channel 中是独立的。
- `appendEvent` 验证键，进入 channel 锁，当键存在时读取持久化
  事件日志，并返回现有的同种事件
  而不追加。
- 没有 `idempotencyKey` 的调用保持仅追加行为。
- 返回的重放事件保留其原始 `seq` 和 `ts`；调用方必须使用
  该返回事件作为权威收据。
- `sendMessage` 严格投递模式仍然先追加消息事件。
  重放从返回的持久化事件（`event.to`）分类投递，
  而不是从重试负载（`opts.to`）。
  当消息调用具有幂等键时，生成的 `undeliverable`
  副作用事件使用确定性的派生键：
  `` `${idempotencyKey}:undeliverable:${targetWorker}` ``。

#### 4. 验证与错误矩阵

| 条件 | 行为 |
|-----------|----------|
| `idempotencyKey` 省略 | 与之前完全相同地追加一个新事件。 |
| `idempotencyKey` 为 `""` 或仅空白 | 抛出 `idempotencyKey must be a non-empty string`。 |
| 相同 channel/key/kind 已存在 | 返回现有事件；不追加，不推进 seq。 |
| 相同 channel/key 以另一种 kind 存在 | 抛出跨 kind 重用错误，指明现有 kind。 |
| 相同键在另一个 channel 中使用 | 视为独立；根据该 channel 的日志追加。 |
| `sendMessage` 严格重放，同一失败目标 | 返回原始消息，不重复 `undeliverable`。 |
| `sendMessage` 严格重放，重试 `to` 不同 | 忽略重试目标漂移；仅分类持久化的消息 `to`。 |

#### 5. Good/Base/Bad 案例

- Good：守护进程重启后重试 `sendMessage({ idempotencyKey: "cmd-123" })`；
  core 读取 JSONL，返回原始 `message` 事件，调用方
  提交原始 `seq`。
- Base：正常的 CLI/用户 `sendMessage` 不传键；每次调用追加
  一个不同的 `message`。
- Bad：调用方在同一个 channel 中先对 `message` 使用键 `cmd-123`，之后对 `thread`
  事件也使用该键；core 拒绝第二次写入。

#### 6. 所需测试

- 单元：重复带键的 `sendMessage` 返回原始 `seq` / `ts`，且只存在
  一个 `message` 事件。
- 单元：重复带键的 `postThread` 返回原始 `seq` / `ts`，且只存在
  一个 `thread` 事件。
- 单元：无键调用仍然追加不同的事件。
- 单元：空/仅空白键被拒绝。
- 单元：跨 kind 键重用被拒绝。
- 单元：严格投递重放不重复 `undeliverable` 事件。
- 单元：严格投递重放目标漂移不会为原始持久化消息中不存在的
  目标追加副作用。
- 单元：直接 `appendEvent` 带键重放返回持久化的事件。

#### 7. Wrong vs Correct

**Wrong**（仅进程内幂等；重启丢失键）：

```ts
if (seenKeys.has(key)) return seenKeys.get(key);
const event = await appendEvent(channel, partial);
seenKeys.set(key, event);
return event;
```

**Correct**（事件日志是权威来源）：

```ts
return withLock(lockPath(channel), async () => {
  const existing = findByIdempotencyKey(eventsPath(channel), key);
  if (existing) return existing;
  return appendJsonlWithNextSeq(channel, partial);
});
```

### Worker OOM 防护

CLI 拥有的保护措施，防止无限制的常驻 worker 累积。

#### 1. 范围 / 触发器

- 触发器：`spawn` 现在在 fork 一个长期运行的 worker supervisor 之前强制执行进程生命周期限制。
- 这是基础设施代码：它读取配置/环境变量，扫描持久化事件状态加上
  worker 附属文件，验证 OS pid，向 supervisor 发送信号，并通过正常的关闭路径写入终结
  channel 事件。
- 边界：core 仅投影 `WorkerState.idleSince`；CLI 拥有预算
  强制执行、pid 验证、空闲清理和 supervisor 空闲计时器。

#### 2. 签名

```ts
type WorkerGuardConfig = {
  idleTimeoutMs: number;    // 默认 300_000；0 禁用空闲清理
  maxLiveWorkers: number;   // 默认 6；0 禁用 spawn 预算
};
```

CLI 新增：

```
trellis channel spawn <name>
  --idle-timeout <duration>  # "5m" 默认；"0" 禁用空闲清理
  --max-live-workers <n>     # 6 默认；0 禁用活跃 worker 预算
```

配置：

```yaml
channel:
  worker_guard:
    idle_timeout: 5m
    max_live_workers: 6
```

环境变量：

```
TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT=5m
TRELLIS_CHANNEL_MAX_LIVE_WORKERS=6
```

#### 3. 契约

- 配置优先级为 CLI 标志 → 环境变量 → `.trellis/config.yaml` →
  内置默认值。`0` 在每个级别禁用对应的防护。
- 活跃 worker 预算是按项目桶计算的。`spawn` 扫描该桶中的每个 channel
  并统计拥有活跃 pid 的非终结 worker。它还将
  `<worker>.reservation` 附属文件计为 `lifecycle:"starting"` 活跃
  worker，直到 supervisor 追加 `spawned`。
- 预算扫描、过期空闲清理、reservation 写入、supervisor fork
  和父 pid 文件写入在 `<projectBucket>/.worker-guard.lock` 下运行。
  每个 worker 的 spawn 锁仍然在该项目锁内使用。
- 仅当 worker 投影为 `activity:"idle"` 且 `idleSince` 存在时，worker 才有资格被空闲清理。`turn_started` 清除 `idleSince`；`turn_finished` 和 `interrupted` 设置它。处于回合中的 worker 和没有 `idleSince` 的 worker 永远不会被空闲防护 kill。
- 自动清理仅可向命令行验证为 `channel __supervisor <exact-channel> <exact-worker>` 的 pid 发送信号。活跃但未经验证的 pid 保留在溢出列表中，不会被自动 kill。
- Spawn 时的空闲清理在发送 `SIGTERM` 之前写入一个一次性 `<worker>.shutdown-reason` 附属文件，内容为 `idle-timeout`。supervisor 消费该附属文件并发出单一终结事件：`killed{reason:"idle-timeout", idle_timeout_ms:N}`。
- 每个 supervisor 在 `spawned` 持久化后也安排自己的空闲计时器。计时器在 `turn_started` 时暂停，在空闲进入时重置，并在连续空闲超时后调用 `shutdown.request("SIGTERM", "idle-timeout")`。
- 没有默认的硬 TTL。显式的 `--timeout` 保持其现有的主动选择硬截止行为，与空闲清理无关。

#### 4. 验证与错误矩阵

| 条件 | 行为 |
|-----------|----------|
| `--idle-timeout` 无效时长 | commander 使用现有的时长解析器拒绝 |
| `--max-live-workers <n>` 为负数/非整数 | commander 以参数错误拒绝 |
| `idle_timeout: 0` 或 `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT=0` | 空闲清理禁用；除非预算也被禁用，worker 仍被计入预算 |
| `max_live_workers: 0` 或 `TRELLIS_CHANNEL_MAX_LIVE_WORKERS=0` | 预算检查禁用；如果 TTL > 0，supervisor 空闲自行终止仍然有效 |
| 过期空闲清理后活跃计数 `>= maxLiveWorkers` | 拒绝 `spawn`，附带活跃 worker 列表、`trellis channel kill` 提示和覆盖提示 |
| 空闲 worker pid 活跃但命令行未经验证 | 计入；不自动对其发信号 |
| Worker 在空闲 TTL 到期时正在执行回合 | 不做任何操作，直到其回到空闲状态 |
| Supervisor 收到带有 `shutdown-reason=idle-timeout` 的外部 SIGTERM | 追加 `killed`，带 `reason:"idle-timeout"` 和 `idle_timeout_ms` |
| Supervisor 收到没有附属文件的 SIGTERM | 追加 `killed`，带 `reason:"explicit-kill"` |

#### 5. Good/Base/Bad 案例

- Good：存在六个常驻空闲 worker，其中三个超过 `idle_timeout`；第七个 `spawn` 清理过期 worker 并继续。
- Base：六个活跃 worker 全部活跃或未过期；第七个 `spawn` 拒绝并打印活跃 worker 加上 kill 提示。
- Bad：一个过期的 pid 文件指向不相关的进程；防护将其计为活跃阻塞项但不向该进程发信号。

#### 6. 所需测试

- Core 归约器：`spawned` 初始化 `idleSince`，`turn_started` 清除它，`turn_finished` / `interrupted` 恢复它，终结事件清除它。
- CLI 防护：配置/环境变量/标志优先级，默认 `5m` / `6`，通过 `0` 禁用，预算拒绝，空闲清理，reservation 计数和精确 pid-command 验证。
- Supervisor：空闲计时器仅在持久化的 `spawned` 之后启动，回合中暂停，通过常规关闭控制器发出 `idle-timeout`，并清理 pid / reservation / shutdown-reason 附属文件。

#### 7. Wrong vs Correct

**Wrong**（粗暴 kill 看起来空闲的任意 pid）：

```ts
if (Date.now() - Date.parse(worker.lastSeen) > ttl) {
  process.kill(worker.pid, "SIGTERM");
}
```

**Correct**（使用投影的空闲状态加上经过验证的 supervisor 所有权）：

```ts
if (
  worker.activity === "idle" &&
  worker.idleSince &&
  isExpired(worker.idleSince, ttl) &&
  worker.supervisorVerified
) {
  writeShutdownReason(worker, "idle-timeout");
  process.kill(worker.pid, "SIGTERM");
}
```

### Codex 进度流元数据

#### 1. 范围 / 触发器

- 触发器：`packages/cli/src/commands/channel/adapters/codex.ts` 将
  Codex `app-server` JSON-RPC 通知转换为 channel `progress` 事件。
- 这是一个跨层事件契约：worker adapter 写入
  `events.jsonl`，`messages --raw` 暴露负载，下游 UI/SDK
  消费者从相同字段重放流式文本。
- Codex 每个回合可以发出多个 `agentMessage` 流。将所有
  `item/agentMessage/delta` 负载视为一个无类型的 `text_delta` 流会使
  交错输出的评论/最终输出 token 无法恢复。

#### 2. 签名

```ts
type CodexProgressDeltaDetail = {
  kind: "output" | "commentary" | "reasoning";
  text_delta: string;          // 向后兼容的流式 token/chunk
  stream_id?: string;          // Codex params.itemId（如果存在）
  phase?: string;              // Codex item.phase（如果已知）
};

type CodexItemMeta = {
  type?: string;               // item.type，来自 item/started 或 item/completed
  phase?: string;              // item.phase，来自 item/started 或 item/completed
};
```

Adapter 状态：

```ts
interface CodexCtx {
  pending: Map<number, "initialize" | "thread/start" | "turn/start" | "other">;
  items: Map<string, CodexItemMeta>;
  threadId?: string;
  nextId: number;
}
```

#### 3. 契约

| Codex 输入 | 必需的 adapter 行为 |
|-------------|---------------------------|
| 带有 `item.id` 的 `item/started` | 在 `ctx.items` 中存储 `item.id -> {type, phase}`；不为普通的 `agentMessage`、`reasoning`、`plan` 或 prompt scaffolding 项发出事件。 |
| 带有 `item.id` 的 `item/completed` | 在投影完成事件之前刷新 `ctx.items`，以便同一 id 的后续 delta 仍具有元数据。 |
| 带有 `params.delta` 或 `params.text` 的 `item/agentMessage/delta` | 发出一个 `progress` 事件，`detail.text_delta` 不变。 |
| 带有 `params.itemId` 的 `item/agentMessage/delta` | 添加 `detail.stream_id = params.itemId`。 |
| 已知 `phase:"commentary"` | 添加 `detail.kind = "commentary"` 和 `detail.phase = "commentary"`。 |
| `agentMessage` 上已知 `phase:"final_answer"` 或未知 phase | 添加 `detail.kind = "output"`；仅在已知时添加 `detail.phase`。 |
| 已知 `type:"reasoning"` | 添加 `detail.kind = "reasoning"`。 |
| 已完成且 `phase:"commentary"` 的 `agentMessage` | 继续以 `progress.detail.kind = "commentary"` 和汇总的 `text_delta` 投影。 |
| 已完成且 `phase:"final_answer"` 或无 phase 的 `agentMessage` | 继续以 `kind:"message"` 投影；这仍然是规范的已完成助手回答。 |

消费者契约：

- 按 `detail.stream_id`（如果存在）对 Codex 流式 delta 进行分组。
- 使用 `detail.kind` 进行通道路由（`output`、`commentary`、`reasoning`）。
- 保持 `kind:"message"` 作为持久化的已完成助手回答；流式
  delta 是活动/进度，而非权威最终正文。

#### 4. 验证与错误矩阵

| 条件 | 行为 |
|-----------|----------|
| Delta 事件没有 `delta` 也没有 `text` | 不发出事件。 |
| Delta 事件有 `itemId` 但没有记忆的元数据 | 发出 `detail.kind = "output"`，保留 `detail.stream_id`，保留 `detail.text_delta`。 |
| Delta 事件有内联的 `params.item` | 在分类之前记录该项元数据。 |
| `item.id` 缺失或不是字符串 | 不写入 `ctx.items`；继续正常的事件投影。 |
| 未知 `item.type` / 未知 `phase` | 不抛出异常；将流式 delta kind 默认为 `output`。 |
| 单个回合中多个流交错 | 不全局缓冲/重排；保留事件顺序并通过 `stream_id` 使流可分离。 |

#### 5. Good/Base/Bad 案例

- Good：`item/started(agentMessage id=msg_final phase=final_answer)` 后跟 `item/agentMessage/delta(itemId=msg_final)` 发出 `{kind:"output", stream_id:"msg_final", phase:"final_answer", text_delta}`。
- Base：`item/agentMessage/delta(itemId=msg_unknown)` 没有前置元数据，发出 `{kind:"output", stream_id:"msg_unknown", text_delta}`。
- Bad：两个 Codex 流只写入 `{text_delta}`；重放消费者将两个流拼接成不可读的文本，无法重建任一通道。

#### 6. 所需测试

- 单元：`parseCodexLine` 记录 `item/started` 元数据并将评论 delta 分类为 `detail.kind = "commentary"`。
- 单元：交错的 final/commentary 流产生不同的 `detail.stream_id` 值，并分别路由到 `output` 与 `commentary`。
- 单元：未知 `itemId` 保留 `detail.text_delta` 并添加回退 `detail.kind = "output"` 加上 `detail.stream_id`。
- 集成或 fixture：录制的 Codex 跟踪（包含交错 delta）可以被重放，而消费者不会将整个回合视为一个单一流。

#### 7. Wrong vs Correct

**Wrong**（丢失流标识）：

```ts
return {
  events: [{ kind: "progress", payload: { detail: { text_delta: delta } } }],
};
```

**Correct**（保留旧字段，新字段使流可分离）：

```ts
const detail: Record<string, unknown> = { kind, text_delta: delta };
if (itemId) detail.stream_id = itemId;
if (meta?.phase) detail.phase = meta.phase;
return { events: [{ kind: "progress", payload: { detail } }] };
```

**Channel 类型语义**：
- `chat` 是默认值，保持时间线优先。
- `forum` 是线程列表优先（一个其线程是独立主题的话题区域）：`messages <channel>` 美化输出以归约后的线程列表开头，除非设置了事件过滤器；`messages --raw` 始终每行打印一个事件 JSONL。
- 带有 `type:"thread"` / `type:"threads"` 的旧事件日志不会被升级为 `forum`；它们投影为 `chat`，因此 forum/thread API 将它们作为非 forum channel 拒绝。新的 CLI 仅写入和接受 `forum`；`--type thread` 和 `--type threads` 都会抛出明确的 "Use '--type forum'" 错误。
- 创建/线程事件的美化输出显示 `description` 和简短的 `context` 摘要；原始输出保留完整的 JSONL 事件。
- `send` 始终追加 `kind:"message"`，从不针对线程。
- `post` 追加 `kind:"thread"`，仅在 `type:"forum"` channel 上有效。

**Thread action 分类**：`opened`、`comment`、`status`、`labels`、`assignees`、`summary`、`processed`、`rename`。

**Channel action 分类**：`title`。这仅是显示标题元数据，不是地址重命名。Channel 地址保留为存储目录键；未来的地址重命名必须是单独的存储操作，如 `channel move`。

**未来事件归属模型**：

当前 v1 事件使用 `by` 作为轻量级作者别名，使用 `to` 作为
可选路由目标。不要将 `by` 扩展为业务身份对象。
对于通过未来 core API 消费 channel 事件的多用户产品，
下一个事件契约应添加：

```ts
type EventOrigin = "cli" | "api" | "worker";

type ChannelEventBase = {
  seq: number;
  ts: string;
  kind: ChannelEventKind;
  by: string;
  to?: string | string[];
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
};
```

- `by` 保持为 `messages --from` 和 `wait --from` 使用的显示/过滤别名；它不是用户表键、组织 id 或权限声明。
- `to` 保持为 channel worker / agent 的路由句柄。
- `origin` 记录公共写入入口点：`trellis channel ...` 为 `cli`，未来 channel core/library 为 `api`，supervisor / worker 运行时写入为 `worker`。
- `meta` 是用于 Trellis 运行时细节和外部系统的透传 JSON 对象。Trellis 持久化它，在 `--raw` 中发出它，并可能支持简单的路径等值过滤器；它不验证业务语义。

外部产品应将其 tenant、user、project、task、server
或 permission 快照放在自己的命名空间下，例如
`meta.external.authorId`。Trellis 不得在 channel 协议中定义 `user`、`org` 或
`displayName` 模式（schema）。

现有的 create-event 可选字段 `origin: "run"` 是旧模式标记，
不是未来的写入入口点字段。引入 `origin` 时，将该
模式标记移动到 `meta.trellis.createMode = "run"` 或等效的
无冲突字段。

**Context 形状**：
```ts
type ContextEntry =
  | { type: "file"; path: string }   // 仅绝对路径
  | { type: "raw"; text: string };
```

Context 可以出现在 channel 创建事件和线程 opened 事件上。
旧的事件日志可能仍包含 `linkedContext`；读取器将其标准化为
`context`，但新的写入不得发出 `linkedContext`。

**路由（`to`）语义**：省略 = 广播。Worker 仅消费 `to` 匹配自身名称的事件（广播是面向操作者/用户的）。CLI 过滤器（`--to <target>`）遵循 `watchEvents` 规则：没有 `to` 的事件通过（广播）；显式 `to` 不匹配则拒绝。

**终结事件不变量**：每个被 spawn 的 worker 最终必须恰好产生 `done` 或 supervisor 合成的回退事件之一。`ShutdownController.markTerminalEmitted()` 在 `await appendEvent({kind: done|error})` **之前同步**声明插槽，以防止与 `finalizeOnExit` 发生竞态。

### 存储布局契约

```
<root>/                              # TRELLIS_CHANNEL_ROOT ?? ~/.trellis/channels
├── _legacy/                         # 保留桶（自动迁移的平面 channel）
│   └── .bucket
├── _default/                        # 保留桶名称（当前未使用）
├── _global/                         # 全局作用域 channel
└── <projectKey(cwd)>/               # 每个项目一个桶
    ├── .bucket                      # 标记 — 将桶与遗留 channel 区分开
    └── <channel-name>/
        ├── events.jsonl             # 唯一权威来源，仅追加
        ├── .seq                     # 最后提交的事件 seq 附属文件；可从 events.jsonl 修复
        ├── <name>.lock              # O_EXCL 追加互斥锁（带 pid 标记）
        ├── <worker>.pid             # supervisor pid
        ├── <worker>.worker-pid      # worker 子进程 pid
        ├── <worker>.config          # 序列化的 SupervisorConfig JSON
        ├── <worker>.log             # worker 原始 stdout+stderr
        ├── <worker>.session-id      # claude resume key（跨越清理持久化）
        ├── <worker>.thread-id       # codex resume key（跨越清理持久化）
        ├── <worker>.inbox-cursor    # 转发给 worker stdin 的最后 seq（持久化）
        ├── <worker>.shutdown-reason # 一次性外部关闭原因附属文件
        ├── <worker>.reservation     # pre-spawn 预算预留附属文件
        ├── <worker>.spawnlock       # 每个 worker 的 spawn 互斥锁
        └── .worker-guard.lock       # 项目桶活跃 worker 预算互斥锁
```

**桶发现规则**：
- 顶级目录是桶，当且仅当它有 `.bucket` 文件或名称是 `_legacy` / `_default` / `_global`
- 任何其他顶级目录（里面包含 `events.jsonl`）是遗留 channel → 自动迁移
- 保留桶名称：`_legacy`、`_default`、`_global`（永远不会作为 projectKey 输出产生，因为 projectKey 从不以 `_` 开头）

**清理契约**（`cleanup(channel, worker)` 在 supervisor.ts 中）：
- 始终删除：`pid`、`worker-pid`、`config`、`spawnlock`、
  `shutdown-reason`、`reservation`
- 绝不删除：`log`、`session-id`、`thread-id`、`inbox-cursor`、`events.jsonl`、`.seq`

`channel rm` 删除整个 channel 目录；上述清理契约
仅适用于每个 worker 的 supervisor 清理。

### 环境变量注入

| 变量 | 必需？ | 默认值 | 使用者 |
|----------|-----------|---------|---------|
| `TRELLIS_CHANNEL_ROOT` | 可选 | `~/.trellis/channels` | `channelRoot()` — 覆盖存储根目录 |
| `TRELLIS_CHANNEL_PROJECT` | 可选 | `projectKey(process.cwd())` | `currentProjectKey()` — 锁定当前项目桶 |
| `TRELLIS_CHANNEL_AS` | 可选 | `"main"` | `spawn.ts` — `spawned` 事件上 `spawnedBy` 的默认值（让 worker spawn worker 时能记录正确的 lineage） |
| `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT` | 可选 | `.trellis/config.yaml` 然后 `5m` | worker OOM 防护空闲清理 TTL；duration 字符串，`0` 禁用 |
| `TRELLIS_CHANNEL_MAX_LIVE_WORKERS` | 可选 | `.trellis/config.yaml` 然后 `6` | worker OOM 防护活跃 worker 预算；非负整数，`0` 禁用 |
| `TRELLIS_HOOKS` | supervisor 设为 `"0"` | 不适用 | 受监督的 worker — 禁用 worker 进程内的 trellis hooks（防止递归 hook 注入） |

**环境变量优先级**：
- `TRELLIS_CHANNEL_PROJECT` 外部设置 → 该桶（高级用法）
- `TRELLIS_CHANNEL_PROJECT` 未设置 → 从 `process.cwd()` 推导
- `selectExistingChannelProject(name)` 在回退到唯一的跨桶匹配时可能**修改 `process.env.TRELLIS_CHANNEL_PROJECT`**，以便 CLI 调用的其余部分落在同一个桶上

---

## 4. 验证与错误矩阵

### CLI 级

| 条件 | 行为 |
|-----------|----------|
| `create <name>` 且 channel 存在，没有 `--force` | 抛出 `"Channel '<name>' already exists at <dir>. Use --force to overwrite."` |
| `create --force` 且有活跃 worker | killLiveWorkers（SIGTERM → 1.5秒 → SIGKILL）→ rmrf → 重新创建 |
| `spawn` 且 channel 未找到 | 抛出 `"Channel '<name>' not found at <dir>"` |
| `spawn` 没有 `--provider` 且没有提供它的 `--agent` | 抛出 `"Missing --provider (and the agent definition has no \`provider:\` frontmatter)"` |
| `spawn` 没有 `--as` 且没有提供回退名称的 `--agent` | 抛出 `"Missing --as (no agent name to fall back to)"` |
| `spawn` 且 worker 名称已有活跃 pid | 抛出 `"Worker '<as>' is already running in channel '<name>' (pid <N>)"` |
| `spawn` 且 `--provider` 不在 REGISTRY 中 | exit 1, stderr `"--provider must be one of: claude, codex"` |
| `send` 没有 `--stdin`/`--text-file`/`[text]` 中的任何一个 | 抛出（缺少正文） |
| `send`/`spawn`/`wait`/`messages`/`kill`/`rm` 且 channel 同时存在于 project 和 global 作用域但没有 `--scope` | 写入前抛出 `"Channel '<name>' exists in global and project scopes. Use --scope global or --scope project."` |
| `post` 针对 `chat` channel | 抛出 `"Channel '<name>' is type 'chat'. 'post' requires a forum channel."` |
| `post <action>` 使用无效 action | 抛出 `"Invalid thread action '<action>'..."` |
| `post` 对非 `opened` action 缺少 `--thread` | 抛出 `"--thread is required unless action is 'opened'"` |
| `--context-file <path>` 使用相对路径 | 抛出 `"--context-file must be absolute: <path>"` |
| `wait --all` 没有 `--from` | 抛出 `"--all requires --from <a,b,...>"` |
| `wait` 超时 | exit 124；如果 `--all`，stderr `"timeout: still waiting on <csv>"` |
| `prune` 使用 >1 个 `--all/--empty/--idle/--ephemeral` | 抛出 `"prune flags are mutually exclusive: <flags>. Pick one."` |
| `prune` 没有 `--yes` | 打印候选 + `(dry-run)` 通知；exit 0 不删除 |
| `run` worker 在 `done` 之前以 `error` 或 `killed` 退出 | exit 1, stderr `"channel kept for inspection: <path>"` |
| `selectExistingChannelProject(name)` channel 在 ≥2 个项目桶中存在 | 抛出 `"Channel '<name>' exists in multiple project buckets: <csv>. Run from the owning project cwd or use --scope."` |
| `selectExistingChannelProject(name)` 到处都未找到 | 抛出 `"Channel '<name>' not found in current project bucket (<key>) or any known project bucket"` |

### Supervisor 级

| 条件 | 行为 |
|-----------|----------|
| `child.on("error")` 在 `child.once("spawn")` 之前（ENOENT 等） | 发出一个 `error{message:"worker spawn failed: ..."}`，运行 `cleanup()`，`process.exit(1)` — 没有 `spawned` 事件 |
| spawn-fail 处理后重复 `child.on("error")` 触发 | 用 `if (spawnFailed) return` 防护 — 无重复事件 |
| Post-spawn `error`（worker 启动后死亡） | `await appendEvent({kind:"error", message})` 然后 `await shutdown.request("SIGTERM", "crash")` — 通过 async IIFE 强制顺序 |
| Adapter handshake 抛出异常 | `await appendEvent({kind:"error", detail:{source:"handshake"}, message})` 然后 `shutdown.request("SIGTERM", "crash")` |
| `await spawnSettled` 期间请求 shutdown | 完成 settle 后，检查 `shutdown.isShuttingDown()` — 如果 true，`await shutdown.awaitFinalize()` 并返回（不写入 `spawned` 事件） |
| `child.on("exit")` 且 adapter 从未发出 done/error | `finalizeOnExit` 合成 `done{synthesized:true, exit_code:0}`（code=0）或 `error{synthesized:true, exit_code, exit_signal}`（其他）。`by` = worker 名称（不是 `supervisor:<worker>`），以便 `wait --from <worker>` 能唤醒。 |
| `child.on("exit")` 且已请求 shutdown | 不合成（`killed` 事件已作为终结事件）。`finalizeOnExit` 仅 `await killedPromise` 然后退出。 |
| Kill ladder 活跃性检查 | `child.exitCode === null && child.signalCode === null`（不是 `child.killed` — 后者意味着 "kill() 已调用"，不是 "进程已退出"） |

### 安全边界

| 接口 | 验证器 | 拒绝行为 |
|---------|-----------|-----------------|
| Worker / channel 名称在协议提示中 | `safeIdentifier(s)` 移除 `/[\r\n\x00-\x08\x0b-\x1f\x7f]/` | 静默移除（仍然产生有效字符串） |
| `--file <path>` | `jailedRealpath(path, cwd)` 要求 `realpath(path).startsWith(realpath(cwd) + sep)` | 跳过文件，stderr 警告 |
| `--jsonl <path>` | 相同的 jail | 跳过清单条目，stderr 警告 |
| 读取期间的符号链接交换 | 解析前 `lstat` 在 `stat` 之前以检测符号链接 | 视为未找到 |
| `--agent <name>` | `/^[A-Za-z0-9._-]+$/` 正则 | 抛出异常 |
| `--agent` 解析路径 | `realpath(path).startsWith(realpath(agentsRoot) + sep)` | 抛出异常 |
| Frontmatter 解析 | `Object.create(null)`，拒绝 `["__proto__","prototype","constructor"]` 中的键 | 跳过键 |
| Context 文件单文件大小 | `MAX_PER_FILE_BYTES = 1_000_000`（1MB） | 截断 + stderr 警告 |
| Context 总大小 | `WARN_TOTAL_BYTES = 500_000`（500KB） | stderr 警告（仍然加载） |

---

## 5. Good / Base / Bad 案例

### 案例 A — `channel run` 成功路径

**Good**（典型短任务）：
```bash
$ TRELLIS_CHANNEL_ROOT=/tmp/test trellis channel run --provider codex --message "say hi in 3 words"
Hi, glad you're here.
$ echo $?
0
$ ls /tmp/test/.../-tmp-*/run-*/   # ← channel 在成功后移除
ls: ... No such file or directory
```

**Base**（带单个 worker 的正常 CR）：
```bash
$ trellis channel run --agent check --message-file /tmp/cr-brief.md --timeout 15m
## Files Checked
...
Issues Found
- ...
$ echo $?
0
```

**Bad**（provider 缺失 → spawn-fail → channel 保留以供检查）：
```bash
$ PATH=/usr/bin trellis channel run --provider claude --message "hi" --timeout 30s
channel kept for inspection: /Users/.../-.../-run-4a520e0f
(ephemeral — will be removed by `channel prune --ephemeral`)
Error: timeout waiting for cx done
$ echo $?
1
# events.jsonl 只有 [create, error] — 没有 spawned（被 pre-spawn guard 正确抑制）
```

### 案例 B — 带 `wait --all` 的多 worker 审查

**Good**：
```bash
trellis channel create cr-feature --ephemeral
trellis channel spawn cr-feature --agent check
trellis channel spawn cr-feature --agent check --provider codex --as check-cx
trellis channel send cr-feature --as main --to check --text-file brief.md
trellis channel send cr-feature --as main --to check-cx --text-file brief.md
trellis channel wait cr-feature --as main --kind done --from check,check-cx --all --timeout 15m
# stdout: 两行 done 事件 JSON（每个 worker 一行）
# exit 0（两个都完成了）
```

**Bad**（一个 worker 超时）：
```bash
trellis channel wait cr-feature --as main --kind done --from check,check-cx --all --timeout 30s
# stdout: 仅来自 check 的 `done`（如果有的话）
# stderr: "timeout: still waiting on check-cx"
# exit 124
```

### 案例 C — 跨 cwd 寻址

**Good**（channel 在 trellis 仓库中创建，通过唯一匹配回退从 /tmp 访问）：
```bash
$ cd /Users/me/work/trellis && trellis channel create unique-name
$ cd /tmp && trellis channel send unique-name --as main --text "hi"
# selectExistingChannelProject 发现 unique-name 只在一个桶中 → 修改 env → 成功
```

**Bad**（相同名称存在于多个桶中）：
```bash
$ cd /tmp && trellis channel send cr-r1 --as main --text "hi"
Error: Channel 'cr-r1' exists in multiple project buckets: -Users-me-work-trellis, -Users-me-work-app. Run from the owning project cwd or use --scope.
```

### 案例 D — 全局 forum channel

**Good**（跨项目共享的本地反馈 channel）：
```bash
trellis channel create trellis-issue --scope global --type forum \
  --description "Local Trellis feedback channel" \
  --context-file /Users/me/work/Trellis/.trellis/spec/cli/backend/commands-channel.md
trellis channel post trellis-issue opened --scope global --as main \
  --thread forum-mode \
  --title "Forum mode" \
  --description "Track forum feedback." \
  --labels channel,ux
trellis channel post trellis-issue comment --scope global --as arch \
  --thread forum-mode \
  --text "Reviewed the functional shape."
trellis channel messages trellis-issue --scope global
# forum-mode [open] Forum mode labels=channel,ux
```

**Bad**（`send` 不是线程原语）：
```bash
trellis channel send trellis-issue --scope global --as main --thread forum-mode "hi"
# Error: unknown option '--thread'
```

### 案例 E — Spawn-fail 事件序列

**Wrong**（r5 之前的行为，永不交付）：
```
[create]
[spawned] pid=undefined        ← 误导，worker 从未启动
[error]                        ← 与 spawned 竞态
[killed]                       ← 重复噪音
# supervisor 从未退出（Node 没有为 ENOENT 发出 `exit`）
```

**Correct**（r5 之后）：
```
[create]
[error] message="worker spawn failed: spawn claude ENOENT"
# supervisor process.exit(1)；无 spawned，无 killed；pid 文件已清理
```

---

## 6. 所需测试

| 接口 | 测试类型 | 断言点 |
|---------|-----------|-------------------|
| `paths.projectKey(cwd)` | unit | (a) `"/Users/x"` → `"-Users-x"`, (b) 反斜杠 → `-`, (c) CJK/空格/`#` → `-`, (d) 对重新清理的输入幂等 |
| `TRELLIS_CHANNEL_ROOT` 覆盖 | integration | 通过环境变量覆盖创建 channel；断言事件落在该根目录下，而非 `~/.trellis/channels` |
| Global/project 作用域冲突 | integration | 在 `_global` 和当前项目中创建相同名称；无作用域写入在追加前抛出异常，显式 `--scope global` 成功 |
| Thread 归约器 | unit/integration | 创建 `type=forum`；post `opened` + `comment` + `status`；断言归约状态有 title/status/labels/assignees/comment count |
| Thread 归约器游标 | unit/integration | 归约状态记录应用的最后 thread 事件的 `lastSeq` |
| Thread 美化输出 | integration | 默认线程列表打印线程视图提示；创建/thread 事件视图打印 description 和 context 摘要 |
| `matchesEventFilter` | unit | kind/from/thread/action/progress/to 语义匹配 `messages` 和 `watchEvents` 消费者 |
| `parseCsv` 辅助函数 | unit | 逗号分隔选项共享修剪和空条目行为 |
| `post` chat 拒绝 | integration | 创建默认 `chat`；`post opened` 抛出，events.jsonl 不变 |
| `context` 验证 | unit/integration | 绝对文件路径接受；相对文件路径拒绝；原始文件为空拒绝；legacy `linkedContext` 读取到标准化后的 `context` |
| Metadata 归约器 | unit/integration | create metadata、legacy `linkedContext`、channel 级 context add/delete、title set/clear 和 legacy `type:"thread"` 通过 `reduceChannelMetadata` 投影 |
| Thread rename 归约器 | unit/integration | 冲突拒绝；别名链解析；旧键 `showThread` 包含 pre-rename 和晚期旧键事件；thread context 跟随别名解析器 |
| `paths.migrateLegacyChannels()` | integration | (a) 平面目录包含 events.jsonl → 移动到 `_legacy/<name>/`, (b) 桶标记目录 → 跳过, (c) `_legacy`/`_default` → 跳过, (d) 幂等（第二次调用空操作） |
| `paths.selectExistingChannelProject(name)` | integration | (a) 当前桶有 channel → 返回 currentProjectKey, (b) 仅一个其他桶有 → 修改 env + 返回该桶, (c) 两个桶有 → 抛出 `Channel '<name>' exists in multiple` 消息, (d) 都没有 → 抛出带当前桶名称的错误 |
| `appendEvent` 原子性 | concurrent | spawn N 个并行 `appendEvent` 调用；断言 seq 严格单调 1..N，无重复或间隙 |
| `appendEvent` 附属文件恢复 | unit/integration | (a) 缺失 `.seq` 从 JSONL 重建, (b) 非整数 `.seq` 从 JSONL 重建, (c) `.seq` 低于 JSONL 尾部 — 修复无重复 seq, (d) `.seq` 高于 JSONL 尾部 — 修复无间隙 |
| `withLock` 过期锁恢复 | unit | 用死 pid 内容写入锁文件；后续 `withLock` 调用恢复并继续 |
| `watchEvents` 模式 | integration | (a) 默认从 EOF 读取, (b) `fromStart:true` 从字节 0 读取, (c) `sinceSeq:N` 跳过 seq ≤ N 的事件 |
| `matchesFilter` `to` 语义 | unit | (a) 没有 `to` 的事件在 filter.to 设置时通过（广播 OK）, (b) `to=X` 的事件仅在 filter.to=X 时通过, (c) `filter.to="exclusive"` 需要显式 `to` |
| Spawn-fail 路径（ENOENT） | e2e | `PATH=/no/claude trellis channel spawn ...` → events.jsonl 有一个 error 事件，无 spawned，无 killed；supervisor 已退出；pid 文件已删除 |
| 成功回合（claude / codex） | e2e | spawn → send "hi" → wait done；断言事件序列为 `create → spawned → message(to) → ...progress... → message(by:worker) → done`，无合成事件 |
| Codex 流式 delta 元数据 | unit/fixture | `parseCodexLine` 存储 `item/started` 元数据；delta 保留 `text_delta`，添加 `kind`，从 `itemId` 添加 `stream_id`，将交错的 `final_answer` / `commentary` 流路由到不同通道 |
| 冷退出回退合成 | e2e | 直接 kill worker 子进程 PID（绕过 supervisor）；断言 `finalizeOnExit` 合成终结事件，`by=workerName`，`synthesized:true` |
| Kill ladder | e2e | `channel kill`，断言 events.jsonl 有 `killed{reason:"explicit-kill", signal:"SIGTERM"}` 且 supervisor 进程在 6 秒内消失 |
| `markTerminalEmitted` 竞态 | concurrent | 近乎同时触发 adapter `done` 和 `child.on("exit")`；断言恰好一个终结事件（无重复合成） |
| `wait --all` 满足 | integration | spawn 2 个 worker，各发送一个提示；`wait --all --from a,b --kind done`；断言两个 done 事件都看到后 exit 0 |
| `wait --all` 超时 | integration | spawn 2 个 worker；在其中一个能 done 之前 kill；`wait --all` exit 124，stderr 输出 `"timeout: still waiting on <killed-one>"` |
| `channel run` 成功清理 | e2e | run 成功；断言 channel 目录在退出后不存在 |
| `channel run` 失败保留 | e2e | run 使用坏 provider；断言 exit 1，stderr 匹配 "channel kept for inspection:"，channel 目录仍存在，`events.jsonl` 有 create+error |
| `--ephemeral` create + list + prune | integration | (a) `list` 默认隐藏, (b) `list --all` 显示带 `*`, (c) `list` footer 打印 "(N ephemeral channels hidden ...)", (d) `prune --ephemeral` 仅删除临时 channel, (e) `prune --ephemeral --idle 1h` 抛出互斥错误 |
| 路径遍历 jail | security | `--file /etc/passwd` 从 cwd `/tmp/work` → 文件跳过，stderr 警告 |
| Agent 名称验证器 | security | `--agent ../../evil` → 抛出异常 |
| Frontmatter 原型污染 | security | 一个 `.trellis/agents/<name>.md` fixture 带有 `__proto__: ...` frontmatter → 键被丢弃，无可观测污染 |
| `safeIdentifier` | unit | 换行 / NUL / 控制字符从协议提示中的 worker 名称中移除 |

---

## 7. Wrong vs Correct（关键模式）

### 模式 1 — 标记 adapter 发出的终结事件

**Wrong**（与 `finalizeOnExit` 竞态）：
```ts
for (const ev of result.events) {
  await appendEvent(channelName, ev);     // ← worker 进程可能在此 await 期间退出
  if (ev.kind === "done" || ev.kind === "error") {
    shutdown.markTerminalEmitted();        // ← 太晚了；finalizeOnExit 已经合成了回退
  }
}
```

**Correct**（同步前置声明）：
```ts
for (const ev of result.events) {
  if (ev.kind === "done" || ev.kind === "error") {
    shutdown.markTerminalEmitted();        // ← 同步；finalizeOnExit 立即观察到
  }
  await appendEvent(channelName, ev);
}
```

### 模式 2 — Post-spawn 错误处理顺序

**Wrong**（killed 可能在 error 之前落地）：
```ts
child.on("error", err => {
  void appendEvent({kind:"error", message: err.message});
  void shutdown.request("SIGTERM", "crash");   // ← 并行运行；killed-append 可能赢得锁
});
```

**Correct**（先 await error，然后请求 shutdown）：
```ts
child.on("error", err => {
  if (spawnFailed) return;                    // L1 修复：防御双重触发
  shutdown.claim("crash");                    // ← 同步意图，使并发代码看到 isShuttingDown
  void (async () => {
    try {
      await appendEvent({kind:"error", message: err.message});
    } catch { /* 忽略 — 无论如何都要退出 */ }
    await shutdown.request("SIGTERM", "crash");
  })();
});
```

### 模式 3 — Kill ladder 中的活跃性检查

**Wrong**（`child.killed` 意思是 "kill() 已调用"，而不是 "进程已退出"）：
```ts
setTimeout(() => {
  if (!child.killed) child.kill("SIGKILL");   // ← 永远不会触发，第一次 kill() 后 child.killed=true
}, GRACE_MS);
```

**Correct**：
```ts
setTimeout(() => {
  if (child.exitCode === null && child.signalCode === null) {
    child.kill("SIGKILL");
  }
}, GRACE_MS);
```

### 模式 4 — 从不同的 cwd 解析 channel

**Wrong**（假设当前桶）：
```ts
const dir = channelDir(name);                 // ← 使用 cwd 推导的桶；如果用户在 /tmp 则抛出异常
```

**Correct**（使用路径前先解析）：
```ts
selectExistingChannelProject(name);            // 如果需要则修改 TRELLIS_CHANNEL_PROJECT env
const dir = channelDir(name);                 // ← 现在读取锁定的 env
```

### 模式 5 — 合成的终结事件作者

**Wrong**（破坏 `wait --from <worker>`）：
```ts
await appendEvent({
  kind: "done",
  by: `supervisor:${workerName}`,             // ← wait --from worker --kind done 不会唤醒
  synthesized: true,
});
```

**Correct**：
```ts
await appendEvent({
  kind: "done",
  by: workerName,                             // ← 与 adapter 将使用的 `by` 相同
  synthesized: true,
});
```

---

## 文件参考

```
commands/channel/
├── index.ts                  CLI Commander 注册
├── create.ts                 channel create
├── spawn.ts                  channel spawn + supervisor fork
├── send.ts                   channel send
├── wait.ts                   channel wait (+ --all)
├── messages.ts               channel messages (+ --follow)
├── threads.ts                channel post / forum / thread
├── list.ts                   channel list (+ --all-projects / --all)
├── rm.ts                     channel rm + prune
├── kill.ts                   channel kill
├── run.ts                    channel run (一次性包装器)
├── supervisor.ts             supervisor 进程编排器
├── supervisor/shutdown.ts    ShutdownController 状态机
├── supervisor/stdout.ts      行泵 + applyParseResult
├── supervisor/inbox.ts       收件箱观察器 + 游标
├── supervisor/idle.ts        OOM-guard 空闲计时器（暂停 / 重置 / 取消）
├── guard.ts                  OOM-guard 策略 + spawn 时扫描 + 空闲清理
├── adapters/index.ts         WorkerAdapter REGISTRY + Provider type
├── adapters/types.ts         AdapterEvent / ParseResult 形状
├── adapters/claude.ts        Claude stream-JSON adapter
├── adapters/codex.ts         Codex app-server JSON-RPC adapter
├── store/paths.ts            项目桶辅助函数 + 迁移
├── store/events.ts           appendEvent + ChannelEvent kind 分类
├── store/schema.ts           scope/type/thread/context 解析器
├── store/filter.ts           共享事件过滤 SOT
├── store/thread-state.ts     线程重放 + 线程列表格式化 SOT
├── store/lock.ts             withLock（O_EXCL + 过期 pid 恢复）
├── store/watch.ts            watchEvents（fs.watch + 轮询回退）
├── context-loader.ts         --file / --jsonl 注入（jailed realpath）
└── agent-loader.ts           --agent 加载器（frontmatter 解析 + path jail）
```

---

## 未来工作（不在本规范范围内）

- **`StorageAdapter` 抽象**用于云支持的存储（S3 / DynamoDB / Redis）。目前 `store/*` 直接调用 `fs.*`；adapter 模式是任何非本地后端的前提条件。
- **events.jsonl 轮转** — 当单个文件 > 100MB 或 > 100k 事件时触发。Schema 分割 + reader-merge 是开放的设计问题。
- **事件归属 + 透传元数据** — 保持 `by` 为轻量别名，添加 `origin: "cli"|"api"|"worker"` 作为写入入口点，并将业务身份/上下文存储在 `meta` 中，不教 Trellis 用户/组织语义。
- **GUI 前端**通过 fs.watch (Electron) 或轮询消费 `events.jsonl`。`messages.ts` 中的 CLI 渲染规则可直接转换。
