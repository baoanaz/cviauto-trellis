# 集成测试模式（Integration Test Patterns）

> CLI 命令的函数级集成测试模式。

---

## 方法：函数级集成（Approach B）

不通过生成 CLI 子进程，而是直接在真实临时目录中导入并调用 `init()` / `update()` 函数。这带来了：

- 快速执行（每个测试文件约 400ms）
- 可复现结果（无网络、无 TTY）
- 通过 mock 精确控制外部依赖
- 从入口到文件系统输出的完整代码路径覆盖

**权衡**：不测试 CLI 参数解析（commander 层）。

---

## 标准测试 Setup

```typescript
describe("command() integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();  // 仅在使用 vi.stubGlobal 时需要
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

---

## 常见模式（Common Patterns）

### 模式：项目 Setup（用于 update 测试）

Update 测试需要一个已初始化的项目作为前置条件：

```typescript
async function setupProject(): Promise<void> {
  await init({ yes: true, force: true });
}

it("test case", async () => {
  await setupProject();
  // ... 修改状态 ...
  await update({ force: true });
  // ... 断言结果 ...
});
```

### 模式：完整快照对比（Full Snapshot Comparison）

用于验证某个操作是真正的无操作（no-op）：

```typescript
const snapshotBefore = new Map<string, string>();
const walk = (dir: string) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else snapshotBefore.set(path.relative(tmpDir, full), fs.readFileSync(full, "utf-8"));
  }
};
walk(tmpDir);

await operation();

// 比较：无新增、无删除、无文件变更
```

### 模式：模拟模板版本变更（Simulate Template Version Change）

用于测试自动更新检测（模板变更，用户未修改）：

```typescript
// 1. 将"旧内容"写入模板文件
const oldContent = "# Old version\n";
fs.writeFileSync(targetFull, oldContent);

// 2. 更新哈希文件以匹配旧内容（使 update 认为用户未修改）
const hashes = JSON.parse(fs.readFileSync(hashFile, "utf-8"));
hashes[targetRelative] = computeHash(oldContent);
fs.writeFileSync(hashFile, JSON.stringify(hashes, null, 2));

// 3. 运行 update——应自动更新为当前模板
await update({ force: true });
expect(fs.readFileSync(targetFull, "utf-8")).toBe(currentTemplateContent);
```

### 模式：降级保护（Downgrade Protection）

```typescript
// 将项目版本设置为未来版本
fs.writeFileSync(versionPath, "99.99.99");

await update({});

// 版本不应被更改——update 拒绝降级
expect(fs.readFileSync(versionPath, "utf-8")).toBe("99.99.99");
```

---

## 测试矩阵设计（Test Matrix Design）

集成测试场景应在 PRD 中以编号矩阵的形式组织：

| # | 场景（Scenario） | 选项（Options） | 验证（Verification） |
|---|----------|---------|--------------|
| 1 | 无操作（相同版本） | `{}` | 零文件变更，无备份 |
| 2 | 干运行（Dry run） | `{ dryRun: true }` | 无文件修改 |
| 3 | 已删除文件重建 | `{ force: true }` | 文件已恢复 |
| ... | | | |

每个测试按编号（`#1`、`#2`……）标记，与矩阵匹配以便追溯。

---

## 通过集成测试发现的 Bug

集成测试在发现**跨模块不一致**方面非常有效：

1. **模板占位符来回转换**：`init` 将 `{{PYTHON_CMD}}` 解析为 `python3`，但 `update` 与原始 `{{PYTHON_CMD}}` 进行比较。每次 update 都会检测到虚假变更。

2. **模板列表不匹配**：`update` 列出了 `init` 未创建的文件，导致相同版本 update 时出现虚假的"新文件"检测。

3. **项目类型相关的模板被忽略**：`createSpecTemplates()` 接收了 `projectType` 但忽略了它（`_projectType`），始终同时创建 backend + frontend 的 spec。`collectTemplateFiles()` 无条件包含所有 spec 文件，而不论哪些目录实际存在。纯 backend 项目在 init 时得到空的 frontend spec 目录，并且 update 始终追踪 frontend 文件，即使目录已被删除。

以上三个 bug 对在隔离状态下测试各模块的单元测试不可见，但在测试完整的 init→update 流程时立即暴露。

---

## DO / DON'T

### DO

- 使用真实文件系统操作（不 mock fs）
- 测试完整流程：入口函数 → 文件系统输出
- 同时验证正向结果（文件已创建）和逆向结果（文件未变更）
- 每个测试后清理临时目录

### DON'T

- 不要 mock 内部模块来模拟模板变更——改用文件系统操作
- 不要在测试之间共享临时目录
- 不要在断言中依赖特定模板内容（使用 `computeHash` 或从 init 输出中读取）
