# `package.json` `exports` — 设计双格式、多运行时入口映射

目标读者：发布单个包到 Node（ESM + CJS）、浏览器、边缘 Worker、React Native、Bun 和 Deno 的 TypeScript SDK 作者——具有一个或多个用于插件/适配器的子路径入口。

本文档仅涵盖字段设计。关于*生成*匹配的 `dist/` 产物，请参阅 `tsdown-bundling.md`。关于*验证*形状（`publint`、`attw --pack`），请参阅 `verification-and-publishing.md`。

---

## 1. 为什么 `exports` 很重要

在 Node 12 / TypeScript 4.7 之前，包的入口解析是一团乱麻：`main` 用于 CJS，`module` 用于打包器，`browser` 用于浏览器打包器，`types` 用于 TypeScript，再加上 `typesVersions` 用于子路径。每个工具都实现了稍有不同的回退链。消费者的导入可能静默地落在错误的文件上，导致重复的 React 副本、缺失的源码映射，或 "ReferenceError: require is not defined"。

`exports` 字段，由 [Node 的解析规范](https://nodejs.org/api/packages.html#conditional-exports)定义，现在是唯一的真相来源：

| 消费者 / 工具 | 从 `exports` 中读取什么 |
| --- | --- |
| Node ESM（`import`）          | `"import"` 分支（或 `"node"` 然后 `"import"`） |
| Node CJS（`require`）         | `"require"` 分支（或 `"node"` 然后 `"require"`） |
| TypeScript（`moduleResolution: bundler`、`node16`、`nodenext`） | `"types"` 键——但**仅在匹配的 `import`/`require` 分支内部** |
| Webpack / Rollup / Vite / esbuild | `"browser"` / `"import"` / 自定义用户配置的条件 |
| Cloudflare Workers、Vercel Edge | `"workerd"`、`"worker"`、`"edge-light"` |
| React Native / Metro          | `"react-native"` |
| Deno                          | `"deno"` 然后 `"import"` |
| Bun                           | `"bun"` 然后 `"import"` |
| [`publint`](https://publint.dev) / [`@arethetypeswrong/cli`](https://arethetypeswrong.github.io) | 遍历整个树并验证每个叶子节点 |

如果 `exports` 存在，Node 会**忽略** `main`、`module` 和 `browser` 进行解析（它们仅作为尚未实现 `exports` 的旧工具的回退保留）。它还会阻止深层导入：消费者只能导入 `exports` 白名单中的内容。这是一个特性——它为你提供了一个真正的公共 API 对外接口。

---

## 2. `exports` 条目的结构

```jsonc
"exports": {
  "<subpath>": {
    "<condition>": "<path>" | { ...nested conditions },
    ...
  }
}
```

- **子路径（Subpath）** — 一个以 `"."` 开头的字符串。`"."` 是包根目录；`"./client"` 是 `pkg-name/client`；`"./package.json"` 暴露清单本身；`"./adapters/*"` 是通配符。子路径不能解析到包外部。
- **条件（Condition）** — 一个字符串键，与消费者的*条件集（condition set）*匹配。条件包括 `"import"`、`"require"`、`"types"`、`"node"`、`"browser"`、`"deno"`、`"bun"`、`"worker"`、`"workerd"`、`"edge-light"`、`"react-native"`、`"react-server"`、`"development"`、`"production"`、`"module-sync"`，以及一个始终匹配的 `"default"`。
- **回退规则** — 在单个对象内部，条件按*声明顺序*尝试。**第一个匹配的获胜**，一旦返回叶子字符串，解析器就不再继续查找。这是关于 `exports` 字段最重要的行为事实。

叶子节点可以是一个字符串（包内的相对文件路径）或 `null`（显式禁止一个目标——例如阻止 CJS 意外获取 ESM 文件）。

---

## 3. 捕获 90% `exports` Bug 的五条规则

这些是不可协商的不变式。Linter（`publint`、`attw`）会标记违规。

### 3.1. 规则 1 — `"types"` 必须在每个分支中放在最前面

```jsonc
// 正确
"import": {
  "types": "./dist/index.d.mts",   // <-- 最前面
  "default": "./dist/index.mjs"
}
```

```jsonc
// 错误 — TypeScript 可能在看到 `types` 之前解析 `default`，
// 导致在严格解析器中缺失类型错误。
"import": {
  "default": "./dist/index.mjs",
  "types": "./dist/index.d.mts"
}
```

因为第一个匹配的获胜，如果运行时条件在 `types` 之前匹配，解析器返回一个 `.js` 路径，而 TS 感知的回退永远不会被咨询。（`publint` 规则 [`types-should-be-first-in-conditional-exports`](https://publint.dev/rules)。）

### 3.2. 规则 2 — `"default"` 必须在最后

`"default"` 匹配每个条件集。任何在其之后声明的内容都是不可达的。

```jsonc
// 错误 — `node` 分支永远不会被选中
"import": {
  "default": "./dist/index.mjs",
  "node": "./dist/index.node.mjs"  // 不可达
}
```

### 3.3. 规则 3 — 双包使用独立的 `.d.mts` 和 `.d.cts`（TS 5.0+）

一个单一的 `.d.ts` 文件无法准确描述 ESM 和 CJS 两种形状——它们在 `export =`、`import.meta` 和默认导出互操作上存在差异。产出两个声明文件，并从匹配的分支引用它们：

```jsonc
".": {
  "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
}
```

TypeScript 在消费者端需要 `moduleResolution: "node16" | "nodenext" | "bundler"` 才能遵循这一点。`publint` 在单个声明文件被错误地跨两种格式重用时，会标记 [`types-resolved-through-fallback`](https://publint.dev/rules) 问题。

### 3.4. 规则 4 — 包含 `"./package.json": "./package.json"`

许多工具（Yarn PnP、Rollup、TypeScript `pkg-pr-new` 流程、`attw`）在运行时读取你自己的 `package.json` 以检查 `version`、`peerDependencies` 等。没有显式条目，这些读取会失败并报 `ERR_PACKAGE_PATH_NOT_EXPORTED`。包含它的成本是一行。

### 3.5. 规则 5 — 如果你使用 `"module"` 条件，它必须在 `"require"` 之前

`"module"` 是一个非标准的打包器条件（由 Webpack/Rollup 使用），意思是"即使我通常使用 `require`，也给我 ESM 构建"。将其放在 `"require"` 之前，以便打包器先看到它；Node 忽略 `"module"` 并回退到 `"require"`。现在大多数现代 SDK 完全跳过 `"module"`，因为 `"import"` 已得到普遍支持。

---

## 4. 标准双形状 — tRPC 模式

这是面向 Node 的 SDK 的规范形状，同时提供 ESM 和 CJS，并为每种格式提供独立的声明文件。

```jsonc
// 来自 trpc/trpc @ packages/server/package.json
// https://github.com/trpc/trpc/blob/main/packages/server/package.json
{
  "name": "@trpc/server",
  "type": "module",
  "sideEffects": false,
  "main":    "./dist/index.cjs",       // 不支持 exports 的旧工具的回退
  "module":  "./dist/index.mjs",       // 旧打包器的回退
  "types":   "./dist/index.d.cts",     // TS 4.7 之前的回退
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types":   "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types":   "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./adapters/aws-lambda": {
      "import":  { "types": "./dist/adapters/aws-lambda/index.d.mts", "default": "./dist/adapters/aws-lambda/index.mjs" },
      "require": { "types": "./dist/adapters/aws-lambda/index.d.cts", "default": "./dist/adapters/aws-lambda/index.cjs" }
    },
    "./adapters/express": {
      "import":  { "types": "./dist/adapters/express.d.mts",  "default": "./dist/adapters/express.mjs" },
      "require": { "types": "./dist/adapters/express.d.cts",  "default": "./dist/adapters/express.cjs" }
    },
    "./adapters/fastify": {
      "import":  { "types": "./dist/adapters/fastify/index.d.mts", "default": "./dist/adapters/fastify/index.mjs" },
      "require": { "types": "./dist/adapters/fastify/index.d.cts", "default": "./dist/adapters/fastify/index.cjs" }
    },
    "./adapters/fetch": {
      "import":  { "types": "./dist/adapters/fetch/index.d.mts", "default": "./dist/adapters/fetch/index.mjs" },
      "require": { "types": "./dist/adapters/fetch/index.d.cts", "default": "./dist/adapters/fetch/index.cjs" }
    },
    "./adapters/next-app-dir": {
      "import":  { "types": "./dist/adapters/next-app-dir.d.mts", "default": "./dist/adapters/next-app-dir.mjs" },
      "require": { "types": "./dist/adapters/next-app-dir.d.cts", "default": "./dist/adapters/next-app-dir.cjs" }
    },
    "./adapters/next": {
      "import":  { "types": "./dist/adapters/next.d.mts", "default": "./dist/adapters/next.mjs" },
      "require": { "types": "./dist/adapters/next.d.cts", "default": "./dist/adapters/next.cjs" }
    },
    "./adapters/node-http": {
      "import":  { "types": "./dist/adapters/node-http/index.d.mts", "default": "./dist/adapters/node-http/index.mjs" },
      "require": { "types": "./dist/adapters/node-http/index.d.cts", "default": "./dist/adapters/node-http/index.cjs" }
    },
    "./adapters/standalone": {
      "import":  { "types": "./dist/adapters/standalone.d.mts", "default": "./dist/adapters/standalone.mjs" },
      "require": { "types": "./dist/adapters/standalone.d.cts", "default": "./dist/adapters/standalone.cjs" }
    },
    "./adapters/ws": {
      "import":  { "types": "./dist/adapters/ws.d.mts", "default": "./dist/adapters/ws.mjs" },
      "require": { "types": "./dist/adapters/ws.d.cts", "default": "./dist/adapters/ws.cjs" }
    },
    "./http": {
      "import":  { "types": "./dist/http.d.mts", "default": "./dist/http.mjs" },
      "require": { "types": "./dist/http.d.cts", "default": "./dist/http.cjs" }
    },
    "./observable": {
      "import":  { "types": "./dist/observable/index.d.mts", "default": "./dist/observable/index.mjs" },
      "require": { "types": "./dist/observable/index.d.cts", "default": "./dist/observable/index.cjs" }
    },
    "./rpc": {
      "import":  { "types": "./dist/rpc.d.mts", "default": "./dist/rpc.mjs" },
      "require": { "types": "./dist/rpc.d.cts", "default": "./dist/rpc.cjs" }
    },
    "./shared": {
      "import":  { "types": "./dist/shared.d.mts", "default": "./dist/shared.mjs" },
      "require": { "types": "./dist/shared.d.cts", "default": "./dist/shared.cjs" }
    },
    "./unstable-core-do-not-import": {
      "import":  { "types": "./dist/unstable-core-do-not-import.d.mts", "default": "./dist/unstable-core-do-not-import.mjs" },
      "require": { "types": "./dist/unstable-core-do-not-import.d.cts", "default": "./dist/unstable-core-do-not-import.cjs" }
    }
  }
}
```

为什么它是黄金标准：

- `"type": "module"` 使包内的裸 `.js` 文件默认为 ESM；`.cjs` / `.mjs` 扩展名显式区分双输出。
- 每个条目都遵守规则 1-5：`types` 在最前，`default` 在最后，独立的 `.d.mts` / `.d.cts`，`./package.json` 已导出，没有 `module` 条件。
- 顶层 `main` / `module` / `types` 保留为*双保险*回退，供尚未实现 `exports` 的工具（Jest 29 之前、某些 IDE）使用。
- "unstable-" 前缀的子路径表示私有 API，同时对 monorepo 内的同级包仍然可导入。

---

## 5. 最小 ESM 专用形状 — Vercel AI v7 模式

如果你只面向 Node 20+ 和现代打包器，可以完全跳过 CJS。这将减少一半的构建步骤和一半的声明文件。

```jsonc
// 来自 vercel/ai @ packages/ai/package.json
// https://github.com/vercel/ai/blob/main/packages/ai/package.json
{
  "name": "ai",
  "type": "module",
  "sideEffects": false,
  "main":   "./dist/index.js",
  "types":  "./dist/index.d.ts",
  "source": "./src/index.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./internal": {
      "types":   "./dist/internal/index.d.ts",
      "import":  "./dist/internal/index.js",
      "default": "./dist/internal/index.js"
    },
    "./test": {
      "types":   "./dist/test/index.d.ts",
      "import":  "./dist/test/index.js",
      "default": "./dist/test/index.js"
    }
  },
  "engines": { "node": ">=18" }
}
```

注解：

- 没有 `require` 分支 — CJS 环境中的消费者会得到一个清晰的 `ERR_REQUIRE_ESM`，而不是一个损坏的 ESM require。Node 22.12+ 原生支持 `require(esm)`，所以摩擦正在减少。
- 单个 `.d.ts` 就可以了，因为只有一种运行时格式。`types` 键与 `import` 在同一深度（非嵌套），因为两个分支解析到相同的产物。
- `"./internal"` 是一个有意的逃生阀——semver 不稳定但可导入。
- `"./test"` 提供测试替身（mock streams、fixtures）；消费者的测试可以 `import { simulateReadableStream } from 'ai/test'`。

---

## 6. 用于插件入口点的子路径导出

当你的 SDK 有框架适配器、可选插件或按运行时划分的入口文件时，每个都有自己的子路径。有三种模式：

### 6.1. 扁平枚举子路径（Inngest）

```jsonc
// 来自 inngest/inngest-js @ packages/inngest/package.json
// https://github.com/inngest/inngest-js/blob/main/packages/inngest/package.json
"exports": {
  ".": {
    "types":   { "import": "./index.d.ts",        "require": "./index.d.cts" },
    "import":  "./index.js",
    "require": "./index.cjs"
  },
  "./astro":      { "types": { "import": "./astro.d.ts",      "require": "./astro.d.cts" },      "import": "./astro.js",      "require": "./astro.cjs" },
  "./bun":        { "types": { "import": "./bun.d.ts",        "require": "./bun.d.cts" },        "import": "./bun.js",        "require": "./bun.cjs" },
  "./cloudflare": { "types": { "import": "./cloudflare.d.ts", "require": "./cloudflare.d.cts" }, "import": "./cloudflare.js", "require": "./cloudflare.cjs" },
  "./edge":       { "types": { "import": "./edge.d.ts",       "require": "./edge.d.cts" },       "import": "./edge.js",       "require": "./edge.cjs" },
  "./express":    { "types": { "import": "./express.d.ts",    "require": "./express.d.cts" },    "import": "./express.js",    "require": "./express.cjs" },
  "./fastify":    { "types": { "import": "./fastify.d.ts",    "require": "./fastify.d.cts" },    "import": "./fastify.js",    "require": "./fastify.cjs" },
  "./h3":         { "types": { "import": "./h3.d.ts",         "require": "./h3.d.cts" },         "import": "./h3.js",         "require": "./h3.cjs" },
  "./next":       { "types": { "import": "./next.d.ts",       "require": "./next.d.cts" },       "import": "./next.js",       "require": "./next.cjs" },
  "./remix":      { "types": { "import": "./remix.d.ts",      "require": "./remix.d.cts" },      "import": "./remix.js",      "require": "./remix.cjs" },
  "./sveltekit":  { "types": { "import": "./sveltekit.d.ts",  "require": "./sveltekit.d.cts" },  "import": "./sveltekit.js",  "require": "./sveltekit.cjs" },
  "./hono":       { "types": { "import": "./hono.d.ts",       "require": "./hono.d.cts" },       "import": "./hono.js",       "require": "./hono.cjs" }
  // ... 20+ 个更多适配器
}
```

为什么有趣：Inngest 展示了"按条件分类的类型"倒置布局——`types` 是*外层*键，`import`/`require` 嵌套在*内部*。这种形状与 tRPC 形状等效（TS 按消费者模式看到正确的 `.d.ts`），但自上而下按关注点（类型 | 运行时）阅读。两者都是有效的；`publint` 接受任何一种，只要 `types` 在任何匹配链中首先被遇到。

Hono 遵循相同的扁平枚举方法，具有更多条目（约 120 个子路径）——每个中间件（`./cors`、`./jwt`、`./logger`、`./cache`、`./csrf`……）和每个预设都是其自己的可导入条目。每个插件获得一个专用的 `dist/cjs/...` 镜像，以便 require 分支始终落在 `.js` 文件上（不是 `.cjs`——Hono 使用无扩展名 ESM，并为 require 提供同级 `dist/cjs/`）。参见 `tsdown-bundling.md` 了解匹配的构建端配置。

### 6.2. 通配符子路径（Zustand）

```jsonc
// 来自 pmndrs/zustand @ package.json
// https://github.com/pmndrs/zustand/blob/main/package.json
"exports": {
  "./package.json": "./package.json",
  ".": {
    "react-native": { "types": "./index.d.ts",       "default": "./index.js" },
    "import":       { "types": "./esm/index.d.mts",  "default": "./esm/index.mjs" },
    "default":      { "types": "./index.d.ts",       "default": "./index.js" }
  },
  "./*": {
    "react-native": { "types": "./*.d.ts",       "default": "./*.js" },
    "import":       { "types": "./esm/*.d.mts",  "default": "./esm/*.mjs" },
    "default":      { "types": "./*.d.ts",       "default": "./*.js" }
  }
}
```

`"./*"` 模式允许消费者 `import { shallow } from 'zustand/shallow'` 而无需枚举每个中间件。左侧的 `*` 捕获一个路径段；右侧的 `*` 被替换到每个目标中。这对具有许多小模块的库来说很棒，但有一些权衡：

- `dist/` 内的每个文件都变为可公开导入——你的私有内部实现会泄露，除非你通过 `files` 或更受约束的模式（`./middleware/*` 而不是 `./*`）排除它们。
- `attw --pack` 无法枚举通配符条目，因此验证器的覆盖率是部分的。

出于这些原因，大多数 SDK 作者更喜欢枚举（Inngest、tRPC、Hono）而不是通配符（Zustand）。

### 6.3. 按运行时拆分子路径

当单个插件需要按运行时使用不同的代码时（例如 `./cloudflare` 使用 `caches.default`，`./node` 使用 `node:fs`），每个都赋予自己的子路径，让用户选择。不要试图在*单个子路径内部*表达运行时分支，除非实现是微小的垫片（shim）——关于何时使用运行时条件，请参见第 7 节。

---

## 7. 同构条件 — Sanity Client 模式

当*相同*的导入（`@sanity/client`）必须按运行时解析到不同的代码时——浏览器使用 `fetch`，Node 使用 `http`，边缘使用无 keepalive 的 Fetch——在单个子路径内使用运行时条件：

```jsonc
// 来自 sanity-io/client @ package.json
// https://github.com/sanity-io/client/blob/main/package.json
"exports": {
  ".": {
    "source":           "./src/index.ts",
    "browser": {
      "source":  "./src/index.browser.ts",
      "import":  "./dist/index.browser.js",
      "require": "./dist/index.browser.cjs"
    },
    "react-native": {
      "import":  "./dist/index.browser.js",
      "require": "./dist/index.browser.cjs"
    },
    "sanity-function": "./dist/index.browser.js",
    "react-server":    "./dist/index.browser.js",
    "bun":             "./dist/index.browser.js",
    "deno":            "./dist/index.browser.js",
    "edge":            "./dist/index.browser.js",
    "edge-light":      "./dist/index.browser.js",
    "worker":          "./dist/index.browser.js",
    "import":          "./dist/index.js",
    "require":         "./dist/index.cjs",
    "default":         "./dist/index.js"
  },
  "./csm": {
    "source":  "./src/csm/index.ts",
    "import":  "./dist/csm.js",
    "require": "./dist/csm.cjs",
    "default": "./dist/csm.js"
  },
  "./stega": {
    "source":  "./src/stega/index.ts",
    "browser": {
      "source":  "./src/stega/index.ts",
      "import":  "./dist/stega.browser.js",
      "require": "./dist/stega.browser.cjs"
    },
    "import":  "./dist/stega.js",
    "require": "./dist/stega.cjs",
    "default": "./dist/stega.js"
  },
  "./media-library": {
    "source":  "./src/media-library.ts",
    "import":  "./dist/media-library.js",
    "require": "./dist/media-library.cjs",
    "default": "./dist/media-library.js"
  },
  "./package.json": "./package.json"
}
```

对于根条目 `.`，以第一个匹配获胜的语义，读取顺序如下：

1. 条件集中带有 `"source"` 的打包器（某些插件管道）看到原始 TS。
2. 浏览器打包器匹配 `"browser"`——嵌套的 `import`/`require` 在浏览器构建中选择 ESM 还是 CJS。
3. React Native 的 Metro 匹配 `"react-native"`。
4. Sanity Functions 运行时匹配 `"sanity-function"`。
5. React Server Components 匹配 `"react-server"`（相同的浏览器包可以工作，因为 RSC 没有仅 Node 的 API）。
6. Bun、Deno、Edge（Vercel/Cloudflare）、Workers 都匹配各自的相应条件并获得浏览器包。
7. 只有在*每个*备用运行时被排除后，Node ESM（`import`）才获得 `./dist/index.js`，Node CJS（`require`）获得 `./dist/index.cjs`。

这是规范的*同构（isomorphic）*形状。几个纪律要点：

- **最具体的运行时放在最前面。** `"react-server"` 和 `"workerd"` 比 `"browser"` 更具体；将它们放在更前面。`"node"` 是后端的总括，放在接近末尾。
- **`"default"` 始终在最后。** 注意 Sanity 对 `default` 使用 `"./dist/index.js"`（匹配 ESM `import`）——这保护了不发送特定条件的 Deno 风格消费者。
- **`"source"` 是非官方的**，但被 Metro、一些 Vite 插件和 `tsup` 的开发管道广泛用于映射回 TS。包含是安全的；省略也是安全的。

### 7.1. 条件匹配速查表

| 运行时 / 工具 | 呈现的条件（按顺序） |
| --- | --- |
| Node 20+ ESM        | `node`、`import`、`module-sync`*、`default` |
| Node 20+ CJS        | `node`、`require`、`default` |
| Cloudflare Workers（Wrangler） | `workerd`、`worker`、`browser`、`import`、`default` |
| Vercel Edge Runtime | `edge-light`、`worker`、`browser`、`import`、`default` |
| Bun                 | `bun`、`node`、`import`、`default` |
| Deno（npm:）         | `deno`、`node`、`import`、`default` |
| React Native（Metro）| `react-native`、`browser`、`import`、`default` |
| Vite（SSR）          | `node`、`import`、`default` |
| Vite（client）       | `browser`、`import`、`default` |
| Webpack 5（web）     | `browser`、`module`、`import`、`default` |
| Webpack 5（node）    | `node`、`module`、`import`、`default` |
| Next.js RSC server  | `react-server`、`node`、`import`、`default` |
| TypeScript          | `types`（加上根据 `module` 设置匹配的运行时条件） |

\* `module-sync` 仅在消费者是 CJS 且包选择加入时呈现——参见第 8 节。

---

## 8. `module-sync` 和其他现代条件

Node 22.10 引入了 [`module-sync`](https://nodejs.org/api/packages.html#conditional-exports)，这个条件旨在让 CJS 消费者同步 `require()` 一个 ESM 模块，当且仅当该模块没有顶层 `await`。模式：

```jsonc
".": {
  "import":      { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "module-sync": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "require":     { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
}
```

你应该采用它吗？在 2026 年底，这个公式是：

- **是的，如果**你已经同时提供 ESM+CJS，并且你的 ESM 构建没有顶层 `await`。它多花费一个额外的键，让 Node 22.12+ 消费者跳过 CJS 往返——对冷启动敏感的工作负载很重要。
- **不，如果**你是纯 ESM——`require(esm)` 在 Node 22.12+ 上无需 `module-sync` 即可工作，更早的版本也无法使用该功能。
- **如果不确定则跳过**——生态系统的其余部分（打包器、旧版 Node）会优雅地忽略 `module-sync`。

其他值得了解的现代条件：

- `"development"` / `"production"` — 门控构建；React、Preact、MobX 使用这些进行仅限开发环境的警告。在 SDK 中较少见。
- `"react-server"` — Next.js / React 19 RSC 标记。如果你的包有一个使用 `React.cache`、`next/headers` 等的仅服务器入口，则设置此项。
- `"workerd"` — Cloudflare Workers 的 V8 隔离运行时（特别是 `workerd`，Wrangler 下的开源运行时）。比 `"worker"` 更具体。
- `"edge-light"` — Vercel 用于 Edge Functions 和 Edge Middleware 的标志。由 `next/server`、`vercel` 使用。

---

## 9. 常见错误 — 糟糕 → 修复 → 原因

### 9.1. 错误的条件顺序

```jsonc
// 糟糕
".": {
  "default": "./dist/index.mjs",
  "node":    "./dist/index.node.mjs",
  "browser": "./dist/index.browser.mjs"
}
```

```jsonc
// 修复后
".": {
  "browser": "./dist/index.browser.mjs",
  "node":    "./dist/index.node.mjs",
  "default": "./dist/index.mjs"
}
```

原因：第一个匹配获胜意味着 `default` 短路了在其之后声明的所有内容。将特定运行时放在最前面，`default` 放在最后。

### 9.2. 伪装 ESM（CJS 包中的 `.js` 包含 ESM）

```jsonc
// 糟糕 — 没有 "type": "module" 的包，但 .js 中包含 ESM 内容
{
  "exports": { ".": { "import": "./dist/index.js" } }   // <-- .js，不是 .mjs
  // "type" 缺失，默认为 "commonjs"
}
// 结果：Node 将 ./dist/index.js 视为 CJS，解析器在 `import` 语句上失败。
```

```jsonc
// 修复后 — 要么：
{ "type": "module", "exports": { ".": { "import": "./dist/index.js" } } }
// 或者：
{ "exports": { ".": { "import": "./dist/index.mjs" } } }
```

原因：Node 的解析器模式由*最近的 `package.json` 的 `"type"` 字段*决定，而不是由 `exports` 内的文件路径决定。`attw` 将此标记为 `FalseESM` / `FalseCJS`。

### 9.3. 缺少 `node10` 类型回退

```jsonc
// 糟糕 — 使用 `moduleResolution: "node"`（旧风格）的 TS 看不到类型
{
  "exports": { ".": { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" } } }
}
// 结果：使用 `moduleResolution: node` 的消费者得到 "Could not find a declaration file."
```

```jsonc
// 修复后 — 添加顶层 `types` 作为旧版回退
{
  "types":   "./dist/index.d.ts",
  "exports": { ".": { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" } } }
}
```

原因：`moduleResolution: "node"`（TS 4.7 之前的默认值）不读取 `exports`；它回退到顶层 `types`/`typings` 字段。同时保留两者——`exports` types 用于现代 TS，顶层 `types` 用于旧版。

### 9.4. 来自 `exports` 前时代的过时 `typesVersions`

```jsonc
// 糟糕 — typesVersions 重复并矛盾于 exports
{
  "exports": { "./plugin": { "types": "./dist/plugin.d.ts", "import": "./dist/plugin.js" } },
  "typesVersions": { "*": { "plugin": ["./dist/plugin/legacy.d.ts"] } }   // 矛盾！
}
```

```jsonc
// 修复后 — 一旦 exports 覆盖了每个子路径，就删除 typesVersions
{
  "exports": { "./plugin": { "types": "./dist/plugin.d.ts", "import": "./dist/plugin.js" } }
}
```

原因：`typesVersions` 是 4.7 之前的变通方案，用于解决"TypeScript 无法找到子路径导入的类型"。如果你的 `exports` types 放置正确，它现在是多余的。仅当你必须支持 TS < 4.7 时才保留 `typesVersions`。

### 9.5. 忘记 `./package.json`

```jsonc
// 糟糕 — Yarn PnP、attw、pkg-pr-new 都失败并报 ERR_PACKAGE_PATH_NOT_EXPORTED
{ "exports": { ".": { ... } } }
```

```jsonc
// 修复后
{
  "exports": {
    "./package.json": "./package.json",
    ".": { ... }
  }
}
```

原因：任何以编程方式读取你的 `package.json` 的工具（打印版本、lint peer deps 等）都需要该条目。成本：一行。收益：避免下游消费者在 CI 中出现神秘的解析错误。

### 9.6. 使用 `null` 阻止意外匹配

微妙的情况：如果你的包完全*没有* CJS，显式将 `require` 分支置为 null，以便 CJS 消费者获得清晰的错误，而不是获得 ESM 文件（然后解析失败）：

```jsonc
".": {
  "import":  "./dist/index.mjs",
  "require": null
}
```

如果你这样做*并且*仍然有顶层 `main`，`attw` 会将其标记为 `MissingExportEquals`。决定：要么纯 ESM 且没有 `main`，要么双格式且两个分支都有。

---

## 10. 验证工作流

每次发布前应通过三项本地检查：

1. **使用 Node 手动解析** — 快速冒烟测试，无需安装：

   ```bash
   # 在包根目录内（或 `npm pack && cd <extracted>` 之后）：
   node --conditions=import --print "require.resolve('./dist/index.mjs')"
   node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m)))"
   node -e "console.log(Object.keys(require('./dist/index.cjs')))"
   ```

   如果其中任何一个抛出 `ERR_PACKAGE_PATH_NOT_EXPORTED` 或 `ERR_REQUIRE_ESM`，你的 `exports` 映射是错误的。

2. **在沙箱中进行打包和解包测试** — 确认*已发布的 tarball*（而不仅仅是你的工作区）正确解析：

   ```bash
   npm pack
   mkdir -p /tmp/exports-check && cd /tmp/exports-check
   npm init -y && npm install /path/to/your-pkg-x.y.z.tgz
   node -e "console.log(require('your-pkg'))"
   node --input-type=module -e "import('your-pkg').then(m => console.log(m))"
   ```

3. **运行 `publint` 和 `attw --pack`** — 这些工具遍历 `exports` 的每个叶子节点，按模块模式运行 TS 类型解析模拟，并报告违反第 3 节和第 9 节中规则的违规行为。关于确切的标志、CI 集成以及如何解释每个诊断，请参阅 `verification-and-publishing.md`。

---

## 延伸阅读

- Node.js 文档 — 条件导出：https://nodejs.org/api/packages.html#conditional-exports
- `publint` 规则索引：https://publint.dev/rules
- Are The Types Wrong? FAQ：https://arethetypeswrong.github.io/?p=faq
- 打包 JS 库的现代指南：https://github.com/frehner/modern-guide-to-packaging-js-library
- TypeScript 4.7 发布说明（`exports` `types` 条件）：https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#packagejson-exports-imports-and-self-referencing

关于将 `exports` 映射匹配到实际的 `dist/` 产物，包括如何产出配对的 `.mjs`/`.cjs` 和 `.d.mts`/`.d.cts`，请参阅 `tsdown-bundling.md`。关于发布前验证，请参阅 `verification-and-publishing.md`。