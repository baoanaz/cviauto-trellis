---
name: gitnexus-cli
description: "Use when the user needs to run GitNexus CLI commands like analyze/index a repo, check status, clean the index, generate a wiki, or list indexed repos. Examples: \"Index this repo\", \"Reanalyze the codebase\", \"Generate a wiki\""
---

# GitNexus CLI 命令

以下命令使用 `node .gitnexus/run.cjs <command>` —— 项目本地运行器 `gitnexus analyze` 会放在索引旁边。它会在调用时自动选择一个可用的运行器（优先全局 `gitnexus`，否则 `pnpm dlx`，再否则 `npx`），因此无需假定包管理器，也不需要全局安装。

> **尚未分析，或 `node .gitnexus/run.cjs` 报错 `Cannot find module`**（被 gitignore 的运行器不存在——例如刚克隆或执行过 `git clean`）？在项目根目录执行 `npx gitnexus analyze` 来（重新）生成运行器。在 **npm 11.x** 上，如果 `npx` 安装时崩溃（`node.target is null`），请用 `npm i -g gitnexus` 安装一次（然后 `gitnexus analyze`），或使用 `pnpm --allow-build=@ladybugdb/core --allow-build=gitnexus --allow-build=tree-sitter dlx gitnexus@latest analyze`。参见 [#1939](https://github.com/abhigyanpatwari/GitNexus/issues/1939)。

## 命令

### analyze —— 构建或刷新索引

```bash
node .gitnexus/run.cjs analyze
```

在项目根目录执行。此命令会解析所有源文件，构建知识图谱，写入 `.gitnexus/` 目录，并生成 CLAUDE.md / AGENTS.md 上下文文件。

| 标志 (Flag)       | 效果                                                             |
| ----------------- | ---------------------------------------------------------------- |
| `--force`         | 强制完整重建索引，即使已是最新                                    |
| `--embeddings`    | 启用语义搜索的嵌入向量生成（默认关闭）                            |
| `--drop-embeddings` | 重建时删除已有的嵌入向量。默认情况下，不带 `--embeddings` 的 `analyze` 会保留它们。 |

**何时运行：** 首次进入项目、大量代码变更后，或 `gitnexus://repo/{name}/context` 报告索引已过时时。在 Claude Code 中，当 `git commit` 和 `git merge` 后检测到索引过期，PostToolUse 钩子（hook）会通知代理执行 `analyze` —— 钩子本身不会直接运行 analyze，以避免阻塞代理长达 120 秒以及超时导致 KuzuDB 损坏的风险。

### status —— 检查索引新鲜度

```bash
node .gitnexus/run.cjs status
```

显示当前仓库是否有 GitNexus 索引、上次更新时间以及符号/关系数量。用于判断是否需要重新索引。

### clean —— 删除索引

```bash
node .gitnexus/run.cjs clean
```

删除 `.gitnexus/` 目录并从全局注册表中注销该仓库。在索引损坏或从项目中移除 GitNexus 之前使用。

| 标志 (Flag) | 效果                                          |
| ----------- | --------------------------------------------- |
| `--force`   | 跳过确认提示                                  |
| `--all`     | 清除所有已索引仓库，而不仅是当前仓库           |

### wiki —— 从图谱生成文档

```bash
node .gitnexus/run.cjs wiki
```

使用 LLM 从知识图谱生成仓库文档。需要 API 密钥（首次使用时保存至 `~/.gitnexus/config.json`）。

| 标志 (Flag)           | 效果                                      |
| --------------------- | ----------------------------------------- |
| `--force`             | 强制完整重新生成                          |
| `--model <model>`     | LLM 模型（默认：minimax/minimax-m2.5）    |
| `--base-url <url>`    | LLM API 基础 URL                          |
| `--api-key <key>`     | LLM API 密钥                              |
| `--concurrency <n>`   | 并发 LLM 调用数（默认：3）                |
| `--gist`              | 将 wiki 发布为公开的 GitHub Gist          |

### list —— 显示所有已索引仓库

```bash
node .gitnexus/run.cjs list
```

列出 `~/.gitnexus/registry.json` 中注册的所有仓库。MCP 的 `list_repos` 工具提供相同的信息。

## 索引完成后

1. **读取 `gitnexus://repo/{name}/context`** 以验证索引已加载
2. 使用其他 GitNexus 技能（`exploring`、`debugging`、`impact-analysis`、`refactoring`）继续任务

## 故障排查

- **"Not inside a git repository"**：请在 git 仓库内的目录中执行
- **重新分析后索引仍为过期状态**：重启 Claude Code 以重新加载 MCP 服务器
- **嵌入向量生成缓慢**：省略 `--embeddings`（默认关闭），或设置 `OPENAI_API_KEY` 使用更快的 API 嵌入
