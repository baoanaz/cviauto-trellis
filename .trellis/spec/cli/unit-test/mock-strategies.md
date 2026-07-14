# Mock 策略（Mock Strategies）

> 测试中 mock 的原则和模式。

---

## 核心原则：最小化 Mock（Core Principle: Minimal Mocking）

仅 mock 以下**外部依赖**：
1. 非确定性的（网络、时间、随机数）
2. 交互式的（TTY 提示）
3. 有副作用的（子进程、写入系统路径的文件系统操作）

**永远不要 mock 内部模块**——让真实代码完整执行。

---

## 标准 Mock 集合

对于命令级集成测试，这是最小集合：

| 依赖（Dependency） | 为什么 Mock | 如何 Mock | 使用位置 |
|------------|----------|-----|---------|
| `figlet` | ASCII 横幅，不是可测试的输出 | `vi.mock("figlet")` | init, update |
| `inquirer` | 交互式提示，CI 中没有 TTY | `vi.mock("inquirer")` | init, update |
| `node:child_process` | Git 配置、Python 脚本调用 | `vi.mock("node:child_process")` | init, update |
| `fetch`（全局） | npm registry 网络调用 | `vi.stubGlobal("fetch")` | 仅 update |
| `process.cwd()` | 重定向到临时目录 | `vi.spyOn(process, "cwd")` | init, update |
| `console.log/error` | 静默输出 | `vi.spyOn(console, "log")` | init, update |

---

## Mock 模式

### 模块 Mock（hoisted）

```typescript
// 放在文件顶部——vitest 会提升 vi.mock 调用
vi.mock("figlet", () => ({
  default: { textSync: vi.fn(() => "TRELLIS") },
}));

vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({ proceed: true }) },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));
```

### 全局 Stub

```typescript
// 在 beforeEach 中——不会被提升，必须在 setup 中
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ version: VERSION }),
}));

// 在 afterEach 中——必须恢复
vi.unstubAllGlobals();
```

### Spy（部分 mock）

```typescript
// 在 beforeEach 中
vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
vi.spyOn(console, "log").mockImplementation(noop);

// 在 afterEach 中
vi.restoreAllMocks(); // 恢复所有 spy
```

---

## inquirer Mock：init vs update

两个命令有不同的 inquirer 跳过条件：

**init**：`--yes` 标志跳过所有 inquirer 提示。Mock 可以返回空的 `{}`。

```typescript
vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({}) },
}));
```

**update**：`--dryRun` 在确认提示之前返回。批量解析模式（`force`、`skipAll`、`createNew`）也不应触及最终的确认提示。普通的交互式 update 路径和没有批量标志的 `migrate` 可能仍会提示，因此默认 mock 应返回 `{ proceed: true }`。

```typescript
vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({ proceed: true }) },
}));
```

当测试非交互式批量路径时，在 setup 后清除 mock 并断言它未被调用：

```typescript
vi.mocked(inquirer.prompt).mockClear();
await update({ force: true });
expect(inquirer.prompt).not.toHaveBeenCalled();
```

---

## 不应该 Mock 的内容

| 内容（What） | 原因（Why） |
|------|------|
| `fs`（node:fs） | 测试运行在真实临时目录中 |
| `path`（node:path） | 纯计算，确定性 |
| 内部模块（`configurators/`、`utils/`、`templates/`） | 让真实代码执行 |
| `chalk` | 自动检测无 TTY 并禁用颜色 |

---

## 已知陷阱（Known Gotchas）

### 模块级状态：`setWriteMode`

`file-writer.ts` 具有写入模式的模块级状态。如果一个测试设置了 `force` 模式，后续测试会继承它，除非被重置。`init()` 函数在内部调用了 `setWriteMode()`，因此调用 `init()` 的集成测试是安全的。但直接对 `writeFile` 的单元测试必须显式管理此状态。

### 模板占位符解析

`collectPlatformTemplates()` 必须返回**已解析** `{{PYTHON_CMD}}` 的模板（与 `configurePlatform()` 写入磁盘的内容匹配）。`configurators/shared.ts` 中的 `resolvePlaceholders()` 函数处理此逻辑。如果向模板中添加了新的占位符，则必须在 `configure()` 和 `collectTemplates()` 中都进行解析。

---

## DO / DON'T

### DO

- 保持 mock 数量最小化（当前为 4 个外部依赖）
- 如果断言调用次数，在测试之间使用 `vi.mocked(fn).mockClear()`
- 使 mock 返回值与真实 API 形态匹配

### DON'T

- 不要 mock 内部模块来强制走特定代码路径
- 使用 `vi.stubGlobal` 时不要忘记 `vi.unstubAllGlobals()`
- 不要假设 mock 状态在测试之间重置，除非显式调用 `mockClear()` 或 `restoreAllMocks()`
