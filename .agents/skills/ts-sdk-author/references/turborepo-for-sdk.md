# 用于 SDK Monorepo 的 Turborepo

当 monorepo 以 SDK 包（`@acme/sdk`）加上消费应用（`@acme/example-app`、文档站点、e2e 测试夹具）和共享工具为中心时，如何配置 Turborepo。Turborepo 是一个**具有内容寻址缓存的任务编排器**——它不替代你的打包器（tsdown、tsup、Vite 等）。它告诉打包器*何时*运行。

---

## 1. 为什么 SDK Monorepo 需要 Turborepo

一个 SDK monorepo 有一个经典的非对称图：一个库在依赖树的根部，许多东西在其下游。

| 痛点                                                       | Turborepo 提供什么                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| 每次修改应用时都重新构建 SDK                   | 内容寻址缓存——当 `src/**` 未更改时，SDK 重新构建被跳过         |
| 在每个 PR 上都运行每个包的测试                       | `--affected` 仅运行变更的包及其依赖项                       |
| 在测试示例应用之前忘记构建 SDK       | `dependsOn: ["^build"]` 自动强制执行构建顺序                       |
| 因为构建是顺序的所以 CI 慢                            | 跨依赖图并行执行                                   |
| Watch 循环导致双重打包（SDK watch + 应用 dev 重新打包）    | `persistent: true` 任务语义 + 用于协调开发管道的 `with` 键 |

Turborepo **不**做以下事情：

- 编译或打包代码（你的 `build` 脚本做这个）
- 自己监视文件进行重新构建（你的 `tsc --watch` / `tsdown --watch` 做这个——`turbo watch` 重新调用一次性任务）
- 替代包管理器工作区（它位于 pnpm / npm / yarn / bun 工作区之上）

---

## 2. 用于 SDK Monorepo 的最小可行 `turbo.json`

这是规范的起点。将其放在仓库根目录。

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json", ".env"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json", "tsdown.config.ts"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

针对 SDK 仓库的关键选择：

- `build` 使用 `^build`，以便应用在打包之前等待 SDK 的 `dist/**`。
- `typecheck` 和 `test` 也依赖 `^build`，因为消费者针对 SDK 产出的 `.d.ts` 进行类型检查。
- `dev` 是 `persistent: true` 和 `cache: false`——长时间运行，从不缓存。
- `outputs: []` 对 lint/typecheck 是**显式的**，这样 Turborepo 仍然缓存*任务结果*（通过/失败 + 日志），即使没有文件产生。

---

## 3. 按包脚本 vs 根目录脚本

**SDK monorepo 中最常被违反的规则：** 根目录 `package.json` 必须仅委托给 `turbo run`。任务逻辑存在于每个包中。

### 错误

```json
// 根目录 package.json — 破坏了并行化，没有缓存
{
  "scripts": {
    "build": "cd packages/sdk && tsdown && cd ../../apps/example-app && vite build",
    "test": "vitest run --project sdk --project example-app",
    "lint": "eslint packages/ apps/"
  }
}
```

### 正确

```json
// 根目录 package.json — 纯委托
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev": "turbo run dev"
  }
}
```

```json
// packages/sdk/package.json
{
  "name": "@acme/sdk",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "dev": "tsdown --watch"
  }
}
```

```json
// apps/example-app/package.json
{
  "name": "@acme/example-app",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "dev": "vite"
  }
}
```

**此外，始终写 `turbo run <task>`，而不是 `turbo <task>` 速记形式**，在任何命令被提交到源码的地方（package.json scripts、CI YAML、shell 脚本）。速记形式仅用于交互式终端使用。

---

## 4. `dependsOn` 语义

`^` 前缀是整个游戏的核心。

| 形式              | 含义                                                       | 何时使用                                                      |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `^build`          | 先在此包的*依赖项*中运行 `build`            | SDK 必须在应用构建之前构建                                 |
| `build`           | 先在*同一个包*中运行 `build`（包内顺序）   | `test` 需要来自同一包 `build` 的 `dist/**`        |
| `@acme/sdk#build` | 在特定包中运行特定任务                     | 依赖于单个命名包构建的 `deploy` 任务     |

SDK 模式：

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":  { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

为什么 `test` 依赖 `^build` 而不是 `build`：大多数 SDK 测试通过 Vitest 的 TS 管道针对源码（`src/**`）运行。它们只需要*上游*包构建好（以便导入解析到真实的 `dist`），而不是它们自己的包。

**注意：** `^build` 仅遍历声明的工作区依赖。如果 `apps/example-app/package.json` 没有列出 `"@acme/sdk": "workspace:*"`，Turborepo 不会先构建 SDK。始终声明依赖——永远不要使用 `prebuild` 脚本手动构建同级包。

---

## 5. 缓存输入和输出

缓存键是 `fingerprint(inputs) → stored outputs`。任何一个搞错了，你都会得到过时的构建或缓存未命中。

### 规则

| 规则                                                            | 原因                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `inputs` 仅列出*影响构建结果*的文件      | 将 `dist/**` 添加到 inputs 会创建一个自失效循环              |
| `outputs` 列出你想要恢复的所有写入磁盘的内容 | 缺少 `outputs` 意味着任务运行了但没有任何内容被缓存              |
| 构建时消费的环境变量放入 `env`（按任务）          | 否则哈希会遗漏它们，你会得到跨环境环境的过时构建     |
| 对 lint/typecheck 使用 `outputs: []`                            | 显式声明"没有文件输出，但缓存通过/失败结果"               |
| `globalDependencies` 用于影响*每个*任务的文件         | 仓库根目录的 `tsconfig.base.json`、共享 lint 配置                       |

### SDK 包 inputs/outputs

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "package.json",
        "tsconfig.json",
        "tsdown.config.ts"
      ],
      "outputs": ["dist/**"]
    }
  }
}
```

### 常见框架 outputs

| 工具       | `outputs`                          |
| ---------- | ---------------------------------- |
| tsc / tsdown / tsup | `["dist/**"]`             |
| Vite / Rollup       | `["dist/**"]`             |
| Next.js             | `[".next/**", "!.next/cache/**"]` |
| Vitest coverage     | `["coverage/**"]`         |

### 隐藏的输入——环境变量

`API_URL` 的更改不会使缓存失效，除非声明：

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "env": ["API_URL", "SDK_RELEASE_CHANNEL"]
    }
  }
}
```

对于影响*每个*任务的变量，使用 `globalEnv` 而不是每个任务重复。

---

## 6. 用于 SDK 开发工作流的 `--filter`

覆盖 SDK 作者一天中约 95% 工作的五种模式：

| 命令                                                              | 作用                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `turbo run build --filter=@acme/sdk`                                 | 仅构建 SDK（跳过每个应用）                                         |
| `turbo run build --filter=@acme/sdk...`                              | 构建 SDK 及其*依赖*的所有内容（传递依赖优先）        |
| `turbo run test --filter=...@acme/sdk`                               | 测试 SDK 和每个*依赖它*的包（受影响的扇出）  |
| `turbo run dev --filter=@acme/sdk --filter=@acme/example-app`        | 同时启动 SDK 和示例应用的开发模式                     |
| `turbo run lint --filter=...[HEAD^1]`                                | 自上次提交以来变更的包进行 lint，包括它们的依赖项         |

### 快速参考

| 语法        | 选择                                                |
| ------------- | ------------------------------------------------------ |
| `pkg`         | 仅 `pkg`                                             |
| `pkg...`      | `pkg` + `pkg` 依赖的所有包                  |
| `...pkg`      | `pkg` + 依赖 `pkg` 的所有包              |
| `...pkg...`   | `pkg` + 其依赖项*和*被依赖项              |
| `^pkg...`     | 仅 `pkg` 的依赖项，不包括 `pkg`            |
| `...^pkg`     | 仅 `pkg` 的被依赖项，不包括 `pkg`              |
| `[ref]`       | 自 git ref 以来变更的包                         |
| `...[ref]`    | 变更的包 + 它们的依赖项（等同于 `--affected`） |
| `!pkg`        | 排除（与另一个 `--filter` 组合）            |
| `./apps/*`    | 按目录 glob                                      |
| `@acme/*`     | 按包作用域 glob                                  |

### 日常 SDK 循环

```bash
# 隔离地迭代 SDK
turbo run build typecheck test --filter=@acme/sdk

# 我改了 SDK — 下游什么会坏？
turbo run test --filter=...@acme/sdk

# 我改了 SDK — 启动示例应用来目视检查
turbo run dev --filter=@acme/sdk --filter=@acme/example-app

# 这个 PR 实际触及了什么？
turbo run build test lint --affected
```

`--affected` 是推荐的 CI 快捷方式。它等同于 `--filter=...[<default-branch>]` 并自动包含依赖项。

---

## 7. `boundaries` 字段（Turbo 2.x）

Turborepo 的 `boundaries` 强制执行包只能导入它们声明的内容。这是对 `eslint-plugin-boundaries`（参见 `module-boundaries-and-plugins.md`）的*补充*：`turbo boundaries` 是跨整个图的 CLI 检查；ESLint 插件在编辑器内对单个文件运行。

### 它捕获什么

1. 导入*在*导入包目录*之外*的文件（例如 `../../packages/sdk/src/internal.ts`）
2. 导入未在 `dependencies` 中列出的包

### 给包打标签

```json
// packages/sdk-internal/turbo.json
{ "tags": ["internal"] }
```

```json
// packages/sdk/turbo.json
{ "tags": ["public"] }
```

### 在根 turbo.json 中配置规则

```json
{
  "boundaries": {
    "tags": {
      "public": {
        "dependencies": {
          "deny": ["internal"]
        }
      },
      "internal": {
        "dependents": {
          "deny": ["@acme/example-app", "@acme/docs"]
        }
      }
    }
  }
}
```

这阻止公共 SDK 导入仅内部包，并阻止消费者应用直接访问内部包。运行：

```bash
turbo boundaries
```

对于包内部按文件的 `import/export` 限制，在之上叠加 `eslint-plugin-boundaries`。

---

## 8. SDK 仓库的 CI 模式

CI 配方：远程缓存 + PR 上的 `--affected` + `main` 上的完整矩阵。

### 最小 GitHub Actions 工作流

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # --affected 需要找到合并基础

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Build, test, lint, typecheck（仅在 PR 上受影响）
        run: turbo run build test lint typecheck --affected
```

### 备注

- **始终 `turbo run`，永不在 YAML 中使用 `turbo`**——速记形式仅用于终端。
- **`fetch-depth: 2` 是最小值**，以便合并基础可达。如果 PR 可能针对旧提交，使用 `0`（完整历史）。
- **远程缓存** 通过 `TURBO_TOKEN` + `TURBO_TEAM`（Vercel Remote Cache 或任何自托管兼容服务器）。没有它，每个 CI 运行器都从冷启动。
- **在 `main` 上**，可选地删除 `--affected` 并运行所有内容以进行夜间正确性检查：
  ```yaml
  - run: turbo run build test lint typecheck
  ```
- 对于远程缓存不可用的环境，回退到基于 `**/turbo.json` 和锁文件的 `actions/cache` 键。

---

## 9. SDK 作者的开发模式

"编辑 SDK src/，看到应用重新渲染"的循环有两种可行的形状。

### 形状 A：SDK watch 构建 dist，应用消费 dist

```json
// turbo.json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```bash
turbo run dev --filter=@acme/sdk --filter=@acme/example-app
```

- `@acme/sdk` 运行 `tsdown --watch` → 写入 `dist/**`
- `@acme/example-app` 运行 `vite` → 通过 HMR 拾取 `dist` 更改
- 两个进程都是 `persistent: true`，所以 Turborepo 保持它们并行运行，不尝试缓存它们。

### 形状 B：应用直接消费 SDK src（无需 watch）

对于 monorepo 内的消费者，你可以将自定义导出条件（例如 `"source"`）指向 `./src/index.ts`，这样消费应用的打包器直接读取 TypeScript 源码。在开发期间 SDK 永远不重新构建；你只在发布时构建。

优点：没有双重打包，更快的 HMR。缺点：要求消费者的打包器支持 TS 源码和配置的条件。参见 `package-json-exports.md` 了解完整设置。

### 为什么 `persistent: true` 很重要

一个持久化任务告诉 Turborepo：*此任务永远不会自行退出*。没有它：

- Turborepo 将 dev server 视为已完成的任务，其标准输出被缓存——这是错误的。
- 其他任务可能尝试依赖其（永远不会到达的）"完成"。

如果你希望 dev server 先等待一次性准备任务（例如生成类型），使用 `with` 键或 `dependsOn` + transit-node 模式。

---

## 10. 反模式

| 反模式                                                       | 为什么错误                                                         | 修复                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 根 `build` 脚本手动运行每个包的构建        | 绕过 Turborepo，没有缓存，没有并行性                         | 仅 `"build": "turbo run build"`                                |
| 为产生文件的任务缺少 `outputs`                        | 任务运行但文件未被缓存或恢复                          | 列出 `["dist/**"]`（或框架等效项）                     |
| 为具有非默认源的构建缺少 `inputs`              | 缓存在不相关的文件更改上失效；或错过真实的更改   | 列出实际的源 glob 模式                                     |
| `dependsOn: ["^build"]` 但没有声明工作区依赖        | `^build` 遍历 `dependencies`——没有条目，就没有构建顺序               | 添加 `"@acme/sdk": "workspace:*"`                                 |
| `dev` 任务没有 `persistent: true`                              | Turborepo 将长时间运行的服务器视为卡住的任务                   | 设置 `persistent: true` 和 `cache: false`                        |
| 构建同级包的 `prebuild` 脚本                     | 手动编排，绕过任务图                          | 声明依赖 + 依赖 `^build`                               |
| 构建时消费的环境变量但未在 `env` 中声明          | 过时的构建：哈希错过了 env 更改                               | 添加到按任务 `env` 或 `globalEnv`                             |
| `inputs` 包含 `dist/**` 或任务自身的 outputs            | 自失效缓存（输出更改 → 输入更改 → 重新运行）        | 仅列出源文件                                           |
| 使用 `--parallel` 来"加速"                                  | 绕过依赖图；构建可能无序运行             | 正确配置 `dependsOn`；让 Turborepo 并行化        |
| `inputs` 中的 `..` 相对路径                                    | 超出包范围，破坏可移植性                         | 使用 `$TURBO_ROOT$/path/to/file`                                  |
| 所有包共享根 `.env` 文件                            | 隐式耦合，粗粒度缓存失效                           | 按包 `.env`；仅对真正共享的内容使用 `globalEnv`    |
| `turbo build`（速记形式）在 CI 或 package.json 中                    | 保留用于交互式终端使用                                  | 始终 `turbo run build`                                         |