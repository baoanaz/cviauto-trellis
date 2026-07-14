# 质量指南

> 后端/CLI 开发的代码质量标准。

---

## 概述

本项目强制执行严格的 TypeScript 和 ESLint 规则以维护代码质量。配置优先考虑类型安全、显式声明和现代 JavaScript 模式。

---

## TypeScript 配置

### 严格模式

项目在 `tsconfig.json` 中使用 `strict: true`：

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

这启用了：
- `strictNullChecks` - Null 和 undefined 必须显式处理
- `strictFunctionTypes` - 函数参数类型严格检查
- `strictPropertyInitialization` - 类属性必须初始化
- `noImplicitAny` - 所有类型必须显式
- `noImplicitThis` - `this` 必须有显式类型

---

## ESLint 规则

### 禁止模式

| 规则 | 设置 | 原因 |
|------|---------|--------|
| `@typescript-eslint/no-explicit-any` | `error` | 强制正确类型化 |
| `@typescript-eslint/no-non-null-assertion` | `error` | 防止运行时 null 错误 |
| `no-var` | `error` | 改为使用 `const` 或 `let` |

### 必需模式

| 规则 | 设置 | 描述 |
|------|---------|-------------|
| `@typescript-eslint/explicit-function-return-type` | `error` | 所有函数必须声明返回类型 |
| `@typescript-eslint/prefer-nullish-coalescing` | `error` | 对默认值使用 `??` 而非 `\|\|` |
| `@typescript-eslint/prefer-optional-chain` | `error` | 对可选访问使用 `?.` |
| `prefer-const` | `error` | 变量未重新赋值时使用 `const` |

### 例外

```javascript
// eslint.config.js
rules: {
  "@typescript-eslint/explicit-function-return-type": [
    "error",
    {
      allowExpressions: true,          // 回调中的箭头函数 OK
      allowTypedFunctionExpressions: true,  // 类型化函数表达式 OK
    },
  ],
  "@typescript-eslint/no-unused-vars": [
    "error",
    {
      argsIgnorePattern: "^_",   // 未使用参数前缀 _
      varsIgnorePattern: "^_",   // 未使用变量前缀 _
    },
  ],
}
```

---

## 代码模式

### 返回类型声明

所有函数必须有显式返回类型：

```typescript
// Good: 显式返回类型
function detectProjectType(cwd: string): ProjectType {
  // ...
}

async function init(options: InitOptions): Promise<void> {
  // ...
}

// Bad: 缺少返回类型（ESLint 错误）
function detectProjectType(cwd: string) {
  // ...
}
```

### Nullish 合并

对默认值使用 `??`，而非 `||`：

```typescript
// Good: Nullish 合并
const name = options.name ?? "default";
const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
const depNames = Object.keys(allDeps ?? {});

// Bad: 逻辑 OR（将空字符串、0 视为 falsy）
const name = options.name || "default";
```

### 可选链

对可选属性访问使用 `?.`：

```typescript
// Good: 可选链
const version = config?.version;
const deps = pkg?.dependencies?.["react"];

// Bad: 手动检查
const version = config && config.version;
```

### Const 声明

默认使用 `const`，仅在需要重新赋值时使用 `let`：

```typescript
// Good: 未重新赋值使用 const
const cwd = process.cwd();
const options: InitOptions = { force: true };

// Good: 重新赋值使用 let
let developerName = options.user;
if (!developerName) {
  developerName = detectFromGit();
}

// Bad: 未重新赋值使用 let
let cwd = process.cwd();  // ESLint 错误: prefer-const
```

### 未使用变量

未使用参数前缀下划线：

```typescript
// Good: 下划线前缀
function handler(_req: Request, res: Response): void {
  res.send("OK");
}

// Bad: 未使用且无前缀（ESLint 错误）
function handler(req: Request, res: Response): void {
  res.send("OK");
}
```

---

## 接口和类型模式

### 接口定义

为结构化数据定义接口：

```typescript
// Good: 选项接口
interface InitOptions {
  cursor?: boolean;
  claude?: boolean;
  yes?: boolean;
  user?: string;
  force?: boolean;
}

// Good: 返回类型接口
interface WriteOptions {
  mode: WriteMode;
}
```

### 类型别名

对联合类型和计算类型使用类型别名：

```typescript
// Good: 联合类型别名
export type AITool = "claude-code" | "cursor" | "opencode";
export type WriteMode = "ask" | "force" | "skip" | "append";
export type ProjectType = "frontend" | "backend" | "fullstack" | "unknown";

// Good: 带 const 断言的类型别名
export const DIR_NAMES = {
  WORKFLOW: ".trellis",
  PROGRESS: "agent-traces",
} as const;
```

### 导出模式

显式导出类型：

```typescript
// Good: 显式类型导出
export type { WriteMode, WriteOptions };
export { writeFile, ensureDir };

// Good: 组合导出
export type WriteMode = "ask" | "force" | "skip" | "append";
export function writeFile(path: string, content: string): Promise<boolean> {
  // ...
}
```

---

## 禁止模式

### 绝不使用 `any`

```typescript
// Bad: 显式 any
function process(data: any): void { }

// Good: 正确的类型化
function process(data: Record<string, unknown>): void { }
function process<T>(data: T): void { }
```

### 绝不使用非空断言

```typescript
// Bad: 非空断言
const name = user!.name;

// Good: 正确的 null 检查
const name = user?.name ?? "default";
if (user) {
  const name = user.name;
}
```

### 绝不使用 `var`

```typescript
// Bad: var 声明
var count = 0;

// Good: const 或 let
const count = 0;
let mutableCount = 0;
```

---

## Schema 废弃：审计所有写入器，而不仅仅是创建器

**触发器**：从持久化 schema（例如 `task.json`、迁移清单、配置文件）中移除字段。

**常见错误**：从创建器（`cmd_create` / init）和读取器（normalize / load）中移除字段，但忘记**其他写入器**（hooks、触发器、子进程）仍然在每个事件上重新填充该字段。净效果：字段在文档中「已废弃」，但仍出现在新写入的文件中 — 你已声明清理但未执行。

### 范围 / 触发器
- 任何从 schema 结构体或 JSON 输出中移除字段的提交。
- 触发器独立于读取器是否仍然容忍该字段。

### 审计契约
在落地移除之前，产出一份写入器清单：

```bash
# 查找写入该字段的每个位置（不仅是 schema 定义）
grep -rn "<field_name>" --include="*.py" --include="*.ts" --include="*.js" .
```

对每个命中进行分类：

| 种类 | 示例 | 操作 |
|------|---------|--------|
| **Schema / 创建器** | `task_store.cmd_create`、`@baoanaz/cviauto-core/task:emptyTaskRecord`（由 `utils/task-json.ts:emptyTaskJson` 重新导出，供遗留 CLI 调用点使用） | 从输出中丢弃字段 |
| **写入器 / 更新器** | `inject-subagent-context.py:update_current_phase`、OpenCode plugin 等效 | **删除写入调用或完全删除函数** |
| **读取器 / 获取器** | `tasks.py:load_task`（通过 `TaskInfo` 上的 `data.get("field", default)` 默认值） | 保留容忍默认值（`data.get("field", null)`）— 处理遗留文件 |
| **文档 / 注释** | spec、README、PRDs | 更新引用 |
| **测试** | 对字段存在的断言 | 翻转为「必须不包含字段」 |

### 验证与错误矩阵
| 条件 | 预期行为 |
|-----------|-------------------|
| 新任务：字段在 `task.json` 中存在 | ❌ 回归 — 写入器遗漏 |
| 旧任务仍有字段 | ✅ 容忍（读取器默认值） |
| 同一生命周期操作运行两次 | ✅ 字段永不重新出现 |

### 所需测试
- **写入器回归**：调用创建器 → 断言字段不在输出中。示例：`test task.py create does NOT write legacy current_phase / next_action`。
- **写入器事后回归**：模拟历史上重新写入字段的下游事件（例如 spawn 子 agent → hook 触发）→ 重新读取文件 → 断言字段仍然缺失。
- **读取器兼容性**：mock 包含该字段的遗留文件 → 断言读取器不抛出。

### Wrong vs Correct
#### Wrong — 清理仅触及创建器
```python
# task_store.cmd_create — 丢弃了 current_phase
task_data = {"status": "planning", ...}  # current_phase 已移除
```
```python
# inject-subagent-context.py — 仍然在每次 spawn 时写入它
def update_current_phase(task_dir, subagent_type):
    task = read_json(task_dir / "task.json")
    task["current_phase"] = next_phase(...)  # ← 重新填充已废弃字段
    write_json(task_dir / "task.json", task)
```
净效果：第一次 `implement` spawn 后，`task.json` 再次包含 `current_phase`。废弃被静默撤销。

#### Correct — 删除每个写入器，或通过单一入口点路由
选项 A：删除写入器函数。
```python
# inject-subagent-context.py
# （update_current_phase + 其调用已移除；hook 不再写入 phase）
```
选项 B：保留写入器但使其停止发出该字段。
```python
def update_task_state(task_dir, subagent_type):
    task = read_json(task_dir / "task.json")
    task["last_subagent"] = subagent_type  # 新字段
    # current_phase 未写入
    write_json(task_dir / "task.json", task)
```

### 为什么
字段只有在每个可能产生它的代码路径都被移除后才算「消失」。静默留下幽灵写入器使废弃无法执行，并迫使未来读取器永远继续支持该字段。

### 案例研究（2026-04-22）：`current_phase` / `next_action` 在 4 个写入器 + 类型声明中漂移

任务 `04-21-task-schema-unify` 对 0.5.0-beta.0 中 `current_phase` / `next_action` 的废弃进行了追溯审计，发现原始清理遗漏了**四种**漂移模式，跨越 **TypeScript 和 Python**：

| # | 位置 | 漂移模式 | 为什么第一次审计遗漏了它 |
|---|----------|------------|-------------------------------|
| 1 | `packages/cli/src/commands/init.ts`（`interface TaskJson` + `getBootstrapTaskJson`） | 16 字段 TS 接口 + 内联对象字面量 | 审计 grep 了字段名，但此写入器省略了它们而非写入它们 — 它在形状上静默偏离，而非内容 |
| 2 | `packages/cli/src/commands/update.ts`（migration-task 内联字面量） | 内联 TS 对象仍然写入 `current_phase: 0` + `next_action: [...]` | 写入器存在于原始 Python 聚焦的审计所跳过的语言中 |
| 3 | 历史 `create_bootstrap.py` 脚本（在 0.5.0-beta.9 中移除） | 孤儿 Python CLI — 其自己的 13 字段形状，包括结构化子任务 | 未被任何命令调用，并作为死模板发布。它现在通过哈希验证的迁移被移除，但仍是案例研究的一部分，因为它解释了为什么发布但未使用的文件在 schema 审计中算数 |
| 4 | `.trellis/scripts/common/types.py` — `TaskData` TypedDict 声明了 `current_phase: int` + `next_action: list[dict]` | **类型声明写入器**：没有运行时代码产生该字段，但注解 `TaskData` 的读取器获得 IDE 自动补全幽灵字段，代码审查者看到「有效字段」 | TypedDict 在技术上是声明，不是写入器 — 但对读取器端契约，它确实是期望的写入器 |

**添加到审计纪律的三条教训**：

1. **跨语言 grep**：移除字段时，grep 必须跨越 `.py`、`.ts`、`.js` 和 `.json`（迁移清单 changelog 可能泄露字段名并导致复制粘贴）。限制为 `--include="*.py" --include="*.ts"` 加上检查清单 `.json` 文件。
2. **发布但未使用的代码算数**：模板注册表中枚举的任何文件（`packages/cli/src/templates/trellis/index.ts`、`templates/markdown/index.ts`）都是用户期望的写入器，即使没有命令调用它。孤儿 = 仍然写入。
3. **类型声明算作读取器端契约的写入器**：仍然声明已废弃字段的 TypedDict / TS 接口以与运行时写入器相同的方式误导消费者。在与运行时写入器相同的 PR 中修剪声明。

**合并结果**：规范 TypeScript 任务形状现在位于 `@baoanaz/cviauto-core/task` 中，作为 `TrellisTaskRecord` + `emptyTaskRecord(overrides)`。`packages/cli/src/utils/task-json.ts` 仅以遗留的 `TaskJson` / `emptyTaskJson` 名称重新导出这些，供 CLI 调用点使用。`init.ts` 和 `update.ts` 都通过该共享工厂路由。未来 schema 更改的审计集现在是：规范 Python `cmd_create`（运行时）+ core `TrellisTaskRecord` / `emptyTaskRecord`（TS schema + 工厂）+ CLI `utils/task-json.ts` 重新导出用户（bootstrap + migration）+ `TaskData` TypedDict（Python 声明）。

---

## 质量检查清单

提交前，确保：

- [ ] `pnpm lint` 通过，无错误
- [ ] `pnpm typecheck` 通过，无错误
- [ ] 所有函数有显式返回类型
- [ ] 代码中无 `any` 类型
- [ ] 无非空断言（`x!` 操作符）
- [ ] 对默认值使用 `??` 而非 `||`
- [ ] 对可选属性访问使用 `?.`
- [ ] 默认使用 `const`，仅在需要时使用 `let`
- [ ] 未使用变量前缀 `_`

---

## 运行质量检查

```bash
# 运行 ESLint
pnpm lint

# 运行 TypeScript 类型检查
pnpm typecheck

# 运行两者
pnpm lint && pnpm typecheck
```

---

## CLI 设计模式

### 显式标志优先

当 CLI 同时有显式标志（`--tool`）和便利标志（`-y`）时，显式标志必须始终胜出：

```typescript
// Bad: -y 覆盖显式标志
if (options.yes) {
  tools = ["cursor", "claude"]; // 忽略 --iflow、--opencode!
} else if (options.cursor || options.iflow) {
  // 从标志构建...
}

// Good: 先检查显式标志
const hasExplicitTools = options.cursor || options.iflow || options.opencode;
if (hasExplicitTools) {
  // 从显式标志构建（带或不带 -y 都能工作）
} else if (options.yes) {
  // 仅在没有显式标志时默认
}
```

**为什么**：用户指定显式标志是有意的。`-y` 标志意味着「跳过交互式提示」，而不是「忽略我的其他标志」。

### 场景：非交互式批量标志不得提示

#### 1. 范围 / 触发器

- 触发器：接受批量解析标志的任何命令，如 `--force`、`--skip-all`、`--create-new` 或命令特定的 `--yes`。
- 原因：这些标志是非交互式执行的显式同意。当 stdin 关闭时，后续的确认提示可能导致 CI 或冒烟测试崩溃。

#### 2. 签名

- `trellis update --force`
- `trellis update --skip-all`
- `trellis update --create-new`
- `trellis update --force --migrate`
- `update({ force?: boolean, skipAll?: boolean, createNew?: boolean, migrate?: boolean })`

#### 3. 契约

- `--force`、`--skip-all` 和 `--create-new` 解析文件冲突而不需要每文件提示。
- 相同的标志也绕过最终的 `Proceed?` 确认提示。
- 单独的 `--migrate` 可能仍然提示修改过的迁移条目和最终确认。
- `--dry-run` 必须在任何变更或确认提示之前返回。
- 带批量标志的空操作 update 必须仍然完成而不触碰 `inquirer.prompt`。

#### 4. 验证与错误矩阵

| 条件 | 必需行为 |
|-----------|-------------------|
| `update --force --migrate` 在非 TTY shell 中 | 以 0 或域错误退出；永不因 readline/inquirer 生命周期错误崩溃 |
| 带修改模板的 `update --force` | 覆盖，更新哈希，无提示 |
| 带修改模板的 `update --skip-all` | 保留文件，无提示 |
| 带修改模板的 `update --create-new` | 写入 `.new`，无提示 |
| 不带批量标志的 `update --migrate` | 可能交互式提示 |
| `update --dry-run` | 无提示，无备份，无写入 |

#### 5. Good/Base/Bad 案例

- Good：`node dist/cli/index.js update --force --migrate` 可以作为冒烟测试运行，stdin 关闭，要么更新文件，要么报告已是最新。
- Base：`trellis update --migrate` 在终端中询问用户如何处理修改过的迁移文件。
- Bad：`--force` 解析了文件冲突但仍询问 `Proceed?`，然后在 CI 中以 `ERR_USE_AFTER_CLOSE` 崩溃。

#### 6. 所需测试

- 集成测试在设置后清除 `inquirer.prompt` mock 并断言 `update({ force: true })` 不调用它。
- 现有的 force/skip/create-new 测试必须继续断言文件结果。
- 构建后的真实 CLI 冒烟测试：`node packages/cli/dist/cli/index.js update --force --migrate`。

#### 7. Wrong vs Correct

##### Wrong

```typescript
if (!options.dryRun) {
  await inquirer.prompt([{ name: "proceed", message: "Proceed?" }]);
}
```

##### Correct

```typescript
const batchMode = options.force || options.skipAll || options.createNew;
if (!options.dryRun && !batchMode) {
  await inquirer.prompt([{ name: "proceed", message: "Proceed?" }]);
}
```

### 数据驱动配置

处理多个类似选项时，使用带元数据的数组而不是重复的 if-else：

```typescript
// Bad: 重复的 if-else
if (options.cursor) tools.push("cursor");
if (options.claude) tools.push("claude");
if (options.iflow) tools.push("iflow");
// ... 重复逻辑，容易遗漏

// Good: 数据驱动方法
const TOOLS = [
  { key: "cursor", name: "Cursor", defaultChecked: true },
  { key: "claude", name: "Claude Code", defaultChecked: true },
  { key: "iflow", name: "iFlow CLI", defaultChecked: false },
] as const;

// 唯一权威来源用于：
// - 从标志构建：TOOLS.filter(t => options[t.key])
// - 交互式选择：TOOLS.map(t => ({ name: t.name, value: t.key }))
// - 默认值：TOOLS.filter(t => t.defaultChecked)
```

**好处**：
- 添加新工具 = 向 TOOLS 数组添加一行
- 显示名称、标志键和默认值共存一处
- 更少代码重复，更少 bug

### 自动检测模式必须在所有代码路径中探测

当 CLI 通过探测资源来自动检测模式（例如 marketplace vs 直接下载）时，探测必须在**每个**使用结果的代码路径中运行 — 包括 `-y`（非交互式）模式：

```typescript
// Bad: 探测仅在交互模式下运行
let templates: Item[] = [];
if (!options.yes) {
  templates = await fetchIndex(url); // 仅交互式探测
}
// -y 模式: templates 保持 []，落入直接模式
// Bug: marketplace 注册表被静默下载为原始目录

// Good: 在所有需要结果的路径中探测
if (options.template) {
  selectedTemplate = options.template; // 显式：不需要探测
} else if (!options.yes) {
  // Interactive: 探测 + 显示选择器
  const result = await probeIndex(url);
  // ...
} else if (registry) {
  // 带注册表的 -y 模式: 仍然需要探测
  const result = await probeIndex(url);
  if (result.templates.length > 0) {
    // Marketplace 需要选择 — 不能在 -y 模式中自动选择
    console.error("Use --template to specify which template");
    return;
  }
}
```

**为什么**：`-y` 标志意味着「跳过交互式提示」，而不是「跳过网络操作」。如果模式决定依赖于远程资源，探测必须无论交互性如何都发生。

### 重建复合标识符时不要丢弃字段

当结构化对象被解析为部分并在之后重新组装时，包含**所有**已解析的字段：

```typescript
// Bad: ref 被解析但在重建时丢弃
const registry = parseSource("gh:org/repo/path#develop");
// registry = { provider: "gh", repo: "org/repo", ref: "develop", ... }
const repoSource = `${registry.provider}:${registry.repo}`;
// Result: "gh:org/repo" — ref "develop" 丢失，默认为 "main"

// Good: 包含所有相关字段
const repoSource = `${registry.provider}:${registry.repo}#${registry.ref}`;
// Result: "gh:org/repo#develop"
```

**预防**：当从已解析对象构建字符串时，审查对象的字段并验证每个字段要么被包含，要么显式不相关。

### Don't: 对模式检测逻辑使用「警告并继续」

当代码基于探测结果决定运行哪个模式时，警告 + 继续在功能上等同于完全没有修复：

```typescript
// Bad: 警告打印但代码仍然落入错误模式
if (!probeResult.isNotFound) {
  console.log(chalk.yellow("Warning: network issue, attempting direct download"));
}
// 落入 → 下载 marketplace 根目录作为 spec 目录

// Good: 中止或循环回 — 永不静默切换模式
if (!probeResult.isNotFound) {
  console.log(chalk.red("Could not reach registry. Check connection and retry."));
  return; // 或: continue（循环回到选择器）
}
```

**为什么**：「警告并继续」适用于**降级功能**（缺失可选数据）。它**不**适用于**模式决定** — 错误模式导致数据损坏，而不仅仅是降级 UX。

### 约定：分支切换时重置共享状态

当用户输入或控制流更改上下文（例如，从官方 marketplace 切换到自定义源）时，重置被先前上下文填充的任何共享状态：

```typescript
// Bad: fetchedTemplates 仍有官方 marketplace 结果
registry = parseRegistrySource(customSource);
// fetchedTemplates.length > 0 → 直接下载守卫永不触发！

// Good: 进入新上下文前重置
registry = parseRegistrySource(customSource);
fetchedTemplates = []; // 清除来自先前源的过期数据
```

**为什么**：跨分支的共享可变状态是静默 bug 工厂。后续守卫（`registry && fetchedTemplates.length === 0`）依赖于 `fetchedTemplates` 反映*当前*源，而不是前一个。

### 场景：注册表探测和下载必须共享后端

#### 1. 范围 / 触发器

当 CLI 注册表流探测一个后端以决定 marketplace vs 直接下载模式，然后稍后下载内容时，所选后端是控制流契约的一部分。这适用于 `trellis init --registry`，特别是私有/自托管 Git 注册表。

#### 2. 签名

```typescript
type RegistryBackend = "http" | "git";

interface RegistryProbeResult {
  templates: SpecTemplate[];
  isNotFound: boolean;
  backend: RegistryBackend;
  error?: RegistryBackendError;
}
```

#### 3. 契约

- `backend` 记录哪个实现产生了探测结果。
- `isNotFound: true` 意味着注册表路径存在但没有 `index.json`；它可能进入直接下载模式。
- `error` 意味着探测失败，不得进入直接下载模式。
- 接收注册表的下载函数必须要么使用探测的 `backend`，要么在下载前重新探测。

#### 4. 验证与错误矩阵

| 条件 | 结果 |
|---|---|
| `index.json` 存在并解析 | `templates.length > 0`、`isNotFound: false`、`backend` 已设置 |
| 在有效注册表路径无 `index.json` | `templates: []`、`isNotFound: true`、`backend` 已设置 |
| Auth 失败 / 无效登录页面 JSON / 网络故障 | `isNotFound: false`、`error` 已设置，中止或循环回 |
| 模板路径在仓库根之外 | `path-not-found` 错误 |
| Git ref 缺失 | `ref-not-found` 错误 |

#### 5. Good/Base/Bad 案例

- Good：私有 GitLab 探测使用本地 Git 凭据，下载从相同的 Git checkout 策略复制。
- Base：公共注册表探测使用 HTTP，下载使用现有的 HTTP/giget 路径。
- Bad：探测通过 Git 成功，但下载重建原始/giget URL 并认证失败。

#### 6. 所需测试

- 公共注册表探测测试保持 `backend: "http"`。
- 自托管/SSH 注册表探测测试返回 `backend: "git"`。
- 下载测试传递预取模板 + `registryBackend: "git"` 并验证文件系统输出。
- 失败测试断言 auth/ref/path/invalid-json 错误不设置 `isNotFound: true`。

#### 7. Wrong vs Correct

```typescript
// Wrong: 后端选择在探测后丢失
const probe = await probeRegistryIndex(indexUrl, registry);
const template = probe.templates.find((t) => t.id === selected);
await downloadTemplateById(cwd, selected, strategy, template, registry);

// Correct: 下载使用在探测期间证明访问的相同后端
const probe = await probeRegistryIndex(indexUrl, registry);
const template = probe.templates.find((t) => t.id === selected);
await downloadTemplateById(
  cwd,
  selected,
  strategy,
  template,
  registry,
  undefined,
  probe.backend,
);
```

**为什么**：认证和可达性是后端特定的。成功的 Git 探测仅证明 Git 访问；它不证明原始 HTTP 或 giget 访问。

---

## 字符串清理模式

### 绝不使用 `str.strip()` 移除周围引号

Python 的 `str.strip(chars)` 从两端**贪婪地**移除**所有匹配字符** — 它不是「移除一对周围引号」：

```python
# Bad: 贪婪 strip 吞噬嵌套引号
value = raw.strip('"').strip("'")
# "echo 'hello'" → strip('"') → echo 'hello' → strip("'") → echo  hello
#                                                               ^^^^ 错误！

# Good: 移除恰好一层匹配的外部引号
def _unquote(s: str) -> str:
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ('"', "'"):
        return s[1:-1]
    return s

value = _unquote(raw)
# "echo 'hello'" → echo 'hello'  ✓
```

在 TypeScript 中，等效的安全模式：

```typescript
// Bad: 完全不处理引号
const value = match[1].trim();
// "path" → 仍有引号

// Good: 正则从每端精确移除一个
const value = match[1].trim().replace(/^['"]|['"]$/g, "");
```

**为什么这很重要**：当解析的值被传递给 `shell=True`（subprocess）或用作文件路径时，损坏的引号导致 shell 注入风格错误或静默路径不匹配。

**规则**：始终使用嵌套/混合引号输入测试字符串清理：`"it's here"`、`'say "hi"'`、`"echo 'hello'"`。

---

## 用户输入解析：穷举格式枚举

编写解析用户提供的 URL、路径或标识符（具有多种有效格式）的函数时，**在编写代码之前枚举所有输入形式**。

### 模式

创建涵盖以下每个组合的格式表：
- 协议变体（HTTPS、SSH `git@`、`ssh://`）
- 已知 vs 未知域名
- 可选后缀（`.git`、尾随 `/`）
- 可选组件（端口、子目录、ref/branch、子组）

```markdown
| # | 格式 | 示例 | 预期行为 |
|---|--------|---------|-------------------|
| 1 | giget 前缀 | `gh:org/repo` | 原生 provider |
| 2 | 公共 HTTPS | `https://github.com/org/repo` | 自动转换为 gh: |
| 3 | 公共 SSH | `git@github.com:org/repo` | 自动转换为 gh: |
| 4 | 自托管 HTTPS | `https://git.corp.com/org/repo` | 检测主机，映射到 gitlab: |
| 5 | 自托管 SSH | `git@git.corp.com:org/repo` | 检测主机，映射到 gitlab: |
| 6 | ssh:// 协议 | `ssh://git@host:port/org/repo` | 提取主机（去除端口） |
| 7 | 带端口的 HTTPS | `https://host:8443/org/repo` | 在主机中包含端口 |
| ... | ... | ... | ... |
```

### 为什么这很重要

**来自 Issue #87 → 自托管 GitLab 修复的教训**：HTTPS URL 的初始修复假设「只有 3 个公共域」。自托管修复然后假设「所有 SSH URL 都是自托管的」— 破坏了 `git@github.com:org/repo`。每个修复对其目标场景是正确的，但引入了新的盲点。穷举枚举防止了这一点。

### 规则

1. **列出所有有效输入形式**再实现 — 不仅仅是 issue 中报告的那些
2. **显式测试每种形式** — 不要假设「如果 HTTPS 工作，SSH 也工作」
3. **公共 vs 自托管必须是显式分支** — 永不假设一个类别涵盖所有输入
4. **在解析函数顶部的代码注释中编写格式表**

---

## 路由修复：在声称修复完成之前审计所有入口路径

**触发器**：修改任何命令中的决策/分发逻辑，该命令有多个入口路径进入相同的下游行为 — `trellis init`（handleReinit 快速路径 + 主分发）、`trellis update`（force vs interactive），或任何在更改点之上有提前返回守卫的函数。

**常见错误**：修补你 grep 到的分发，在一个 fixture 上手动验证，发布。另一个入口路径保持损坏，因为（a）它在到达你的修复之前短路，（b）手动 fixture 恰好使用了绕过未修复路径的标志组合，（c）你编写的测试也使用了那个便利的绕过标志。

### 范围 / 触发器
- 函数内部的任何更改，该函数包含像 `if (!isFirstInit && !options.force && !options.skipExisting) { ...; return; }` 这样的提前返回守卫，后面跟着额外的分发逻辑。
- 任何对「如果条件成立则创建 X」分支的更改，其中另一个兄弟函数做出相同类型的决策。
- 用户报告了一个特定标志组合的 bug 修复工作 — 假设有其他组合通过不同路径命中相同的缺陷。

### 审计契约

在落地修复之前，产出一份入口路径清单：

```bash
# 查找每个可能产生错误结果的调用点 / 分支
rg -n "createBootstrapTask|createJoinerOnboardingTask" packages/cli/src/commands/init.ts
rg -n "if \(!options\.force.*return|reinitDone|return true.*//.*handled" packages/cli/src/commands/init.ts
```

对于每个入口路径，记录：

| 入口路径 | 到达你的修复？ | 进入它所需的标志组合 | *绕过*它的标志组合 |
|------------|-------------------|---------------------------------------|-------------------------------------|
| 路径 A: `init()` 主分发 | 是（你的修复在这里） | `--force` 或 `--skip-existing`（跳过 reinit） | （进入时始终可到达） |
| 路径 B: `handleReinit` 提前返回 | **否** | 不是 force / skipExisting / first-init 中的任何一个 | `--force` 或 `--skip-existing` |

如果任何入口路径未到达修复，你有两个选择：

1. **扩展修复**使所有路径汇集到相同逻辑中（例如，放宽提前返回处的守卫，使你关心的案例落入修补后的分发）。
2. **单独修补每个路径** — 仅当汇集在结构上不可行时。

汇集是首选：它消除了这类 bug，而不仅仅是这个实例。

### 所需测试
- **每个入口路径一个测试**，使用选择该路径的确切标志组合断言修复的效果。
- 使用「便利」标志（`force: true`）绕过入口路径守卫的测试不覆盖该入口路径 — 它覆盖绕过路由。参见 `cli/unit-test/conventions.md` →「Bug-Fix Tests Must Reproduce Reported Flag Combination」。
- 落地后，重新构建 CLI 并在 fixture 上运行用户的确切报告命令。如果你不能在该 fixture 上复现修复前的 bug，你的复现是错误的，而不是修复。

### Wrong vs Correct

#### Wrong — 仅修补你注意到的分发，使用绕过未修补路径的标志组合测试

```typescript
// init.ts — 仅主分发
if (isFirstInit || tasksEmpty) {
  createBootstrapTask(...);
} else if (!hadDeveloperFileAtStart) {
  createJoinerOnboardingTask(...);
}

// handleReinit — 未更改，仍将空任务恢复错误路由到 joiner
async function handleReinit(...) {
  // ... 没有 tasksEmpty 检查 ...
  if (!hadDeveloperFileBefore) createJoinerOnboardingTask(...);
}

// init() 顶部的守卫 — 未更改
if (!isFirstInit && !options.force && !options.skipExisting) {
  await handleReinit(...);  // ← 用户的 `--yes` 单独进入此，永不到达修复
}
```

```typescript
// 在 bug 仍然存在时「通过」的测试
it("empty tasks/ → bootstrap", async () => {
  await init({ yes: true, user: "alice", force: true });  // ← force 绕过 handleReinit
  expect(...).toBe(true);  // 绿色，但仅因为 force 路由绕过了 bug
});
```

净效果：发布时用户的确切命令（`trellis init -u alice --codex --yes`）仍然损坏。

#### Correct — 使所有入口路径汇聚，测试每个路径

```typescript
// init.ts — 放宽守卫，使空任务恢复永不进入 reinit
const tasksEmptyEarly =
  !fs.existsSync(tasksDirEarly) || fs.readdirSync(tasksDirEarly).length === 0;
if (
  !isFirstInit &&
  !options.force &&
  !options.skipExisting &&
  !tasksEmptyEarly
) {
  await handleReinit(...);
}
// 主分发统一处理所有空任务案例
```

```typescript
// 两个测试：每个入口路径一个，都不使用绕过标志来规避工作
it("#2b empty tasks/ + --yes alone → bootstrap (reported case)", async () => {
  await init({ yes: true, user: "alice" });  // 确切是用户的命令
  ...
});
it("#2c empty tasks/ + --yes --force → bootstrap (force path)", async () => {
  await init({ yes: true, user: "alice", force: true });
  ...
});
```

### 为什么

多入口分发是 bug 的结构性倍数放大器：每个入口路径都是原始缺陷表现的单独机会，而遗漏一个的代价是「用户以略微不同的标志重新提交相同的 issue」。审计每个入口路径需要 5 分钟；遗漏一个耗费一个发布周期。

### 案例研究（2026-04-30）：issue #204 `--yes` + bootstrap 恢复

第一个提交（`346003d`）仅在 `init()` 的主分发中添加了 `tasksEmpty` 回退。它使 `--yes` 日志行正确，使 `--force --yes` 恢复 bootstrap，并添加了通过的测试（`#2b` 带 `force: true`）。它没有修复用户的字面报告命令 — `trellis init -u <name> --codex --yes` — 因为该命令通过 `handleReinit`（定义在 `init.ts:740`，调用在 `init.ts:1081`），它在到达修补的分发之前短路。被 `trellis-check` 子 agent 在 dist 构建上做实时 CLI 复现时捕获。在 `589f753` 中通过在 reinit 守卫中添加 `!tasksEmptyEarly` 修复，加上将测试拆分为 `#2b`（无 force，报告案例）和 `#2c`（带 force，相等性检查）。

---

## 原生依赖策略（Native dependency policy）

### 警示故事 — 0.6.0-beta.3 → 0.6.0-beta.4 紧急回退

0.6.0-beta.3 添加了 `better-sqlite3`（一个原生 C++ 绑定）来读取 OpenCode 1.2+ 会话存储，它从 JSONL 切换到 SQLite。在 Windows + 中国网络下，失败级联是：

1. `prebuild-install` 尝试从 GitHub releases CDN 下载预编译二进制文件。
2. CDN 超时（中国网络对 `github.com/.../releases/download/...` 的可靠性较差）。
3. `node-gyp` 源构建回退启动。
4. 源构建需要 Visual Studio 2017+ Build Tools，大多数 Windows 用户没有安装。
5. 安装失败 — **`trellis` 本身再也无法安装**。

检测时间：发布后约 4 小时。修复：0.6.0-beta.4 紧急回退（移除 `better-sqlite3`，将 OpenCode 1.2+ SQLite 读取器标记为降级，带软降级回退）。`commands-mem.md` 中的 OpenCode SQLite 部分现在是一个描述降级状态的存根。

教训：**一个安装失败的原生依赖会使整个 CLI 失败**，而不仅仅是一个功能。对于生产力工具，这种权衡是不可接受的，除非性能收益是巨大的且不可替代的。

### 规则

#### 1. 默认避免在 trellis CLI 中使用原生依赖

Trellis 是一个生产力/脚手架工具。跨所有 OS / 网络条件的安装可靠性比每次调用的性能更重要。对「我们应该添加这个原生依赖吗？」的默认答案是**否**。

#### 2. 如果绝对需要，使用 `optionalDependencies` + 软降级

将依赖放在 `optionalDependencies`（而不是 `dependencies`）下，以便安装永远不会硬失败。用 try/catch 包装每个加载点，并带有清晰的「feature unavailable」stderr 提示：

```typescript
let nativeReader: NativeReader | null = null;
try {
  // Dynamic import keeps install-time failure away from the load barrel
  nativeReader = (await import("better-sqlite3")).default as NativeReader;
} catch {
  process.stderr.write(
    "[trellis] OpenCode 1.2+ SQLite session reader unavailable " +
    "(better-sqlite3 not installed). Falling back to JSONL-only mode.\n"
  );
}

if (nativeReader) {
  // Use native path
} else {
  // Soft-degrade: degraded but functional output
}
```

交叉引用：未来的原生依赖添加应镜像 `commands/mem.ts:opencodeListSessions`（在 `feat/v0.6.0-beta` 分支上）使用的软降级模式。当原生读取器不可用时，函数返回降级但非空输出，而不是抛出异常。

#### 3. 发布前在 Windows + 受限网络上测试

即使目标平台存在预编译二进制文件，GitHub releases CDN 从中国和其他受限网络也不可靠。node-gyp 源构建回退则需要用户通常没有的 C 编译器工具（Windows 上的 MSVC、macOS 上的 Xcode CLT、Linux 上的 build-essential）。

任何原生依赖的发布前必需矩阵：

| 环境 | 要验证什么 |
|---|---|
| Windows（干净 VM，无 VS Build Tools）+ 中国路由网络 | `pnpm install` 成功；CLI 在没有该功能的情况下启动 |
| macOS（干净，无 Xcode CLT） | 安装成功；优雅回退 |
| Linux（Alpine / 最小 Docker） | 安装成功；musl vs glibc 预编译二进制匹配 |

#### 4. 决策框架

原生依赖仅当**两者**都为 true 时才是合理的：

- 性能收益是**巨大的**（数量级，不是 2-3 倍）且无法在纯 JS / WASM 中替代。
- Shell-out 到系统工具（`sqlite3`、`ffmpeg` 等）不可行 — 通常因为系统工具在目标平台上不是标准的，或每次调用调度开销过高。

如果只有一个是 true，选择非原生替代方案。

#### 5. 替代方案阶梯（按优先级顺序）

| 选项 | 安装风险 | 性能 | 备注 |
|---|---|---|---|
| 纯 JS | 无 | 基准 | 始终是首选。大多数 CLI 工作负载是 I/O 密集而非 CPU 密集。 |
| WASM 包 | 无（一次性包大小成本 ~1-2 MB） | 比原生慢约 1.5-3 倍，通常没问题 | 例如用于 SQLite 读取的 `sql.js`。构建时打包，无需安装时获取。 |
| Shell out 到系统 CLI | 低（Windows-PATH / 「已安装？」风险） | 每次调用调度开销 | 零安装依赖，但引入「sqlite3 / ffmpeg 在 PATH 上吗？」分支。当工具被广泛假定存在时可接受。 |
| `node:sqlite` 等（Node 内置） | 无 | 原生 | 一旦这些从 Node LTS 的实验阶段毕业，它们成为首选路径。截至 Node 22 LTS，`node:sqlite` 仍然是实验性的 — 跟踪上游。 |
| 原生依赖 + `optionalDependencies` + 软降级 | 中（仍然在相当比例的 Windows 用户上安装失败） | 原生 | 最后手段。仅当步骤 1-4 被排除且软降级路径真正可用时。 |

#### 6. 添加任何原生依赖时的审计清单

在合并添加原生依赖的 PR 之前：

- [ ] 它在 `optionalDependencies`（不是 `dependencies`）下吗？
- [ ] 每个加载点是否用 try/catch 包装并带有 stderr 提示？
- [ ] 软降级路径是否产生有用输出，还是仅以不同消息抛出？
- [ ] 是否在干净 Windows VM 上测试过安装，无 VS Build Tools，在中国路由代理后？
- [ ] 性能收益是否经过测量（不是假设）且是巨大的？
- [ ] WASM 替代方案是否已基准测试并以数字拒绝？
- [ ] spec / PR 描述是否说明了每个替代方案阶梯的哪些梯级被考虑过，以及为什么每个被拒绝？

如果任何答案是「否」，该依赖不发布。

---

## DO / DON'T

### DO

- 在所有函数上声明显式返回类型
- 默认使用 `const`
- 对默认值使用 `??`
- 对可选访问使用 `?.`
- 为结构化数据定义接口
- 未使用参数前缀 `_`

### DON'T

- 不要使用 `any` 类型
- 不要使用非空断言（`x!` 操作符）
- 不要使用 `var`
- 不要对默认值使用 `||`（使用 `??`）
- 不要留下隐式返回类型
- 不要忽略 ESLint 或 TypeScript 错误