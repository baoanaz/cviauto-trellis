# `tl mem` — 跨平台 AI 会话记忆

Trellis 如何索引、搜索并从 Claude Code、Codex、OpenCode 和 Pi Agent 写入的磁盘会话文件中提取对话。

检索引擎位于 `@baoanaz/cviauto-core/mem`（`packages/core/src/mem/`）；
`packages/cli/src/commands/mem.ts` 是其上的薄 CLI 包装器。在阅读「Subcommand surface」之前，先看下面的「Package boundary」。

---

## 概述

`tl mem` 是一个离线读取器，针对**本地 AI 会话存储**。它不会附加到正在运行的 CLI 或与任何远程服务通信 — 它只解析这些 CLI 已经放在磁盘上的文件：

| 平台    | 会话根目录                                                                                       |
| ----------- | -------------------------------------------------------------------------------------------------- |
| Claude Code | `~/.claude/projects/<sanitized-cwd>/<id>.jsonl`                                                    |
| Codex       | `~/.codex/sessions/**/rollout-<ts>-<id>.jsonl`                                                     |
| OpenCode    | 读取器在 0.6.0-beta.4 中不可用（已回退，参见 Notes）                                           |
| Pi Agent    | `~/.pi/agent/sessions/--<encoded-cwd>--/<timestamp>_<id>.jsonl` 或环境变量/设置自定义会话目录 |

对于每个会话，`mem` 可以：列出元数据（id / cwd / 时间），跨所有会话 grep 清理后的对话，深入单个会话以获取命中周围受 token 预算限制的上下文窗口，或转储完整的清理后对话。清理后的形式剥离了 Trellis / 平台注入标签，因此搜索命中不会被会话开始的序言占据。

检索域**不**依赖于 Trellis 运行时的其余部分（没有 `configurators/`，没有 Python 脚本），也**不**依赖于 CLI：它仅使用 `node:fs / node:path / node:os`，且不含 `zod`、`console.*` 和 `process.exit`。CLI 通过从 `tl` Commander 连线调用的单个 `runMem(args)` 入口点暴露它。

> **本规范的受众**：扩展 `mem` 的贡献者 — 添加新平台、新子命令或新标志。目标是确保当进行更改时，清理管道、过滤语义和排序启发式在各平台之间保持一致。

---

## Package boundary

`mem` 在 `@baoanaz/cviauto-core` 和 CLI 之间拆分。一般规则参见 `trellis-core-sdk.md`；`mem` 特定的拆分如下：

**Core 拥有**（`packages/core/src/mem/`，公共接口在 `@baoanaz/cviauto-core/mem` 子路径 — **不是**根 barrel）：

- 持久化会话读取器 / 适配器，适用于 Claude Code、Codex、OpenCode、Pi（`adapters/{claude,codex,opencode,pi}.ts`）
- 搜索、相关性评分、摘录选择（`search.ts`）
- 对话清理（`dialogue.ts`）、过滤（`filter.ts`）
- 对话上下文提取（`context.ts`）、头脑风暴阶段切片（`phase.ts`）、项目聚合（`projects.ts`）
- 编排 API：`listMemSessions`、`searchMemSessions`、`readMemContext`、`extractMemDialogue`、`listMemProjects`，以及它们的输入/输出类型和 `MemSessionNotFoundError`
- `packages/core/src/mem/internal/` 下的低级 JSONL / 路径辅助函数（私有 — CLI 不得深层导入它们）

**CLI 拥有**（`packages/cli/src/commands/mem.ts`）：

- `runMem`、argv 解析（`parseArgv`）和 CLI 标志 → `MemFilter` 转换
- 终端渲染：`printSessions`、`shortDate`、`shortPath`、行格式化
- `--json` 输出塑形（保留稳定的 JSON 字段名）
- OpenCode 不可用 stderr 通知（`warnOpencodeUnavailable`）
- `process.exit` 代码和 `die`

CLI 仅通过公共子路径导入 core：

```ts
import { searchMemSessions } from "@baoanaz/cviauto-core/mem";
```

Core 返回携带 `warnings` 数组的结构化结果；CLI 决定如何打印警告和使用什么退出代码。Core 永不打印或退出。

---

## 子命令接口（Subcommand surface）

入口点：`commands/mem.ts:runMem` 在 `commands/mem.ts:parseArgv` 之后基于 `argv.cmd` 分发，然后调用匹配的 `@baoanaz/cviauto-core/mem` API 并渲染结果。跨领域的 `--platform / --since / --until / --cwd / --global / --limit` 标志由 CLI 解析并转换为 core 的 `MemFilter`。

| 子命令               | 函数                      | 用途                                                                                                                                                                                   |
| ------------------------ | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `list`                   | `commands/mem.ts:cmdList`     | 按最近时间排序的会话元数据列表，上限为 `--limit`（默认 50）。未指定时的默认子命令。                                                                            |
| `search <kw>`            | `commands/mem.ts:cmdSearch`   | 跨所有匹配会话的清理后对话的多 token AND grep；按加权相关性评分排序；发出每个会话的摘录。                                                   |
| `context <id>`           | `commands/mem.ts:cmdContext`  | 单个会话深入查看：top-N 命中回合 + 每侧 N 回合的上下文，受字符预算限制。不带 `--grep` 时，返回前 N 回合（会话打开）。                        |
| `extract <id>`           | `commands/mem.ts:cmdExtract`  | 转储一个会话的完整清理后对话；`--grep` 通过 AND 子串过滤回合。                                                                                                      |
| `projects`               | `commands/mem.ts:cmdProjects` | 聚合各平台的唯一 cwd，附带最后活跃时间戳 + 各平台计数。AI 在选择用于 `search` 的 `--cwd` 之前将此项用作「门牌号」（项目路径）目录。 |
| `help` / `--help` / `-h` | `commands/mem.ts:cmdHelp`     | 打印完整的标志参考。                                                                                                                                                                |

### 标志

跨领域（`buildFilter`）：

| 标志                                          | 默认值         | 备注                                                                                                                                                                |
| --------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--platform claude\|codex\|opencode\|pi\|all` | `all`           | 由 CLI 对照 `MemSourceFilter` 联合类型验证（手写守卫，无 zod）。未知值 → exit 2。                                                       |
| `--since YYYY-MM-DD`                          | 无            | 包含下限。通过 `new Date(value)` 解析；无效 → exit 2。                                                                                                |
| `--until YYYY-MM-DD`                          | 无            | 包含上限；解析器追加 `T23:59:59.999Z`，因此日期字符串覆盖整个 UTC 日。                                                                    |
| `--cwd <path>`                                | `process.cwd()` | 项目范围。通过 `path.resolve` 解析。与 `--global` 结合 → `--global` 胜出。                                                                             |
| `--global`                                    | 关闭             | 取消 cwd 范围限定（`f.cwd = undefined`）。                                                                                                                             |
| `--limit N`                                   | `50`            | 输出行数上限。对于 `search` 候选收集和 `findSessionById`，内部提升至 `1_000_000`，因此限制仅控制**显示**，而非搜索召回。 |

子命令特定：

| 标志                 | 子命令          | 默认值               | 备注                                                                                                                                                              |
| -------------------- | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--grep KW`          | `extract`, `context` | 无                  | 多 token AND。`extract` 通过子串过滤回合；`context` 排序回合并显示 top hits。`context --grep` 需要非空。                          |
| `--turns N`          | `context`            | `3`                   | 要显示的命中回合数。                                                                                                                                    |
| `--around M`         | `context`            | `1`                   | 每个命中任一侧的上下文回合数；通过 `Set` 去重。                                                                                                    |
| `--max-chars N`      | `context`            | `6000`（约 1500 tokens） | 总字符预算。每回合上限为 `floor(N/2)`；超出该上限的回合从头截断并附带 `…[+X chars]`。                                                         |
| `--include-children` | `search`, `context`  | 关闭                   | 在搜索/上下文之前将 OpenCode 子 agent 后代合并到父级（仅 OpenCode 填充 `parent_id`）。在 0.6.0-beta.4 中为空操作（OpenCode 读取器不可用）。 |
| `--json`             | 全部                  | 关闭                   | 用于 AI 消费的机器可读输出。                                                                                                                        |

---

## 平台索引

每个平台 adapter 位于 `packages/core/src/mem/adapters/` 并导出三个函数：

| 平台 | `*ListSessions(f)`                                   | `*ExtractDialogue(s)`     | `*Search(s, kw)`                                  |
| -------- | ---------------------------------------------------- | ------------------------- | ------------------------------------------------- |
| Claude   | `core/mem/adapters/claude.ts:claudeListSessions`     | `claudeExtractDialogue`   | `claudeSearch`                                    |
| Codex    | `core/mem/adapters/codex.ts:codexListSessions`       | `codexExtractDialogue`    | `codexSearch`                                     |
| OpenCode | `core/mem/adapters/opencode.ts:opencodeListSessions` | `opencodeExtractDialogue` | `opencodeSearch`（在 0.6.0-beta.4 中降级为空操作） |
| Pi       | `core/mem/adapters/pi.ts:piListSessions`             | `piExtractDialogue`       | `piSearch`                                        |

`core/mem/sessions.ts:listAll` 分发到各平台列表函数，并按 `updated ?? created` 降序合并结果；同一模块的 `extractDialogue` / `searchSession` 辅助函数根据 `s.platform` 分发。

### Claude Code

- **布局**：`~/.claude/projects/<sanitized-cwd>/<sessionId>.jsonl`。cwd 按 `cwd.replace(/[/_]/g, "-")` 清理。当设置 `--cwd` 时，`mem` 直接解析单个项目目录；否则它遍历每个项目目录。
- **索引**：当存在时，`<projectDir>/sessions-index.json` 为每个会话 id 提供 `cwd / created / title`，省去 JSONL 扫描。缺失字段则回退到扫描前 100 个事件（`findInJsonl`）查找 `cwd`，然后扫描第一个事件（`readJsonlFirst`）查找创建时间戳。
- **Updated**：`fs.statSync(filePath).mtime`。
- **清理**（`core/mem/adapters/claude.ts:claudeExtractDialogue`）：
  - 用户回合：`type === "user"` AND `message.role === "user"` AND `content` 是字符串（Array content = tool_result，丢弃）。
  - 助手回合：`type === "assistant"` AND `message.role === "assistant"` AND `content` 是 block 数组；仅保留 `block.type === "text"` 块。`thinking` 和 `tool_use` 块全部丢弃。
  - **压缩（Compaction）**：当 `user` 事件有 `isCompactSummary === true` 时，所有压缩前的回合被丢弃，替换为单个合成的 `[compact summary]\n<text>` 用户回合。

### Codex

- **布局**：`~/.codex/sessions/**/rollout-<YYYY-MM-DDTHH-MM-SS>-<id>.jsonl`。`core/mem/internal/paths.ts:walkDir` 通过基于栈的生成器惰性递归。
- **文件名时间戳**：通过正则 `/^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)$/` 解析，并通过将 `T??-??-??` 替换为 `T??:??:??Z` 转换为 ISO。如果第一个事件缺少 `timestamp`，则用作回退 `created`。
- **元数据**：从第一个 JSONL 事件的 `payload` 读取（id、cwd）。
- **清理**（`core/mem/adapters/codex.ts:codexExtractDialogue`）：
  - 真实回合：带有 `payload.type === "message"` 且 `payload.role` 可解析为 `user` / `assistant` 的顶层事件（丢弃 `developer` / `system`）。
  - 每个 `payload.content[]` 部件仅在 `type` 为 `input_text` 或 `output_text` 时保留。其他类型忽略。
  - **压缩**：顶层 `type: "compacted"` 事件携带 `payload.replacement_history[]` — 每个带有 `type === "message"` 的项变为合成的 `[compact]\n<text>` 回合，且此前的回合被丢弃。

### Pi Agent

#### 1. 范围 / 触发器

添加或更改 Pi 支持意味着编辑零依赖 adapter 位于 `core/mem/adapters/pi.ts`，以及 `core/mem/sessions.ts` 中的显式分发器、`core/mem/projects.ts` 中的项目聚合，和 `commands/mem.ts` 中的 CLI 平台验证/帮助。

#### 2. 签名

Pi adapter 导出与其他 adapter 相同的平台函数，加上其阶段收集器：

```ts
export function piListSessions(f: MemFilter): MemSessionInfo[];
export function piExtractDialogue(s: MemSessionInfo): DialogueTurn[];
export function piSearch(s: MemSessionInfo, kw: string): SearchHit;
export function collectPiTurnsAndEvents(s: MemSessionInfo): {
  turns: DialogueTurn[];
  events: TaskPyEvent[];
};
```

#### 3. 契约

- **根目录**：检查 `~/.pi/agent/sessions/--<encoded-cwd>--/`、`PI_CODING_AGENT_DIR`、`PI_CODING_AGENT_SESSION_DIR` 以及当前 Trellis 进程可见的 `settings.json.sessionDir` 下的默认根目录。自定义会话目录包含直接的 `.jsonl` 文件，必须按 `cwd` 头过滤。
- **元数据**：第一行必须是 `type: "session"` 头。发出 `platform: "pi"`、`id`、`cwd`、`created`、`updated`、`filePath`，以及从最新 `session_info.name` 获取的可选 `title`。不要使用第一个用户消息作为标题。
- **活跃分支**：Pi JSONL 是树状结构。构建 `id -> entry`，按文件顺序选择最后一个非头条目作为活跃叶节点，然后沿 `parentId` 走向根。永远不要线性扫描所有行来进行对话/搜索。
- **压缩**：如果活跃路径包含压缩，使用最新的：先发出 `[compact summary]`，然后是从 `firstKeptEntryId` 到压缩条目的条目，然后是压缩之后的条目。丢弃更早的压缩前条目及其 `task.py` 边界事件。
- **清理**：保留用户文本、助手 `text` 块、`custom_message` 文本、`[branch summary]` 和 `[compact summary]`。从对话中丢弃 thinking、tool results、bash output、image payloads 和 tool-call arguments。
- **阶段信号**：从 `name` 为 `bash` 或 `shell` 且 `arguments.command` 为字符串的助手 `toolCall` 块，以及从带有字符串 `command` 的 `message.role === "bashExecution"` 中收集 `task.py create|start`。

#### 4. 验证与错误矩阵

| 条件                                            | 必需行为                                   |
| ---------------------------------------------------- | --------------------------------------------------- |
| 缺少 Pi 根目录                                     | 静默返回 `[]`                                |
| 格式错误的 JSONL 行或未知条目类型            | 静默跳过                                       |
| 头在 `--cwd` 范围内有未知 cwd           | 丢弃该会话                                    |
| 废弃分支包含匹配文本              | `search` / `extract` 不得包含它            |
| 丢弃的压缩前文本包含匹配文本 | `search` / `extract` 不得包含它            |
| `--phase brainstorm` 没有 Pi `task.py` 边界    | 共享无边界警告 + 回退到完整对话 |
| `--phase implement` 没有 Pi `task.py` 边界     | 共享无边界警告 + 空结果           |

#### 5. Good/Base/Bad 案例

- Good：`trellis mem search kw --platform pi --cwd /repo` 仅搜索 `/repo` 的清理后活跃分支，且已应用压缩。
- Base：`trellis mem list --platform pi --json` 返回元数据行，带有使用 `/name` 或 `--name` 时的最新会话名称。
- Bad：对每个 Pi 行的线性扫描将 `/tree` 废弃分支和旧的压缩前历史泄露到搜索结果中。

#### 6. 所需测试

- Core adapter fixtures：列表、标题、设置/自定义根目录、清理后提取、活跃分支、压缩和搜索。
- Core phase fixtures：助手 `toolCall` 和 `bashExecution` 边界，包括压缩丢弃过期事件。
- 公共 API 测试：`platform: "pi"`、`readMemContext`、`extractMemDialogue(... phase: "brainstorm")` 和 `listMemProjects().by_platform.pi`。
- CLI 测试：`--platform pi`、JSON list/search/context/extract 输出和帮助文本。

#### 7. Wrong vs Correct

Wrong — 线性扫描泄露非活跃历史：

```ts
readJsonl(file, (entry) => {
  if (entry.type === "message") turns.push(turnFromMessage(entry.message));
});
```

Correct — 先解析活跃路径，然后清理：

```ts
const path = walkParentIdsFromLastLeaf(entries);
const effective = applyLatestPiCompaction(path);
for (const entry of effective) addCleanTurnAndTaskEvents(entry);
```

### OpenCode（读取器在 0.6.0-beta.4+ 中不可用）

在 0.6.0-beta.3 中，为 OpenCode 1.2+ 添加了一个 SQLite 支持的读取器（它从 JSON 树迁移到 `~/.local/share/opencode/opencode.db`）。该版本依赖于一个 `better-sqlite3` 原生依赖，该依赖在 Windows + 受限网络（中国、企业防火墙）上破坏了安装：`prebuild-install` 在获取二进制文件时超时，回退的 `node-gyp` 重新构建需要 VS2017+ 构建工具，且在没有 C 工具链的机器上 `trellis` 根本无法安装。0.6.0-beta.4 回退了该依赖。更广泛的规则参见 `quality-guidelines.md`「Native dependency policy」。

当前行为：

- `opencodeListSessions` 返回 `[]`。
- `opencodeExtractDialogue` 返回 `[]`。
- `opencodeSearch` 返回空命中。
- 三者都调用 `warnOpencodeUnavailable()`，每个进程写入一行 stderr（通过模块级标志缓存）。

重新启用 OpenCode 需要一个安装弹性后端。可接受的选项，按优先级排序：

1. **纯 JS / WASM** — `sql.js` 打包的 WASM。无需原生构建，每个平台字节相同，内存成本略高。
2. **Shell-out** — 当存在时调用用户系统的 `sqlite3` CLI；不存在时以清晰消息跳过 OpenCode。无需原生构建，零打包成本，依赖于主机。
3. **`node:sqlite`** — 一旦它从 Node LTS 的实验阶段毕业。原生但随运行时一起发布，无需安装时编译。
4. **`optionalDependencies` + 软降级** — 仅作为最后手段，且仅当软降级路径与今天的「空列表 + 一次性警告」UX 完全匹配，使得缺少依赖不会降低安装可靠性。

参见后续任务笔记。

### `SessionInfo` 契约

每个列表函数发出符合 `MemSessionInfo` 类型的项（`core/mem/types.ts`）：

| 字段       | 必需      | 来源                                                                                                                                                  |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `platform`  | 是           | `claude` / `codex` / `opencode` / `pi`                                                                                                                  |
| `id`        | 是           | 平台会话 id                                                                                                                                     |
| `title`     | 可选      | Claude 索引 `title`、OpenCode `title`、Pi 最新 `session_info.name`；Codex 无标题                                                               |
| `cwd`       | 可选      | OpenCode `directory`、Claude 索引/事件 `cwd`、Codex 首事件 `payload.cwd`、Pi 会话头 `cwd`                                                |
| `created`   | 可选 ISO  | 首事件/头时间戳；Codex 回退到文件名时间戳                                                                                    |
| `updated`   | 可选 ISO  | Claude/Codex 回退 `fs.statSync(file).mtime`；Pi 优先选择最新的用户/助手活动并回退到 mtime；OpenCode `session.time_updated` |
| `filePath`  | 是           | 会话主文件的绝对路径（OpenCode：共享 `opencode.db`）                                                                            |
| `parent_id` | 仅 OpenCode | 来自 `session.parent_id` 的子 agent 链接；Pi `parentSession` 是 fork/clone 源元数据，不得参与 `--include-children`           |

---

## 过滤与重叠语义

`mem.ts` 中最重要的不变量：

> **会话按区间重叠过滤，而非按单点 `created` 比较。**

### `inRange` vs `inRangeOverlap`

| 辅助函数                              | 语义                                                                                      | 使用位置                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `core/mem/filter.ts:inRange`        | 单点：`f.since ≤ t ≤ f.until`。如果 `iso` 未定义或不可解析则放行。         | 仅内部；**不用于会话列表过滤** |
| `core/mem/filter.ts:inRangeOverlap` | 区间：当且仅当会话生命周期 `[start, end]` 与查询窗口 `[f.since, f.until]` 重叠时保留。 | 由每个 `*ListSessions` 函数使用                 |

### 为什么重叠是强制性的

长生命周期会话跨越多天边界。一个在 2026-04-01 创建但仍于 2026-04-05 接收消息的 Claude 会话必须在 `--since 2026-04-03` 下显示。使用单点 `inRange(created, f)` 会将其静默丢弃，尽管它明显在窗口内活跃。审计轨迹：`task.05-08-mem-since-cross-day-filter`。

历史上的 Codex bug 值得特别指出。列表函数过去在**读取文件之前**就基于 `!inRange(tsFromName, f)` 提前短路 — 看似合理的优化，但 `tsFromName` 是会话的**创建时间**，因此跨天会话仅仅因为它开始于 `--since` 之前就被丢弃了。这已被移除；Codex 现在对每个文件进行 `stat` 并在 `[created, updated]` 上应用重叠。性能成本是每次列表调用每个 Codex rollout 一个 `fs.statSync`，相比于已经发生的 JSONL 解析，这可以忽略不计。

**规则**：添加新平台时，`start` 和 `end` 都要经过 `inRangeOverlap`。永远不要基于单个时间戳短路。如果平台只暴露一个时间戳，将其同时作为 `start` 和 `end` 传递 — `inRangeOverlap` 被定义为能处理这种退化情况。

### `sameProject` 语义

`core/mem/filter.ts:sameProject` 返回 true 当且仅当 target 为 undefined（无范围），或 `path.resolve(sessionCwd) === path.resolve(target)`，或会话 cwd 是子目录（`startsWith(target + sep)`）。cwd 未知的会话在 cwd 范围内被丢弃，但在 `--global` 下保留。

---

## 清理管道（Cleaning pipeline）

在任何搜索或显示之前，原始回合文本经过：

1. **`core/mem/dialogue.ts:stripInjectionTags`** — 对 `INJECTION_TAGS` 中的每个条目进行大小写不敏感的 `<tag>...</tag>` 块移除。同时移除 AGENTS.md 序言（`^# AGENTS\.md instructions for...` 直到下一个空行 + 大写/CJK 边界）。将 `\n` 连续运行折叠为 `\n\n` 并修剪。
2. **`core/mem/dialogue.ts:isBootstrapTurn`** — 在标签剥离**之后**应用。当以下条件满足时丢弃整个回合（从各平台构建器返回 `null`）：
   - `cleaned.startsWith("# AGENTS.md instructions for")`，或
   - `originalLength > 4000` 且 `cleaned` 以 `<INSTRUCTIONS>`（大小写不敏感）开头。大小阈值避免错误丢弃恰好以 `<INSTRUCTIONS>` 开头的小用户回复。
3. **压缩处理** — Claude `isCompactSummary` 和 Codex `compacted` 事件都重置累积的回合并将其替换为合成的 `[compact …]` 标记（参见上述平台章节）。

### 为什么管道对搜索很重要

一旦回合被清理，搜索就归结为**多 token AND 子串匹配（基于小写文本）** — `searchInDialogue` 不需要分词器或词干提取器。清理管道是使普通的 `String.prototype.includes` 可行的原因：否则 Trellis / 平台注入标签会主导每一个匹配。

如果你需要添加一个新的注入标签（例如，一个新的 Trellis hook 添加了 `<my-new-tag>`），将其追加到 `INJECTION_TAGS` 数组并添加一个基于 fixture 的测试。不要编写平台特定的剥离逻辑；标签列表是共享的。

`INJECTION_TAGS` 当前涵盖：

```
system-reminder, task-status, ready, current-state, workflow,
workflow-state, guidelines, instructions, command-name, command-message,
command-args, local-command-stdout, local-command-stderr,
permissions instructions, collaboration_mode, environment_context,
auto_compact_summary, user_instructions
```

`permissions instructions`（带空格）是有意的 — Codex 正是以这种方式发出它。

---

## 搜索相关性评分

`core/mem/search.ts:searchInDialogue` 返回一个 `SearchHit`，包含按角色命中计数和摘录。`core/mem/search.ts:relevanceScore` 是排序器：

```
score(hit) = (3 * user_count + asst_count) / total_turns
```

### 权重原理

- **用户命中加权 ×3**：用户自己的话锚定了主题意图。助理在阐述中重复「session insight」二十次的得分低于用户提及两次 — 助理阐述是用户真正关心内容的下游。
- **按 `total_turns` 归一化**：紧凑的 18 命中短会话必须排名高于臃肿的 58 命中长会话。没有归一化，每个长会话都会占主导。

### 平局决胜（`cmdSearch`）

```
1. score（降序）
2. raw count（降序）
3. updated ?? created（降序）— 最近性
```

### 摘录选择

在一个回合内，命中位置按以下评分：

1. **覆盖度** — 块中可见的不同查询 token（降序）。
2. **锚点稀有度** — `1 / tokenFreq[anchorToken]`（降序）。锚定在最稀有匹配 token 上的块最能表示用户实际谈论该主题的位置；锚定在常见 token（项目名称、"the"）上的块大多是噪音。
3. **最早开始** — 最终稳定平局决胜。

块来自 `core/mem/search.ts:chunkAround` — 在命中的任一侧按 `\n\n` 段落对齐，如果自然段落超过 `maxChars`（默认 `400`）则回退到居中的字符窗口。截断通过 `truncated` 标志报告，并在摘要中表现为前导 / 尾随 `…`。

用户角色摘录在最终列表中排在进行**之前**发出（参见 `searchInDialogue` 中的 `[...userExcerpts, ...asstExcerpts]` 拼接）。使用 `maxExcerpts = 3`（默认），一个有三次用户命中和十次助手命中的回合将仅显示用户摘录。

### 块去重

`seenStarts` 集合防止同一段落内的相邻命中位置产生多个重叠摘录。一个段落中的两次命中折叠为一个块。

---

## 子 Agent 合并（`--include-children`）

OpenCode 是唯一具有原生父子链接的平台（SQLite `session` 表上的 `parent_id` 列）。当设置 `--include-children` 时：

1. `core/mem/sessions.ts:buildChildIndex` 遍历候选列表并构建一个 `Map<parent_id, descendants[]>`，具有**传递扁平化** — 一个父级映射到所有后代，不仅是直接子级。
2. **搜索**：`core/mem/sessions.ts:searchSessionWithChildren` 将父级的清理后对话与每个后代的清理后对话拼接，并在合并后的回合列表上运行一次 `searchInDialogue`。评分反映整个子 agent 树中的主题密度。
3. **过滤已吸收的子级**：任何 `parent_id` 也在候选集中的候选者从结果列表中丢弃 — 父级已经吸收了其命中。
4. **上下文**（`cmdContext`）：相同合并；子级回合按 `extractDialogue` 顺序追加到父级回合之后；合并的子级计数在输出中显示。

Claude 和 Codex 不变地通过 — `parent_id` 是 undefined，因此它们永远不会吸收子级。

---

## 边界 — `mem.ts` 不做什么

- **不附加到活动进程**：仅读取磁盘上已有的文件。进行中的会话可能被部分索引（JSONL 是仅追加的，因此读取在行粒度上是一致的）。
- **不进行全局跨 cwd 隐式搜索**：默认情况下，所有内容都限定到 `process.cwd()` 的 cwd 范围。跨项目查询需要显式的 `--global` 或先通过 `projects` 子命令发现其他 cwd。
- **无写入路径**：`mem` 从不修改会话文件、索引或任何其他状态。它是一个严格的读取器。
- **无远程/云同步**：OpenCode 的可选云同步在此不可见。本地 OpenCode 读取在 0.6.0-beta.4 中也不可用（已回退 — 参见上述 OpenCode 章节）。
- **不对 Trellis 运行时产生传递依赖**：`core/mem/` 不从 `configurators/`、`migrations/`、`templates/` 或 `.trellis/scripts` 导入，也不依赖于 CLI 包。它仅使用 `node:fs / node:path / node:os` — 无 `zod`，无 `console.*`，无 `process.exit`。OpenCode 原生依赖路径（`better-sqlite3`）已在 0.6.0-beta.4 中移除。
- **不在 OpenCode 之外进行 OpenCode 风格的子 agent 链接**：即使未来的 Codex / Claude 版本暴露了父子 ID，当前的 `buildChildIndex` 仅查询 `s.parent_id`，而只有 OpenCode 发出它。添加跨平台子 agent 合并意味着扩展 `SessionInfo`。

---

## 搜索索引缺口（已知限制）

`mem search` / `mem extract --grep` / `mem context --grep` 仅对**清理后的对话文本**操作 — 用户消息加助手 `text` 块，在 `stripInjectionTags` 之后。以下原始 JSONL 字段被有意排除在搜索索引之外：

| 排除的字段                              | 所在位置                              | 索引遗漏的示例值                 |
| ------------------------------------------- | ------------------------------------------- | ---------------------------------------------- |
| `tool_use.name`                             | Claude 助手块（`type:"tool_use"`） | `"Skill"`, `"Bash"`, `"Read"`                  |
| `tool_use.input.*`                          | 同上                                        | `{"skill":"res-literature-search","args":"…"}` |
| `tool_use.id`                               | 同上                                        | `toolu_01XYZ…`                                 |
| `tool_result.content`                       | Claude 用户块（`type:"tool_result"`）   | command stdout, file contents                  |
| `thinking` blocks                           | Claude 助手块（`type:"thinking"`） | extended-thinking text                         |
| Codex `payload.tool_call.*`                 | 带有 `type:"tool_call"` 的 Codex 事件        | similar tool metadata                          |
| Codex `payload.function_call_output.*`      | 工具结果事件                          | function output                                |
| `cwd`, `gitBranch`, `version`, `entrypoint` | 顶层事件元数据                    | `feat/v0.6.0-beta`, `2.1.132`                  |

**用户可见的后果**：以_调用了什么工具 / 技能 / agent_ 表述的查询返回假阴性，即使对话大量使用了该工具。例如，`tl mem search "Skill"` 针对一个调用了 `Skill` 40 次的会话将返回 0 命中 — 工具名称存在于 `tool_use.name` 中，该字段在提取时被丢弃。

这是**设计如此**：对话清理器的存在是为了让 `String.includes` 相关性排序在对话文本上工作。索引工具元数据将使每个助手回合充斥 `Skill`/`Read`/`Bash`/`Edit`/等，并破坏信噪比。工具使用查询的正确工具是对 JSONL 文件进行**原始 `grep`**：

```bash
# 这个会话调用了哪些 skills？
grep -oE '"name":"Skill","input":\{[^}]+\}' \
  ~/.claude/projects/-Users-…-Trellis/<session-id>.jsonl

# 项目中跨会话的 skill 使用
grep -hoE '"skill":"[a-z0-9-]+"' \
  ~/.claude/projects/-Users-…-Trellis/*.jsonl | sort | uniq -c
```

**决策规则**：在 `tl mem` 和原始 `grep` 之间选择：

| 搜索内容                                                       | 工具                     |
| ------------------------------------------------------------------- | ------------------------ |
| 用户/助手说了什么 / 讨论了一个主题 / 做了一个决定 | `tl mem search`          |
| 使用了什么工具 / skill / agent / 子 agent                      | `grep` over JSONL        |
| 工具调用频率 / 参数                                    | `grep` + `jq` over JSONL |
| 跨会话主题回忆（对话中的概念）                   | `tl mem search`          |

未来的增强可以添加一个可选的 `--include-tools` 标志到 `extractDialogue`，发出合成的 `[tool: <name>]` 回合或将工具元数据作为单独的结果流展示，但当前范围不包括此功能。记录限制，将用户指向 `grep`，不要静默降低对话路径上的相关性质量。

---

## 阶段切片（`--phase`）

`tl mem extract <id> --phase <brainstorm|implement|all>` 按 Trellis 头脑风暴窗口切片清理后的对话，允许高密度的讨论回合（用户思考、AI 提案被拒绝、决策理由）与实现工作独立提取。

### 三个值

| `--phase`       | 行为                                                                                                                                          |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `all`（默认） | 现有行为 — 完整的清理后对话，不变。                                                                                         |
| `brainstorm`    | 仅返回 `[task.py create, task.py start)` 窗口内的回合。                                                                              |
| `implement`     | 返回每个头脑风暴窗口**之外**的回合（即用户花费在实际工作上的回合，加上第一个 `create` 之前的会话预热）。 |

### 边界信号

头脑风暴窗口由从平台原生 shell 调用事件中恢复的 `task.py` 调用界定（对话清理器丢弃这些事件）：

- **窗口开始**：一个 Bash 等效的 shell 调用，其命令匹配 `task.py create`。
  - Claude：助手 `tool_use` 块，带有 `name === "Bash"`，`input.command` 是命令字符串。
  - Codex：顶层 `function_call` 事件，带有 `name` ∈ `{"exec_command", "shell"}`。命令字符串通过 `core/mem/adapters/codex.ts:commandFromCodexArguments` 恢复，它接受 Codex 各版本发出的每种形状：原始 shell 字符串、字符串化的 JSON 对象或原始对象 — 命令在 `cmd`、`command` 或 `argv[]`（用空格连接）下。
- **窗口结束**：同一会话中的下一个 `task.py start` shell 调用。

Pi 使用相同的边界模型，shell 命令从名为 `bash` / `shell`（`arguments.command`）的助手 `toolCall` 块和 `bashExecution.command` 消息中恢复。

检测由 `core/mem/adapters/claude.ts:collectClaudeTurnsAndEvents`（Claude）、`core/mem/adapters/codex.ts:collectCodexTurnsAndEvents`（Codex）和 `core/mem/adapters/pi.ts:collectPiTurnsAndEvents`（Pi）执行 — 每个都是单次遍历，产生清理后的 `DialogueTurn[]`（在语义上与该平台的 `*ExtractDialogue` 相同）和一个带有 `turnIndex`（shell 调用被看到时的清理后回合索引）的 `task.py` 事件列表。

### 正则兼容性

`core/mem/phase.ts:parseTaskPyCommand` 解析单个 Bash 命令。它必须涵盖 Trellis 用户实际编写的每种形状：

```
\b(?:python3?|py(?:\s+-3)?)?\s*\S*[/\\]?task\.py\s+(create|start)\b
```

具体支持的调用器 + 路径形式：

- `python ./.trellis/scripts/task.py create "title"`
- `python3 ./.trellis/scripts/task.py create my-task`
- `py -3 .trellis/scripts/task.py create ...`（Windows 启动器）
- `python3 .trellis\\scripts\\task.py start ...`（JSONL 双重转义反斜杠）
- `python3 .trellis\scripts\task.py start ...`（单反斜杠）
- `task.py start <task-dir>`（PATH + chmod +x，无调用器前缀）
- `python3 /Users/.../task.py create ...`（绝对路径）

解析器还为 create 事件捕获 `--slug FOO` / `--slug=FOO`，并为 start 事件捕获位置任务目录。假阳性防护：`task.py` 必须出现在命令开头、空白之后或路径分隔符之后 — 永远不要嵌入在标志值中，如 `--slug=task.py-create-x`。

### 在 `task.py` 边界检测中的 Shell 参数解析

边界检测针对 AI 从 shell 提示符复制粘贴的真实 Bash 命令字符串运行，而非针对合成的 argv。解析器栈 — `core/mem/phase.ts:parseTaskPyCommandsAll` → `parseTaskPyCommand` → `splitShellArgs` → `slugFromTaskDir` — 必须吸收在 dogfood JSONL 流中出现的几种真实世界 Bash 惯用写法。

| 模式（真实世界）                                                                                             | 边缘情况                                               | 必需处理                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `SMOKE=$(python3 task.py create demo --slug demo)`                                                               | 尾随 `)` 粘在最后一个参数上               | `splitShellArgs` 在产出每个 token 之前剥离尾随的 `;                                                                                                                         | &()` |
| `SMOKE=$(task.py create …); task.py start "$SMOKE"`                                                              | 一个 Bash 命令中有**两个** `task.py` 调用            | `parseTaskPyCommandsAll` 返回**所有**匹配项，不仅是第一个                                                                                            |
| `EOF\nWith --slug, task.py start runs after create…`（包含文字短语的 heredoc 提交消息正文） | 是散文，不是命令                               | 假阳性防护：`task.py` 之后的 token 必须是在单词边界上的已知子命令；周围的上下文必须看起来像调用，而不是句子 |
| `python3 .trellis/scripts/task.py start .trellis/tasks/05-08-foo`                                                | task-dir 带有来自 `task.py create` 的 `MM-DD-` 前缀 | `slugFromTaskDir` 剥离前导的 `MM-DD-`，使得 `create --slug foo` 通过 slug 匹配与此 `start` 配对                                                 |
| `--slug=foo` vs `--slug foo`                                                                                     | `=` vs 空格                                       | `splitShellArgs` 仅基于空白；`=` 形式由 `parseTaskPyCommand` 中的 equals 分支捕获                                                  |

「两次调用」案例是最关键的：头脑风暴窗口在同一个 Bash 命令内的第一个 `task.py create` 上打开，并在第二个 `task.py start` 上关闭，因此错过第二次调用将静默丢弃窗口。`parseTaskPyCommandsAll` 在 0.6.0-beta.5 中添加，专门用于在对该仓库进行真实的 `--phase brainstorm` dogfood 运行后修复该丢弃问题，该运行在包含 6 个任务的会话上返回了 0 个窗口。

当扩展解析器时：

- 新的表面形式（例如，`tl task create`，如果 Trellis 有一天发布包装器）必须添加到 `parseTaskPyCommand` 的正则中，并且必须通过相同的 shell token 清理进行往返；不要单独处理引号。
- Token 边缘剥离（`;|&()`）是 shell 元字符清理的规范位置。不要将其推入 slug 正则或 `slugFromTaskDir` — 将其保留在分词器意味着未来的调用点免费获得清理。
- 「散文 vs 调用」启发式（「裸词 + 空格 + 大写字母」）故意保守：假阴性（在奇怪的 heredoc 内丢弃真实调用）可通过 `--phase all` 回退恢复；假阳性（将散文视为调用）破坏窗口标记并且没有恢复方法，除了重新运行 `--phase all`。

### 配对策略（多任务会话）

单个 Claude 会话通常包含 N 对 `[create, start)`，因为用户会在几个任务之间移动。在 `core/mem/phase.ts:buildBrainstormWindows` 中的配对：

1. **Slug 匹配优先**：任何带有显式 `--slug` 的 create 与第一个其 `taskDir` 的最后一个段等于该 slug 的未匹配 start 配对，无论位置如何。
2. **FIFO 回退**：剩余的 create 与出现在它们**之后**的下一个未匹配 start 按事件顺序配对。
3. **输出顺序**：窗口按 `startTurn` 升序排序（因此输出反映按时间顺序的会话流程）。

每个窗口发出一个标签：如果已知则使用显式 slug，否则使用 `slugFromTaskDir(start.taskDir)`，否则 `window-N`。

### 多窗口输出格式

具有多个窗口的 `--phase brainstorm` 在每个组之前发出分隔符：

```
--- task: <slug-or-label> ---

## Human

...
```

在 `--json` 模式下，输出添加：

```json
{
  "phase": "brainstorm",
  "windows": [{ "label": "demo", "startTurn": 1, "endTurn": 3 }, ...],
  "total_turns": 5,
  "groups": [{ "label": "demo", "turns": [...] }, ...],
  "turns": [...]   // 所有组的扁平拼接，用于旧解析器
}
```

`groups` 是结构化形式（每个窗口一个条目）。`turns` 是扁平拼接，保留用于与解析 pre-`--phase` 输出的消费者的向后兼容性。

### 回退矩阵

| 条件                                                              | `--phase brainstorm`                                     | `--phase implement`       |
| ---------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------- |
| `create` 和 `start` 都已找到，已配对                                | 切片每个窗口的 `[start, end)`                      | 不在任何窗口中的回合   |
| `create` 已找到，没有后续 `start`                                   | `[create, totalTurns)`（窗口保持开放到会话结束） | 任何 `create` 之前的回合 |
| `start` 已找到，没有前导 `create`（任务在更早的会话中创建） | `[0, start)`                                             | `start` 处或之后的回合 |
| 两者都未找到                                                          | 完整对话 + stderr 警告                           | 空 + stderr 警告    |
| `start.turnIndex < create.turnIndex`（事件交错异常）        | 窗口被丢弃                                         | （无影响）               |

警告发出到 stderr（`console.error`），因此它们不会污染 `--json` 消费者使用的机器可读 stdout。

### 平台覆盖

| 平台 | `--phase brainstorm` / `implement`                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude   | 原生 — 基于原始 JSONL 中 `tool_use`（Bash）块的边界检测                                                                        |
| Codex    | 原生 — 基于 `function_call` 事件（其 `name` 是 `exec_command` 或 `shell`，Codex 的 Bash 对应物）的边界检测                         |
| Pi       | 原生 — 基于活跃分支上名为 `bash` / `shell` 的助手 `toolCall` 块和 `bashExecution.command` 消息的边界检测 |
| OpenCode | 读取器在 0.6.0-beta.4+ 中不可用（返回空 + 警告）                                                                               |

`core/mem/adapters/codex.ts:collectCodexTurnsAndEvents` 是 `collectClaudeTurnsAndEvents` 的 Codex 对应物。相同的单次遍历形状：它产生清理后的 `DialogueTurn[]`（在语义上与 `codexExtractDialogue` 相同）和带有 `turnIndex` 的 `task.py` 事件列表，边界信号从 `name === "exec_command"`（或 `"shell"`）且其参数负载包含 `task.py create|start` 的 `function_call` 事件中读取。`cmdExtract` 中的分发器通过 `s.platform` 选择正确的收集器。配对（`buildBrainstormWindows`）、标记（`slugFromTaskDir`）和上述回退矩阵在 Claude、Codex 和 Pi 之间共享 — 只有原始事件解析器不同。

OpenCode 是唯一未完成的缺口，并且取决于 OpenCode 读取器本身；参见下面的「OpenCode reader status」。

### 与 `--grep` 结合

`--phase` 首先运行，然后 `--grep` 过滤结果切片中的回合。顺序很重要：`--grep KW --phase brainstorm` 仅在头脑风暴窗口内搜索，而不是整个会话。

### 常见陷阱：tool_use / function_call 在清理过程中被丢弃

`claudeExtractDialogue`、`codexExtractDialogue` 和 `piExtractDialogue` 丢弃 shell 调用载体块（Claude `tool_use`、Codex 顶层 `function_call`、Pi `toolCall` / `bashExecution`），因为它们的文本不是用户/助手对话。边界信号存在于这些块中，因此阶段切片**不能**后置过滤清理后的回合 — 信号已经消失。实现为每个平台进行自己的原始 JSONL 遍历（`collectClaudeTurnsAndEvents` / `collectCodexTurnsAndEvents` / `collectPiTurnsAndEvents`），同时构建回合和跟踪 shell 调用事件。当添加新边界信号（例如，读取器回归后的 OpenCode）时，遵循此模式：在单次遍历中读取原始事件，不要消费清理后的 `DialogueTurn[]`。

### 压缩重置 task.py 事件列表，不仅是回合

每个平台的收集器在压缩更改有效对话时必须丢弃**两个** `turns` 和过期的 `events` — Claude `isCompactSummary` 事件上的 `collectClaudeTurnsAndEvents`，Codex 顶层 `type === "compacted"` 事件上的 `collectCodexTurnsAndEvents`，以及当最新活跃路径 `compaction` 丢弃 `firstKeptEntryId` 之前的条目时 `collectPiTurnsAndEvents`。压缩前的 `task.py` 事件锚定在 `turnIndex` 值上，这些值索引到现在已折叠的对话（被单个 `[compact summary]` / `[compact]` 合成回合替换）。将它们向前携带并与压缩后的 `start` 事件配对将发出引用不再存在的对话的窗口。症状（如果遗忘）：一个窗口的 `startTurn` 深入压缩后区域但被标记为压缩前任务的过时 slug。修复：任何在压缩上变更或重建 `turns` 累加器的新边界检测器也必须从相同的有效条目重置或重建其事件累加器。

---

## 常见陷阱

当扩展或重构 `mem.ts` 时：

### 单点 `inRange` 用于会话列表过滤

**Wrong**：`if (!inRange(created, f)) continue;` — 丢弃跨天会话。**Correct**：`if (!inRangeOverlap(created, updated, f)) continue;` — 参见 `core/mem/adapters/codex.ts:codexListSessions` 获取规范模式。

### 基于文件名时间戳短路

**Wrong**：跳过 `tsFromName < f.since` 的 Codex 会话而不读取文件。**Correct**：stat 文件获取 `updated` 并应用 `inRangeOverlap`。文件名 ts 是创建时间；`--since` 过滤必须考虑活跃窗口。

### 绕过 `stripInjectionTags`

将原始回合文本添加到 `searchInDialogue` 会跳过注入标签移除，并在每个使用 Trellis 的会话上夸大命中计数。始终在 bootstrap 检查**之前**通过 `stripInjectionTags` 运行文本，并将剥离后的文本与 `originalLength` 一起传递给 `isBootstrapTurn`，以便大小阈值针对原始输入计算。

### 错误处理压缩

Claude 和 Codex 压缩事件重置 `turns` 数组；Pi 压缩首先从最新的 `compaction` 条目重建有效活跃分支。线性 Pi 扫描是错误的，因为旧条目仍保留在磁盘上。合成标记（`[compact summary]` / `[compact]`）是有意的 — 它们使压缩对读取器可见，并在 `extract` 输出中正确显现。

### 忘记将 `from` 推进到匹配 token 之后

在 `searchInDialogue` 中，`from = idx + tok.length` 是必需的，以避免当 token 长度为零时的无限循环。`kw.toLowerCase().split(/\s+/).filter(Boolean)` 中的 `tokens.filter(Boolean)` 守卫确保在此循环之前空 token 被丢弃。

### `readJsonl` 分块流式处理 + `0x7b` 快速拒绝

`core/mem/internal/jsonl.ts:readJsonl` 是每个平台 adapter 的规范 JSONL 读取器。它**不是** `fs.readFileSync` + `data.split("\n")` — 该模式将整个文件（在长 Claude 会话上可达数十 MB）作为一个字符串分配，且在 `"stop"` 短路信号之前无法停止，直到整个文件已加载到内存中。

当前实现：

1. **分块同步流式处理**，通过 `fs.openSync` + `fs.readSync` 使用 256 KB 缓冲区。行通过 `leftover` 字符串跨块边界重新组装；一次只有一个块大小的字节常驻。
2. **字节前缀快速拒绝** — 在分配异常路径之前，跳过第一个字节不是 `0x7b`（`{`）的任何行。JSONL 事件行几乎以 `{` 开头；空白行、偶尔的序言、仍在运行的 CLI 的部分写入等都在不付出 `JSON.parse` + 运行时守卫成本的情况下被拒绝。检查是 `line.charCodeAt(0) !== OPEN_BRACE`。
3. **`"stop"` 短路** — 访问者闭包可以返回 `"stop"` 以表示「我已经得到我需要的」（由 `readJsonlFirst` 和 `findInJsonl(maxLines<100)` 使用）。读取器关闭文件并立即返回，不再读取更多块。

对 36 MB Claude 会话（Trellis dogfood）实测影响：

| 操作                           | 之前（完整读取 + split） | 之后（分块 + 0x7b 跳过） |
| ----------------------------------- | -------------------------- | --------------------------- |
| `tl mem list`                       | ~3.5s                      | ~0.67s                      |
| `tl mem extract --phase brainstorm` | ~5.8s                      | ~0.73s                      |

扩展规则：

- 每个平台 adapter **必须**通过 `readJsonl` / `readJsonlFirst` / `findInJsonl`。永远不要重新引入 `fs.readFileSync` 用于会话文件。
- 不要用正则测试或 `trim` 比较替换 `0x7b` 快速拒绝 — 字节级检查是最便宜的过滤器。
- 保持访问者闭包为纯同步。异步闭包将强制读取循环进入 `for await`，这在 `fs.openSync` 句柄上比同步分块读取更昂贵，并破坏 `"stop"` 短路。

### 在导入 adapter **之前** Mock `node:os`

`core/mem/internal/paths.ts`（`CLAUDE_PROJECTS`、`CODEX_SESSIONS`、…）中的模块加载常量捕获 `os.homedir()` 一次。Core 测试必须通过 `vi.hoisted` 和 `vi.mock("node:os", ...)` 在 `await import("../../src/mem/adapters/...")` **之前** mock `node:os`。参见 `packages/core/test/mem/adapters.test.ts` 获取规范模式。

### 添加新平台而不更新所有分发器

新平台需要在以下位置更新：

| 位置                                             | 什么                         |
| ------------------------------------------------ | ---------------------------- |
| `MemSourceKind`（`core/mem/types.ts`）            | union member                 |
| `core/mem/sessions.ts:listAll`                   | 调用新的 `*ListSessions`  |
| `core/mem/sessions.ts:extractDialogue`           | switch case                  |
| `core/mem/sessions.ts:searchSession`             | switch case                  |
| `core/mem/projects.ts` `by_platform` aggregation | 新键，默认 `0`     |
| CLI `cmdHelp`                                    | 在 `--platform` 行中提及 |

没有穷尽性检查 — TypeScript 对 `s.platform` 的 `switch` 仅在每个分发器使用显式可区分联合时才会警告未处理的情况，它们确实这样做；在这里信任编译器。

---

## 运行时验证（无 zod）

`core/mem/` **不**使用 `zod` — `@baoanaz/cviauto-core` 保持零依赖接口（参见 `trellis-core-sdk.md`）。外部平台形状被建模为松散的 TypeScript `interface`，每个字段都是可选的，adapter 在使用点通过纯 `typeof` / `Array.isArray` 检查守卫字段。公共域类型位于 `core/mem/types.ts`：

| 类型                                                                 | 域                                                              |
| -------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `MemSourceKind` / `MemSourceFilter`                                  | `"claude" \| "codex" \| "opencode" \| "pi"`（+ 过滤器 `"all"`） |
| `MemSessionInfo`                                                     | 跨平台的统一会话元数据                           |
| `DialogueRole` / `DialogueTurn`                                      | `"user" \| "assistant"` 和清理后的回合                          |
| `SearchExcerpt` / `SearchHit` / `MemSearchMatch` / `MemSearchResult` | 搜索输出                                                       |
| `MemFilter`                                                          | 归一化的跨领域过滤器（CLI 标志转换为此）     |
| `MemContextTurn` / `MemContextResult`                                | 对话上下文窗口输出                                      |
| `BrainstormWindow` / `MemDialogueGroup` / `MemExtractResult`         | 阶段切片输出                                                |
| `MemProjectSummary`                                                  | 项目聚合输出                                          |
| `MemWarning`                                                         | 返回给 CLI 的结构化警告                              |

松散的每平台事件接口（`CodexEvent`、`CodexPayload`、`ClaudeEvent`、…）保持在其 adapter 文件本地。

### 验证规则

- **保持松散**：外部事件接口保持每个字段可选，因此上游格式增加永远不会破坏解析 — 未知字段被简单忽略。
- **在使用点守卫**：在消费字段之前检查 `typeof x === "string"` / `Array.isArray(x)`；永远不要假定形状。
- **保持模式不匹配静默**：`readJsonl` 跳过 `JSON.parse` 失败的行。不要记录每行警告 — 生产会话文件包含合法多样的我们不关心的事件形状（tool_result, errors, telemetry）。仅对调用方应了解的整个操作条件发出结构化 `MemWarning`。

当扩展 `MemSessionInfo`（例如，为新平台添加 `conversation_id` 字段）时，每个 `*ListSessions` 函数必须填充该字段（或为没有它的平台显式保留 undefined）。忘记在平台 A 上填充它而平台 B 却做了，将导致跨平台的输出不一致。

---

## 输出格式化

格式化仅限 CLI — 这些辅助函数位于 `packages/cli/src/commands/mem.ts`，永不在 core 中：

| 辅助函数                          | 用途                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `commands/mem.ts:shortDate`     | `iso.slice(0, 16).replace("T", " ")` — 分钟精度的本地化时间戳 |
| `commands/mem.ts:shortPath`     | 将 `$HOME` 替换为 `~`；未定义时为 `(no cwd)`                              |
| `commands/mem.ts:printSessions` | `cmdList` 共享的表格人类可读转储                                 |

每个子命令支持 `--json`。JSON 输出在结构上是稳定的，是 AI agent 消费 `mem` 输出的契约。CLI 将 core 的 camelCase 结果字段映射到稳定的用户可见 JSON 名称（`platform`、`by_platform`、`parent_id`、`is_hit`、`total_turns`、…）。如果你更改 JSON 输出中的字段名（例如，将 `hit_count` 重命名为 `total_hits`），假设某处有一个 AI 在解析它，并对更改进行版本控制。

---

## 测试约定

测试遵循包边界：纯检索逻辑在 core 中测试，CLI 包装器行为在 CLI 中测试。

Core 测试（`packages/core/test/mem/`）：

| 文件                | 涵盖内容                                                                                                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `helpers.test.ts`   | 过滤 / 清理 / 搜索原语：`inRange`、`inRangeOverlap`、`sameProject`、`stripInjectionTags`、`isBootstrapTurn`、`chunkAround`、`searchInDialogue`、`relevanceScore` |
| `adapters.test.ts`  | 针对合成 JSONL / JSON fixtures 和 mock `os.homedir()` 的每平台 `*ListSessions` / `*ExtractDialogue` / `*Search`                                                   |
| `phase.test.ts`     | `parseTaskPyCommand(sAll)`、`commandFromCodexArguments`、`collectClaudeTurnsAndEvents`、`collectCodexTurnsAndEvents`、`collectPiTurnsAndEvents`、`buildBrainstormWindows`          |
| `cross-day.test.ts` | 跨天会话必须在 `--since` 晚于 `created` 时存活；锁定 `inRangeOverlap` 契约                                                                                  |
| `api.test.ts`       | 公共编排 API（`listMemSessions`、`searchMemSessions`、`readMemContext`、`extractMemDialogue`、`listMemProjects`）返回结构化结果 + 警告           |

CLI 测试（`packages/cli/test/commands/`）：

| 文件                      | 涵盖内容                                                                                                        |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `mem-helpers.test.ts`     | 仅 CLI 辅助函数：`parseArgv`、CLI 标志 → `MemFilter` 转换、`shortDate`、`shortPath`                           |
| `mem-integration.test.ts` | 端到端 `runMem`，带 stdout 捕获、`--json` 输出形状、退出行为、OpenCode 不可用 stderr 通知 |

### Fixture 模式（core adapter 测试）

对 `packages/core/test/mem/` 中任何新的平台解析器测试强制执行：

1. **`vi.hoisted` block**为 `fakeHome` 创建一个 tmpdir。这在模块解析**之前**运行，因此 `core/mem/internal/paths.ts` 的 `os.homedir()` 派生常量捕获假值。
2. **`vi.mock("node:os", ...)`** 保留 `os` API 的其余部分（`tmpdir`、`EOL` 等）— Vitest 本身使用它们。展开 `actual` 并仅覆盖 `homedir`。
3. **`await import("../../src/mem/adapters/...")`** 在 mock 设置**之后**。
4. **每测试 fixture 播种**：将最小 JSONL / JSON 文件写入 `<fakeHome>/.claude/projects/...` 或 `<fakeHome>/.codex/sessions/...`。OpenCode fixture 播种在 0.6.0-beta.4 中不适用 — 读取器是降级的空操作，测试断言「返回空」。
5. **`utimesSync`** 是锚定 `updated` 断言的 `mtime` 的规范方式 — `fs.statSync(file).mtime` 是 adapter 读取的内容。
6. **`afterEach`** 清理自己的 fixture 文件；测试必须在套件内相互隔离。

### 新测试必须涵盖的内容

向 `mem` 添加功能时：

- 新的 core 过滤器 / 清理 / 搜索原语 → `core/test/mem/helpers.test.ts`。
- 新的注入标签 → `helpers.test.ts` `stripInjectionTags` 测试断言标签被移除且与标签相邻的段落完整存活。
- 新平台 → `core/test/mem/adapters.test.ts` 中新的 `*ListSessions` / `*ExtractDialogue` 块，镜像现有的每平台组。
- 涉及过滤的错误修复 → `core/test/mem/cross-day.test.ts` 风格的回归：一个带有已知边界情况的 fixture + 锁定修复的断言。
- 阶段解析器拾取的新 shell-arg / Codex-argument 形式 → `core/test/mem/phase.test.ts` fixture，包含 AI 发出的确切文字（`SMOKE=$(...)`、heredoc 嵌入散文、`argv[]` 数组等），加上对结果窗口计数和 slug 标签的断言。dogfood 案例研究位于 `.trellis/tasks/05-08-mem-phase-slice/` 和 `.trellis/tasks/05-09-mem-phase-multi/` 下。
- 新的 CLI 标志或输出更改 → `mem-helpers.test.ts` 用于解析 + `mem-integration.test.ts` 用于端到端行为。

### 测试不得做的事

- 不要断言人类可读模式下的整个 stdout 块 — 格式会变化（行间距、填充）。改为断言 `--json` 输出。
- 不要在 `fakeHome` 之外写 fixtures。adapter 的路径常量只知道 `HOME` 派生的路径；使用 `os.tmpdir()` 直接进行的测试不会被解析器执行。
- 不要在没有 `node:os` mock 就位的情况下导入 core adapter — 常量将锁定到真正的 `~/.claude` 等，你的测试将要么偶然通过，要么污染开发者的实际会话存储。
- 不要将纯检索断言移到 CLI 套件中。如果 CLI 测试只会在 core 逻辑上执行，请改为在 `packages/core/test/mem/` 中编写。

---

## 公共 API 接口（Public API surface）

### Core — `@baoanaz/cviauto-core/mem`

可复用的检索 API，可由 CLI、守护进程和未来的 SDK 消费者导入。仅在 `/mem` 子路径上暴露 — **不是**根 barrel。

| 导出                                                                                                                                                      | 使用                                                                                        |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `listMemSessions`、`searchMemSessions`、`readMemContext`、`extractMemDialogue`、`listMemProjects`                                                           | 五个编排入口点；全部返回带有 `warnings` 数组的结构化结果 |
| `MemSessionNotFoundError`                                                                                                                                   | 针对未知会话 id 的 `context` / `extract` 的类型化错误                        |
| `MemSessionInfo`、`MemFilter`、`DialogueTurn`、`SearchHit`、`MemSearchResult`、`MemContextResult`、`MemExtractResult`、`MemProjectSummary`、`MemWarning`、… | 输入/输出类型（参见 `core/mem/types.ts`）                                               |

内部 core 模块（`filter.ts`、`search.ts`、`dialogue.ts`、`context.ts`、`phase.ts`、adapter 和 `internal/` 下的所有内容）由 `packages/core/test/mem/**` 直接执行，但**不**是已发布子路径接口的一部分 — CLI 不得深层导入它们。

### CLI — `packages/cli/src/commands/mem.ts`

| 导出                                                       | 使用                                          |
| ------------------------------------------------------------ | -------------------------------------------- |
| `runMem(args)`                                               | 入口点 — `tl mem ...` 调用此   |
| `parseArgv(argv)` 和 CLI 标志 → `MemFilter` 转换 | argv 解析 — 由 `mem-helpers.test.ts` 使用 |
| `shortDate`, `shortPath`                                     | 终端格式化 — 直接测试                        |

CLI 包装器组合 core API，渲染结果，将警告映射到 stderr，发出 OpenCode 不可用通知，并拥有退出代码。

---

## 参考

- `packages/core/src/mem/` — 检索引擎（adapter、搜索、上下文、阶段、项目）
- `packages/core/src/mem/index.ts` — `@baoanaz/cviauto-core/mem` 公共接口
- `packages/cli/src/commands/mem.ts` — CLI 包装器（`runMem`、argv 解析、渲染）
- `packages/core/test/mem/` — core 检索测试（helpers、adapters、phase、cross-day、api）
- `packages/cli/test/commands/mem-helpers.test.ts` — CLI argv / 格式化测试
- `packages/cli/test/commands/mem-integration.test.ts` — 端到端 `runMem`
- `.trellis/tasks/05-14-mem-core-channel-reuse/` — mem-core 提取任务
- `.trellis/tasks/05-08-mem-since-cross-day-filter/` — `inRangeOverlap` 切换的历史背景
- `.trellis/tasks/05-08-mem-phase-slice/` — `--phase` 标志和 `[task.py create, start)` 边界信号的历史背景
