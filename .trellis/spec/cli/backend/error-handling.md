# 错误处理

> 本 CLI 项目中如何处理错误。

---

## 概述

本 CLI 项目使用**顶层捕获模式**，错误冒泡到命令处理程序并以彩色输出显示给用户。该方法优先考虑用户友好的错误消息，同时保持正确的退出代码以支持脚本编写。

---

## 错误处理策略

### 顶层捕获模式

所有命令操作在 CLI 级别由 try-catch 包装：

```typescript
// cli/index.ts
program
  .command("init")
  .action(async (options: Record<string, unknown>) => {
    try {
      await init(options);
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });
```

### 关键原则

1. **让错误冒泡** - 不要在工具函数中捕获错误，除非你能有意义地处理它们
2. **错误消息的类型守卫** - 始终使用 `error instanceof Error ? error.message : error`
3. **以 code 1 退出** - 所有错误应导致 `process.exit(1)` 以支持脚本编写
4. **用户友好的消息** - 仅显示消息，不显示完整堆栈跟踪

---

## 错误模式

### 模式 1: 顶层命令捕获

在 CLI 命令级别用于捕获所有错误：

```typescript
.action(async (options) => {
  try {
    await commandAction(options);
  } catch (error) {
    console.error(
      chalk.red("Error:"),
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
});
```

### 模式 2: 可选操作的静默失败

当操作是可选的且失败可接受时：

```typescript
// Git config 可能不可用
let developerName: string | undefined;
try {
  developerName = execSync("git config user.name", {
    encoding: "utf-8",
  }).trim();
} catch {
  // Git 不可用或未配置 user.name - 静默忽略
}
```

### 模式 3: 带警告的优雅降级

当操作失败但我们可以继续时：

```typescript
try {
  execSync(`bash "${scriptPath}" "${developerName}"`, { cwd, stdio: "inherit" });
  developerInitialized = true;
} catch (error) {
  console.log(
    chalk.yellow(
      `Warning: Failed to initialize developer: ${error instanceof Error ? error.message : error}`,
    ),
  );
  // 在没有 developer 初始化的情况下继续
}
```

### 模式 4: 基于返回值的错误信号

对于检查条件的函数，返回结果对象或布尔值：

```typescript
function checkPackageJson(cwd: string): { hasFrontend: boolean; hasBackend: boolean } {
  if (!fs.existsSync(packageJsonPath)) {
    return { hasFrontend: false, hasBackend: false };
  }

  try {
    const content = fs.readFileSync(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    // ... 分析逻辑
    return { hasFrontend, hasBackend };
  } catch {
    return { hasFrontend: false, hasBackend: false };
  }
}
```

### 模式 5: 基于探测的错误区分（404 vs 瞬时故障）

当函数探测远程资源以**决定控制流分支**（例如，marketplace vs 直接下载）时，为所有错误返回统一的空结果是一个 bug。区分「资源不存在」（404）和瞬时故障（超时、auth、5xx）：

```typescript
// Good: 调用者可以区分「not found」和「network error」
export async function probeRegistryIndex(indexUrl: string): Promise<{
  templates: SpecTemplate[];
  isNotFound: boolean;
}> {
  try {
    const res = await fetch(indexUrl, {
      signal: AbortSignal.timeout(TIMEOUTS.INDEX_FETCH_MS),
    });
    if (res.status === 404) {
      return { templates: [], isNotFound: true };
    }
    if (!res.ok) {
      return { templates: [], isNotFound: false };
    }
    const index = (await res.json()) as TemplateIndex;
    return { templates: index.templates, isNotFound: false };
  } catch {
    return { templates: [], isNotFound: false };
  }
}

// Bad: 调用者无法知道 templates 为什么为空
export async function fetchTemplateIndex(url: string): Promise<SpecTemplate[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).templates;
  } catch {
    return []; // 404？超时？Auth 错误？无法得知
  }
}
```

**何时使用**：任何其空/错误结果触发**不同代码路径**（不仅是回退）的函数。如果调用者只是回退到默认值，统一的空结果是可以的（如官方 marketplace fetch）。如果调用者切换模式，它需要区分。

**真实示例**：`fetchTemplateIndex` 对所有错误返回 `[]`，导致注册表 marketplace 在网络出现瞬时故障时被错误分类为直接下载源。

---

## 错误的类型守卫

访问错误属性时始终使用类型守卫模式：

```typescript
// Correct: error.message 的类型守卫
catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(chalk.red("Error:"), message);
}

// Incorrect: 假设 error 是 Error
catch (error) {
  console.error(error.message); // TypeScript 错误: 'error' 是 'unknown'
}
```

---

## 退出代码

| 代码 | 含义 | 用途 |
|------|---------|-------|
| `0` | 成功 | 正常完成（隐式） |
| `1` | 错误 | 任何错误条件 |

```typescript
// Error: 以 code 1 退出
process.exit(1);

// Success: 不需要显式退出，或者:
process.exit(0);
```

---

## DO / DON'T

### DO

- 在顶层（命令处理程序）捕获错误
- 使用 `error instanceof Error ? error.message : error` 类型守卫
- 错误时以 code 1 退出以支持正确的脚本编写
- 对真正可选的操作使用空 catch
- 显示用户友好的消息，而不是堆栈跟踪
- 对错误前缀使用 `chalk.red()`
- 对警告使用 `chalk.yellow()`

### DON'T

- 不要在工具函数中捕获错误，除非你能处理它们
- 不要假定 `error` 是 `Error` 类型
- 不要向用户记录完整堆栈跟踪（除非在调试模式下）
- 不要对错误条件使用 exit code 0
- 不要在没有解释原因的注释的情况下静默吞掉错误

---

## 常见错误

### 错误 1: 不使用类型守卫

```typescript
// Bad: TypeScript 错误，运行时风险
catch (error) {
  console.error(error.message);
}

// Good: 类型守卫
catch (error) {
  console.error(error instanceof Error ? error.message : error);
}
```

### 错误 2: 捕获过早

```typescript
// Bad: 错误被捕获并重新抛出，丢失上下文
function readConfig(path: string): Config {
  try {
    return JSON.parse(fs.readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error("Failed to read config"); // 丢失了原始错误
  }
}

// Good: 让它带着原始错误冒泡
function readConfig(path: string): Config {
  return JSON.parse(fs.readFileSync(path, "utf-8")); // 调用者处理
}
```

### 错误 3: Catch-all 为模式切换逻辑返回统一空结果

```typescript
// Bad: 所有错误返回 []，调用者使用 length===0 切换模式
async function fetchIndex(url: string): Promise<Item[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()).items;
  } catch {
    return []; // 404 和 timeout 对调用者看起来相同
  }
}
// Caller: if (items.length === 0) switchToDirectMode();
// Bug: timeout 也触发 direct mode！

// Good: 当调用者需要分支时返回结构化结果
async function probeIndex(url: string): Promise<{ items: Item[]; isNotFound: boolean }> {
  // ... 参见上面的模式 5
}
```

**症状**：模式自动检测大多数时候工作，但在网络条件差时随机切换到错误模式。

**预防**：问「调用者是否在空 vs 错误上分支？」如果是，返回结构化结果。如果不是（只是回退到默认），统一空是可以的。

### 错误 4: 快捷路径从下游函数继承 catch-all

当 CLI 有「跳过探测」快捷方式（例如 `--template` 跳过交互选择器）时，下游动作函数可能仍然在内部调用 catch-all，静默吞掉探测设计用来展示的错误：

```typescript
// Setup: probeRegistryIndex 正确区分 404 和 timeout
// 但 downloadTemplateById 仍然调用 findTemplate → fetchTemplateIndex（catch-all）

// Bad: --template 路径跳过探测，命中下游 catch-all
if (options.template) {
  selectedTemplate = options.template; // Skip probe ✓
}
// ... later:
await downloadTemplateById(cwd, selectedTemplate, strategy, undefined, registry);
// Inside: findTemplate() → fetchTemplateIndex() → catch { return [] }
// Timeout 变成 "Template not found" → 回退到空白

// Good: 动作函数对注册表路径使用探测级错误处理
if (registry && indexUrl) {
  const probeResult = await probeRegistryIndex(indexUrl);
  if (!probeResult.isNotFound && probeResult.templates.length === 0) {
    return { success: false, message: "Could not reach registry." };
  }
  resolved = probeResult.templates.find((t) => t.id === templateId);
} else {
  resolved = await findTemplate(templateId); // catch-all 对官方源没问题
}
```

**症状**：`--registry gh:org/repo/marketplace --template foo` 在网络失败时静默回退到空白模板，而不是报告真正的错误。

**预防**：当添加「跳转到动作」快捷方式时，验证动作函数的内部错误处理质量与被跳过的路径匹配。如果跳过路径使用 `probeRegistryIndex`，动作也必须使用。

### 错误 5: 没有注释的静默失败

```typescript
// Bad: 为什么被忽略？
try {
  doSomething();
} catch {
}

// Good: 解释为什么忽略它是安全的
try {
  doSomething();
} catch {
  // Optional operation - safe to ignore if it fails
}
```

---

## 示例

### 完整命令处理程序

```typescript
import chalk from "chalk";

program
  .command("init")
  .description("Initialize the project")
  .action(async (options: InitOptions) => {
    try {
      await init(options);
    } catch (error) {
      console.error(
        chalk.red("Error:"),
        error instanceof Error ? error.message : error,
      );
      process.exit(1);
    }
  });
```

### 带可选操作的函数

```typescript
async function init(options: InitOptions): Promise<void> {
  const cwd = process.cwd();

  // 可选：从 git 检测 developer 名称
  let developerName = options.user;
  if (!developerName) {
    try {
      developerName = execSync("git config user.name", {
        cwd,
        encoding: "utf-8",
      }).trim();
    } catch {
      // Git 不可用 - 稍后将提示用户
    }
  }

  // 必需操作 - 让错误冒泡
  await createWorkflowStructure(cwd, options);
}
```
