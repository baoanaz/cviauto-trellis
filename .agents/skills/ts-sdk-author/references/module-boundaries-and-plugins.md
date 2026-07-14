# 模块边界与插件

使用本文档来组织 TypeScript SDK 包，使其在代码增长、消费者增多和第三方插件出现时保持一致性。这里的模式适用于任何对外接口范围大于单个函数的 SDK：带有适配器后端的 HTTP 客户端、具有提供者可插拔性的 agent/runtime SDK、带有 broker 驱动的队列库、带有 loader 插件的构建工具等。

本文档重点介绍：

- 保持 TypeScript SDK 可发布（shippable）的四层思维模型
- `src/` 内的 `modules/api/internal` 边界
- 运行时分层和单向依赖方向
- 用于可替换集成的提供者（provider）/适配器（adapter）模式
- 插件扩展模型及其生命周期
- 使用 eslint-plugin-boundaries、dependency-cruiser 和 Turborepo `boundaries` 进行强制执行
- 最常见的边界反模式
- 可在 CI 中运行的验证清单

---

## 1. 概述：四层思维模型

一个旨在被嵌入、扩展和多年版本迭代的 TypeScript SDK 应收敛为恰好四个概念层。其他任何东西在仔细审视后都会归入这四个层之一。

```text
+----------------------------------------------------------+
|  L1  公共 API（Public API）                               |
|      src/api/* 从 src/index.ts 重新导出                   |
|      消费者唯一被允许导入的对外接口。                    |
+----------------------------------------------------------+
|  L2  内部逻辑（Internal Logic）                           |
|      src/internal/*、modules/*/internal/*                |
|      编排、状态机、策略。此处无 SDK 或传输代码。          |
+----------------------------------------------------------+
|  L3  提供者 / 适配器（Providers / Adapters）             |
|      L2 定义的端口（port）的具体实现。                    |
|      由组合根（composition root）导入，而不是由 L2 导入。  |
+----------------------------------------------------------+
|  L4  扩展点（Extension Points）                          |
|      插件合约、注册表、生命周期钩子。                     |
|      第三方添加能力的受支持方式。                          |
+----------------------------------------------------------+
```

**跨四层的关键不变式：**

- L1（公共 API）重新导出 L2 的精简子集以及 L3/L4 的**类型**。它从不重新导出具体适配器。
- L2（内部逻辑）只依赖自己的端口加上共享类型。它不得导入 L3 的具体包或 L1 的 barrel（汇总导出）文件。
- L3（适配器）依赖 L2 端口和外部 SDK。**适配器不得从 `internal/` 导入。**
- L4（扩展点）通过 `PluginContext` 对象访问。插件不得跨入其他插件的内部实现。

如果你只记住一条规则：**层的依赖方向向下；类型可以向上流动；具体代码不得向上。**

### 架构信号指南

当你查看他人的 SDK 源码树时，文件夹名称会告诉你他们旨在使用什么架构：

| 信号 | 暗示 |
|--------|----------|
| `controllers/`、`services/`、`repositories/` | 分层架构（layered architecture） |
| `domain/`、`ports/`、`adapters/` | 六边形架构（hexagonal architecture） |
| `domain/entities/`、`use_cases/`、`infrastructure/` | 整洁架构（clean architecture） |
| `modules/<name>/api` + `internal` | 模块化单体（modular monolith） |

如果你的 `src/` 同时包含以上所有内容却没有文档化的规则，那么边界是偶然的，你正在混用模式。选择一个并重写多余的部分。

---

## 2. `src/` 边界：modules/api/internal

对于大多数 SDK 包，`src/` 内的模块化单体是正确的默认选择。你不需要发布十个包来获得干净的边界。

### 推荐的内部结构

```text
packages/sdk-core/
└── src/
    ├── api/                  # 公共对外接口汇总导出
    │   └── index.ts
    ├── modules/
    │   ├── sessions/
    │   │   ├── api/
    │   │   │   ├── create-session.ts
    │   │   │   ├── load-session.ts
    │   │   │   └── index.ts
    │   │   ├── internal/
    │   │   │   ├── session-reducer.ts
    │   │   │   ├── session-store.ts
    │   │   │   └── state.ts
    │   │   └── index.ts
    │   ├── execution/
    │   │   ├── api/
    │   │   ├── internal/
    │   │   └── index.ts
    │   └── tools/
    │       ├── api/
    │       ├── internal/
    │       └── index.ts
    ├── internal/             # 包级内部实现（不可触碰）
    ├── shared/               # 本地跨领域辅助工具
    └── index.ts              # 顶层公共汇总导出
```

### 文件夹语义

| 文件夹 | 用途 |
|--------|---------|
| `src/api/` | 精选的公共导出。消费者的入口点。 |
| `src/index.ts` | 从 `src/api/` 重新导出。`package.json` 的 `"exports"` 指向的唯一文件。 |
| `src/internal/` | 包作用域私有工具。永不重新导出。 |
| `src/modules/<name>/api/` | 模块作用域公共函数；同级模块在此导入。 |
| `src/modules/<name>/internal/` | 一个模块的实现细节。**其他模块不得从此处导入。** |
| `src/modules/<name>/index.ts` | 模块汇总导出；仅重新导出其自身的 `api/`。 |
| `src/shared/` | 尚未值得提升为包的本地辅助工具。 |

### Barrel 文件（汇总导出文件）：它们是什么以及为什么重要

**Barrel 文件** 是一个 `index.ts`，其唯一职责是重新导出同级文件中的选定符号。Barrel 作为守门人：任何未被重新导出的内容，按约定，即为私有。

```ts
// src/modules/sessions/index.ts
export { createSession } from "./api/create-session";
export { loadSession } from "./api/load-session";
// 注意：不重新导出 ./internal/ 中的任何内容。
```

```ts
// src/api/index.ts（包级公共对外接口）
export { createSession, loadSession } from "../modules/sessions";
export { runTask } from "../modules/execution";
export type { Session, SessionId, TaskResult } from "../shared/types";
// 适配器具体类不在此处重新导出。
// 仅重新导出适配器 *接口*。
export type { ModelPort, ToolRegistryPort } from "../ports";
```

```ts
// src/index.ts（根 barrel）
export * from "./api";
```

然后在 `package.json` 中：

```json
{
  "name": "@acme/sdk-core",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

`"exports"` 中的单个条目意味着消费者只能 `import { ... } from "@acme/sdk-core"`。像 `@acme/sdk-core/src/internal/...` 这样的深层导入会被模块解析器阻止。这是你能买到的最便宜、最强大的边界。

### 公共 API 规则

**模块仅通过公共 API 通信，从不通过导入内部文件。**

良好：

```ts
import { createSession } from "../sessions/api";
import { executeTurn } from "../execution";
```

糟糕：

```ts
import { reduceSessionState } from "../sessions/internal/session-reducer";
import { buildToolCall } from "../tools/internal/build-tool-call";
```

糟糕的模式创建了隐藏的依赖，并使未来的提取变得更加困难。TypeScript 会愉快地解析这种导入，这正是你需要一个 lint 规则来禁止它的原因（见第 6 节）。

### 具体模块示例

```ts
// src/modules/sessions/api/create-session.ts
import type { SessionId, SessionState } from "@acme/shared-types";
import { initializeState } from "../internal/state";

export function createSession(id: SessionId): SessionState {
  return initializeState(id);
}
```

```ts
// src/modules/sessions/internal/state.ts
import type { SessionId, SessionState } from "@acme/shared-types";

export function initializeState(id: SessionId): SessionState {
  return {
    id,
    status: "idle",
    history: [],
    metadata: {},
  };
}
```

### 两个边界级别

任何存在于工作区中的 SDK 都有两个不同的边界级别：

1. **包内的模块 API**（`modules/<name>/api` vs `internal` 的划分）
2. **跨工作区的包 API**（`src/api/index.ts` vs `src/internal`）

```text
consumer import
  -> @acme/sdk-core
     -> package public API   (src/api/index.ts)
        -> module public API (src/modules/<name>/api)
           -> internal implementation
```

每个级别暴露的内容比它下面的级别**更少**。如果你的包公共 API 重新导出了本应是模块内部的内容，下次重构将会很痛苦。

### 何时将模块提升为独立包

仅当模块满足以下至少一项时才提升：

- 另一个消费者需要独立使用它
- 它有独立的运行时依赖（例如，原生模块）
- 它需要独立的发布节奏或 semver 合约
- 它足够复杂，以至于隔离的测试/构建是有价值的

不要因为文件夹感觉很庞大就提升。当**所有权和依赖方向**作为包更清晰时再提升。

糟糕的工作区结构：

```text
packages/shared/
├── prompts/
├── types/
├── utils/
├── providers/
└── commands/
```

良好的工作区结构：

```text
packages/shared-types/
packages/prompt-assets/
packages/command-core/
```

`packages/shared/` 巨型包是一个垃圾场；它几乎总是在六个月内产生循环依赖。

---

## 3. 运行时分层

第 2 节中的边界工作是结构性的。本节是关于**依赖方向**：哪一层允许调用哪一层。

### 核心问题

包装外部系统的 SDK 自然会积累各种关注点：

- 请求/响应组装
- 传输调用（HTTP 客户端、模型 SDK、队列 broker）
- 副作用执行（工具调用、文件 I/O、重试）
- 会话/状态持久化
- 输出格式化
- 重试、降级、熔断

如果所有这些都放在面向消费者的入口函数中，SDK 将变得无法演进。

### 推荐的依赖方向

```text
consumer apps
  -> application services      （公共 API 入口点）
    -> core runtime            （编排循环、状态、策略）
      -> ports                 （外部交互的合约）
        -> adapters            （具体实现）
          -> infrastructure    （环境、装配、引导）
```

### 各层拥有什么

| 层 | 拥有 | 不得拥有 |
|-------|------|--------------|
| 消费者对外接口 | 参数、配置对象、显示 | 传输 SDK 代码 |
| 应用服务 | 用户意图入口点（`executeTask`、`listTools`） | 终端渲染、传输 |
| 核心运行时 | 状态机、计划循环、决策规则 | 直接导入供应商 SDK |
| 端口 | 集成的接口合约 | 具体实现 |
| 适配器 | 提供者/工具/存储实现 | 编排策略 |
| 基础设施 | 装配、环境、引导 | 领域决策 |

### 示例运行时布局

```text
packages/sdk-core/
└── src/
    ├── application/
    │   ├── execute-task.ts
    │   ├── resume-session.ts
    │   └── list-tools.ts
    ├── domain/
    │   ├── task-state.ts
    │   ├── execution-policy.ts
    │   └── turn.ts
    ├── ports/
    │   ├── model-port.ts
    │   ├── tool-registry-port.ts
    │   ├── session-store-port.ts
    │   └── prompt-store-port.ts
    ├── adapters/
    │   ├── testing/
    │   └── composition/
    └── index.ts
```

具体提供者包（如 `provider-openai`）位于**此包之外**。编排层只拥有合约和内部策略。

### 核心运行时类型

```ts
export type RunMode = "plan" | "build";

export interface RunTask {
  prompt: string;
  mode: RunMode;
  sessionId?: string;
}

export interface RunResult {
  sessionId: string;
  status: "completed" | "failed" | "interrupted";
  output: string;
  toolCalls: number;
}

export interface RuntimeContext {
  now: () => Date;
  logger: Logger;
  config: RuntimeConfig;
}
```

### 应用服务示例

应用服务是消费者使用的稳定入口点（并通过公共 API barrel 暴露）。

```ts
// src/application/execute-task.ts
import type { ModelPort } from "../ports/model-port";
import type { ToolRegistryPort } from "../ports/tool-registry-port";
import type { SessionStorePort } from "../ports/session-store-port";
import { RunLoop } from "../domain/run-loop";

export interface ExecuteTaskDeps {
  model: ModelPort;
  tools: ToolRegistryPort;
  sessions: SessionStorePort;
  context: RuntimeContext;
}

export async function executeTask(
  task: RunTask,
  deps: ExecuteTaskDeps,
): Promise<RunResult> {
  const loop = new RunLoop(deps.model, deps.tools, deps.sessions, deps.context);
  return loop.run(task);
}
```

消费者调用 `executeTask`。它不知道端口背后是哪个模型 SDK 或工具存储实现。

### 运行时核心示例

```ts
export class RunLoop {
  constructor(
    private readonly model: ModelPort,
    private readonly tools: ToolRegistryPort,
    private readonly sessions: SessionStorePort,
    private readonly context: RuntimeContext,
  ) {}

  async run(task: RunTask): Promise<RunResult> {
    const sessionId = task.sessionId ?? crypto.randomUUID();
    const state = createInitialState(sessionId, task);

    const response = await this.model.generate({
      messages: state.messages,
      tools: this.tools.list(),
    });

    for (const toolCall of response.requestedTools) {
      const result = await this.tools.execute(toolCall);
      state.toolHistory.push({ name: toolCall.name, output: result.output });
    }

    state.finalOutput = response.text;
    await this.sessions.save(state);

    return {
      sessionId,
      status: "completed",
      output: state.finalOutput,
      toolCalls: state.toolHistory.length,
    };
  }
}
```

重点不在于循环的内容。重点在于依赖方向：

- `RunLoop` 只知道端口
- 消费者只知道应用服务
- 适配器知道 SDK 和外部系统

### 组合根（Composition Root）

装配（wiring）属于**一个**地方：

```ts
// src/adapters/composition/build-runtime.ts
import OpenAI from "openai";
import { OpenAIModelAdapter } from "@acme/provider-openai";
import { FileSessionStore } from "@acme/session-store-file";
import { createDefaultToolRegistry } from "@acme/tool-pack-default";
import { executeTask } from "../../application/execute-task";

export async function buildRuntime() {
  const model = new OpenAIModelAdapter(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    process.env.MODEL_ID ?? "gpt-4.1",
  );

  const tools = createDefaultToolRegistry();
  const sessions = new FileSessionStore(process.env.SESSION_DIR ?? ".sessions");

  return {
    executeTask: (task: RunTask) =>
      executeTask(task, {
        model,
        tools,
        sessions,
        context: {
          now: () => new Date(),
          logger: console,
          config: loadRuntimeConfig(),
        },
      }),
  };
}
```

组合根可以导入具体包。核心运行时不得导入。

---

## 4. 提供者 / 适配器模式

适配器的存在是为了让编排层保持供应商无关。

### 端口设计

将端口定义为核心包中的**纯 TypeScript 接口**。保持它们最小化；端口对外接口越小，替换就越容易。

```ts
// src/ports/model-port.ts
export interface ModelRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  tools?: Array<{ name: string; description: string; inputSchema: object }>;
}

export interface ModelResponse {
  text: string;
  requestedTools: Array<{
    name: string;
    input: unknown;
  }>;
}

export interface ModelPort {
  generate(request: ModelRequest): Promise<ModelResponse>;
}
```

```ts
// src/ports/tool-registry-port.ts
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolExecution {
  name: string;
  input: unknown;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

export interface ToolRegistryPort {
  list(): ToolDefinition[];
  execute(call: ToolExecution): Promise<ToolResult>;
}
```

```ts
// src/ports/session-store-port.ts
export interface SessionStorePort {
  save(state: TaskSessionState): Promise<void>;
  load(sessionId: string): Promise<TaskSessionState | null>;
}
```

### 具体适配器

```ts
// packages/provider-openai/src/index.ts
import OpenAI from "openai";
import type { ModelPort, ModelRequest, ModelResponse } from "@acme/provider-contracts";

export class OpenAIModelAdapter implements ModelPort {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const completion = await this.client.responses.create({
      model: this.model,
      input: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      text: completion.output_text ?? "",
      requestedTools: [],
    };
  }
}
```

核心运行时导入 `ModelPort`，而不是 `OpenAIModelAdapter`。

### 用于测试的内存适配器

```ts
export interface Tool {
  definition: ToolDefinition;
  execute(input: unknown): Promise<string>;
}

export class InMemoryToolRegistry implements ToolRegistryPort {
  constructor(private readonly tools: Map<string, Tool>) {}

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  async execute(call: ToolExecution): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, output: `Unknown tool: ${call.name}` };
    }

    return {
      ok: true,
      output: await tool.execute(call.input),
    };
  }
}
```

### 工厂注入（Factory Injection）vs 类层次结构

优先使用**工厂函数（factory functions）**，将端口作为参数接收，而不是继承端口的类层次结构。工厂可组合；继承会困住你。

```ts
export function createSessionService(deps: {
  store: SessionStorePort;
  now: () => Date;
}) {
  return {
    async create(id: string) {
      const session = { id, createdAt: deps.now() };
      await deps.store.save(session);
      return session;
    },
  };
}
```

### 使用假对象（Fakes）进行测试

```ts
const fakeStore: SessionStorePort = {
  async save() {},
  async load() {
    return null;
  },
};

const fixedNow = new Date("2030-01-01T00:00:00Z");
const service = createSessionService({ store: fakeStore, now: () => fixedNow });
```

你永远不需要 mock OpenAI 客户端来测试编排策略。仅这一点就证明了端口间接层的价值。

---

## 5. 插件扩展模型

一个 SDK 通过插件来增长新能力。当插件模型为你提供模块化注册、受控依赖、隔离的故障边界和无需深层导入的扩展时，它**有帮助**。当它变成一个没有合约的魔法加载器时，它**有害**。

### 设计原则

1. **默认封装** — 插件只暴露它注册的内容。
2. **显式依赖** — 在元数据中声明，而非隐式。
3. **仅通过合约共享能力** — 没有跨插件导入。
4. **确定性注册顺序** — 按依赖排序，而非按列表位置。
5. **插件可隔离测试** — 无需启动 SDK。

### 最小插件合约

```ts
export interface SdkPlugin {
  name: string;
  version: string;
  dependsOn?: string[];
  capabilities?: {
    commands?: string[];
    tools?: string[];
    providers?: string[];
  };
  register(ctx: PluginContext): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
```

### 插件上下文（PluginContext）

`PluginContext` 是插件与宿主交互的**唯一**受支持方式。

```ts
export interface PluginContext {
  commands: CommandRegistry;
  tools: ToolRegistry;
  providers: ProviderRegistry;
  config: ConfigStore;
  logger: Logger;
  has(name: string): boolean;
}
```

插件不应直接相互导入。如果两个插件共享状态，它们通过上下文上的注册表（registry）共享。

### 宿主注册表

每个扩展点获得一个注册表。这比一个单一的巨型可变全局映射要好得多。

```ts
export interface CommandRegistry {
  register(name: string, command: CommandHandler): void;
  get(name: string): CommandHandler | undefined;
}

export interface ToolRegistry {
  register(name: string, tool: Tool): void;
  list(): Tool[];
}

export interface ProviderRegistry {
  register(name: string, provider: ModelPort): void;
  get(name: string): ModelPort | undefined;
}
```

### 插件工厂模式

当插件需要宿主配置时使用工厂：

```ts
export interface FilesystemToolPluginOptions {
  rootDir: string;
  readOnly?: boolean;
}

export function filesystemToolPlugin(
  options: FilesystemToolPluginOptions,
): SdkPlugin {
  return {
    name: "tool-filesystem",
    version: "1.0.0",
    register(ctx) {
      ctx.tools.register("read_file", createReadFileTool(options));
      if (!options.readOnly) {
        ctx.tools.register("write_file", createWriteFileTool(options));
      }
    },
  };
}
```

工厂通常比在随机插件文件中进行全局 env 查找更好。

### 依赖声明和注册顺序

一个没有排序规则的插件系统最终会以不明显的方式出现故障。

良好：

```ts
export async function registerPlugins(plugins: SdkPlugin[], ctx: PluginContext) {
  const ordered = topologicalSortByDependency(plugins);

  for (const plugin of ordered) {
    await plugin.register(ctx);
  }
}
```

糟糕：

```ts
for (const plugin of plugins) {
  await plugin.register(ctx);
}
```

糟糕的版本静默地依赖列表顺序，最终变得脆弱。

声明元数据：

```ts
export const openAIProviderPlugin = (): SdkPlugin => ({
  name: "provider-openai",
  version: "1.0.0",
  dependsOn: ["provider-contracts"],
  capabilities: {
    providers: ["openai"],
  },
  register(ctx) {
    ctx.providers.register("openai", buildOpenAIProvider());
  },
});
```

规则：

- 依赖通过**插件名称**声明，而非通过导入
- 保持依赖树浅层
- 对缺失依赖快速失败（fail fast）
- 将循环作为启动错误暴露

### 生命周期钩子顺序

| 顺序 | 钩子 | 用途 |
|-------|------|---------|
| 1 | 宿主调用 `topologicalSortByDependency(plugins)` | 解析顺序 |
| 2 | 每个插件：验证元数据 | 重复名称、缺失依赖 |
| 3 | 每个插件：`register(ctx)` | 声明能力、附加处理程序 |
| 4 | （运行时）调用已注册的处理程序 | 正常运行 |
| 5 | 每个插件：按逆序 `dispose()` | 关闭资源 |

如果插件拥有文件监视器或网络客户端等句柄，给它们 `dispose`。宿主按逆注册顺序关闭插件。

### 自动加载 vs 显式注册

| 策略 | 可预测性 | 灵活性 | 推荐 |
|----------|----------------|-------------|----------------|
| 显式列表 | 高 | 中 | 默认 |
| 清单驱动 | 中高 | 高 | 在核心稳定后使用 |
| 文件系统自动加载 | 低中 | 非常高 | 仅在严格验证下使用 |

显式：

```ts
await registerPlugins(
  [
    coreCommandsPlugin(),
    filesystemToolPlugin({ rootDir: process.cwd(), readOnly: false }),
    openAIProviderPlugin(),
  ],
  ctx,
);
```

清单驱动（包声明其插件入口点）：

```json
{
  "name": "@acme/provider-openai",
  "exports": { ".": "./dist/index.js" },
  "sdkPlugin": {
    "entry": "./dist/plugin.js",
    "tags": ["provider"]
  }
}
```

文件系统自动加载（谨慎使用，在调用 `register` 之前始终验证元数据）：

```ts
const discovered = await discoverPluginsFromDirectory(pluginDir);
await registerPlugins(discovered, ctx);
```

### 能力矩阵

能力矩阵是你发布的表格，让插件作者知道哪些扩展点存在以及哪些是稳定的。

| 能力 | 注册表 | 稳定性 | 备注 |
|------------|----------|-----------|-------|
| `commands` | `CommandRegistry` | 稳定 | 注册时检测名称冲突 |
| `tools` | `ToolRegistry` | 稳定 | 注册时验证输入 schema |
| `providers` | `ProviderRegistry` | 稳定 | 每个 `kind` 一个默认值；否则需要显式名称 |
| `renderers` | `RendererRegistry` | 实验性 | 可能在下个次版本中改变 |
| `hooks:pre-run` | `HookBus` | 稳定 | 按注册顺序运行 |
| `hooks:post-run` | `HookBus` | 稳定 | 按逆序运行 |

**安全 vs 不安全的扩展点：**

- **安全**：具有显式 `register(name, handler)` 的注册表——冲突被检测，类型被强制执行。
- **不安全**：在 `ctx.config` 内修改共享可变状态，对另一个插件的工具进行 monkey-patching。通过合约禁止这些。

### 作用域注册

某些插件应仅影响一个区域。显式地建模作用域：

```ts
ctx.commands.register("x:trace", traceCommand, { scope: "experimental" });
ctx.tools.register("delete_file", deleteFileTool, { scope: "build" });
```

如果作用域很重要但系统没有建模它，用户最终会得到意外的行为。

### 隔离测试

每个插件应可在不启动完整 SDK 的情况下测试。

```ts
import { describe, it } from "node:test";

describe("provider-openai plugin", () => {
  it("registers the openai provider", async (t) => {
    const ctx = createTestPluginContext();
    await openAIProviderPlugin().register(ctx);

    t.assert.ok(ctx.providers.get("openai"));
  });
});
```

需要测试的内容：

- 必需的能力已注册
- 依赖失败是显式的
- 可选能力行为正确
- 没有重复注册的副作用
- 如果插件拥有资源，可以干净地关闭

---

## 6. 模块边界强制

仅依赖记忆和纪律的架构是站不住脚的。在这些失败发生之前就捕获它们：

- 消费者代码导入提供者内部实现
- 核心运行时导入 UI 或 CLI 代码
- 包使用未声明的依赖
- 模块导入同级 `internal/` 文件
- 插件注册顺序静默地中断

### 工具选择

| 工具 | 层 | 捕获什么 |
|------|-------|-----------------|
| TypeScript `paths` + `package.json` 中的 `exports` | 解析器 | 跨包边界的深层导入 |
| `eslint-plugin-boundaries` | 源文件 | 违反标签规则的导入路径 |
| `dependency-cruiser` | 导入图 | 循环、禁止的模块到模块边 |
| Turborepo `boundaries` 字段 | 工作区 | 未声明的包依赖、未标记的交叉 |

你通常需要**至少两层**：`exports`（廉价）加上 `eslint-plugin-boundaries` 或 `dependency-cruiser` 之一（深度）。

### eslint-plugin-boundaries

按目录给你的文件打标签，然后禁止被禁止的边。

```js
// eslint.config.js（flat config）
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "public-api", pattern: "src/api/**" },
        { type: "module-api", pattern: "src/modules/*/api/**" },
        { type: "module-internal", pattern: "src/modules/*/internal/**" },
        { type: "ports", pattern: "src/ports/**" },
        { type: "adapters", pattern: "src/adapters/**" },
        { type: "internal", pattern: "src/internal/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "public-api", allow: ["module-api", "ports"] },
            { from: "module-api", allow: ["module-internal", "ports", "internal"] },
            { from: "module-internal", allow: ["internal", "ports"] },
            { from: "adapters", allow: ["ports", "internal"] },
            { from: "ports", allow: [] },
          ],
        },
      ],
      "boundaries/no-private": ["error", { allowUncles: false }],
    },
  },
];
```

它编码的关键不变式：

- **`module-api` 不得导入同级模块的 `internal/`**
- **`adapters` 可以导入 `ports/` 但永远不能导入 `module-internal/`**
- **`ports/` 是一个 sink：它不导入包内的任何内容**

### dependency-cruiser

当你想要一个**基于图的**视图，而不仅仅是按文件 lint 时，使用此工具。

```json
// .dependency-cruiser.json（摘录）
{
  "forbidden": [
    {
      "name": "no-cross-module-internal",
      "severity": "error",
      "from": { "path": "^src/modules/([^/]+)/" },
      "to":   {
        "path": "^src/modules/(?!\\1)([^/]+)/internal/"
      }
    },
    {
      "name": "ports-have-no-deps",
      "severity": "error",
      "from": { "path": "^src/ports/" },
      "to":   { "pathNot": "^src/ports/|^src/shared/types" }
    },
    {
      "name": "no-circular",
      "severity": "error",
      "from": {},
      "to": { "circular": true }
    }
  ]
}
```

在 CI 中运行：

```bash
depcruise --config .dependency-cruiser.json src
```

### Turborepo `boundaries`

对于具有多个 SDK 包的工作区，在工作区级别的基于标签的规则为你提供了最强的保证，例如 `sdk-core` 永远不会导入 `provider-openai`。

```bash
turbo boundaries
```

给包打标签：

```json
// packages/provider-openai/turbo.json
{ "tags": ["adapter", "provider"] }
```

```json
// packages/sdk-core/turbo.json
{ "tags": ["runtime", "core"] }
```

配置根规则：

```json
{
  "boundaries": {
    "tags": {
      "core": {
        "dependencies": {
          "deny": ["provider", "tool-pack", "cli"]
        }
      },
      "cli": {
        "dependencies": {
          "allow": ["runtime", "command", "shared", "provider", "tool-pack"]
        }
      }
    }
  }
}
```

实用的标签模型：

| 标签 | 含义 |
|-----|---------|
| `cli` | 可执行 shell 或消费者 UI |
| `runtime` | 编排核心 |
| `provider` | 模型/提供者适配器 |
| `tool-pack` | 工具/操作实现 |
| `shared` | 纯共享合约或类型 |
| `command` | 命令注册表或合约 |

最重要的规则通常是：**核心运行时依赖合约，而不是具体提供者或工具包**。

### 依赖声明卫生

一个包必须声明它导入的每个包。

良好：

```json
{
  "name": "@acme/sdk-core",
  "dependencies": {
    "@acme/provider-contracts": "workspace:*",
    "@acme/tool-contracts": "workspace:*",
    "@acme/shared-types": "workspace:*"
  }
}
```

糟糕：导入 `@acme/provider-openai` 而没有声明依赖，或者通过深层相对导入如 `../../packages/provider-openai/src`。

### 耦合启发式指标

在架构漂移之前的轻量级警告信号：

| 指标 | 良好 | 警告 | 糟糕 |
|--------|------|---------|-----|
| 每个模块的扇出 | `<= 5` | `6-10` | `> 10` |
| 循环依赖 | `0` | `1-2` | `> 2` |
| 超过 500 行的文件 | `0` | 低比例 | 常见 |

这些是启发式指标，不是法律。但如果多个警告同时触发，边界正在被侵蚀。

---

## 7. 模式 vs 反模式

### 模式

**Facade 导出。** 一个单独的 `src/index.ts` 从精选的 `src/api/index.ts` 重新导出。消费者无法访问内部实现，因为它们没有被导出。

**工厂注入。** 应用服务将它们的依赖作为 `deps` 对象接收。测试传入假对象（fake）；生产环境传入真实适配器。

**密封接口。** 端口是核心包中的接口。具体类存在于适配器包中。核心从不 `import` 适配器类。

**一个组合根。** 每个具体适配器在恰好一个文件中构造（`build-runtime.ts`）。没有其他东西 `new` 一个 OpenAI 客户端。

**每个扩展点一个注册表。** `CommandRegistry`、`ToolRegistry`、`ProviderRegistry` 是不同的。没有 `globalRegistry` 巨型对象。

**插件上下文作为唯一的宿主句柄。** 插件接收一个 `PluginContext`。它们从不 `import` 另一个插件。

### 反模式

**深层导入内部路径。**

```ts
// 糟糕
import { reducer } from "@acme/sdk-core/dist/internal/sessions/reducer";
```

这在运行时能够工作意味着你的 `package.json` `"exports"` 过于宽松。锁定它。

**将提供者类型泄露到公共 API。**

```ts
// 糟糕：重新导出具体供应商类型
export type { ChatCompletion } from "openai/resources";
```

现在你永远无法在不进行主版本升级的情况下升级 `openai`。

**插件访问内部实现。**

```ts
// 糟糕
import { internalToolRegistry } from "@acme/sdk-core/internal";
```

如果插件可以这样做，那么插件系统就是装饰性的。

**跨模块内部导入。** 使边界变得虚假的最快方式。

**消费者代码拥有运行时逻辑。** 如果消费者的调用代码决定重试策略、工具仲裁或提供者降级，它已经吸收了本应属于 SDK 内部的编排关注点。

**提供者拉入消费者类型。** 适配器不应知道面向用户的标志或终端渲染器对象。

**隐藏的全局单例。** 一个到处被导入的巨型可变注册表。优先使用显式上下文。

**运行时导入具体包。**

```ts
// 糟糕，在 src/domain 或 src/application 内部
import { OpenAIModelAdapter } from "@acme/provider-openai";
```

**导入时隐藏的副作用。**

```ts
// 糟糕
import "./register-everything";
```

插件应通过宿主注册，而不是在导入时修改全局状态。

**插件直接导入其他插件。**

```ts
// 糟糕，在另一个插件内部
import { openAIProviderPlugin } from "@acme/provider-openai";
```

改用依赖声明和共享注册表。

**未验证的自动加载。** 从磁盘加载文件而不验证元数据、版本和依赖顺序，使调试变成猜测。

**边界规则仅存在于文档中。** 如果规则被写了但没有被检查，它就会漂移。

**未标记的包。** 如果包角色是隐式的，边界规则就会变得太弱而无关紧要。

---

## 8. 验证清单

一个小的但有纪律的 CI 序列将保持上述所有内容的诚实性。

### CI 序列

1. 边界检查（Turborepo `boundaries` + eslint-plugin-boundaries + dependency-cruiser）
2. 对变更的包进行类型检查
3. 运行受影响的测试
4. 运行插件隔离测试
5. 运行一个薄层的端到端冒烟测试

```bash
turbo boundaries
turbo run lint test typecheck --filter=...[origin/main]
```

### 导入图检查

特别标记这些模式：

```ts
// 所有这些都应该在 CI 中失败：
import { reducer } from "../sessions/internal/reducer";
import { renderTurn } from "../../apps/cli/src/ui/renderers";
import { OpenAIModelAdapter } from "../../packages/provider-openai/src";
```

### 导出符号审计

对于一个稳定的公共 API，你想要一个已知的、经过审查的导出列表。

```bash
# 快照公共对外接口
npx api-extractor run --local --verbose
```

或者，更简约地，编写一个导入 `@acme/sdk-core` 并断言命名空间键的测试：

```ts
import * as sdk from "@acme/sdk-core";

const expected = new Set(["createSession", "loadSession", "executeTask"]);
const actual = new Set(Object.keys(sdk));

assert.deepEqual(actual, expected);
```

任何意外的导出都会变成一个失败的测试，而不是一个静默的泄露。

### 插件合约合规性

显式测试缺失依赖的行为：

```ts
it("fails clearly when dependency is missing", async (t) => {
  const ctx = createTestPluginContext();

  await t.assert.rejects(
    () => authDependentPlugin().register(ctx),
    /requires database-plugin/,
  );
});
```

测试注册顺序：

```ts
it("registers dependencies before dependents", async (t) => {
  const ordered = topologicalSortByDependency([
    authPlugin(),
    databasePlugin(),
  ]);

  t.assert.equal(ordered[0].name, "database-plugin");
});
```

### 跨包影响规则

| 变更的包 | 同时验证 |
|-----------------|-------------|
| `shared-types` | 所有 typecheck 任务 |
| `provider-contracts` | 核心 + 所有提供者包 |
| `tool-contracts` | 核心 + 所有工具包 |
| `sdk-core` | 消费者应用和与会话相关的适配器 |
| `apps/example` | 仅该应用，除非共享包变更 |

### 冒烟矩阵

| 对外接口 | 验证什么 |
|---------|----------------|
| consumer -> public API | 消费者调用应用服务，而非直接调用传输层 |
| core -> provider | 核心仅使用 `ModelPort` |
| core -> tools | 核心仅使用注册表/合约 |
| plugin load | 确定性顺序 |
| provider swap | 核心测试在使用假提供者时仍然通过 |

### 测试工厂模式

构建可复用的测试夹具，而不是在每个测试中启动完整 SDK。

```ts
export async function buildTestRuntime() {
  const model = new FakeModelAdapter();
  const tools = new InMemoryToolRegistry(new Map());
  const sessions = new InMemorySessionStore();

  return {
    executeTask: (task: RunTask) =>
      executeTask(task, {
        model,
        tools,
        sessions,
        context: {
          now: () => new Date(),
          logger: console,
          config: defaultRuntimeConfig(),
        },
      }),
  };
}
```

如果核心运行时测试需要终端或传输设置，它们可能正在测试错误的层。

### 审查清单（在合并结构性变更之前运行）

- 这个模块能否在不访问 `internal/` 的情况下使用？
- 如果我替换一个提供者包，核心运行时代码是否会改变？
- 如果我移除消费者外壳，核心运行时在测试中是否仍然工作？
- 这是一个模块关注点还是一个新包的关注点？
- 我是否引入了一个实际上隐藏了多个领域的 `shared/` 文件夹？
- 所有包导入是否都在 `package.json` 中声明？
- 是否有来自另一个包 `src/` 的任何导入（深层导入）？
- 是否有任何模块访问同级 `internal/` 文件夹？
- 核心运行时测试能否使用假适配器运行？
- 每个插件能否隔离注册？
- 插件排序是否具有确定性？
- 导出的符号集是否与上次发布相同，或者是有意更新的？
- 边界检查是否是 CI 的一部分，而不仅仅是本地脚本？

如果任何答案是"否"，架构已经开始漂移——在下一个功能在此基础上落地之前修复它。