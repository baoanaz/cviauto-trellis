# 核心系统概述

这些系统在**所有平台**（Claude Code、Cursor 以及未来平台）上均可运行。

---

## 核心系统包含什么？

| 系统 | 用途 | 文件 |
|--------|---------|-------|
| Workspace | 会话跟踪、日志 | `.trellis/workspace/` |
| Tasks | 工作项跟踪 | `.trellis/tasks/` |
| Specs | 编码规范 | `.trellis/spec/` |
| Commands | 斜杠命令提示 | `.claude/commands/` |
| Scripts | 自动化工具 | `.trellis/scripts/`（核心子集） |

---

## 为什么这些系统具有可移植性

所有核心系统都是**基于文件**的：
- 不需要特殊运行时
- 可用任何工具读写
- 适用于任何 AI 编码环境

```
┌─────────────────────────────────────────────────────────────────┐
│                    核心系统（基于文件，CORE SYSTEMS）              │
│                                                                  │
│  .trellis/                                                       │
│  ├── workspace/     → 日志、会话历史                              │
│  ├── tasks/         → 任务目录、PRD、上下文文件                    │
│  ├── spec/          → 编码规范                                    │
│  └── scripts/       → Python 工具（核心子集）                     │
│                                                                  │
│  .claude/                                                        │
│  └── commands/      → 斜杠命令提示                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 平台使用方式

### Claude Code
所有核心系统通过钩子集成自动工作。

### Cursor
在会话开始时手动读取文件：
1. 阅读 `.trellis/workflow.md`
2. 阅读 `.trellis/spec/` 中的相关规范
3. 运行 `python3 .trellis/scripts/task.py current --source` 获取当前活动工作
4. 阅读 JSONL 文件获取上下文

### 其他平台
与 Cursor 相同 - 手动读取文件。

---

## 本目录中的文档

| 文档 | 内容 |
|----------|---------|
| `files.md` | `.trellis/` 中的所有文件及其用途 |
| `workspace.md` | Workspace 系统、日志、开发者身份 |
| `tasks.md` | Task 系统、目录、JSONL 上下文文件 |
| `specs.md` | Spec 系统、规范组织方式 |
| `scripts.md` | 核心脚本（平台无关） |