# 论坛频道（Forum Channels）

论坛频道是持久化、主题式的频道。在频道创建时通过 `--type forum` 指定，创建后不可更改。它们不是普通的聊天流：默认的阅读路径是
**论坛摘要（forum summary） -> 单个线程时间线（one thread timeline） -> 当前上下文（current context）**。

## 论坛 vs 普通频道

频道类型在 `channel create` 时通过 `--type` 设置，且永不改变：

- `chat`（默认）—— 扁平消息时间线。`channel messages` 始终渲染事件流。论坛专用 flags 如 `--thread` 和 `--action` 在此处会被拒绝。
- `forum` —— 面向线程（thread-oriented）。不带过滤条件的 `channel messages` 渲染线程面板摘要而非原始事件。`post`、`forum`、`thread` 和 `thread rename` 子命令仅适用于论坛频道。

两种类型共享相同的作用域模型（scope model）（`--scope project` 为默认值；`--scope global` 将频道放入跨项目桶中）。

## 创建论坛频道

```bash
trellis channel create design-feedback \
  --type forum \
  --scope global \
  --description "Cross-project design feedback board." \
  --context-raw "One thread per design topic; close when resolved." \
  --by main
```

使用 `--scope project` 创建限定于单个仓库的面板，使用 `--scope global` 创建跨项目面板。

## 线程（Threads）：打开、评论、状态、摘要

线程存在于论坛频道内部。每个线程通过稳定的 `--thread <key>` 标识（约定使用小写 kebab-case）。对线程的第一个操作是 `opened`；之后的所有操作使用相同的 `--thread` key。

```bash
trellis channel post design-feedback opened \
  --scope global \
  --as main \
  --thread login-empty-state \
  --title "Empty state on the login screen" \
  --description "Track design feedback for the new login empty state." \
  --labels design,login \
  --context-raw "Spotted during the 0.4 release review." \
  --text-file /tmp/thread-open.md

trellis channel post design-feedback comment \
  --scope global \
  --as reviewer \
  --thread login-empty-state \
  --text-file /tmp/review.md

trellis channel post design-feedback status \
  --scope global \
  --as main \
  --thread login-empty-state \
  --status closed

trellis channel post design-feedback summary \
  --scope global \
  --as main \
  --thread login-empty-state \
  --summary "Adopted the option-B layout; ticket TRELLIS-123 owns the fix."
```

关键区别：

- `--description` 是**持久化**的线程描述（回答"这个线程是关于什么的？"）。在 `opened` 时设置，通过重新运行带 `--description` 的 `post` 来编辑。
- `--text` / `--stdin` / `--text-file` 是**事件正文（event body）**—— 附属于此特定时间线条目的评论或负载。
- `--labels` 和 `--assignees` 是 CSV 格式，会**替换**当前值而非追加。
- `--summary` 是滚动线程摘要。在 `status closed` 时设置它是标记线程已解决并附带上下文的标准方式。

每个操作都需要 `--thread`，除了 `opened`（实际上也需要 —— 不存在匿名线程）。

## 阅读论坛

```bash
trellis channel messages design-feedback --scope global
trellis channel forum design-feedback --scope global --status open
trellis channel thread design-feedback login-empty-state --scope global
trellis channel messages design-feedback --scope global --raw --thread login-empty-state
```

如果同伴说"我在论坛上评论了"，先运行 `channel forum` 查看哪个线程有变化，然后用 `channel thread <name> <thread>` 深入该线程。不要直接跳到临时的 `events.jsonl` 解析。

## 上下文（Context）

上下文条目（context entries）是持久化的背景信息，在阅读频道或线程时应始终处于作用域内。它们**不是**时间线事件；它们被单独投影，并为每个读者重放。

使用 `context` 子命令。旧版的 `--linked-context-file` / `--linked-context-raw` flags（在 `create` 和 `post` 上）是已弃用的别名，会被折叠到规范的 `--context-file` / `--context-raw` 中。

### 添加上下文

```bash
# 频道级上下文（整个论坛）
trellis channel context add design-feedback \
  --scope global \
  --raw "Upstream feedback board; please link tasks before opening threads."

# 线程级上下文（单个线程）
trellis channel context add design-feedback \
  --scope global \
  --thread login-empty-state \
  --file "$PWD/.trellis/tasks/05-13-login-redesign/design.md"
```

- `--thread <key>` 在频道级上下文和线程级上下文之间切换。
- `--file` 路径**必须为绝对路径**；相对路径会被拒绝。
- `--raw` 是纯文本内联内容。
- 两个 flags 均可重复使用；`add` / `delete` 至少需要一个。
- `--as <agent>` 记录作者身份；默认为 `main`。

### 列出上下文

```bash
trellis channel context list design-feedback --scope global
trellis channel context list design-feedback --scope global --thread login-empty-state --raw
```

`list` 上的 `--raw` 每行输出一个 JSON 条目（适用于管道）；不带它时，会得到人类可读的 `file <path>` / `raw <truncated text>` 列表。空存储打印 `(no context)`。

### 删除上下文

```bash
trellis channel context delete design-feedback \
  --scope global \
  --thread login-empty-state \
  --raw "stale note"
```

按**值**而非 id 删除：传入与添加时相同的 `--file` 或 `--raw` 值。重复该 flag 可在一次调用中删除多个条目。

### 阅读顺序

阅读线程时，按自上而下的顺序：

1. 线程 `description`（持久化的"这是关于什么的"）。
2. 上下文条目（频道级 + 线程级）。
3. 时间线（`opened`、`comment`、`status`、`summary`）。

如果上下文文件缺失或不可读，明确说明并继续使用剩余数据 —— 不要凭空编造内容。

## 标题投影（Title Projection）

`title` 将稳定的显示标题投射到频道上，而不重命名存储地址。你传给每个命令的频道 `name` 保持不变。

```bash
trellis channel title set design-feedback \
  --scope global \
  --title "Design feedback board"

trellis channel title clear design-feedback --scope global
```

- `title set` 需要 `--title`。
- `--as <agent>` 记录作者身份；默认为 `main`。
- 这是表现层（presentation-layer）的变更。工具和脚本继续使用原始频道名称。

## 线程重命名（Thread Rename）

`thread rename` 是当线程以错误的 key（拼写错误、slug 约定错误等）打开时的修正路径。线程不支持硬删除 —— 重命名是支持的纠正操作。

```bash
trellis channel thread rename design-feedback old-key new-key \
  --scope global \
  --as main
```

- `--as <agent>` **必须**提供。
- `post <name> rename` 会被拒绝 —— 必须使用 `thread rename`。

## 删除原则（Deletion Discipline）

不要将单条评论删除或线程硬删除建模为正常工作流。论坛线程是仅追加的协作历史。要纠正状态，请使用：

- `post ... status` 将线程标记为 closed / blocked 等。
- `post ... summary` 记录解决方案。
- `post ... --labels` 重新打标签（替换整个集合）。
- `thread rename` 纠正错误的线程 key。

## 内部 Changelog 模式

全局论坛频道的一个常见用途是内部发布/运行时 changelog。每个显著变更一个线程，保持历史可搜索：

```bash
trellis channel create release-notes \
  --type forum \
  --scope global \
  --description "Internal release and runtime changelog." \
  --context-raw "One thread per notable change; close when shipped." \
  --by main

trellis channel post release-notes opened \
  --scope global \
  --as main \
  --thread release-2026-q1 \
  --title "Channel threads and forum UX in 0.6" \
  --description "Forum channel UX shipped in the 0.6 line." \
  --labels channel,release \
  --text-file /tmp/release-notes.md
```

使用稳定、描述性的线程 key（如 `release-2026-q1`、`runtime-event-schema-change`），以便后续读者能按名称找到它们。