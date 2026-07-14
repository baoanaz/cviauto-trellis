# Trellis Core SDK

> `@baoanaz/cviauto-core` 和 CLI 的包边界和编码规则。

---

## 概述

Trellis 拆分为两个版本锁定的包：

| 包 | 职责 |
|---|---|
| `@baoanaz/cviauto-core` | 可复用领域逻辑、存储原语、归约器、任务 API、channel API 和类型化契约。 |
| `@baoanaz/cviauto` | CLI 参数解析、终端渲染、命令连接、进程退出行为、模板安装、迁移和发布脚本。 |

当某个能力需要与其他集成共享时，CLI 应是一个围绕 core 的薄壳。Core 包必须独立于终端 UX 和 CLI 进程控制。

---

## 包边界（Package boundary）

Core 拥有：

- channel 存储和事件追加/读取辅助函数
- channel 和 thread 状态归约器
- 在 CLI 之外有用的任务记录辅助函数
- 由 CLI、测试和未来 SDK 消费者共享的结构化类型
- 不应依赖于 Commander 或 Chalk 的纯验证和标准化逻辑
- `packages/core/src/mem/` 下的 `mem` 检索域：持久化会话读取器（Claude Code / Codex / OpenCode）、搜索和相关性评分、对话上下文提取、头脑风暴阶段切片和项目聚合

CLI 拥有：

- 命令定义和选项解析（包括 `tl mem` argv 解析）
- 帮助文本和终端输出（包括 `tl mem` 行格式化和 `--json` 塑形）
- 提示、确认、退出代码和 `process.exit`
- `tl mem` 的 OpenCode 不可用 stderr 通知（一个表现关注点，而非 core 关注点）
- 模板复制、自我试用路径、迁移清单应用和 update UX
- 发布脚本和 CI 特定的包编排

当逻辑从 CLI 开始，但被另一个包或嵌入应用需要时，将可复用部分移入 core，仅在 CLI 包中保留 CLI 渲染和选项转换。

---

## 导入规则

CLI 代码必须通过公共导出导入 core：

```ts
import { createChannelStore } from "@baoanaz/cviauto-core/channel";
```

不要深层导入 core 内部：

```ts
// forbidden
import { parseEvent } from "../../core/src/channel/internal/parse-event";
```

Core 公共导出必须在 `packages/core/package.json` 中显式声明。不要暴露通配内部路径。导出条目应提供 `types`、`import` 和 `default` 目标。

### 子路径导出

Core 将域暴露为显式子路径，而不是从一个根 barrel：

```ts
import { createChannelStore } from "@baoanaz/cviauto-core/channel";
import { searchMemSessions } from "@baoanaz/cviauto-core/mem";
```

`mem` 仅作为 `@baoanaz/cviauto-core/mem` 子路径发布。它有意识地**不**从 `@baoanaz/cviauto-core` 根 barrel 重新导出 — 这保持了根 API 小巧，并阻止 `DialogueTurn` / `SearchHit` / `MemFilter` 泄露到根接口中。`mem` 公共 API 是 `listMemSessions`、`searchMemSessions`、`readMemContext`、`extractMemDialogue`、`listMemProjects`，加上它们的输入/输出类型和 `MemSessionNotFoundError`。`packages/core/src/mem/internal/` 下的任何内容（JSONL/path 辅助函数）是私有的，CLI 不得深层导入。

`mem` 域遵循与 core 其余部分相同的 core API 规则：无 `zod`、无 `console.*`、无 `process.exit`。它返回带有 `warnings` 数组的结构化结果；CLI 决定如何展示警告和使用什么退出代码。

---

## Core API 设计

Core API 返回结构化值，并在调用方需要处理失败时抛出类型化、领域特定的错误。

Core API 不得：

- 调用 `process.exit`
- 打印终端输出
- 依赖于 Chalk、Commander、Inquirer 或仅 CLI 的辅助函数
- 直接读取 CLI argv
- 假设当前工作目录，除非 API 契约明确说明

优先选择小的可组合函数，而非一个解析选项、变更存储和格式化输出的函数。CLI 可以为面向用户命令组合各部分。

---

## 存储和状态

状态转换应有一个所有者。

对于 channel 和 thread 工作：

- 事件文件格式属于 core
- 事件追加和序列分配属于 core
- 带键变更重放的持久化幂等性属于 core；带键
  写入必须在追加锁内检查持久化 channel 事件日志，并
  返回原始同种事件而非重复 JSONL 行
- 计算 channel/thread 摘要的归约器属于 core
- CLI 命令调用 core API 并渲染结果

不要在命令文件之间重复 `lastSeq`、事件分类、链接上下文解析或 thread 状态规则。改为添加一个 core 辅助函数，然后从 CLI 使用它。

---

## Channel 运行时基板

Core 拥有可复用的 channel 运行时基板，以便 CLI、外部守护进程
和未来的 SDK 消费者共享一个实现，而不是各自
重新解析 `events.jsonl`、pid 文件和 worker 状态。

Core 拥有：

- worker 生命周期事件 schema（`undeliverable`、`interrupt_requested`、
  `turn_started`、`turn_finished`、`interrupted`）和 `spawned.inboxPolicy`
- `reduceWorkerRegistry` — SOT worker 状态投影（纯函数；仅
  持久化事件，永不使用 pid 文件或收件箱游标）
- `listWorkers` / `watchWorkers` — worker 读取/观察 API
- `probeWorkerRuntime` / `reconcileWorkerLiveness` — 主机本地 pid 文件
  观察，与持久化投影分开；
  `reconcileWorkerLiveness` 默认不进行持久化写入
- `readChannelEvents` 游标分页（`beforeSeq` / `afterSeq` / `limit`）；
  当未设置选项时保留读取全部默认行为
- `watchChannels` + `channelCursorKey` — 跨 channel 扇入，带
  每 channel 游标和动态 channel 发现（project / global 作用域）
- `matchesInboxPolicy` + 投递模式（`classifyDelivery`、
  `DeliveryMode`）— 投递分类
- provider 注入的运行时契约（`WorkerRuntime`、
  `WorkerStartInput`、`WorkerInterruptResult`、…）加上 `spawnWorker`、
  `requestInterrupt` 和 `interruptWorker`

CLI 拥有：Commander argv、终端渲染、退出代码、provider adapter
实现（`WorkerAdapter`）、supervisor 进程启动 / 信号 /
pid 文件细节和 `process.exit`。Core 不得导入 CLI provider
adapter 或 shell 特定进程行为 — `WorkerRuntime` 是
注入的。不要将 `packages/cli/src/commands/channel/supervisor.ts`
整体移入 core。

---

## 构建和 typecheck 契约

新 checkout 没有 `packages/core/dist`。根 `typecheck` 脚本必须在检查 CLI 之前构建 core，以便 TypeScript 可以解析 core 声明。

必需顺序：

```bash
pnpm --filter @baoanaz/cviauto-core build
pnpm --filter @baoanaz/cviauto typecheck
```

发布和 CI 流程必须保持此顺序。仅在开发者之前已本地构建 core 后才能工作的 CLI typecheck 是无效的。

---

## 版本化契约

Core 和 CLI 始终以完全相同的版本一起发布。

开发期间：

- CLI 使用 `workspace:*` 依赖 core。
- Core 和 CLI 可以独立测试。

发布期间：

- `bump-versions.js` 一起更新两个包的版本。
- `verify-packed-cli` 确认 pnpm 在打包的 CLI 产物中将 `workspace:*` 重写为确切的发布版本。
- CI 先发布 core，再发布 CLI。
- CI 验证两个包在公共 npm 上可见。

发布/版本化详情位于 `release-process.md`。

---

## 测试

Core 行为应在 `packages/core` 中测试，当行为可以在没有 CLI 渲染的情况下运行时。CLI 测试应覆盖选项解析、终端输出、命令编排以及与模板/迁移流的集成。

如果 CLI 测试重复了纯 core 测试，将纯断言移到 core，仅在 CLI 测试中保留 CLI 特定行为。

`mem` 是此规则的示范示例：纯检索/搜索/阶段/adapter 测试位于 `packages/core/test/mem/**`，而 `packages/cli/test/commands/mem-*.test.ts` 仅保留 CLI 包装器覆盖 — argv 解析、`--json` 输出形状、退出行为和 OpenCode 警告。