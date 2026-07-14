# 日志指南

> 本 CLI 项目中 console 输出和日志记录的方式。

---

## 概述

本 CLI 项目使用 **chalk** 进行彩色控制台输出。由于这是一个面向用户的 CLI 工具，我们直接使用 `console.log()` 和 `console.error()` 而不是结构化的日志库。输出遵循一致的颜色约定，以帮助用户快速理解每条消息的性质。

---

## 颜色约定

| 颜色 | Chalk 方法 | 用途 | 示例 |
|-------|--------------|-------|---------|
| **青色（Cyan）** | `chalk.cyan()` | 标题、横幅、章节标题 | `"Next steps:"` |
| **蓝色（Blue）** | `chalk.blue()` | 进行中的操作、步骤指示器 | `"Creating workflow structure..."` |
| **绿色（Green）** | `chalk.green()` | 成功消息 | `"Trellis initialized successfully!"` |
| **黄色（Yellow）** | `chalk.yellow()` | 警告、即将推出、跳过的项目 | `"Coming soon: update command"` |
| **红色（Red）** | `chalk.red()` | 错误 | `"Error:"` 前缀 |
| **灰色（Gray）** | `chalk.gray()` | 次要信息、提示、路径 | 描述、文件路径 |
| **白色（White）** | `chalk.white()` | 高亮内联文本 | 要运行的命令 |

---

## 消息模式

### 章节标题（青色）

```typescript
console.log(chalk.cyan("Next steps:"));
console.log(chalk.cyan("Generated structure files:"));
```

### 进度步骤（蓝色 + Emoji）

```typescript
console.log(chalk.blue("📁 Creating workflow structure..."));
console.log(chalk.blue("📝 Configuring Cursor commands..."));
console.log(chalk.blue("🤖 Configuring Multi-Agent Pipeline..."));
console.log(chalk.blue("📄 Created init-agent.md"));
```

### 子步骤（灰色 + 缩进）

```typescript
console.log(chalk.gray("   - Creating agent configurations..."));
console.log(chalk.gray("   - Creating hook configurations..."));
```

### 成功（绿色 + Emoji）

```typescript
console.log(chalk.green("\n✅ Trellis initialized successfully!\n"));
```

### 警告（黄色 + Emoji）

```typescript
console.log(chalk.yellow("Coming soon: update command"));
console.log(chalk.yellow("No tools selected. At least one tool is required."));
console.log(chalk.yellow(`⚠️  Failed to initialize developer: ${message}`));
```

### 错误（红色）

```typescript
console.error(
  chalk.red("Error:"),
  error instanceof Error ? error.message : error,
);
```

### 信息性（混合颜色）

```typescript
// 键值对
console.log(chalk.blue("👤 Developer:"), chalk.gray(developerName));
console.log(chalk.blue("🔍 Project type:"), chalk.gray(projectDescription));

// 带高亮命令的说明
console.log(
  chalk.gray(`${stepNum}. Use `) +
  chalk.white("/trellis:start") +
  chalk.gray(" command in your AI tool to begin a session"),
);
```

---

## 输出结构

### 横幅和介绍

```typescript
// ASCII 艺术横幅（青色）
const banner = figlet.textSync("Trellis", { font: "Rebel" });
console.log(chalk.cyan(`\n${banner.trimEnd()}`));

// 标语（灰色）
console.log(chalk.gray("\n  AI-assisted development workflow framework\n"));
```

### 进度输出

```typescript
// 模式指示器
console.log(chalk.gray("Mode: Force overwrite existing files\n"));

// 检测结果
console.log(chalk.blue("👤 Developer:"), chalk.gray(developerName));
console.log(chalk.blue("🔍 Project type:"), chalk.gray(description));

// 配置摘要
console.log(chalk.gray(`\nConfiguring: ${tools.join(", ")}`));
console.log(chalk.gray(`Project type: ${typeDescription}\n`));

// 步骤进度
console.log(chalk.blue("📁 Creating workflow structure..."));
console.log(chalk.blue("📝 Configuring Cursor commands..."));
```

### 完成摘要

```typescript
// 成功消息
console.log(chalk.green("\n✅ Trellis initialized successfully!\n"));

// 后续步骤
console.log(chalk.cyan("Next steps:"));
console.log(
  chalk.gray(`1. Use `) +
  chalk.white("/trellis:start") +
  chalk.gray(" command in your AI tool"),
);

// 生成的文件
console.log(chalk.cyan("Generated structure files:"));
console.log(chalk.gray(`  ${PATHS.STRUCTURE}/guides/   - Thinking guides`));
```

---

## Emoji 用法

| Emoji | 用途 |
|-------|-------|
| 📁 | 目录/文件夹操作 |
| 📝 | 配置/文件写入 |
| 📄 | 单个文件创建 |
| 🤖 | AI/agent 相关 |
| 👤 | 用户/开发者相关 |
| 🔍 | 检测/分析 |
| ✅ | 成功完成 |
| ⚠️ | 警告 |

---

## 缩进

使用缩进来显示层次结构：

```typescript
// 顶层（无缩进）
console.log(chalk.blue("🤖 Configuring Multi-Agent Pipeline..."));

// 子级（3 个空格 + 短横）
console.log(chalk.gray("   - Creating agent configurations..."));
console.log(chalk.gray("   - Creating hook configurations..."));

// 文件列表（2 个空格）
console.log(chalk.gray(`  ${PATHS.STRUCTURE}/guides/   - Thinking guides`));
console.log(chalk.gray(`  ${PATHS.STRUCTURE}/frontend/ - Frontend guidelines`));
```

---

## DO / DON'T

### DO

- 对所有彩色输出使用 `chalk`
- 一致地遵循颜色约定
- 使用 emoji 进行视觉扫描（适度使用）
- 使用缩进来显示层次结构
- 在章节之间添加空行以提高可读性
- 对错误使用 `console.error()`

### DON'T

- 不要使用原始 ANSI 转义码
- 不要混合颜色含义（例如，用红色表示非错误）
- 不要过度使用 emoji
- 不要记录敏感信息（路径如包含用户名是例外，为了上下文可以接受）
- 不要对错误使用 `console.log()`（使用 `console.error()`）
- 不要在生产中输出调试信息

---

## 示例

### 完整 Init 输出流程

```typescript
// 1. 横幅
console.log(chalk.cyan(`\n${banner.trimEnd()}`));
console.log(chalk.gray("\n  AI-assisted development workflow framework\n"));

// 2. 模式（如果是特殊模式）
if (options.force) {
  console.log(chalk.gray("Mode: Force overwrite existing files\n"));
}

// 3. 检测结果
console.log(chalk.blue("👤 Developer:"), chalk.gray(developerName));
console.log(chalk.blue("🔍 Project type:"), chalk.gray(typeDescription));

// 4. 配置摘要
console.log(chalk.gray(`\nConfiguring: ${tools.join(", ")}\n`));

// 5. 进度步骤
console.log(chalk.blue("📁 Creating workflow structure..."));
console.log(chalk.blue("📝 Configuring Cursor commands..."));
console.log(chalk.blue("🤖 Configuring Multi-Agent Pipeline..."));
console.log(chalk.gray("   - Creating agent configurations..."));

// 6. 成功
console.log(chalk.green("\n✅ Trellis initialized successfully!\n"));

// 7. 后续步骤
console.log(chalk.cyan("Next steps:"));
console.log(
  chalk.gray("1. Use ") +
  chalk.white("/trellis:start") +
  chalk.gray(" command to begin"),
);
```

### 错误输出

```typescript
try {
  await init(options);
} catch (error) {
  console.error(
    chalk.red("Error:"),
    error instanceof Error ? error.message : error,
  );
  process.exit(1);
}
```

### 警告输出

```typescript
// 非关键警告
console.log(
  chalk.yellow(
    `⚠️  Failed to initialize developer: ${message}`,
  ),
);

// 即将推出的功能
console.log(chalk.yellow("Coming soon: update command"));
```
