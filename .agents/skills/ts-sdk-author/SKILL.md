---
name: ts-sdk-author
description: >
  Design, build, verify, and publish production-grade TypeScript SDKs as npm
  packages inside a pnpm monorepo. Covers workspace layout, public API and
  module boundaries, plugin extension points, branded types and library-tuned
  tsconfig, tsdown bundling (vs tsup/tsc-only/unbuild), package.json exports
  with dual ESM+CJS and isomorphic conditions (browser/workers/RN/deno),
  Turborepo pipelines, publint and @arethetypeswrong/cli verification,
  changesets pre-release mode, npm dist-tags (latest/next/beta/rc/canary),
  and the alpha→beta→rc→stable release lifecycle. Triggers on: build a TS
  SDK, extract core library, package.json exports, dual ESM CJS, tsdown
  config, tsup vs tsdown, publint, attw, changesets prerelease, npm
  dist-tag, beta to rc, canary release, pnpm workspace SDK, isomorphic SDK,
  tsconfig library, npm provenance, shipping a TypeScript library.
license: MIT
metadata:
  author: oh-my-openclaw
  version: "1.0"
  composed_from:
    - agent-cli-architecture
    - typescript-pro
    - turborepo
    - monorepo-navigator
  sources:
    - code-architecture-refactoring
    - architecture-patterns
    - turborepo
    - fastify
    - Jeffallan/claude-skills (typescript-pro)
    - turborepo (official docs)
    - monorepo-navigator
    - publint.dev (rule catalog)
    - arethetypeswrong.github.io (problem catalog)
    - tsdown.dev (official docs)
    - changesets/changesets (prerelease + dist-tags docs)
    - GitHub package.json originals — tRPC, vercel/ai, Inngest, Sanity client, Hono, Zustand, TanStack query-core
---

# TypeScript SDK 作者

从 pnpm monorepo 中发布 TypeScript SDK 作为独立 npm 包的端到端工作流：工作区布局、公共 API 设计、构建配置、分发包形状、monorepo pipeline、验证，以及包含 beta / rc / canary 频道的完整发布生命周期。

七个参考文件包含深度内容。此文件是统一工作流加上你日常需要的模式快速参考。

---

## 何时使用此技能

- 从 pnpm workspace 中的现有 CLI 或应用中提取核心库（如 `packages/core`、`packages/sdk`）
- 设计陌生人将消费的 TypeScript 库的公共 API 面——branded type、泛型客户端、插件扩展点
- 选择构建工具——tsdown vs tsup vs tsc-only vs unbuild
- 编写 `package.json` `exports` 字段，支持双 ESM+CJS、同构运行时条件和子路径插件入口
- 配置 Turborepo 使 SDK 仅在其输入变化时重新构建，下游应用消费 SDK 的构建输出（或通过自定义 condition 消费原始 `src`）
- 将 `publint --strict` 和 `attw --pack` 接入 `prepublishOnly` 或 CI
- 管理预发布频道——`canary`（每次提交）、`next`（下一个大版本）、`beta` / `rc`（稳定化）、`latest`（稳定版）——以及它们之间的过渡（`beta.N` → `rc.0` → `1.0.0` → `1.1.0-beta.0`）
- 使用 GitHub Actions `changesets/action@v1` 加 npm provenance 设置 changesets

---

## 执行工作流

一个 TS SDK 构建经过以下七个阶段。跳过任何阶段，后续某个环节会出问题——阶段之间的依赖关系是真实存在的。

### 阶段 1 — Workspace 和包骨架

建立 monorepo 并创建空的 SDK 包。

核心操作：

1. 在 workspace 根目录采用 `apps/` + `packages/` + 可选的 `tools/`
2. 将 SDK 放在 `packages/<sdk-name>/`（或 `packages/core/`）
3. 给它一个 scope 名称（`@<org>/<sdk-name>`）
4. 使用 `workspace:*` 协议连接 workspace 内部依赖
5. 在任何其他操作之前决定：此包最终将被发布，因此在设计边界和命名时要考虑到这一点

```
my-repo/
├── pnpm-workspace.yaml
├── package.json          # 根：仅 devDeps + workspace 脚本
├── apps/
│   └── example-app/      # SDK 的消费者
└── packages/
    ├── sdk/              # ← SDK
    └── shared-tsconfig/  # 内部专用，绝不发布
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

**下一步阅读：** `references/workspace-and-layout.md` — §2 布局，§3 SDK 命名模式，§4 内部包创建，§5 `package.json` 骨架，§7 多仓库 → monorepo 迁移。

### 阶段 2 — 公共 API 面

在编写任何代码之前，决定 SDK 的公共面是什么样子。

两个并行的关注点：

**A. 模块边界。** `src/` 树清晰地分为 `api/`（被重新导出且是契约的一部分）和 `internal/`（不要从包外部导入）。`package.json` `exports` 字段是你最便宜的强制执行机制——任何未在其中列出的内容都不能被消费者导入。

```
packages/sdk/src/
├── index.ts          # 桶文件 — 从 api/ 重新导出
├── api/
│   ├── client.ts
│   └── types.ts
└── internal/
    ├── transport.ts  # 不导出
    └── state.ts      # 不导出
```

**B. 类型设计。** SDK 类型由陌生人消费，不得泄漏内部实现，必须可演进。使用：

- **Branded type** 用于不透明 ID：`type UserId = Brand<string, "UserId">`
- **泛型客户端** 具有合理默认值，以便稍后添加类型参数时不会破坏兼容性：`createClient<Schema = DefaultSchema>(...)`
- **区分联合类型** 用于结果类型：`Result<T, E>` 配合 `{ ok: true; value: T } | { ok: false; error: E }`
- **Builder 模式** 用于类型安全配置，当选项组合很重要时
- **Interfaces**（而非 type 别名）当用户可能需要通过声明合并扩展类型时

**下一步阅读：**

- `references/module-boundaries-and-plugins.md` — §2 `src/` 边界，§3 运行时分层，§4 provider/adapter，§5 插件扩展，§6 边界强制执行，§7 模式 vs 反模式
- `references/type-design-for-public-api.md` — §1 branded type，§2 泛型面，§3 conditional/mapped type，§4 type guard，§5 builder，§6 utility type 发布/内部，§7 库的 tsconfig，§8 API 演进

### 阶段 3 — 构建配置

你需要 (a) 一个针对库输出调优的 `tsconfig.json`，和 (b) 一个产出实际 `dist/` 的打包器。

**库的 tsconfig** — 关键标志：

```jsonc
// tsconfig.build.json — 库构建配置
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "declaration": true,             // 输出 .d.ts
    "declarationMap": true,          // .d.ts → .ts 的 sourcemap
    "sourceMap": true,
    "verbatimModuleSyntax": true,    // TS 5.0+ — 严格 import 消除
    "isolatedDeclarations": true,    // TS 5.5+ — 公共 API 上的显式返回类型
    "composite": true,               // 启用项目引用
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**2026 年的打包器选择：** `tsdown`。tRPC 和 Inngest 已从 tsup 迁移到它；tsup 的 README 现在声明 *"此项目不再活跃维护。请考虑改用 tsdown。"*

最小可行的 `tsdown.config.ts`：

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/plugin/index.ts", "src/testing/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  outExtensions: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
    dts: format === "esm" ? ".d.mts" : ".d.cts",
  }),
});
```

**替代方案：**

- `tsc-only` / `zshy` — 无运行时依赖的小型 SDK，保真源码发布
- `unbuild` — 仅在已处于 UnJS 生态中时使用
- `tsup` — 社区熟悉但在失势；出于惯性也可行

**下一步阅读：**

- `references/tsdown-bundling.md` — §3 结论，§4 工作配置，§6–§8 替代方案，§11 选择决策树
- `references/type-design-for-public-api.md` §7 — 完整库 tsconfig 讲解

### 阶段 4 — 分发包形状（`package.json` `exports`）

这是大多数 TS SDK bug 所在的地方。五个不变量：

1. `types` **必须**在每个 `import` / `require` 分支中排第一
2. `default` **必须**排最后
3. 双 ESM+CJS 需要**分开的** `.d.mts` 和 `.d.cts`（TS 5.0+）
4. 始终包含 `"./package.json": "./package.json"`（让 publint/attw 可以内省）
5. `module` 在 `require` 之前（如果同时使用两者）

规范的双格式形状（逐字来自 `@trpc/server`）：

```json
{
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

为插件入口点添加子路径，使其与根桶文件版本分离：

```json
{
  "exports": {
    ".":          { "import": { ... }, "require": { ... } },
    "./plugin":   { "import": { ... }, "require": { ... } },
    "./testing":  { "import": { ... }, "require": { ... } }
  }
}
```

对于同构 SDK（browser / workers / RN / edge），运行时条件在 `import` / `require` **之前**：

```json
{
  ".": {
    "browser":      { "import": "./dist/browser.mjs" },
    "workerd":      { "import": "./dist/workerd.mjs" },
    "react-native": { "import": "./dist/rn.mjs" },
    "deno":         { "import": "./dist/deno.mjs" },
    "import":       { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
    "require":      { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
}
```

**下一步阅读：** `references/package-json-exports.md` — §3 五项规则，§4 tRPC 双模式注释，§5 仅 ESM 模式，§6 子路径插件，§7 同构条件（Sanity client 模式），§9 常见错误：坏 → 修复 → 为什么。

### 阶段 5 — Monorepo Pipeline（Turborepo）

一旦 SDK 能独立构建，将其接入 workspace 以便：

- 应用仅当 SDK 输出变化时重新构建（缓存）
- 本地开发在 watch 模式下重建 SDK，同时应用重新加载
- CI 仅在 PR 上构建受影响的包

最小可行的 `turbo.json`：

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig*.json", "tsdown.config.ts", "package.json"],
      "outputs": ["dist/**"]
    },
    "test":      { "dependsOn": ["^build"], "inputs": ["src/**", "test/**"] },
    "lint":      { "inputs": ["src/**"] },
    "typecheck": { "dependsOn": ["^build"], "inputs": ["src/**", "tsconfig*.json"] },
    "dev":       { "persistent": true, "cache": false }
  }
}
```

日常 `--filter` 模式：

```bash
pnpm turbo run build --filter=@acme/sdk                   # 仅 SDK
pnpm turbo run dev   --filter=@acme/sdk... --filter=@acme/example-app
pnpm turbo run test  --filter=...@acme/sdk                # 受 SDK 影响
pnpm turbo run lint  --filter=[HEAD^1]                    # 自上次提交以来的影响
```

**关键规则：** 将脚本放在**每个**包的 `package.json` 中，而非根目录。根目录仅委托 `turbo run X`。

**下一步阅读：** `references/turborepo-for-sdk.md` — §2 最小可行 `turbo.json`，§3 每包 vs 根，§4 `dependsOn`，§5 缓存 inputs/outputs，§6 `--filter` 模式，§7 boundaries 字段，§8 CI 模式，§9 dev 模式 watch。

### 阶段 6 — 验证

发布前，两个静态检查 + 一个运行时检查是不可协商的：

```bash
# 在 pnpm build 之后：
pnpm exec publint --strict                   # package.json 静态 lint
pnpm exec attw --pack .                      # 模拟 Node/Bun/Deno/bundler 解析

# 然后 pack + 在 sandbox 目录中安装
pnpm pack
cd /tmp/sandbox && npm init -y && npm install /path/to/your-pkg-1.0.0.tgz
node -e "console.log(require('@acme/sdk'))"                          # CJS 可达
node --input-type=module -e "import('@acme/sdk').then(console.log)"  # ESM 可达
```

将三项全部接入 `prepublishOnly`：

```json
{
  "scripts": {
    "prepublishOnly": "pnpm build && pnpm exec publint --strict && pnpm exec attw --pack ."
  }
}
```

**为什么同时需要 publint 和 attw？** publint 静态检查 `package.json` 形状；attw 实际模拟每个消费者运行时如何解析你的 tarball。最常见的 attw 失败是 **Masquerading ESM**——一个 `.js` 文件包含 ESM 语法但暴露在 `require` 下——这是 publint 无法捕获的。

**下一步阅读：** `references/verification-and-publishing.md` — §2 publint 规则 + 3 种常见失败，§3 attw 解析模式表格 + 7 种失败模式，§4 冒烟测试（tarball → 全新目录）。

### 阶段 7 — 发布生命周期

这是大多数 SDK 项目积累技术债务的地方。从第一天就把它做对。

**Semver + 预发布标识符：**

```
0.x.y           # 1.0 之前 — 次版本号允许 breaking change
1.0.0-alpha.0   # 内部功能探索
1.0.0-beta.0    # 功能完整，API 可能仍有调整
1.0.0-rc.0      # 冻结，仅修复阻塞性问题
1.0.0           # 稳定版
1.0.1           # 稳定版补丁
1.1.0-beta.0    # 下一个次版本的 beta 周期，同时 1.0.x 发布补丁
```

**npm dist-tags — 绝不将预发布版发布到 `latest`：**

```bash
# 在 `beta` tag 下发布 beta 版（不是 `latest`）
npm publish --tag beta

# 从错误发布到 latest 中恢复：
npm dist-tag add @acme/sdk@1.0.0 latest      # 将 latest 重新指向稳定版
npm dist-tag rm  @acme/sdk beta              # 如果不再需要
```

约定 tag：`latest`（稳定版）、`next`（即将发布的大版本预发布）、`beta`、`rc`、`canary`（每次提交）、`alpha`、`experimental`、`nightly`。

**changesets 预发布模式 — 规范过渡：**

```bash
# 创建 beta 线
pnpm changeset pre enter beta
pnpm changeset                  # 编写 changeset
pnpm changeset version          # 版本号升至 1.0.0-beta.0
pnpm changeset publish

# 功能完整；将 beta → rc
pnpm changeset pre exit
pnpm changeset pre enter rc
pnpm changeset version          # 版本号升至 1.0.0-rc.0
pnpm changeset publish

# RC 稳定；发布 1.0.0
pnpm changeset pre exit
pnpm changeset version          # 版本号升至 1.0.0
pnpm changeset publish

# 开启下一个次版本的 beta 线
pnpm changeset pre enter beta
pnpm changeset version          # 版本号升至 1.1.0-beta.0
```

**npm provenance** — 启用它：

```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

搭配 GitHub Actions 发布 job 中的 `id-token: write` 权限；npm 将在包页面上显示已验证的 attestation。

**下一步阅读：** `references/verification-and-publishing.md` — §5 semver 复习，§6 dist-tag 规则，§7 完整生命周期状态图，§8 案例研究（Next.js / vercel-ai / tRPC / Storybook / Stripe 真实版本序列），§9 changesets 预发布流程，§10 GitHub Actions 发布工作流，§11 provenance，§12 yank vs deprecate，§13 策略决策树。

---

## 快速参考

### 文件 / 字段速查表

| 文件 | 拥有 | 快速检查 |
|---|---|---|
| `pnpm-workspace.yaml` | 哪些目录是包 | `apps/*` + `packages/*` |
| 根 `package.json` | Workspace devDeps + `turbo run` 委托 | 根目录中没有包级构建脚本 |
| 包 `package.json` | `name`、`version`、`type`、`exports`、`files`、`sideEffects`、`bin`、`scripts.prepublishOnly` | 运行 `publint --strict` |
| 包 `tsconfig.json` | 编辑器 + `tsc --noEmit` | `strict: true` + `declaration: true` |
| `tsconfig.build.json` | 库构建配置 | 如需快速 `.d.ts` 则 `isolatedDeclarations: true` |
| `tsdown.config.ts` | 打包 | `format: ['esm', 'cjs']` + 双 `outExtensions` |
| `turbo.json` | 任务 pipeline | `dependsOn: ['^build']` 用于编译顺序 |
| `.changeset/config.json` | 发布策略 | `commit: false`、`access: public` |

### 打包器选择一览

| 场景 | 选择 |
|---|---|
| 现代 TS SDK，双 ESM+CJS，插件子路径 | **tsdown** |
| 零运行时依赖，希望保真源码发布 | 仅 `tsc` / `zshy` |
| 已有 tsup 项目且工作正常 | 继续用 tsup；规划 tsdown 迁移 |
| UnJS / Nuxt 生态 | unbuild |
| 需要 bundle-splitting + 高级 rollup 配置 | 直接用 `rolldown` |

### 模块格式决策

| 场景 | 推荐 |
|---|---|
| 2026 年新 SDK 的默认选择 | **双 ESM + CJS** |
| 库有稳定的消费者基础 ≥ Node 22 | 仅 ESM 可辩护 |
| 库仅在 Node 应用内部使用 | 仅 ESM |
| 库被 Jest、旧版 Next.js、Lambda CJS 消费 | **双格式** 是必需的 |

### 发布 Tag 一览

| Tag | 含义 | `npm install pkg@?` 解析 |
|---|---|---|
| `latest` | 当前稳定版 | `npm install pkg` |
| `next` | 即将发布的大版本预发布 | `npm install pkg@next` |
| `beta` | 功能完整的稳定化阶段 | `npm install pkg@beta` |
| `rc` | 冻结，仅阻塞性修复 | `npm install pkg@rc` |
| `canary` | 每次提交/每个 PR 的快照 | `npm install pkg@canary` |
| `experimental` | 不稳定的探索 | `npm install pkg@experimental` |

### 你常打的一行命令

```bash
# 将 SDK 添加为 workspace 内部依赖
pnpm add @acme/sdk@workspace:* --filter @acme/example-app

# 构建 SDK + 依赖它的所有内容
pnpm turbo run build --filter=...@acme/sdk

# 发布前门禁
pnpm build && pnpm exec publint --strict && pnpm exec attw --pack .

# 为 PR 创建快照发布（vercel/ai 模式）
pnpm changeset version --snapshot pr-123
pnpm publish --tag pr-123 --no-git-checks
```

---

## 发布前检查清单

每次发布前过一遍。跳过任何一项就是 SDK 出问题的原因。

### 构建产物

- [ ] `pnpm build` 产出的 `dist/` 同时包含 `.mjs` 和 `.cjs`（双格式）或仅 `.mjs`（仅 ESM）
- [ ] `.d.mts` 和 `.d.cts` 存在（双格式），或仅 `.d.ts`（仅 ESM）
- [ ] Source map 已输出（`.mjs.map`、`.d.mts.map`）
- [ ] `dist/` 大小合理（`du -sh dist/` — 健全性检查，不应有意外膨胀）

### package.json

- [ ] `name` 有 scope（`@org/name`）— 如果以后要设为私有则必需
- [ ] `version` 匹配即将发布的版本
- [ ] `type` 匹配默认格式（`"module"` 用于 ESM 默认，CJS 默认则省略）
- [ ] `exports` 有 `"./package.json": "./package.json"`
- [ ] 每个 `exports` 分支 `types` 第一，`default` 最后
- [ ] `files` 列出 `dist`（如果发布源码用于 IDE 跳转定义则加上 `src`）
- [ ] `sideEffects: false`（除非确实有顶级副作用）
- [ ] 首次 scoped 发布 `publishConfig.access: "public"`
- [ ] `publishConfig.provenance: true`

### 验证

- [ ] `publint --strict` 通过
- [ ] `attw --pack .` 通过（或仅有预期的 `node10` 警告）
- [ ] 冒烟测试：pack + 在 `/tmp` 中安装 + CJS + ESM + TS 消费者全部可解析

### 发布

- [ ] 选择了正确的 dist-tag（`latest` 仅用于稳定版）
- [ ] 如果是预发布：`pnpm changeset pre enter <tag>` 在 `version` **之前**运行
- [ ] 如果是稳定版：如果之前处于 pre-mode，`pnpm changeset pre exit` 已运行
- [ ] CHANGELOG.md 反映了变更
- [ ] Git tag 匹配版本（如 `v1.0.0-beta.3`）
- [ ] Provenance attestation 在 npm 包页面上可见

---

## 常见错误

| 错误 | 出什么问题 | 修复 |
|---|---|---|
| `types` 不在 `exports` 分支的第一位 | TS 将 `.js` 作为类型源 → 消费者端级联错误 | 将 `types` 移到每个 `import` / `require` 分支顶部（publint 会标记） |
| 双 ESM+CJS 使用单一 `.d.ts` | TS 以错误的模块模式解析 `.d.ts` | 输出 `.d.mts` + `.d.cts`（TS 5.0+）；tsdown 自动处理 |
| exports 中缺少 `"./package.json": "./package.json"` | publint/attw 无法内省你的包 | 始终包含它 |
| 将预发布版发布到 `latest` | 每个 `npm install pkg` 的用户都获得你的 beta 版 | 使用 `npm publish --tag beta`；通过 `npm dist-tag add pkg@stable latest` 恢复 |
| 稳定版发布前忘记 `pnpm changeset pre exit` | 稳定版本显示为 `1.0.0-beta.N` 而非 `1.0.0` | 最终发布前始终 `pre exit` |
| 根 `package.json` 包含实际的构建脚本 | 破坏 Turborepo 并行性和缓存 | 每包脚本；根仅通过 `turbo run` 委托 |
| 消费者从 `dist/internal/...` 进行深层导入 | 消费者耦合到内部实现；你的重构会破坏他们 | 不要在 `exports` 中列出内部；使用 ESLint `no-restricted-imports` |
| 内部类型泄漏到公共 API 面 | 用户看到他们不应依赖的类型 | 仅从 `src/api/*.ts` 重新导出；不要从内部 `export *` |
| 无副作用却缺少 `sideEffects: false` | 打包器无法 tree-shake 你的库 | 添加 `"sideEffects": false` 或列出实际有副作用的文件 |
| Provenance 缺少 `id-token: write` 权限 | Provenance attestation 在 CI 中静默失败 | 添加 `permissions: { id-token: write, contents: read }` 到发布 job |
| 在同一个 Turbo 任务中混合 watch + build | 缓存不断失效；watch 永不稳定 | 分离 `build`（可缓存）和 `dev`（`persistent: true, cache: false`） |
| `exports` 中 `module` 和不相关的运行时条件顺序错误 | Edge 运行时选了错误的文件 | 运行时条件（`browser`、`workerd`）→ `module` → `import` → `require` → `default` |
| 公共 API 类型中使用 `enum` | 强制消费者只能使用 TS，破坏可擦除语法 | 使用字符串字面量联合或 `as const` 对象 |
| SDK 根使用 `default` 导出 | 破坏 tree-shaking + 互操作故事 | 始终使用命名导出 |

---

## 参考文件

| 文件 | 何时使用 |
|---|---|
| `references/workspace-and-layout.md` | 设置 `apps/` + `packages/` + `tools/`；命名 SDK 包；创建内部包；选择 dep 字段（`dependencies` / `peerDependencies` / `devDependencies`）；从多仓库迁移 |
| `references/module-boundaries-and-plugins.md` | 将 `src/` 分为 `api/` vs `internal/`；设计编排层 vs 适配器 vs 工具；构建具有生命周期 hooks 的插件扩展模型；通过 eslint-plugin-boundaries / dependency-cruiser / Turbo `boundaries` 强制执行边界 |
| `references/type-design-for-public-api.md` | Branded type；泛型客户端；conditional + mapped type；类型安全 builder；哪些 utility type 发布 vs 保留内部；库的 tsconfig 标志（`verbatimModuleSyntax`、`isolatedDeclarations`、`composite`）；API 演进模式 |
| `references/package-json-exports.md` | 编写 `exports` 字段；双 ESM+CJS 配合分离的 `.d.mts`/`.d.cts`；子路径插件条目；同构运行时条件（`browser`、`workerd`、`react-native`、`deno`、`edge-light`）；修复常见 `exports` bug |
| `references/tsdown-bundling.md` | 选择 tsdown vs tsup vs tsc-only vs unbuild；最小可行 `tsdown.config.ts`；子路径输出映射；side-effects + tree-shaking；watch & dev 模式；打包器选择决策树 |
| `references/turborepo-for-sdk.md` | 为 SDK monorepo 编写 `turbo.json`；`dependsOn: ['^build']`；缓存 `inputs`/`outputs`；SDK 开发的 `--filter` 模式；`boundaries` 字段；CI 远程缓存 + 仅受影响构建；`persistent: true` 的 dev 模式 |
| `references/verification-and-publishing.md` | publint + attw 设置；tarball 冒烟测试；semver + 预发布标识符；npm dist-tags；完整 beta → rc → 稳定版 → 下一周期状态机；changesets 预发布模式；规范 beta → rc 过渡命令序列；GitHub Actions 发布工作流含快照 PR；npm provenance；yank vs deprecate；发布策略决策树 |

---

## 源技能

此技能由 `oh-my-openclaw` 中的四个源技能组合而成：

- **`agent-cli-architecture`** (architect-claw) — workspace 结构、模块边界、运行时分层、插件扩展模式。从 "agent CLI" 框架推广到通用 "SDK + 支撑 CLI"。
- **`typescript-pro`** (frontend-claw) — branded type、泛型、conditional type、type guard、utility type、tsconfig 深入。重新聚焦到库/SDK 作者的关注点。
- **`turborepo`** (frontend-claw) — 任务 pipeline、缓存、`--filter`、`boundaries`。大幅精简到 SDK-monorepo 相关子集。
- **`monorepo-navigator`** (architect-claw) — pnpm workspace、changesets、发布、迁移。

加上对 `package.json exports`、2026 年双 ESM/CJS、tsdown 生态、publint + attw 以及 alpha→beta→rc→stable 生命周期的原始研究，以及来自 tRPC、vercel/ai、Inngest、Sanity client、Hono、Zustand 和 TanStack query-core 的 GitHub `package.json` 逐字示例。