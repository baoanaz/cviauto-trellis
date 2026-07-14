# 工作区与目录布局

## 1. 概述

本文档介绍如何为 TypeScript SDK 项目规划基于 pnpm 的工作区：应使用哪些顶层目录（`apps/`、`packages/`、`tools/`），SDK 本身放在哪里，如何使用 `workspace:*` 依赖创建内部工作区包，以及如何从多仓库（multi-repo）设置迁移到单仓库（monorepo）。构建编排（`turbo.json`）、`exports` 字段和 npm 发布不在本文讨论范围内——请分别参阅 `turborepo-for-sdk.md` 和发布相关的参考文档。

---

## 2. 工作区顶层布局

一个 SDK 项目的 pnpm 工作区应收敛为三个顶层目录。除非有充分理由，否则从这里开始：

```text
repo/
├── apps/
│   └── cli/
├── packages/
│   ├── sdk-core/
│   ├── adapter-openai/
│   ├── shared-types/
│   ├── eslint-config/
│   └── typescript-config/
├── tools/
│   └── dev-scripts/
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

### 核心原则

1. **`apps/` 包含可部署或可执行的应用。** CLI、Web 应用、桌面应用、服务——任何你实际运行的东西——都属于这里。
2. **`packages/` 包含可复用的逻辑。** 任何被其他包导入的东西都属于这里。**你的 SDK 就放在这里。**
3. **`tools/` 包含仓库内部工具。** 代码生成器、发布辅助脚本、迁移脚本、本地维护命令。不是运行时 SDK 代码。
4. **每个包一个明确职责。** 每个包回答一个清晰的问题。
5. **不要使用嵌套的通配工作区。** 避免 `packages/**`。
6. **根目录仅用于编排。** 仓库工具放在根目录；应用逻辑不放这里。

### 何时使用各自目录

| 目录   | 存放内容                                       | 示例                                       | 不应放入的内容                          |
|-------------|---------------------------------------------|------------------------------------------------|-----------------------------------------|
| `apps/`     | 可执行文件、可部署应用、应用壳        | `apps/cli`、`apps/web`、`apps/desktop`         | 任何被其他包导入的内容    |
| `packages/` | 可复用库（SDK、类型、适配器）   | `packages/sdk-core`、`packages/adapter-openai` | 一堆不相关的工具集         |
| `tools/`    | 仓库内部脚本，不在运行时消费  | `tools/dev-scripts`、`tools/codegen`           | 任何 SDK 导入的内容                |

**经验法则：** 如果已发布的 SDK 或任何应用在运行时导入它，它就属于 `packages/`。如果你只在本地运行它来维护仓库，它就属于 `tools/`。

### `pnpm-workspace.yaml`

最小配置：

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

对于 npm/yarn/bun 风格的工作区（如果必须使用），在根目录的 `package.json` 中放入相同的 glob 模式：

```json
{
  "workspaces": ["apps/*", "packages/*", "tools/*"]
}
```

仅当你刻意按关注点对包进行分组时，才使用额外的 glob 模式：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/config/*"      # 分组的配置
  - "packages/features/*"    # 功能包
```

**避免** 递归 glob 模式：

```yaml
# 错误：模糊的发现方式，容易导致意外嵌套
packages:
  - "packages/**"
```

### 根目录 `package.json`

```json
{
  "name": "my-sdk-repo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

**根目录规则：**

- `private: true` 是必需的（永远不要发布根目录）。
- `packageManager` 锁定 pnpm 版本，确保所有贡献者一致。
- scripts 仅委托给编排器——不包含实际的构建逻辑。
- 根目录依赖仅包含仓库工具（`turbo`、`husky`、`changesets` 等）。
- 应用/SDK 依赖保留在使用它们的包中。

**错误**——运行时依赖放在根目录：

```json
{
  "dependencies": {
    "openai": "^4",
    "chalk": "^5",
    "zod": "^3"
  }
}
```

**正确**——仅工具放在根目录：

```json
{
  "devDependencies": {
    "turbo": "latest",
    "husky": "latest"
  }
}
```

---

## 3. SDK 包放在哪里

**SDK 始终放在 `packages/` 下。** 根据定义，它是其他代码导入的东西。

### 命名模式

没有唯一的"正确"名称。三种常见约定：

| 模式                         | 示例                  | 何时使用                                                                 |
|---------------------------------|--------------------------|-----------------------------------------------------------------------------|
| `packages/<name>`（SDK 名称） | `packages/stripe`        | 仓库本身就是 SDK；一个明显的包；匹配公共作用域名称。   |
| `packages/core`                 | `packages/core`          | SDK 拆分为 core + 适配器；`core` 是入口点。               |
| `packages/<name>-core`          | `packages/sdk-core`      | 多个 SDK 风格的包共享前缀；与适配器区分开来。 |
| `packages/sdk`                  | `packages/sdk`           | 仓库托管 SDK 加上不相关的应用；`sdk` 是明显的文件夹。        |

选择一个并保持一致。文件夹名称**不必**与发布名称匹配——发布名称来自 `package.json#name`（例如 `@acme/sdk`）。

### SDK + CLI 共存（wrangler 模式）

许多 SDK 附带一个配套 CLI，用于脚手架搭建、调试或从 shell 调用 SDK。将它们作为独立的包——SDK 放在 `packages/`，CLI 放在 `apps/`：

```text
repo/
├── apps/
│   └── cli/                # @acme/cli — 可执行文件，依赖 SDK
├── packages/
│   ├── sdk-core/           # @acme/sdk — 用户导入的库
│   ├── adapter-node/       # @acme/adapter-node — 运行时适配器
│   └── shared-types/       # @acme/shared-types — 纯类型合约
```

CLI 通过 `workspace:*` 依赖 SDK：

```json
// apps/cli/package.json
{
  "name": "@acme/cli",
  "private": true,
  "bin": {
    "acme": "./dist/bin.js"
  },
  "dependencies": {
    "@acme/sdk": "workspace:*",
    "@acme/shared-types": "workspace:*"
  }
}
```

**为什么拆分它们：**

- SDK 可以在 CLI 无意义的场景中消费（浏览器、边缘函数、其他 Node 库）。
- CLI 可以引入重量级依赖（`chalk`、`commander`、`prompts`），而不会污染 SDK 的安装体积。
- 版本控制、发布节奏和变更日志自然解耦。

### 库包，一般情况

以 SDK 为中心的仓库中 `packages/` 的良好结构：

```text
packages/
├── sdk-core/             # 主 SDK 对外接口
├── adapter-openai/       # 具体适配器实现
├── adapter-node/         # 特定运行时适配器
├── shared-types/         # 纯类型合约
├── eslint-config/        # 共享 lint 配置
└── typescript-config/    # 共享 tsconfig 预设
```

**错误**——模糊的"万能"包，最终变成垃圾场：

```text
packages/
├── shared/
├── core/                 # 包含所有内容
└── utils/                # 包含任何无处安放的东西
```

```text
packages/
└── shared/
    ├── commands/
    ├── tools/
    ├── providers/
    ├── prompts/
    └── session/
```

一个"shared"巨型包破坏了所有权边界，并强制每个使用者拉入不相关的传递代码。

---

## 4. 内部包创建模式

当你需要一个新的内部工作区包时，遵循以下清单：

1. **创建目录** 在 `packages/<name>/` 下。
2. **添加 `package.json`**，包含作用域名称（`@<org>/<name>`）、`version`、`private: true` 和入口点。
3. **添加源代码** 在 `src/` 中。
4. **添加 `tsconfig.json`**（通常扩展共享配置包）。
5. **将其作为依赖安装** 在使用包中，使用 `workspace:*`。
6. **运行 `pnpm install`** 更新锁文件。

### 逐步操作

```bash
# 1. 创建目录
mkdir -p packages/sdk-core/src

# 2. 初始化 package.json（手动编辑或通过 pnpm init）
cd packages/sdk-core
cat > package.json <<'EOF'
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
EOF

# 3. 编写代码
cat > src/index.ts <<'EOF'
export function createClient(config: { apiKey: string }) {
  return { apiKey: config.apiKey };
}
EOF

# 4. 扩展共享 tsconfig
cat > tsconfig.json <<'EOF'
{
  "extends": "@acme/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

# 5. 从消费应用中声明依赖
cd ../../apps/cli
pnpm add @acme/sdk@workspace:*

# 6. 安装解析链接
cd ../..
pnpm install
```

### `workspace:*` 协议

在 pnpm 和 bun 中，内部工作区依赖使用 `workspace:` 协议：

```json
// apps/cli/package.json
{
  "name": "@acme/cli",
  "dependencies": {
    "@acme/sdk":         "workspace:*",   // 始终使用工作区中的版本
    "@acme/shared-types": "workspace:^",  // 本地；发布时遵循 ^semver
    "@acme/utils":        "workspace:~"   // 本地；发布时遵循 ~semver
  }
}
```

| 说明符      | 效果                                                                        |
|----------------|-------------------------------------------------------------------------------|
| `workspace:*`  | 始终使用本地版本。发布时重写为已发布版本。  |
| `workspace:^`  | 本地树内。发布为 `^X.Y.Z`，匹配当前本地版本。      |
| `workspace:~`  | 本地树内。发布为 `~X.Y.Z`。                                         |

对于 npm/yarn，传递语法不同——对内部依赖使用 `"*"`：

```json
// npm/yarn 工作区——不要使用 workspace: 前缀
{ "@acme/sdk": "*" }
```

**错误：** 混用前缀：

```json
// 错误：npm/yarn 工作区不理解 "workspace:*"
{ "@acme/sdk": "workspace:*" }
```

### 安装到特定包

永远不要将运行时依赖安装到根目录。按包过滤安装：

```bash
# 添加运行时依赖到某个包
pnpm --filter @acme/adapter-openai add openai

# 添加开发依赖到某个包
pnpm --filter @acme/sdk add -D vitest

# 添加共享开发依赖（turbo、husky）仅到根目录
pnpm add -D turbo -w
```

---

## 5. 内部包的 `package.json` 骨架

这是**发布前**的骨架——即仅被其他工作区包消费的工作区内部包。已发布包的骨架（包含完整的 `exports` 条件、`files`、`publishConfig`）在单独的参考文档中介绍。

### 最小 JIT 包（TypeScript 源码作为入口点）

```json
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

当包仅被现代打包器（bundler）或处理 TypeScript 的构建步骤消费时使用此方式。在工作区内供下游使用时无需构建。

### 最小编译包（产出 `dist/`）

```json
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

在以下情况下使用此方式：

- 包被 Node 直接消费。
- 你想要构建缓存。
- 包可能被测试、打包器或具有不同工具链的其他应用消费。

### 最小目录布局

JIT：

```text
packages/sdk-core/
├── package.json
├── src/
│   └── index.ts
└── tsconfig.json
```

编译：

```text
packages/sdk-core/
├── package.json
├── src/
│   ├── index.ts
│   └── client.ts
├── dist/
└── tsconfig.json
```

### 按包定义脚本，而非根目录脚本

每个包定义自己的生命周期：

```json
// packages/adapter-openai/package.json
{
  "name": "@acme/adapter-openai",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

**避免** 硬编码包顺序的顺序根目录脚本：

```json
// 错误
{
  "scripts": {
    "build": "cd packages/shared-types && tsc && cd ../sdk-core && tsc && cd ../../apps/cli && tsc"
  }
}
```

```json
// 错误：无法并行化，无法过滤
{
  "scripts": {
    "lint": "eslint apps/cli && eslint packages/sdk-core && eslint packages/adapter-openai"
  }
}
```

按包定义任务让编排器可以并行化、缓存和精确过滤。编排层参见 `turborepo-for-sdk.md`。

---

## 6. 纯类型依赖 vs 运行时依赖

一个工作区内部包可以出现在三个不同的依赖字段中，具体取决于消费者需要从中获取什么。搞错这一点，你以后会向 npm 发布幽灵依赖（phantom deps）。

| 字段              | 何时用于内部包                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| `dependencies`     | 消费者从包中导入运行时值（函数、类、常量），并期望在执行时可用。 |
| `devDependencies`  | 消费者仅在构建/测试/lint 时需要该包（例如共享 eslint 配置、测试夹具、代码生成）。        |
| `peerDependencies` | 消费者使用包的类型，但期望宿主（嵌入它的应用）提供运行时实例。        |

### `dependencies` — SDK 内部包的默认方式

```json
// apps/cli/package.json
{
  "dependencies": {
    "@acme/sdk":           "workspace:*",
    "@acme/shared-types":  "workspace:*"
  }
}
```

如果 CLI 的编译输出在运行时从 `@acme/sdk` `require` 或 `import` 任何内容，这就是正确的字段。

### `devDependencies` — 配置和工具包

共享配置包由包管理器和工具链消费，而非运行时代码：

```json
// packages/sdk-core/package.json
{
  "devDependencies": {
    "@acme/eslint-config":      "workspace:*",
    "@acme/typescript-config":  "workspace:*"
  }
}
```

这些永远不会出现在运行时包中——它们只被 `eslint`、`tsc` 等使用。

### `peerDependencies` — 纯类型 / 宿主提供

在以下情况下使用 `peerDependencies`：

1. 内部包仅导出**类型**，运行时实例来自其他地方。
2. 内部包是一个插件/适配器，需要宿主已安装的特定版本的核心包。

```json
// packages/adapter-openai/package.json
{
  "peerDependencies": {
    "@acme/sdk":  "workspace:*",
    "openai":     "^4"
  },
  "devDependencies": {
    "@acme/sdk":  "workspace:*",
    "openai":     "^4"
  }
}
```

模式：将其列为 `peerDependencies` 作为安装合约，同时列为 `devDependencies` 以便在开发/测试期间本地解析。

### 纯类型依赖

如果一个包**纯粹为了其类型**（无运行时导入）而被消费，TypeScript 5+ 允许你使用 `import type`：

```ts
import type { ClientConfig } from "@acme/shared-types";
```

在这种情况下，当消费者本身就是最终应用时，依赖可以放在 `devDependencies`（仅构建时），或者当消费者是一个将这些类型重新导出给其自身调用者的库时，放在 `peerDependencies`。

**经验法则：**

- 应用导入包的运行时 ⇒ `dependencies`。
- 库期望宿主提供运行时 ⇒ `peerDependencies`（加上 `devDependencies` 用于本地解析）。
- 仅构建时（配置、代码生成、测试夹具）⇒ `devDependencies`。

---

## 7. 多仓库 → 单仓库迁移

将多个现有仓库折叠到一个 pnpm 工作区是一次性操作。请谨慎操作——你只有一次机会保留 git 历史。

### 概要

```bash
# 步骤 1 — 创建单仓库骨架
mkdir my-monorepo && cd my-monorepo
pnpm init
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
EOF
mkdir -p apps packages tools
git init && git add -A && git commit -m "chore: init monorepo scaffold"

# 步骤 2 — 对于每个仓库，将其历史重写目标子目录
# 选项 A: git filter-repo（推荐，需要 `pip install git-filter-repo`）
git clone https://github.com/acme/web-app /tmp/web-app
cd /tmp/web-app
git filter-repo --to-subdirectory-filter apps/web
cd -

# 将重写后的历史引入单仓库
git remote add web-app /tmp/web-app
git fetch web-app --tags
git merge web-app/main --allow-unrelated-histories -m "chore: import web-app history"
git remote remove web-app

# 选项 B: git subtree（无需额外工具，但速度较慢且历史记录较杂乱）
# git subtree add --prefix=apps/web https://github.com/acme/web-app main

# 对每个要导入的仓库重复此操作（packages/sdk-core、packages/adapter-openai 等）

# 步骤 3 — 将包重命名为作用域名称
# 在每个导入的 package.json 中：
#   "name": "web"  ->  "name": "@acme/web"
#   "name": "sdk"  ->  "name": "@acme/sdk"

# 步骤 4 — 将跨仓库的 registry 依赖替换为 workspace:*
# apps/web/package.json:
#   "@acme/sdk": "1.2.3"   ->   "@acme/sdk": "workspace:*"

# 步骤 5 — 提升共享配置
# 将 eslint、prettier、tsconfig 预设移动到 packages/eslint-config、packages/typescript-config
# 更新每个包以扩展共享配置：
#   { "extends": "@acme/typescript-config/library.json" }

# 步骤 6 — 安装编排器（turbo、nx 等）——参见 turborepo-for-sdk.md
pnpm add -D turbo -w

# 步骤 7 — 验证
pnpm install
pnpm -r run build
pnpm -r run test
pnpm -r run lint

# 步骤 8 — 统一 CI（参见你的 CI 参考文档）
```

### 经验教训

- **使用 `git filter-repo`，而非 `git filter-branch`。** `filter-branch` 已被弃用，速度慢，且存在细微的正确性问题。
- **在修改内容之前先导入历史。** 抵制在合并前"清理"旧仓库的冲动——每次导入前的修改都会膨胀重写操作。
- **每个包一次 commit 重命名。** 使最终的 `git log --follow` 记录可读。
- **锁文件变动是不可避免的。** 在导入时删除每个仓库的锁文件，并在单仓库根目录重新生成一次 `pnpm-lock.yaml`。
- **标签可能冲突。** 两个仓库都有 `v1.0.0` 标签会冲突。在导入时添加标签前缀：`git filter-repo --tag-rename '':'web-'`。
- **CI 不是免费的。** 你需要重新评估每个工作流、密钥和受保护分支——旧的 `.github/workflows/*.yml` 文件会随历史一起被带入，通常是不需要的。

---

## 8. 反模式

### A. 根目录任务污染

错误——运行时依赖和临时脚本放在根目录：

```json
{
  "name": "my-sdk-repo",
  "dependencies": {
    "openai": "^4",
    "chalk": "^5"
  },
  "scripts": {
    "build:sdk": "cd packages/sdk-core && tsc",
    "build:cli": "cd apps/cli && tsc"
  }
}
```

正确——根目录仅委托，依赖保留在导入它们的包中：

```json
{
  "name": "my-sdk-repo",
  "private": true,
  "scripts": {
    "build": "turbo run build"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### B. 深层 `apps/foo/lib/` 业务代码

错误——可复用逻辑埋在应用内部：

```text
apps/cli/src/
├── bin.ts
├── shared/        # 实际上被复用——应该是一个包
├── providers/     # 实际上被复用——应该是一个包
└── runtime/       # 整个 SDK 都放在这里
```

正确——提取另一个包会导入的任何内容：

```text
apps/cli/
└── src/
    └── bin.ts                # 仅 CLI 外壳

packages/
├── sdk-core/                 # 运行时
├── adapter-openai/           # 提供者
└── shared-types/             # 共享类型
```

**启发式方法：** 如果第二个应用会从第一个应用复制/粘贴一个文件夹，那这个文件夹就是一个包。

### C. 循环工作区依赖

错误——`@acme/sdk` 依赖 `@acme/adapter-openai`，而后者又依赖回 `@acme/sdk`：

```json
// packages/sdk-core/package.json
{ "name": "@acme/sdk", "dependencies": { "@acme/adapter-openai": "workspace:*" } }
```

```json
// packages/adapter-openai/package.json
{ "name": "@acme/adapter-openai", "dependencies": { "@acme/sdk": "workspace:*" } }
```

正确——反转依赖。适配器依赖合约；核心依赖合约；两者互不依赖：

```json
// packages/sdk-core/package.json
{ "dependencies": { "@acme/shared-types": "workspace:*" } }
```

```json
// packages/adapter-openai/package.json
{ "dependencies": { "@acme/shared-types": "workspace:*" } }
```

如果 SDK 需要实例化适配器，在运行时通过依赖注入（dependency injection）接受它们，而不是作为构建时导入。

### D. 混合应用和库的关注点

错误——`apps/` 目录包含没有执行内容的东西：

```text
apps/
├── cli/         # 实际的应用
├── shared/      # 不是应用——是一个库
├── providers/   # 不是应用——是一个库
└── runtime/     # 不是应用——是一个库
```

正确——只有可执行文件放在 `apps/` 中：

```text
apps/
├── cli/
├── desktop/
└── tui/

packages/
├── sdk-core/
├── adapter-openai/
└── shared-types/
```

### E. 跨包文件导入

错误——访问另一个包的内部实现：

```ts
import { runQuery } from "../../packages/sdk-core/src/internals/runner";
```

正确——通过包的公共名称导入：

```ts
import { runQuery } from "@acme/sdk";
```

这迫使你维护真正的公共对外接口，并保持重构的局部性。

### F. 递归工作区 glob 模式

错误：

```yaml
packages:
  - "packages/**"
```

这会静默地拾取任何未来包含 `package.json` 的嵌套文件夹，包括在特殊条件下的 `node_modules` 符号链接。要明确指定：

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

### G. 巨型包 "core"

错误——一个包拥有所有内容：

```text
packages/
└── sdk/
    ├── client/
    ├── adapters/
    ├── prompts/
    ├── storage/
    └── cli-helpers/
```

这创建了隐藏的内部耦合，阻止了独立版本控制，并迫使每个消费者安装所有内容。

正确——按关注点拆分：

```text
packages/
├── sdk-core/
├── adapter-openai/
├── adapter-anthropic/
├── shared-types/
└── storage/
```

---

## 决策清单

在提交布局之前，逐项检查此清单：

- 每个可执行文件都在 `apps/` 中吗？
- 每个可复用单元都在 `packages/` 中吗？
- 根目录仅委托和锁定工具吗？
- 每个包都有明确的职责吗？
- 内部依赖是否使用 `workspace:*`（pnpm/bun）或 `*`（npm/yarn）声明？
- 每个包可以独立构建、测试和 lint 吗？
- 是否存在零跨包文件导入（没有 `../../packages/...`）？
- 是否存在零循环工作区依赖？
- `pnpm-workspace.yaml` 是否列出了具体的 glob 模式，而非 `packages/**`？