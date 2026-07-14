# 目录结构

> 后端/CLI 代码在本项目中的组织方式。

---

## 概述

本项目是一个使用 ES 模块的 **TypeScript monorepo**。它发布一个 CLI 包（`@baoanaz/cviauto`）和一个可复用 core 包（`@baoanaz/cviauto-core`）。源码也遵循**自我试用（dogfooding）架构** — Trellis 使用自己的配置文件（`.cursor/`、`.claude/`、`.trellis/`）作为新项目的模板。

---

## 目录布局

```
packages/
├── core/                # @baoanaz/cviauto-core: 可复用 API
│   ├── src/
│   │   ├── channel/     # channel/thread 存储、归约器、事件协议辅助函数
│   │   ├── task/        # 可复用任务记录辅助函数
│   │   ├── testing/     # 供包消费者使用的测试辅助函数
│   │   └── index.ts     # 包公共 API
│   └── package.json     # 显式公共导出
└── cli/                 # @baoanaz/cviauto: 面向用户的 CLI
    ├── src/
    │   ├── cli/         # CLI 入口点和参数解析
    │   │   └── index.ts # 主 CLI 入口（Commander.js 设置）
    │   ├── commands/    # 命令实现（每个命令一个文件或文件夹）
    │   │   ├── init.ts
    │   │   ├── update.ts
    │   │   ├── uninstall.ts
    │   │   ├── mem.ts
    │   │   └── channel/ # Channel 命令渲染器和 CLI 编排
    │   ├── configurators/
    │   ├── constants/
    │   ├── templates/
    │   ├── types/
    │   ├── utils/
    │   └── index.ts     # CLI 包公共 API
    ├── scripts/         # 发布、清单、模板复制和验证脚本
    └── package.json
```

### 自我试用目录（项目根目录）

这些目录在构建时复制到 `dist/` 并用作模板：

```
.cursor/                 # Cursor 配置（自我试用）
├── commands/            # Cursor 斜杠命令
│   ├── start.md
│   ├── finish-work.md
│   └── ...

.claude/                 # Claude Code 配置（自我试用）
├── commands/            # 斜杠命令
├── agents/              # 多智能体管道 agents
├── hooks/               # 上下文注入 hooks
└── settings.json        # Hook 配置

.trellis/                # Trellis workflow（部分自我试用）
├── scripts/             # Python 脚本（自我试用）
│   ├── common/          # 共享实用工具（paths.py, developer.py, cli_adapter.py 等）
│   ├── hooks/           # 生命周期 hook 脚本（项目特定，不自我试用）
│   └── *.py             # 主脚本（task.py, get_context.py 等）
├── workspace/           # 开发者进度跟踪
│   └── index.md         # 索引模板（自我试用）
├── spec/                # 项目指南（不自我试用）
│   ├── cli/             # CLI 包规范（backend/, unit-test/）
│   ├── docs-site/       # 文档站点包规范（docs/）
│   └── guides/          # 思考指南
├── workflow.md          # Workflow 文档（自我试用）
└── .gitignore           # Git 忽略规则（自我试用）
```

---

## 自我试用架构

### 什么是自我试用的

直接从 Trellis 项目复制到用户项目的文件：

| 源 | 目标 | 描述 |
|--------|-------------|-------------|
| `.cursor/` | `.cursor/` | 整个目录复制 |
| `.claude/` | `.claude/` | 整个目录复制 |
| `.trellis/scripts/` | `.trellis/scripts/` | 全部脚本复制 |
| `.trellis/workflow.md` | `.trellis/workflow.md` | 直接复制 |
| `.trellis/.gitignore` | `.trellis/.gitignore` | 直接复制 |
| `.trellis/workspace/index.md` | `.trellis/workspace/index.md` | 直接复制 |

### 什么不是自我试用的

使用通用模板（在 `src/templates/` 中）的文件：

| 模板源 | 目标 | 原因 |
|----------------|-------------|--------|
| `src/templates/markdown/spec/**/*.md.txt` | `.trellis/spec/**/*.md` | 用户填写项目特定内容 |
| `src/templates/markdown/agents.md` | `AGENTS.md` | 项目根文件 |

### 构建过程

```bash
# scripts/copy-templates.js 将自我试用源复制到 dist/
pnpm build

# 结果:
dist/
├── .cursor/           # 从项目根 .cursor/
├── .claude/           # 从项目根 .claude/
├── .trellis/          # 从项目根 .trellis/（已过滤）
│   ├── scripts/       # 所有脚本（无 multi_agent/）
│   ├── workspace/
│   │   └── index.md   # 仅 index.md，无 developer 子目录
│   ├── workflow.md
│   └── .gitignore
└── templates/         # 从 src/templates/（无 .ts 文件）
    ├── common/        # 共享命令 + skill 模板
    ├── shared-hooks/  # 平台无关的 hook 脚本
    ├── claude/        # Claude 特定模板
    ├── {platform}/    # 其他平台模板
    └── markdown/
        └── spec/      # 通用 spec 模板
```

---

## 模块组织

### 层职责

| 层 | 目录 | 职责 |
|-------|-----------|----------------|
| Core | `packages/core/src/` | 可复用 API、归约器、存储辅助函数、类型化契约 |
| CLI | `packages/cli/src/cli/` | 解析参数、显示帮助、调用命令 |
| Commands | `packages/cli/src/commands/` | 实现 CLI 命令、编排操作 |
| Configurators | `packages/cli/src/configurators/` | 为工具复制/生成配置 |
| Templates | `packages/cli/src/templates/` | 提取模板内容，提供实用工具 |
| Types | `packages/cli/src/types/` | CLI 特定的 TypeScript 类型定义 |
| Utils | `packages/cli/src/utils/` | CLI 特定的实用函数 |
| Constants | `packages/cli/src/constants/` | CLI 常量（paths, names） |

共享逻辑属于 `packages/core/src/`，当它在终端命令渲染之外有用时。包边界规则位于 `trellis-core-sdk.md`。

### 配置器模式

配置器使用 `cpSync` 进行直接目录复制（自我试用）：

```typescript
// configurators/cursor.ts
export async function configureCursor(cwd: string): Promise<void> {
  const sourcePath = getCursorSourcePath(); // dist/.cursor/ or .cursor/
  const destPath = path.join(cwd, ".cursor");
  cpSync(sourcePath, destPath, { recursive: true });
}
```

### 模板提取

`extract.ts` 提供读取自我试用文件的实用工具：

```typescript
// 获取 .trellis/ 的路径（在 dev 和 production 中都能工作）
getTrellisSourcePath(): string

// 从 .trellis/ 读取文件
readTrellisFile(relativePath: string): string

// 从 .trellis/ 复制带有可执行脚本的目录
copyTrellisDir(srcRelativePath: string, destPath: string, options?: { executable?: boolean }): void
```

---

## 命名约定

### 文件和目录

| 约定 | 示例 | 用途 |
|------------|---------|-------|
| `kebab-case` | `file-writer.ts` | 所有 TypeScript 文件 |
| `kebab-case` | `multi-agent/` | 所有目录 |
| `*.ts` | `init.ts` | TypeScript 源文件 |
| `*.md.txt` | `index.md.txt` | markdown 模板文件 |

### 为什么模板使用 `.txt` 扩展名

模板使用 `.txt` 扩展名是为了：
- 防止 IDE markdown 预览渲染模板
- 明确这些是模板源，不是实际文档
- 避免与实际的 markdown 文件混淆

### Don't: 将自我试用 spec 泄露到 `templates/markdown/spec/`

**不变量**：`packages/cli/src/templates/markdown/spec/` 仅包含 **`.md.txt` 文件**。那里的裸 `.md` 文件是一个 bug — 它会被发送到 `dist/`（进入 npm tarball），但永远不会被 `markdown/index.ts` 导入，所以它永远不会落在用户磁盘上，除了死重 + 未来维护者混淆之外毫无用处。

**Bug 如何发生**（在 git log 中确认 — v0.1.x 到 v0.4）：spec 编写工作流写入到错误的目录。两个路径看起来几乎相同：

| 路径 | 用途 |
|------|---------|
| `.trellis/spec/<pkg>/<layer>/*.md` | 此仓库的自我试用 spec（Trellis 文档化自己的代码） |
| `packages/cli/src/templates/markdown/spec/<layer>/*.md.txt` | 面向用户的占位符模板（通过 `trellis init` 发送到新项目） |

如果你打开并编辑错误的一个，构建/测试/lint 时都不会失败 — `markdown/index.ts` 静默忽略你的新文件，因为它只读取 `.md.txt` 变体。漂移可能持续数年（在 2026-04 约 3 个月后被发现）。

**预防清单**（每当你添加或编辑 spec 层文件时应用）：

1. 将 spec 内容写入 `.trellis/spec/<pkg>/<layer>/<file>.md` — 这是自我试用位置。
2. 用户的模板存根位于 `packages/cli/src/templates/markdown/spec/<layer>/<file>.md.txt` — 写入面向用户的占位符，而不是实际内容。
3. 如果新文件未被 `packages/cli/src/templates/markdown/index.ts` 导入，它不应该存在于该目录中。`ls packages/cli/src/templates/markdown/spec/**/*.md` 必须返回空。

**审计命令**：
```bash
# 这里的每个文件必须以 .md.txt 结尾
find packages/cli/src/templates/markdown/spec -type f -name "*.md" ! -name "*.md.txt"
# （空输出 = 干净）
```

考虑将此 find 添加到回归测试（非空输出 → 失败），以便不变量由机器强制执行，而不是由记忆强制执行。

---

## Monorepo 检测（`project-detector.ts`）

### `detectMonorepo(cwd)` 流程

检测 monorepo 工作区配置并枚举包。返回 `DetectedPackage[]` 或 `null`。

**返回值语义**：

| 返回 | 含义 |
|--------|---------|
| `null` | 不是 monorepo（未找到工作区配置或 `.gitmodules`） |
| `[]`（空数组） | Monorepo 配置存在（例如 `pnpm-workspace.yaml`）但磁盘上没有匹配的包 |
| `[...]`（填充的数组） | Monorepo 包含已检测到的包 |

**检测优先级**（按顺序检查，结果合并）：

1. `.gitmodules` — 首先解析以构建子模块路径集
2. `pnpm-workspace.yaml` — `packages:` 列表
3. `package.json` `workspaces` — 数组或 `{packages: [...]}`（npm/yarn/bun）
4. `Cargo.toml` `[workspace]` — `members` 减 `exclude`
5. `go.work` — `use` 指令（块和单行形式）
6. `pyproject.toml` `[tool.uv.workspace]` — `members` 列表
7. `parsePolyrepo` — 兄弟 `.git` 扫描，**仅当 1-6 全部未命中且无子模块存在时触发**（最后手段回退）

所有工作区管理器的 glob 模式通过 `expandWorkspaceGlobs()` 扩展，结果通过标准化路径去重。

### `DetectedPackage` 接口

```typescript
interface DetectedPackage {
  name: string;         // 来自 readPackageName() 回退链
  path: string;         // 标准化相对路径（无 ./ 或尾随 /）
  type: ProjectType;    // 通过包目录上的 detectProjectType() 检测
  isSubmodule: boolean; // 如果路径出现在 .gitmodules 中则为 True
  isGitRepo: boolean;   // 如果通过 parsePolyrepo 发现则为 True（独立的 .git，不是子模块）
}
```

`isSubmodule` 和 `isGitRepo` 是**互斥的** — 它们对应两种不同的运行时配置 schema（`type: submodule` vs `git: true`）。参见下文的「CLI ↔ Runtime Schema Parity」。

### `expandWorkspaceGlobs()` 限制

- 仅支持 `*` 作为**完整路径段**通配符（例如 `packages/*`、`crates/*/subcrate`）
- **不**支持 `**`（递归通配）、`?` 或字符类 `[abc]`
- 不正好是 `*` 的段被视为文字路径组件
- 点文件（以 `.` 开头的目录）从通配匹配中排除
- 支持 `!` 前缀用于排除模式（例如 `!packages/internal`）

### `readPackageName()` 回退链

按优先级顺序从配置文件读取包名称，回退到目录基本名称：

1. `package.json` → `name` 字段
2. `Cargo.toml` → `[package]` `name`
3. `go.mod` → `module` 指令（最后一个路径段）
4. `pyproject.toml` → `[project]` `name`
5. 回退：`path.basename(pkgPath)`

### `.gitmodules` 自动检测

当 `.gitmodules` 存在时，其条目被解析并：

- 路径被添加到子模块查找集
- 如果未检测到工作区管理器，仅子模块仓库仍返回非空结果（每个子模块成为带有 `isSubmodule: true` 的 `DetectedPackage`）
- 如果工作区管理器也被检测到，子模块路径被合并：在子模块路径处的工作区包获得 `isSubmodule: true`，未被任何工作区管理器覆盖的子模块路径被添加为额外包

### `parsePolyrepo()` — 兄弟 `.git` 回退

**多仓库**布局的最后手段检测器（一个目录中多个独立的 git 仓库，无工作区管理器，无 `.gitmodules`）。

**规则**：

- 从 `cwd` 扫描最多 **2 层深度**（直接子级 + 孙级）。更深的布局必须通过 `config.yaml` 手动配置
- 一旦找到包含 `.git` 的目录，该路径即为候选，扫描**不**进入其中（一个包是原子的）
- 过滤掉：点前缀目录（`.git`、`.next`、`.venv`、`.trellis`、…）和一个显式忽略集：`node_modules`、`target`、`dist`、`build`、`out`、`bin`、`obj`、`vendor`、`coverage`、`tmp`、`__pycache__`。过滤在每个深度应用
- `.git` 可以是**目录或文件**（工作树 gitlink）。检测必须使用 `fs.existsSync` 而不带 `.isDirectory()`
- 跳过已在子模块集中的路径（避免重复计数）
- 如果少于 2 个候选则返回 `null`（单个 `.git` 更可能是意外克隆而非多仓库）

**门控**：仅当所有 6 个先前解析器返回 null **且**子模块集为空时才运行。工作区配置始终胜过 polyrepo 推理。

> **陷阱**：兄弟 `.git` 启发式被有意在自动检测模式下触发（不需要标志）。`init.ts` 中现有的交互式 `confirm` 提示是用户意图门控。不要添加单独的 `--monorepo` 风格守卫 — 它会重复现有的安全机制。

---

## Monorepo Init 流程（`init.ts`）

### CLI 标志

| 标志 | 行为 |
|------|----------|
| `--monorepo` | 强制 monorepo 模式。检测器未命中时，打印所有 7 个标记的清单 + 一个手动 `config.yaml` 示例，显示 `type: submodule` 和 `git: true`，然后 `return`（不是 `process.exit(1)`） |
| `--no-monorepo` | 完全跳过 monorepo 检测 |
| _（两者都不是）_ | 自动检测；如果找到包则提示用户确认 |

> **设计决策（不要轻易重新审视）**：有意**没有 `--packages` CLI 标志**。非标准布局用户的逃生舱是手工编写 `.trellis/config.yaml` 中的 `packages:` — `writeMonorepoConfig` 是非破坏性的，不会覆盖。原因：（1）`config.yaml` 是运行时权威来源，标志将是临时重复；（2）Trellis 偏好声明性配置而非命令式标志。如果未来需求对此有意见，在添加标志之前记录用例。

### Init 顺序（Monorepo 路径）

1. **检测**：调用 `detectMonorepo(cwd)` 查找包
2. **确认**：在交互模式下，显示检测到的包并提示「Enable monorepo mode?」
3. **每包模板**：对于每个包，询问是使用空白 spec 还是下载远程模板（使用 `-y` 跳过）
4. **创建工作流结构**：使用 `packages` 数组调用 `createWorkflowStructure()`，创建每包 spec 目录（`spec/<name>/backend/`、`spec/<name>/frontend/` 等）
5. **写入配置**：调用 `writeMonorepoConfig()` 修补 `config.yaml`

### `writeMonorepoConfig()` 行为

非破坏性 config.yaml 修补：

- **读取**现有的 `config.yaml`（文件不存在时为 no-op）
- **如果 `packages:` 键已存在则跳过**（重新 init 安全 — 也使手工编写的配置成为非标准布局的受支持逃生舱）
- **追加** `packages:` 块，包含每个包的 `path` 和可选的 `type: submodule` **或** `git: true`（互斥 — 一个包不能同时是子模块和多仓库条目）
- **设置** `default_package:` 为第一个非子模块包（回退到第一个包）

### CLI ↔ Runtime Schema Parity

TS `DetectedPackage` 接口和 Python 运行时配置 schema 是耦合的。更改一个时，更改另一个。

| TS 字段（`DetectedPackage`） | YAML 键（`config.yaml` `packages.<name>`） | Python 读取器 |
|---|---|---|
| `isSubmodule: true` | `type: submodule` | `get_submodule_packages()` 在 `.trellis/scripts/common/config.py` 中 |
| `isGitRepo: true` | `git: true` | `get_git_packages()` 在 `.trellis/scripts/common/config.py` 中 |

Python 辅助函数 `_is_true_config_value()` 接受 `true`（大小写不敏感的字符串）。YAML 文字由 `writeMonorepoConfig` 不带引号发出。端到端往返由 `test/commands/init.integration.test.ts` 多仓库案例覆盖。

### 运行时会话上下文回退

`common/session_context.py` 在注入包 Git 状态时消费 `git: true` 运行时 schema。已配置的包列表仍然是主要权威来源。

为了与在 polyrepo 检测之前初始化或手工创建 Trellis 根的项目保持向后兼容，会话上下文有一个有限的回退：当 Trellis 根不是 Git 工作树且没有已配置的包 Git 仓库可用时，它可以扫描直接子目录和孙目录以查找独立的 `.git` 条目并注入这些仓库的状态。此回退必须镜像 `parsePolyrepo()`：

- 最大深度：两层
- 跳过点前缀和生成的/vendor 目录
- 接受 `.git` 作为目录或文件
- 找到子仓库后停止下降
- 将布局视为 polyrepo 之前至少需要两个发现的仓库

不要使用回退重写 `config.yaml`；它仅作上下文使用。非标准布局的用户仍应显式配置 `packages:`。

### 每包 Spec 目录创建

对于每个检测到的包，`createWorkflowStructure()` 基于包检测到的 `ProjectType` 创建 spec 目录：

- `backend` → `.trellis/spec/<name>/backend/*.md`
- `frontend` → `.trellis/spec/<name>/frontend/*.md`
- `fullstack` / `unknown` → backend 和 frontend 目录都有

收到远程模板下载的包（通过 `remoteSpecPackages` 集跟踪）跳过空白 spec 模板创建。

---

## DO / DON'T

### DO

- 在可能的情况下从项目自己的配置文件中自我试用
- 使用 `cpSync` 复制整个目录
- 将通用模板保留在 `src/templates/markdown/` 中
- 对模板文件使用 `.md.txt` 或 `.yaml.txt`
- 进行更改时更新自我试用源（`.cursor/`、`.claude/`、`.trellis/scripts/`）
- 在记录脚本调用时始终显式使用 `python3`（Windows 兼容性）

### DON'T

- 不要硬编码文件列表 — 改为复制整个目录
- 不要在模板和自我试用源之间重复内容
- 不要将项目特定内容放在通用模板中
- 不要对 spec/ 使用自我试用（用户填写这些）

---

## 设计决策

### 远程模板下载（giget）

**上下文**：需要下载 GitHub 子目录以支持远程模板。

**考虑过的选项**：
1. `degit` / `tiged` - 简单，但没有编程 API
2. `giget` - TypeScript 原生，有编程 API，被 Nuxt/UnJS 使用
3. 手动 GitHub API - 太复杂

**决策**：使用 `giget`，因为：
- TypeScript 原生，带编程 API
- 支持 GitHub 子目录：`gh:user/repo/path/to/subdir`
- 内置缓存，支持离线
- 由 UnJS 生态系统积极维护

**示例**：
```typescript
import { downloadTemplate } from "giget";

await downloadTemplate("gh:mindfold-ai/Trellis/marketplace/specs/electron-fullstack", {
  dir: destDir,
  preferOffline: true,
});
```

### 目录冲突策略（skip/overwrite/append）

**上下文**：下载远程模板时，目标目录可能已存在。

**决策**：三种策略，`skip` 为默认：
- `skip` - 如果目录存在则不下载（安全默认）
- `overwrite` - 删除现有，下载全新
- `append` - 仅复制不存在的文件（合并）

**为什么**：giget 原生不支持 append，所以我们：
1. 下载到临时目录
2. 遍历并仅复制缺失的文件
3. 清理临时目录

**示例**：
```typescript
// append 策略实现
const tempDir = path.join(os.tmpdir(), `trellis-template-${Date.now()}`);
await downloadTemplate(source, { dir: tempDir });
await copyMissing(tempDir, destDir);  // 仅复制不存在的文件
await fs.promises.rm(tempDir, { recursive: true });
```

### 可扩展模板类型映射

**上下文**：当前只有 `spec` 模板，但未来需要 `skill`、`command`、`full` 类型。

**决策**：使用类型字段 + 映射表实现可扩展性：

```typescript
const INSTALL_PATHS: Record<string, string> = {
  spec: ".trellis/spec",
  skill: ".claude/skills",
  command: ".claude/commands",
  full: ".",  // 整个项目根
};

// 用法：从模板类型自动检测安装路径
const destDir = INSTALL_PATHS[template.type] || INSTALL_PATHS.spec;
```

**可扩展性**：添加新模板类型：
1. 向 `INSTALL_PATHS` 添加条目
2. 向 `index.json` 添加带新类型的模板
3. 下载逻辑无需代码更改
