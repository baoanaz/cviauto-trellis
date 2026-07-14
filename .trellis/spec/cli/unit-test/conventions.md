# 测试规范（Test Conventions）

> 文件命名、结构和断言模式。

---

## 测试基础设施（Test Infrastructure）

| 项目（Item） | 值（Value） |
|------|-------|
| 框架（Framework） | Vitest 4.x |
| 配置（Config） | `vitest.config.ts` |
| 包含范围（Include） | `test/**/*.test.ts` |
| 排除范围（Exclude） | `third/**` |
| 前置脚本（Setup files） | `test/setup.ts`（在任何测试之前运行，剥离宿主 shell 会话环境变量——见下方"测试隔离（Test Isolation）"） |
| Lint 范围（Lint scope） | `eslint src/ test/` |
| 模块系统（Module system） | ESM（`"type": "module"` + `"module": "NodeNext"`） |
| 覆盖率提供者（Coverage provider） | `@vitest/coverage-v8` |
| 覆盖率命令（Coverage command） | `pnpm test:coverage` |
| 覆盖率范围（Coverage scope） | `src/**/*.ts`（排除 `src/cli/index.ts`） |
| 覆盖率报告（Coverage reports） | `text`（终端），`html`（`./coverage/index.html`），`json-summary` |

---

## 测试隔离（Test Isolation）

### 在进程启动时剥离宿主 shell 会话环境变量

多个 Trellis 模块（如 `OpenCodeContext.getContextKey`、`TrellisContext.getActiveTask`）在解析时将 `process.env.TRELLIS_CONTEXT_ID` 和 `process.env.OPENCODE_RUN_ID` 作为**最高优先级的覆盖项（override）**——这是有意为之的生产行为。

当测试在 Claude Code 或 OpenCode 会话中运行时，这些环境变量会从父 shell 泄漏到 vitest 进程中，**劫持解析器**，使其忽略测试中 mock 的 `platformInput`。症状：期望得到 `opencode_oc-a` 派生 contextKey 的测试，实际拿到了 `claude_<host-session-id>`，导致仅在开发机上确定性地失败。

**规范**：`test/setup.ts` 通过 `vitest.config.ts` 中的 `setupFiles` 注册，在任何测试加载之前无条件地 `delete` 这些环境变量：

```ts
// test/setup.ts
delete process.env.TRELLIS_CONTEXT_ID;
delete process.env.OPENCODE_RUN_ID;
```

**何时扩展**：任何被生产解析器作为用户覆盖项使用，且开发者宿主 shell 可能导出的新环境变量，都必须添加到 `test/setup.ts` 中。不要通过在生产代码中忽略环境变量来修复此问题——覆盖项对最终用户来说是一个真实功能。

**何时不使用**：有意测试环境变量覆盖路径的测试应在测试内部显式设置环境变量（在 `beforeEach` 中设置 `process.env.X = "..."`，在 `afterEach` 中恢复）。

---

## 何时编写测试（When to Write Tests）

### 必须编写

| 变更类型（Change Type） | 测试类型（Test Type） | 示例（Example） |
|-------------|-----------|---------|
| 新增纯函数/工具函数 | 单元测试（Unit test） | 添加了 `compareVersions()` → 测试边界值 |
| 新增平台（Platform） | 单元测试（由 `registry-invariants.test.ts` 自动覆盖） | 添加了 opencode → 不变量验证一致性 |
| Bug 修复（Bug fix） | 回归测试（Regression test） | 修复了 Windows 编码问题 → 添加到 `regression.test.ts` |
| 修改了 init/update 行为 | 集成测试（Integration test） | 修改了降级逻辑 → 在 `update.integration.test.ts` 中添加/更新场景 |

### 无需编写测试

| 变更类型（Change Type） | 原因（Reason） |
|-------------|--------|
| 模板文本/文档内容变更 | 无逻辑变更 |
| 新增迁移清单（migration manifest）JSON | `registry-invariants.test.ts` 自动验证格式 |
| CLI 标志描述文本 | 仅用于显示 |

### 必须更新现有测试

| 变更类型（Change Type） | 需要更新什么（What to Update） |
|-------------|----------------|
| 为某个平台添加了新的 command/skill | 将该平台测试文件中的 `EXPECTED_COMMAND_NAMES` / `EXPECTED_SKILL_NAMES` 中添加条目 |
| 为任意平台添加了新的 command | 添加到所有平台的测试文件（claude、cursor、iflow、codex）——参见 platform-integration spec 中所需 command 列表 |

### 决策流程（Decision flow）

```
此变更是否包含逻辑分支？
├─ 否（纯数据/文本）→ 不写测试
└─ 是
   ├─ 独立的函数，具有可预测的输入→输出？→ 单元测试（Unit test）
   ├─ 修复历史 bug？→ 回归测试（Regression test，验证修复在源码中存在）
   └─ 改变了 init/update 的端到端行为？→ 集成测试（Integration test）
```

---

## 文件命名（File Naming）

```
test/
  types/
    ai-tools.test.ts          # src/types/ai-tools.ts 的单元测试
  commands/
    update-internals.test.ts   # 内部函数的单元测试
    init.integration.test.ts   # init() 命令的集成测试
    update.integration.test.ts # update() 命令的集成测试
  regression.test.ts           # 跨版本回归测试
```

**规则（Rules）**：
- 在 `test/` 下镜像 `src/` 的目录结构
- 后缀：`.test.ts` 用于单元测试，`.integration.test.ts` 用于集成测试
- 每个源模块一个测试文件（例外：回归测试）

---

## 测试结构（Test Structure）

### 标准模式（Standard Pattern）

```typescript
import { describe, it, expect } from "vitest";

describe("functionName", () => {
  it("does X when given Y", () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });
});
```

### 带 Setup/Teardown

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("module", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-test-"));
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

---

## 断言模式（Assertion Patterns）

### 优先使用精确匹配器（Prefer Exact Matchers）

```typescript
// Good: Exact
expect(result).toBe("expected");
expect(array).toEqual(["a", "b"]);

// Avoid: Loose
expect(result).toBeTruthy();
expect(array.length).toBeGreaterThan(0);
```

### 用于无操作验证的快照对比（Snapshot Comparison for No-Op Verification）

当断言某个操作未产生任何变更时，使用完整目录快照：

```typescript
// Collect all files + contents before
const before = new Map<string, string>();
walk(dir, (filePath, content) => before.set(filePath, content));

// Run operation
await operation();

// Collect after and diff
const after = new Map<string, string>();
walk(dir, (filePath, content) => after.set(filePath, content));

const added = [...after.keys()].filter((k) => !before.has(k));
const removed = [...before.keys()].filter((k) => !after.has(k));
expect(added).toEqual([]);
expect(removed).toEqual([]);
```

---

## ESLint 兼容性（ESLint Compatibility）

测试必须通过与 `src/` 相同的 ESLint 规则。常见解决方案：

```typescript
// 空函数（no-empty-function 规则）
// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};
vi.spyOn(console, "log").mockImplementation(noop);

// 避免非空断言
// Bad: match![0]
// Good: (match as [unknown])[0]
```

---

## 测试反模式（Test Anti-Patterns）

测试应该验证**有意义的行为**，而不是重述 TypeScript 或运行时已经保证的内容。以下反模式是在一次完整的测试审计中发现的，应当避免。

### 对持续增长的数据使用硬编码计数（Hardcoded Counts on Growing Data）

```typescript
// Bad: 每新增一个 manifest/script 都会失败
expect(scripts.size).toBe(23);
expect(versions.length).toBe(23);

// Good: 从真实来源动态获取计数
const jsonFiles = fs.readdirSync(manifestDir).filter(f => f.endsWith(".json"));
expect(versions.length).toBe(jsonFiles.length);
expect(versions.length).toBeGreaterThan(0);
```

**原因**：硬编码计数会在无关变更上产生误报失败，并需要持续手动更新。

### 同义反复断言（Tautological Assertions）

```typescript
// Bad: 测试 registry[key] === registry[key]
const config = getToolConfig(id);
expect(config).toBe(AI_TOOLS[id]); // getToolConfig 只是返回 AI_TOOLS[id]

// Bad: 测试函数返回其自身的输入
const dirs = getTemplateDirs(id);
expect(dirs).toEqual(AI_TOOLS[id].templateDirs); // getTemplateDirs 只是返回 .templateDirs
```

**原因**：这些测试验证的是 JavaScript 对象属性访问是否正常工作，而非我们代码是否正确。如果实现只是一个简单的查找，不要测试它——转而测试**消费者行为（consumer behavior）**。

### 冗余的类型检查（TypeScript 已保证）（Redundant Type Checks）

```typescript
// Bad: TypeScript 在编译时已经保证了这些
expect(typeof settingsTemplate).toBe("string");
expect(Array.isArray(commands)).toBe(true);
expect(typeof cmd.name).toBe("string");

// Good: 改为测试有意义的属性
expect(settingsTemplate.length).toBeGreaterThan(0);
expect(commands.length).toBeGreaterThan(0);
```

**原因**：在严格的 TypeScript 项目中，测试中的运行时类型检查只会增加噪音，无法捕获真正的 bug。

### 跨文件重复覆盖（Duplicate Coverage Across Files）

```typescript
// Bad: registry-invariants.test.ts 和 index.test.ts 都测试了：
// - PLATFORM_IDS 长度与 AI_TOOLS 键匹配
// - cliFlag 唯一性
// - configDir 以点号开头

// Good: 在一个规范位置测试每个不变量
// registry-invariants.test.ts: 内部一致性（唯一标志、无冲突、保留名称）
// index.test.ts: 派生辅助函数的正确性（getConfiguredPlatforms, isManagedPath 等）
```

**原因**：重复测试给人虚假的覆盖率感，增加重构难度，并增加维护负担。

### 单个测试内的冗余断言（Redundant Assertions Within a Test）

```typescript
// Bad: parse 测试已经证明它是有效的 JSON 字符串
it("is valid JSON", () => {
  expect(() => JSON.parse(settingsTemplate)).not.toThrow();
});
it("is a non-empty string", () => { // 如果 parse 成功则是冗余的
  expect(settingsTemplate.length).toBeGreaterThan(0);
});

// Good: 合并为一个有意义的断言
it("is valid non-empty JSON", () => {
  const parsed = JSON.parse(settingsTemplate);
  expect(parsed).toBeTruthy();
});
```

### 重构后的过时回归测试（Stale Regression Tests After Refactoring）

```typescript
// Bad: 代码被移动后，回归测试仍检查旧位置
it("[beta.10] git_context.py has inline encoding fix", () => {
  expect(commonGitContext).toContain('sys.platform == "win32"');  // 已移至 __init__.py！
});

// Good: 更新为检查新位置
it("[beta.10] common/__init__.py has centralized encoding fix", () => {
  expect(commonInit).toContain('sys.platform == "win32"');
});
```

**原因**：当重构将代码在文件之间移动时（例如，将编码处理从各个脚本集中到 `common/__init__.py`），检查特定文件中特定字符串的回归测试会失败。回归保护依然存在——只是在不同的文件中。

**预防**：在跨文件重构代码时，搜索 `test/regression.test.ts` 中对受影响文件的引用，并将断言更新为匹配新位置。

### 同义反复输入（测试未执行到被测代码路径）（Tautological Input）

```typescript
// Bad: 测试输入从未触发被测代码路径
it("safe-file-delete respects update.skip", () => {
  // 写入 "some content"——其哈希永远不会匹配 allowed_hashes
  // 因此 collectSafeFileDeletes() 在检查 update.skip 之前就返回 "skip-modified"
  // 即使 update.skip 逻辑完全损坏，此测试也会通过
  fs.writeFileSync(deprecatedFile, "some content");
  config.update.skip = [".claude/commands/trellis/"];
  await update({ force: true });
  expect(fs.existsSync(deprecatedFile)).toBe(true); // 始终为 true！
});

// Good: 使用在无保护时会触发删除的输入
it("safe-file-delete respects update.skip", () => {
  // 写入其哈希在 allowed_hashes 中的内容
  // 没有 update.skip 时，该文件会被删除
  fs.writeFileSync(deprecatedFile, originalTemplateContent);
  config.update.skip = [".claude/commands/trellis/"];
  await update({ force: true });
  expect(fs.existsSync(deprecatedFile)).toBe(true); // 证明了 update.skip 有效
});
```

**原因**：测试看起来像是在覆盖功能，但输入使该功能的代码路径不可达。无论功能是否正常，测试都会通过。这比缺失测试更糟糕，因为它提供了**虚假的安全感（false confidence）**。

**检测**：对于任何断言文件/值被保留的测试，问自己："如果我删除被测功能，这个断言会失败吗？"如果不会 → 同义反复输入。

### 决策规则（Decision Rule）

在编写测试之前，问自己：

1. **TypeScript 是否已经保证了这个？**→ 跳过（typeof、Array.isArray、属性存在性）
2. **这是简单的透传（passthrough）吗？**→ 跳过（返回属性的 getter）
3. **这已经在其他地方测试过了吗？**→ 跳过（避免跨文件重复）
4. **这依赖于随时间增长的数据吗？**→ 使用动态计数
5. **这测试的是真实行为还是仅仅是重述实现？**→ 只测试行为
6. **测试输入是否真的到达了被测代码路径？**→ 用"脑内删除测试（mental deletion test）"验证
7. **对于 bug 修复测试：参数是否匹配用户报告的标志组合？**→ 如果你通过添加便利标志来"简化"，你测试的是另一条路径

### Bug 修复测试必须复现报告中的标志组合（Bug-Fix Tests Must Reproduce the Reported Flag Combination）

```typescript
// Bad: 便利标志绕过了 bug 所在的那个 guard
it("#2b issue #204: empty tasks/ → bootstrap", async () => {
  await init({ yes: true, user: "alice", force: true });
  // ↑ `force: true` 跳过了 `if (!options.force) handleReinit(...)` guard
  //   （位于 init.ts:1081，handleReinit 定义在 init.ts:740）。即使
  //   用户只用 `--yes` 就会触发 handleReinit 并错误路由到 joiner，
  //   测试也是绿色的。
  expect(fs.existsSync(bootstrapPath)).toBe(true);
});

// Good: 参数与 issue 报告者输入的命令完全一致
it("#2b issue #204: empty tasks/ + --yes alone → bootstrap", async () => {
  await init({ yes: true, user: "alice" });  // 用户实际输入的命令
  expect(fs.existsSync(bootstrapPath)).toBe(true);
});

// 可选：并行的正向路径测试
it("#2c issue #204: empty tasks/ + --yes --force → bootstrap", async () => {
  await init({ yes: true, user: "alice", force: true });
  expect(fs.existsSync(bootstrapPath)).toBe(true);
});
```

**原因**：CLI 测试中的便利标志（`force`、`skipExisting`、`--no-confirm`）通常是为了在测试运行中跳过提示——但这些标志同样会短路 reinit / dispatch / 交互式 guard。为了让"测试更简单"而添加这些标志的测试，可能静默地通过了一条与用户所经过的完全不同的代码路径。测试绿色 ≠ bug 已修复。

**检测**：对于任何 bug 修复测试，将参数与 issue 报告者的确切命令对齐。每个额外的标志都必须自我辩护：它是达到复现状态所必需的，还是因为测试"不加就跑不起来"而添加的？如果是后者，测试的是绕过路径，而非修复本身。

**相关**：`cli/backend/quality-guidelines.md` → "Routing Fixes: Audit ALL Entry Paths"——同一个教训在结构层面的体现。测试中的每个便利标志通常对应生产代码中一个未修复的入口路径。

### 辅助函数（Helper）的设置是具有负载性质的——在修改前审计其依赖者（Helper Setup Functions Are Load-Bearing）

```typescript
// 原始辅助函数——每个 joiner 测试都依赖 tasks/ 为空
function simulateExistingCheckout() {
  fs.mkdirSync(path.join(workflow, "tasks"), { recursive: true });
  fs.mkdirSync(path.join(workflow, "spec"), { recursive: true });
}

// 更新后的辅助函数——现在还会种下 tasks/archive/
function simulateExistingCheckout() {
  fs.mkdirSync(path.join(workflow, "tasks", "archive"), { recursive: true });
  // ...
}
```

如果生产代码开始使用 `tasks/.length === 0` 作为"真实 reinit"和"中断恢复"之间的判别器，每个调用 `simulateExistingCheckout()` 的测试都会静默翻转到新分支。测试仍然绿色，但它们测试的是与其名称所声称的不同的场景。

**规则**：在修改产生 fixture 状态的辅助函数之前，`grep` 其调用者，并针对新行为逐一追踪。在 JSDoc 注释中记录具有负载性质的约束条件（invariant），以便下一位维护者无需重新推导：

```typescript
/**
 * 辅助函数：模拟一个已有 Trellis 项目的新克隆……
 *
 * 注意：种下的 `tasks/archive/` 对 joiner 分支具有负载性质。
 * 如果你修改 init.ts 中的 `tasksEmpty` 谓词（当前为
 * `!exists || readdirSync().length === 0`），请审计此辅助函数——例如，如果
 * archive/ 不再被计为"非空"，下面每个 joiner 测试都会回退到
 * bootstrap 回退分支，断言会静默翻转。
 */
```

---

## DO / DON'T

### DO

- 每个测试使用独立的临时目录（无共享状态）
- 在 `afterEach` 中清理临时目录
- 在 `afterEach` 中使用 `vi.restoreAllMocks()` 恢复所有 mock
- 使用 `vi.mocked()` 进行类型安全的 mock 访问
- 为测试场景编号（`#1`、`#2`……）以便追溯到 PRD
- 使用从真实来源（文件系统、registry）推导出的动态计数
- 测试有意义的行为，而非实现细节

### DON'T

- 不依赖测试执行顺序
- 不使用定时器、网络或全局状态
- 不在测试完成后留下临时文件
- 不在测试文件中使用 `any`（适用相同的 ESLint 规则）
- 使用 `vi.stubGlobal` 时不要忘记 `vi.unstubAllGlobals()`
- 不要对持续增长的数据集（manifests、scripts、platforms）使用硬编码计数
- 不要在 TypeScript 测试中添加 `typeof` 或 `Array.isArray` 检查
- 不要跨多个测试文件重复相同的断言
- 不要编写只是验证 `x === x` 的同义反复测试
