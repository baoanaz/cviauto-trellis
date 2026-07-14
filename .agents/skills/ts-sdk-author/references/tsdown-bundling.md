# 2026 年打包 TypeScript 库

如何为将发布到 npm 的 TypeScript 库选择并配置打包器（bundler）。TL;DR 是：**使用 `tsdown`**，除非你有特定理由不这样做。本文档解释了为什么，展示了一个真实的工作配置，并调查了替代方案。

本文档的范围是*打包器选择与配置*。它**不**涵盖：

- `package.json#exports` 形状 → 参见 `package-json-exports.md`
- `publint` / `@arethetypeswrong/cli` → 参见 `verification-and-publishing.md`

---

## 1. 为什么库需要打包器

纯粹的 `tsc` 可以用于库——一些成熟的库（Zod、TanStack Query 历史上）证明了这一点。但当你的库不再是简单的时，"仅运行 `tsc`"有实际的代价：

- **多文件输出，未压缩。** `tsc` 每个 `.ts` 产出一个 `.js`。源码中的每个 `import` 在消费时变成运行时的 `require`/`import`。对于一个有 200 个源文件的库，这意味着要通过消费者的打包器进行 200 次往返。
- **发布时没有树摇（tree-shaking）。** `tsc` 会输出你写的所有内容，包括死代码分支。在发布使用之前，带树摇的打包器会移除不可达代码，这样没有打包器的消费者（Deno、Bun 脚本、直接使用 Node ESM）也能受益。
- **没有双输出。** `tsc` 产出 CJS 或 ESM，不是两者。2026 年的库消费者是分裂的：生态系统中一个有意义的部分是纯 ESM，但大量大型应用和工具链仍然是 CJS。提供双格式仍然是礼貌的默认做法。
- **没有源码预处理。** JSX、装饰器、`import.meta.env`、CSS-in-JS——`tsc` 不会转换任何这些。打包器会。
- **没有代码分割/共享代码块。** 当你发布子路径条目（例如 `./plugin`、`./testing`）时，`tsc` 会在每个条目中产出重复的辅助函数。打包器将它们提升到共享代码块中。

反方论点——"让消费者的打包器来做这个"——部分有效，这正是 `zshy`（第 7 节）所主张的情况。但大多数库作者仍然应该打包，因为大多数消费者要么不打包（Node 服务器、脚本、REPL），要么简单打包（零配置 Next.js、Vite 库模式）。

---

## 2. 2026 年的格局

| 工具          | 引擎      | 状态（2026）                                                | 心智份额    | 备注                                                                 |
| ------------- | ----------- | ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------- |
| **tsdown**    | Rolldown    | **活跃，推荐**                                      | 快速上升   | tsup 自己的 README 现在说"请改用 tsdown"                       |
| tsup          | esbuild     | **不再维护**（Egoist 已退出；README 指向 tsdown） | 下降中     | 仍然有效；有大量现有安装量；短期内保持使用是安全的   |
| 仅 `tsc`    | TypeScript  | 稳定，始终有效                                         | 稳定的利基  | 适用于零运行时依赖的工具库（例如纯类型包）      |
| unbuild       | Rollup      | 在 UnJS 内部活跃                                           | 仅 UnJS     | UnJS 本身正在试验 `obuild`（基于 Rolldown 的继任者） |
| tshy          | TypeScript  | 由 isaacs 维护                                         | 利基         | 通过 `tsc` 两次实现双产出；"没有打包器，但生成 `exports`"      |
| zshy          | TypeScript  | 活跃（被 Zod 4 使用）                                       | 利基，上升 | "tsc + 扩展名重写 + 自动生成 `exports`"                |
| rolldown      | Rolldown    | 稳定，但更加底层                                      | 打包器构建者 | 仅当 tsdown 的抽象妨碍你时直接使用         |

推动这一结论的具体信号：

- tsup 自己的 GitHub README（逐字引用）：*"This project is not actively maintained anymore. Please consider using `tsdown` instead. Read more in the migration guide."* 来源：`github.com/egoist/tsup/blob/main/README.md`。
- tRPC 将 `packages/server` 迁移到 tsdown（参见第 4 节的逐字配置）。
- Inngest 将 `packages/inngest` 迁移到 tsdown。
- tsdown 由 VoidZero（Vite/Rolldown 组织）发布，因此它与 Vite 生态系统工具的长远对齐是结构性的，不是巧合。

---

## 3. 推荐：tsdown

**tsdown 是 2026 年的正确默认选择。**

- **引擎。** 基于 [Rolldown](https://rolldown.rs)，Rollup 的 Rust 重写版本。速度与 esbuild 相当，但具有 Rollup 的插件模型和更优的代码分割启发式算法。
- **为库设计。** tsup 是"打包一个 Node CLI"，tsdown 是"发布一个 npm 包"。默认值是库形状的：`dts: true`，双产出，`target: 'node18'`，源码映射默认关闭，直到你要求。
- **零配置基线。** 仅有 `src/index.ts` 和一个声明条目的 `package.json`，`npx tsdown` 就能产出正确的双输出。
- **一流的 `outExtensions`。** 与旧工具不同，tsdown 理解 `.mjs` 文件需要 `.d.mts` 声明，`.cjs` 文件需要 `.d.cts`。这对于通过 `@arethetypeswrong/cli` 检查很重要。
- **AI 感知文档。** tsdown.dev 发布 `/guide.md`（同一页面的 markdown 优化版本），专为 LLM 消费者。文档导航字面上写着 "Are you an LLM? You can read better optimized documentation at /guide.md"。
- **从 tsup 迁移的路径。** tsdown 提供了一个 `migrate-from-tsup` 指南，并按原样接受大多数 tsup 选项。

结论：**对新库使用 tsdown；当你下次接触现有 tsup 配置时迁移到 tsdown。**

---

## 4. 一个有效的 `tsdown.config.ts`

逐字引用自 `github.com/trpc/trpc`，`packages/server/tsdown.config.ts`（撰写时的 `main` 分支提交）：

```ts
import { defineConfig } from 'tsdown';

export const input = [
  'src/adapters/aws-lambda/index.ts',
  'src/adapters/express.ts',
  'src/adapters/fastify/index.ts',
  'src/adapters/fetch/index.ts',
  'src/adapters/next-app-dir.ts',
  'src/adapters/next.ts',
  'src/adapters/node-http/index.ts',
  'src/adapters/standalone.ts',
  'src/adapters/ws.ts',
  'src/http.ts',
  'src/index.ts',
  'src/observable/index.ts',
  'src/rpc.ts',
  'src/shared.ts',
  'src/unstable-core-do-not-import.ts',
];

export default defineConfig({
  target: ['node18', 'es2017'],
  entry: input,
  dts: {
    sourcemap: true,
    tsconfig: './tsconfig.build.json',
  },
  // unbundle: true,
  format: ['cjs', 'esm'],
  outExtensions: (ctx) => ({
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
  onSuccess: async () => {
    const start = Date.now();
    const { generateEntrypoints } = await import(
      '../../scripts/entrypoints.js'
    );
    await generateEntrypoints(input);
    console.log(`Generated entrypoints in ${Date.now() - start}ms`);
  },
});
```

来源：`https://github.com/trpc/trpc/blob/main/packages/server/tsdown.config.ts`

作为对比，Inngest SDK 配置——相同工具，非常不同的理念（注意 `unbundle: true`）：

```ts
// github.com/inngest/inngest-js/blob/main/packages/inngest/tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "src/astro.ts",
    "src/bun.ts",
    "src/cloudflare.ts",
    "src/connect.ts",
    "src/deno/fresh.ts",
    "src/digitalocean.ts",
    "src/edge.ts",
    "src/express.ts",
    "src/fastify.ts",
    "src/h3.ts",
    "src/hono.ts",
    "src/index.ts",
    "src/koa.ts",
    "src/lambda.ts",
    "src/next.ts",
    "src/nitro.ts",
    "src/node.ts",
    "src/nuxt.ts",
    "src/react.ts",
    "src/remix.ts",
    "src/sveltekit.ts",
    "src/types.ts",
    "src/components/connect/strategies/workerThread/runner.ts",
    "!src/test/**/*",
    "!src/**/*.test.*",
  ],
  format: ["cjs", "esm"],
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  target: "node20",
  platform: "neutral",
  sourcemap: true,
  failOnWarn: true,
  minify: false,
  report: true,
  unbundle: true,            // 逐文件转译，不分块
  copy: ["package.json", "LICENSE.md", "README.md", "CHANGELOG.md"],
  skipNodeModulesBundle: true,
});
```

值得了解的关键选项（来自 `tsdown.dev/reference/api/Interface.UserConfig.md`）：

| 选项           | 作用                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `entry`          | 源入口点的数组（或对象）。支持 glob；`!` 排除。            |
| `format`         | `'esm'`、`'cjs'`，或两者。驱动 `outExtensions`。                            |
| `outExtensions`  | 返回每种格式的 `{ js, dts }` 的函数。ATTW 清洁双格式所必需。    |
| `dts`            | `true` 表示布尔值，或对象：`{ sourcemap, tsconfig, isolatedDeclarations }`。 |
| `sourcemap`      | 布尔值 / `'inline'` / `'hidden'`。默认关闭。                            |
| `treeshake`      | 默认 `true`。传入对象进行高级调优。                           |
| `clean`          | 构建前清空 `outDir`。默认 `false`。在 CI 中设为 `true`。                |
| `external`       | 正则 / glob / 数组 — 保持导入不被解析（peer deps、运行时 deps）。     |
| `platform`       | `'node'` / `'browser'` / `'neutral'`。更改默认的外部依赖和垫片。      |
| `target`         | `'node18'`、`'es2022'` 等。降低 = 更多转译。                   |
| `unbundle`       | 为 true 时，每个输入文件一个输出文件。禁用分块。                 |
| `report`         | 构建后打印每个代码块的大小表。                                       |

一个新项目的第一个配置可以小得多：

```ts
// tsdown.config.ts — 最小双产出库
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtensions: (ctx) => ({
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
  }),
});
```

来源：由 `tsdown.dev/guide/getting-started` 和 `tsdown.dev/options/output-format` 组合而成。

---

## 5. 打包器生成的子路径输出

当你列出多个条目时，tsdown 在 `outDir` 下保留源相对路径：

```
src/index.ts           ->  dist/index.{mjs,cjs}      dist/index.d.{mts,cts}
src/plugin/index.ts    ->  dist/plugin/index.{mjs,cjs}
src/testing/index.ts   ->  dist/testing/index.{mjs,cjs}
src/adapters/node.ts   ->  dist/adapters/node.{mjs,cjs}
```

首次构建后验证形状：

```bash
$ npx tsdown
$ find dist -maxdepth 3 -name '*.mjs' -o -name '*.cjs' -o -name '*.d.*ts' | sort
```

这些磁盘上的文件成为你的 `package.json#exports` 的目标。该字段的确切形状——包括 `types` 排序、`import`/`require` 条件和通配符子路径——在 **`package-json-exports.md`** 中介绍。从这一端，你只需要知道哪些文件存在。

要避免的两个反模式：

- **不要发布 `dist/index.js` 并让消费者选择。** 模糊的 `.js` 扩展名迫使消费者 Node 根据最近的 `package.json#type` 猜测。ATTW 会失败。始终使用 `.mjs` / `.cjs`。
- **不要将 `.d.ts` 与双格式 `.mjs`/`.cjs` 放在一起。** TypeScript 为两者解析 `.d.ts`，这会谎报运行时形状。使用 `.d.mts` 和 `.d.cts`。

---

## 6. 替代方案：tsup（仍然常见但在下降）

**它是什么。** tsdown 的前身，也由 Egoist 开发。esbuild 驱动，对 CLI 零配置。曾是 2021 年到 2025 年的事实标准。

**配置片段**（典型库形状）：

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/plugin/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
```

来源：`tsup.egoist.dev/#configuration-file`。

**优点。**

- 巨大的现有安装量——你使用的许多库仍然在 tsup 上。
- esbuild 快速且经过实战考验。
- 大量的 Stack Overflow / 博客答案；LLM 非常了解它。

**缺点。**

- `github.com/egoist/tsup` 的 README 明确声明该项目不再维护。
- `.d.ts` 生成依赖于一个单独的路径，历史上一直是围绕 `outExtension` 的 ATTW 失败的来源。
- esbuild 的树摇很好，但对于具有深层重新导出的库来说不是 Rollup 级的。

**结论。** 不要在新库上使用 tsup。对于现有库：当你下次接触构建配置时迁移——迁移通常只需 5-15 行 diff。

**迁移路径（tsup → tsdown），概览：**

```diff
- import { defineConfig } from 'tsup';
+ import { defineConfig } from 'tsdown';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
-   outExtension: ({ format }) => ({
+   outExtensions: (ctx) => ({
-     js: format === 'cjs' ? '.cjs' : '.mjs',
+     js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
+     dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    }),
  });
```

完整迁移指南：`tsdown.dev/guide/migrate-from-tsup`。

---

## 7. 替代方案：仅 tsc / zshy（无打包器）

**它是什么。** 完全跳过打包。运行 `tsc`（或运行两次 `tsc` 以支持双格式）。像 `zshy` 和 `tshy` 这样的工具通过扩展名重写和 `exports` 生成对此进行了包装。

**zshy 配置**（在 `package.json` 中，没有单独的配置文件）：

```jsonc
// package.json
{
  "name": "my-pkg",
  "type": "module",
  "scripts": { "build": "zshy" },
  "zshy": {
    "exports": {
      ".": "./src/index.ts",
      "./utils": "./src/utils.ts",
      "./plugins/*": "./src/plugins/*",
      "./components/**/*": "./src/components/**/*"
    }
  },
  "devDependencies": { "zshy": "^1.0.0" }
}
```

来源：`github.com/colinhacks/zshy/blob/main/README.md`。

zshy 然后运行 `tsc` 两次（一次用于 ESM，一次用于 CJS，并重写扩展名为 `.cjs`/`.d.cts`），并根据入口点**直接将 `exports` 映射写入你的 `package.json`**。根本没有打包器。

**优点。**

- 输出与源码一对一。堆栈跟踪无需源码映射就能清晰地映射到你的代码。
- 认知负担几乎为零：只是 `tsc`。
- 被 [Zod 4](https://zod.dev) 用于生产环境——证明它适用于大型流行库。
- 与已经自己做树摇的消费者打包器配合良好。

**缺点。**

- 没有打包意味着消费者看到你的完整文件树（200 个文件，200 个导入）。大多数现代打包器可以处理这种情况，但这可能会暴露出长导入链的 bug。
- 没有跨条目的代码分割或共享代码块——辅助函数被重复。
- 安装时更慢（更多文件要读取）。
- "它很慢"——直接引用 zshy README 的话。

**结论。** 当你（a）有零或接近零的运行时依赖，（b）你想要与源码一致的发布输出，并且（c）你不需要向不使用打包器的消费者提供预树摇的输出时，这是正确的选择。当你需要代码分割或有复杂的预处理管道（JSX + CSS + 装饰器）时，这是错误的选择。

最小纯 `tsc` 工作流（无 zshy）：

```jsonc
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

```jsonc
// package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json"
  }
}
```

这是"我会手动处理 exports"的路径。可行；交叉引用 `package-json-exports.md` 了解最终的 `exports` 字段。

---

## 8. 替代方案：unbuild

**它是什么。** 由 UnJS 团队开发的基于 Rollup 的打包器。与 Nuxt/Nitro/H3 紧密集成。注意：UnJS 自己现在正在试验 `obuild`（基于 Rolldown 的继任者）；README 逐字说明了这一点。

**配置片段：**

```ts
// build.config.ts
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    './src/index',
    {
      builder: 'mkdist',
      input: './src/components/',
      outDir: './dist/components',
    },
  ],
  declaration: true,
  rollup: {
    emitCJS: true,
  },
});
```

来源：`github.com/unjs/unbuild/blob/main/README.md`。

独特功能：

- **`--stub` 模式** — 不构建，而是写入通过 `jiti` 直接从 `src/` 重新导出的垫片文件。让你无需在每次更改时重新构建即可 `pnpm link`。
- **mkdist builder** — 逐文件转译（类似 zshy/tsc，但由 Rollup 驱动），可用于组件库。
- **从 `package.json` 自动配置** — 推断条目。

**优点。** 通过 `--stub` 提供出色的 monorepo 开发体验。强大的 Rollup 生态系统。内置依赖审计（警告缺失/未使用的依赖并在 CI 中失败）。

**缺点。** UnJS 之外是小众的。比 tsdown 慢。鉴于 `obuild` 的开发，未来不明朗。

**结论。** 如果你已经在 UnJS 生态系统中（Nuxt module、Nitro plugin、H3 middleware），使用它。否则使用 tsdown。

---

## 9. 副作用、树摇和 `sideEffects`

打包器的 `treeshake` 选项（在 tsdown 中默认开启）移除不可达代码。但它不能移除模块级别的*求值（evaluation）*，除非包选择加入。

在 `package.json` 中：

```json
{
  "sideEffects": false
}
```

这个声明——"此包中没有模块有顶层副作用"——给予*消费者的*打包器权限，如果未从该模块导入任何符号，则丢弃整个模块。它被 webpack、Vite、Rollup 和 tsdown 共同读取。

如果你的库中有一些文件确实有副作用（CSS 导入、polyfill 注册、monkey-patch），缩小声明范围：

```json
{
  "sideEffects": ["./dist/polyfills.cjs", "./dist/polyfills.mjs", "*.css"]
}
```

常见陷阱：

- **在 `index.ts` 顶部导入 CSS 文件** 是一个副作用。如果设置了 `sideEffects: false`，消费者将丢弃 CSS，静默地破坏样式。
- **通过顶层 `if` 的 Polyfill** 是副作用。同样的风险。
- **设置全局变量**（`globalThis.__MY_LIB__ = ...`）是典型的副作用示例。

当不确定时，完全省略 `sideEffects`。默认值（"可能有副作用"）是安全的，但会损失消费者的树摇精度。

---

## 10. Watch 与 Dev 模式

tsdown 的 watch 模式是 `--watch`（或 `tsdown -w`）：

```bash
$ npx tsdown --watch
```

在 monorepo 中，优先通过工作区管理器限定 watch 范围，而不是运行多个观察器：

```bash
$ pnpm --filter @your-org/core --filter @your-org/plugin run dev
# 其中每个包的 "dev" 脚本是 "tsdown --watch"
```

**"在 monorepo 内消费原始 `src`"技巧。** 由 TanStack 首创，在 `tanstack/query` 的 `packages/query-core/package.json` 中使用：定义一个自定义导出条件，在开发时指向 `src/`，在生产时指向构建好的 `dist/`。Vite 和 webpack 会在 monorepo 内遵循它，因此你在开发期间永远不需要重新构建依赖。

```jsonc
// packages/query-core/package.json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",       // 用于 tsconfig paths + vite
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.mts"
    }
  }
}
```

结合 `vite.config.ts`：

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['source', 'import', 'module', 'default'],
  },
});
```

现在 dev = 永远没有构建步骤，你的观察器只是 `tsc --watch --noEmit` 用于类型检查。生产发布仍然使用 tsdown。

参考：TanStack Query 的 monorepo `github.com/TanStack/query`。

---

## 11. 打包器选择决策树

按顺序使用。在第一个匹配处停止。

```
1. 你要发布到 npm 并希望消费者能在没有自己的打包器的情况下使用该包
   （CLI 工具、Node 脚本、边缘函数）？
   是 → 继续
   否  → （你正在发布一个仅 TS 源码的包，例如 code-mod 或
          内部 monorepo 库） → 转到 6（仅 tsc）

2. 你有以下任何一种：JSX、CSS 导入、装饰器、资源导入、
   非 TS 源文件，或 `import.meta.env` 替换？
   是 → tsdown（rolldown 原生处理所有这些）
   否  → 继续

3. 你的库是零运行时依赖（纯 TS，没有 `dependencies` 字段）
   并且你重视与源码一致的输出并且可以接受消费者打包器
   做树摇？
   是 → zshy（或纯 tsc）
   否  → 继续

4. 你在 UnJS 生态系统中（Nuxt module、Nitro plugin、H3 utility）？
   是 → unbuild
   否  → 继续

5. 你已经有一个正常工作的 tsup 配置，且接触它的成本
   超过保持现状的成本？
   是 → 暂时保留 tsup；下次接触构建时迁移
   否  → tsdown

6. 仅 tsc 路径：
   - 设置 `"main": "./dist/index.js"`、`"types": "./dist/index.d.ts"`
   - 仅单格式（根据消费者选择 ESM 或 CJS 之一）
   - 对于不带打包器的双产出：使用 zshy 或 tshy
```

以表格形式压缩的版本：

| 如果你...                                              | 使用                  |
| ------------------------------------------------------ | -------------------- |
| 在 2026 年开始一个新的 TS 库                  | **tsdown**           |
| 有一个正常工作的现有 tsup 配置                | tsup → 稍后迁移到 tsdown  |
| 想要零依赖、与源码一致的输出（Zod 风格）      | zshy                 |
| 构建 Nuxt module / UnJS 包                     | unbuild              |
| 发布一个仅 TS 源码的包（无转译）       | 仅 `tsc`           |
| 需要完整的 Rollup 插件 API 控制                    | 直接使用 rolldown    |

---

## 构建输出验证（简要）

使用上述任何一种工具首次构建后，在发布前验证磁盘上的形状：

```bash
$ ls -la dist/
$ node -e "require('./dist/index.cjs')"        # CJS 冒烟测试
$ node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m)))"
$ npx tsc --noEmit --strict scratch.ts          # 从新项目消费 .d.ts
```

更深入的验证（`publint`、`@arethetypeswrong/cli`、`node --experimental-vm-modules`）在 `verification-and-publishing.md` 中介绍。当 `dist/` 包含正确形状的正确文件时，本文档的工作就结束了。

---

## 来源引用

- tsdown 指南：`https://tsdown.dev/guide/`
- tsdown 配置参考：`https://tsdown.dev/reference/api/Interface.UserConfig.md`
- tsdown LLM 优化指南：`https://tsdown.dev/guide.md`
- tRPC server 配置：`https://github.com/trpc/trpc/blob/main/packages/server/tsdown.config.ts`
- Inngest SDK 配置：`https://github.com/inngest/inngest-js/blob/main/packages/inngest/tsdown.config.ts`
- tsup README（不再维护通知）：`https://github.com/egoist/tsup/blob/main/README.md`
- tsup → tsdown 迁移：`https://tsdown.dev/guide/migrate-from-tsup`
- zshy README：`https://github.com/colinhacks/zshy/blob/main/README.md`
- unbuild README：`https://github.com/unjs/unbuild/blob/main/README.md`
- Anthony Fu 关于纯 ESM：`https://antfu.me/posts/move-on-to-esm-only`
- TanStack Query `source` 条件模式：`https://github.com/TanStack/query`