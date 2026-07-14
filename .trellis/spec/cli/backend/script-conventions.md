# 脚本约定

> `.trellis/scripts/` 目录中 Python 脚本的标准。

---

## 概述

所有 workflow 脚本目标 **Python 3.9+** 以实现跨平台兼容性（匹配 macOS 系统 `python3`；覆盖 Ubuntu 22.04 LTS 及更新版本）。脚本仅使用标准库（无外部依赖）。PEP 604 联合注解（`str | None`）仅在文件声明 `from __future__ import annotations` 时允许 — 参见下面的跨平台兼容性章节。

---

## 目录结构

```
.trellis/scripts/
├── __init__.py           # 包初始化
├── common/               # 共享模块
│   ├── __init__.py       # Windows 编码修复（集中式）
│   ├── paths.py          # 路径常量和函数
│   ├── developer.py      # 开发者身份管理
│   ├── io.py             # read_json / write_json
│   ├── log.py            # Colors 类 + log_info/log_error/log_warn/log_success
│   ├── git.py            # run_git() — git 命令包装器
│   ├── types.py          # TaskData（TypedDict）、TaskInfo（dataclass）、AgentRecord
│   ├── tasks.py          # load_task()、iter_active_tasks() — 类型化任务访问
│   ├── active_task.py    # 会话作用域的活跃任务解析器
│   ├── task_utils.py     # resolve_task_dir()、run_task_hooks()
│   ├── task_store.py     # 任务 CRUD（create、archive、set-branch 等）
│   ├── task_context.py   # JSONL 上下文管理（add-context、validate、list-context）
│   ├── task_queue.py     # 任务队列 CRUD
│   ├── config.py         # 配置读取器（config.yaml、hooks）
│   ├── trellis_config.py # 独立 .trellis/config.yaml 读取器（无任务/仓库依赖）
│   ├── workflow_phase.py # 从 .trellis/workflow.md 提取 Phase Index / 步骤节（带平台过滤）
│   ├── cli_adapter.py    # 多平台 CLI 抽象
│   ├── git_context.py    # 入口 shim → session_context + packages_context
│   ├── session_context.py    # 会话上下文生成（text/json/record）
│   └── packages_context.py  # 包发现和上下文
├── hooks/                # 生命周期 hook 脚本（项目特定）
│   └── linear_sync.py    # 示例：同步任务到 Linear
├── task.py               # 入口 shim → task_store + task_context
├── get_context.py        # 会话上下文检索
├── init_developer.py     # 开发者初始化
├── get_developer.py      # 获取当前开发者
└── add_session.py        # 会话记录
```

---

## 脚本类型

### 库模块（`common/*.py`）

由其他脚本导入的共享实用工具。**永不直接运行。**

三个层级：

| 层级 | 模块 | 角色 |
|------|---------|------|
| **基础** | `io.py`、`log.py`、`git.py`、`paths.py` | 零内部依赖，被所有内容使用 |
| **领域** | `types.py`、`tasks.py`、`task_store.py`、`task_context.py`、`task_utils.py` | 任务数据模型和操作 |
| **基础设施** | `config.py`、`cli_adapter.py` | 平台抽象和配置 |
| **上下文** | `session_context.py`、`packages_context.py`、`git_context.py`（shim） | 输出生成 |

### 入口脚本（`*.py`）

用户直接运行的 CLI 工具。包含带使用说明的文档字符串。

```python
#!/usr/bin/env python3
"""简短描述。

Usage:
    python3 script.py <command> [options]
"""

from __future__ import annotations

import argparse
import sys

from common.paths import get_repo_root

def main() -> int:
    parser = argparse.ArgumentParser(...)
    args = parser.parse_args()
    # ... 分发
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

---

## 编码标准

### 类型提示

使用现代类型提示（Python 3.10+ 语法）：

```python
# Good
def get_tasks(status: str | None = None) -> list[dict]:
    ...

def read_json(path: Path) -> dict | None:
    ...

# Bad - 旧风格
from typing import Optional, List, Dict
def get_tasks(status: Optional[str] = None) -> List[Dict]:
    ...
```

### 路径处理

始终使用 `pathlib.Path`：

```python
# Good
from pathlib import Path

def read_file(path: Path) -> str:
    return path.read_text(encoding="utf-8")

config_path = repo_root / DIR_WORKFLOW / "config.json"

# Bad - 字符串拼接
config_path = repo_root + "/" + DIR_WORKFLOW + "/config.json"
```

### JSON 操作

使用辅助函数实现一致的错误处理：

```python
import json
from pathlib import Path


def read_json(path: Path) -> dict | None:
    """读取 JSON 文件，错误时返回 None。"""
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_json(path: Path, data: dict) -> bool:
    """写入 JSON 文件，返回成功状态。"""
    try:
        path.write_text(
            json.dumps(data, indent=2, ensure_ascii=False),
            encoding="utf-8"
        )
        return True
    except Exception:
        return False
```

### 子进程执行

```python
import subprocess
from pathlib import Path


def run_command(
    cmd: list[str],
    cwd: Path | None = None
) -> tuple[int, str, str]:
    """运行命令并返回 (returncode, stdout, stderr)。"""
    result = subprocess.run(
        cmd,
        cwd=cwd,
        capture_output=True,
        text=True
    )
    return result.returncode, result.stdout, result.stderr
```

### 会话脚本中的可选咨询检查

#### 1. 范围 / 触发器

当生成的 `.trellis/scripts/` 模块在 hook/会话上下文生成期间执行咨询检查时使用此契约，例如检查是否有可用的 Trellis 更新。这些检查永远不得阻塞上下文输出。

#### 2. 签名

```python
def _fetch_tool_output() -> str | None: ...
def _extract_advisory_value(output: str) -> str | None: ...
def _resolve_advisory_value() -> str | None: ...
def _marker_path(repo_root: Path) -> Path: ...
def _mark_attempted(repo_root: Path) -> bool: ...
```

#### 3. 契约

- 优先重用现有本地 CLI 行为，而不是重复注册表/API 逻辑。
- 本地咨询命令使用 `subprocess.run(..., capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=<short timeout>)`。
- 标记文件位于 `.trellis/.runtime/` 下，并在可用时由当前 Trellis 会话身份键控。
- 标记写入是尽力而为：写入失败不得使上下文输出失败。

#### 4. 验证与错误矩阵

| 条件 | 行为 |
|-----------|----------|
| 本地命令返回有效值 | 比较/使用值并写入标记 |
| 本地命令失败 | 不打印任何内容，不写入标记 |
| 值解析为无效 | 不打印任何内容；可能写入标记以避免重复嘈杂工作 |
| 标记已存在 | 跳过所有探测，不打印任何内容 |

#### 5. Good / Base / Bad 案例

- Good：`trellis --version` 打印现有 CLI 更新提示或最终版本，项目 `.version` 是 `0.5.0`，因此上下文打印一次更新提示。
- Base：`trellis --version` 返回 `0.5.9`；不需要注册表解析。
- Bad：失败的本地命令在解析到任何可用值之前写入标记，隐藏了同一会话中稍后的成功检查。

#### 6. 所需测试

- 较新版本打印提示并包含生成的上下文正文。
- 相等/更新的当前项目版本不打印提示。
- 失败的查找不打印提示，不消耗一次会话标记。
- 现有 `trellis --version` 更新输出被解析并标准化。
- 非默认模式（`--json`、record、packages、phase）不调用咨询检查。

#### 7. Wrong vs Correct

```python
# Wrong: 在知道检查是否产生值之前消耗标记。
if not _mark_attempted(repo_root):
    return None
latest = _fetch_primary_value()
if not latest:
    return None
```

```python
# Correct: 仅当先前成功/决定性尝试写入标记时才跳过。
if _marker_path(repo_root).exists():
    return None
latest = _resolve_advisory_value()
if not latest:
    return None
_mark_attempted(repo_root)
```

---

## 共享模块 API 参考

### `common/io.py` — JSON 文件 I/O

所有 JSON 文件操作的唯一权威来源。替换了 8 个重复的 `_read_json_file` 和 5 个重复的 `_write_json_file` 函数。

| 函数 | 签名 | 返回 | 错误行为 |
|----------|-----------|---------|----------------|
| `read_json` | `(path: Path) -> dict \| None` | 已解析的 dict，或 `None` | 在 `FileNotFoundError`、`JSONDecodeError`、`OSError` 上返回 `None` |
| `write_json` | `(path: Path, data: dict) -> bool` | 成功时为 `True` | 在 `OSError`、`IOError` 上返回 `False` |

**契约**：
- 始终使用 `encoding="utf-8"` 和 `ensure_ascii=False`
- `write_json` 使用 `indent=2`（美化打印）输出
- 调用者必须检查返回值 — 不抛出异常

### `common/log.py` — 终端输出

| 导出 | 类型 | 描述 |
|--------|------|-------------|
| `Colors` | class | ANSI 代码：`RED`、`GREEN`、`YELLOW`、`BLUE`、`CYAN`、`DIM`、`NC` |
| `colored(text, color)` | function | 用颜色包装文本 + 重置 |
| `log_info(msg)` | function | `[INFO]` 前缀（蓝色） |
| `log_success(msg)` | function | `[SUCCESS]` 前缀（绿色） |
| `log_warn(msg)` | function | `[WARN]` 前缀（黄色） |
| `log_error(msg)` | function | `[ERROR]` 前缀（红色） |

所有 `log_*` 函数打印到 **stdout**（不是 stderr）。对 stderr 输出使用 `print(..., file=sys.stderr)`。

### `common/git.py` — Git 命令包装器

```python
def run_git(args: list[str], cwd: Path | None = None) -> tuple[int, str, str]
```

- 在所有命令前添加 `git -c i18n.logOutputEncoding=UTF-8`（跨平台 UTF-8）
- 对子进程输出使用 `encoding="utf-8", errors="replace"`
- 异常时返回 `(1, "", error_message)`（永不抛出异常）
- `git_context.py` 中的向后兼容别名：`_run_git_command = run_git`

### `common/active_task.py` — 活跃任务解析器

所有当前任务消费者必须使用活跃任务解析器，而不是直接读取 `.trellis/.current-task`。解析器是会话/窗口作用域任务状态的唯一权威来源：

1. 从平台输入、`TRELLIS_CONTEXT_ID`、当主机导出时的平台原生会话环境变量或匹配 AI 运行 `task.py` 命令的 Cursor shell 票据派生上下文键。
2. 读取 `.trellis/.runtime/sessions/<session-key>.json`。
3. 如果没有上下文键或没有会话任务存在，返回无活跃任务。
4. 如果会话任务存在但任务目录过时，返回过时会话状态。

| 函数 | 用途 |
|----------|---------|
| `resolve_context_key(platform_input, platform)` | 接受 `session_id` / `sessionId` / `sessionID`、Cursor `conversation_id` 和 transcript 路径回退 |
| `resolve_active_task(repo_root, platform_input, platform)` | 返回带有 `task_path`、`source_type`、`context_key` 和 `stale` 的 `ActiveTask` |
| `set_active_task(...)` | 当上下文键存在时写入会话运行时状态；没有上下文键则返回 `None` |
| `clear_active_task(...)` | 删除当前会话文件；没有上下文键则返回无活跃任务 |

`TRELLIS_CONTEXT_ID` 是子进程的上下文键覆盖。它不是第二个任务指针，且永远不得存储任务路径。普通的 AI 运行 shell 命令不能推断当前对话/窗口，除非主机进程在其环境中导出会话身份或命令以 `TRELLIS_CONTEXT_ID` 启动；没有该身份，`task.py start` 失败并解释如何提供会话运行时。对于 Claude Code，SessionStart 接收 `CLAUDE_ENV_FILE`；Trellis 必须在那里追加 `export TRELLIS_CONTEXT_ID=<context-key>`，以便后续 Bash 工具继承相同的会话身份。对于 OpenCode，`tool.execute.before` 必须在命令尚未设置时使用 plugin 会话身份前缀 Bash 命令为 `TRELLIS_CONTEXT_ID`，因为某些 TUI 会话不暴露 `OPENCODE_RUN_ID` 给 Bash。前缀必须匹配主机 shell：使用 `export TRELLIS_CONTEXT_ID=<context-key>;` 用于 POSIX shells，`$env:TRELLIS_CONTEXT_ID = '<context-key>';` 用于 Windows PowerShell。将赋值放在用户命令之前，以便像 `task.py start && task.py current` 这样的复合命令为 Bash 调用中的每个命令保持相同的上下文。不要仅从 OS 选择此前缀。在 Windows 上，Git Bash / MSYS2 仍然解析 POSIX 语法，因此 OpenCode 必须将 `MSYSTEM`、`MINGW_PREFIX`、`OSTYPE=msys|mingw|cygwin`、`SHELL=...bash` 或 `OPENCODE_GIT_BASH_PATH` 视为 POSIX-shell 信号，并仅在没有此类信号存在时使用 PowerShell 前缀。对于 Cursor，`session-start.py` 不是可靠的 shell 环境桥接。相反，`inject-shell-session-context.py` 必须在 `beforeShellExecution` 上运行，并为匹配的 `task.py start/current/finish` 命令写入短生命周期的 `.trellis/.runtime/cursor-shell/*.json` 票据。活跃任务解析器可以仅在没有环境变量身份存在、当前 `task.py` 子命令匹配票据、票据新鲜且恰好一个上下文键匹配时才消费该票据。这使 Cursor 任务状态按对话保持，而不接受全局指针。对于 Pi Agent，生成的 TypeScript 扩展必须从 `ctx.sessionManager.getSessionId()` 读取真实会话 id，并在 `tool_call` 中通过前缀 `export TRELLIS_CONTEXT_ID=<context-key>;` 变更 Bash 工具调用。然后 Python 解析器看到显式 `TRELLIS_CONTEXT_ID` 覆盖；Pi 不需要 `.current-task` 回退或 Python hook 目录。

（活跃任务运行时生命周期场景、错误矩阵、Wrong vs Correct 等省略 — 详细内容见原文）

---

## 跨平台兼容性

### 关键：Windows stdio 编码（stdout + stdin）

在 Windows 上，Python 的 stdout 和 stdin 默认使用系统代码页（例如，中国的 GBK/CP936，西方地区的 CP1252）。这导致：
- 当**打印**非 ASCII 字符时的 `UnicodeEncodeError`（stdout）
- 当**读取管道** UTF-8 内容时的 `UnicodeDecodeError`（stdin），例如通过 `cat << EOF | python3 script.py` 的中文文本

**解决方案**：在 `common/__init__.py` 中集中编码修复。所有导入 `common` 的脚本自动获得修复。

### 关键：PEP 604 注解需要 `from __future__ import annotations`

使用 PEP 604 联合语法的任何分布式 Python 模板文件必须在模块文档字符串之后立即以 `from __future__ import annotations` 开头。这使得注解在 Python 3.7+ 上作为惰性字符串工作。

### 关键：保持面向用户的 Python 命令平台感知

Windows 不支持 shebang。文档字符串和帮助文本应描述规则：Windows 上 `python`，其他平台 `python3`。

### 路径分隔符

使用 `pathlib.Path` — 它自动处理分隔符。

---

## 任务生命周期 Hooks

### 范围 / 触发器

任务生命周期事件（`after_create`、`after_start`、`after_finish`、`after_archive`）执行在 `config.yaml` 中配置的用户定义 shell 命令。

### 签名

```python
def get_hooks(event: str, repo_root: Path | None = None) -> list[str]
def _run_hooks(event: str, task_json_path: Path, repo_root: Path) -> None
```

### 契约

**配置格式**（`config.yaml`）：
```yaml
hooks:
  after_create:
    - "python3 .trellis/scripts/hooks/my_hook.py create"
  after_start:
    - "python3 .trellis/scripts/hooks/my_hook.py start"
  after_archive:
    - "python3 .trellis/scripts/hooks/my_hook.py archive"
```

**传递给 hooks 的环境变量**：

| 键 | 类型 | 描述 |
|-----|------|-------------|
| `TASK_JSON_PATH` | 绝对路径字符串 | 任务 `task.json` 的路径 |

- `cwd` 设置为 `repo_root`
- Hooks 继承父进程环境 + `TASK_JSON_PATH`

### 子进程执行

```python
import os
import subprocess

env = {**os.environ, "TASK_JSON_PATH": str(task_json_path)}

result = subprocess.run(
    cmd,
    shell=True,
    cwd=repo_root,
    env=env,
    capture_output=True,
    text=True,
    encoding="utf-8",    # 必需：跨平台
    errors="replace",    # 必需：跨平台
)
```

### 验证与错误矩阵

| 条件 | 行为 |
|-----------|----------|
| 配置中无 `hooks` 键 | 空操作（空列表） |
| `hooks` 不是 dict | 空操作（空列表） |
| 事件键缺失 | 空操作（空列表） |
| Hook 命令非零退出 | `[WARN]` 到 stderr，继续下一个 hook |
| Hook 命令抛出异常 | `[WARN]` 到 stderr，继续下一个 hook |
| `linearis` 未安装 | Hook 失败带警告，任务操作成功 |

### Wrong vs Correct

#### Wrong — hook 失败时阻塞
```python
result = subprocess.run(cmd, shell=True, check=True)  # 失败时抛出异常！
```

#### Correct — 警告并继续
```python
try:
    result = subprocess.run(cmd, shell=True, ...)
    if result.returncode != 0:
        print(f"[WARN] Hook failed: {cmd}", file=sys.stderr)
except Exception as e:
    print(f"[WARN] Hook error: {cmd} — {e}", file=sys.stderr)
```

### Hook 脚本模式

需要项目特定配置（API 密钥、用户 ID）的 hook 脚本应：
1. 将配置存储在 **gitignored** 本地文件中（例如 `.trellis/hooks.local.json`）
2. 在启动时读取配置，如果缺失则失败并显示清晰消息
3. 保持脚本本身可提交（无硬编码密钥）

---

## 脚本中的 Git 交互

自动暂存/自动提交 `.trellis/` 路径的脚本必须通过规范 `common/safe_commit.py` 辅助函数。手写的 `git add -A` / `git add -f` 调用已导致真实用户数据事件，被禁止。

### 绝对禁止：永远不要全量暂存（`git add -A` / `git add .` / `git add .trellis/`）

> **在此仓库中，绝不运行 `git add -A`、`git add .` 或 `git add .trellis/` — 在任何语言、任何脚本、任何人、任何 AI 中。始终按精确路径暂存。**

暂存 `.trellis/` 仅允许通过两条精确路由之一：

1. **`common/safe_commit.py` 的精确允许列表** — 用于所有 Python 自动提交（`add_session.py`、`task.py archive`）。
2. **`release.js` 的精确 pathspec** — 用于发布提交。发布前扫描必须排除 `.trellis/`（参见 `release-process.md`）。

对于人类/AI 制定即席提交：先 `git status`，然后按文件 `git add <path>`。永不全量暂存。

### 规范辅助函数

| 辅助函数 | 来源 | 用途 |
|---|---|---|
| `safe_trellis_paths_to_add(repo_root, task_name=None)` | `templates/trellis/scripts/common/safe_commit.py:safe_trellis_paths_to_add` | `add_session.py` 的路径白名单 — 当前开发者的日志文件 + index.md，以及（当传递 `task_name` 时）仅当前任务目录。调用者必须传递 `task_name`，以便并行窗口脏任务目录永不泄露到会话提交中（#303）。 |
| `safe_archive_paths_to_add(repo_root, task_name=None, modified_children=None)` | `templates/trellis/scripts/common/safe_commit.py:safe_archive_paths_to_add` | `task.py archive` 的路径白名单 — archive 子树 + 显式传递的 `modified_children` 任务目录（父/子关系更新）。调用者必须传递 `task_name`。 |
| `safe_git_add(paths, repo_root)` | `templates/trellis/scripts/common/safe_commit.py:safe_git_add` | 纯 `git add -- <paths>`；永不 `-f`。返回 `(success, used_force=False, stderr)` |
| `print_gitignore_warning(paths)` | `templates/trellis/scripts/common/safe_commit.py:print_gitignore_warning` | 「ignored by .gitignore」警告的唯一权威来源，包括 AI 防御负面示例 |
| `get_session_auto_commit(repo_root)` | `templates/trellis/scripts/common/config.py:get_session_auto_commit` | 从 `.trellis/config.yaml` 读取 `session_auto_commit`（默认 `False`；仅本地记录） |

### 反模式：AI 发明的 `git add -f .trellis/`

真实用户事件（pre-0.5.10）：项目的 `.gitignore` 将 `.trellis/` 列为公司级模板。当自动提交遇到 `ignored by .gitignore` 时，驱动 workflow 的 AI agent 通过用 `git add -f .trellis/` 重试来「修复」失败。扇出包括每个被忽略的子树（`.trellis/.backup-*/`、`.trellis/worktrees/`、`.trellis/.template-hashes.json`、`.trellis/.runtime/`），在任何人注意到之前提交了 548 个文件 / 83474 行缓存和备份。

### 模式：路径白名单 + 纯 `git add` + 警告并跳过

```python
from common.safe_commit import (
    safe_trellis_paths_to_add,
    safe_git_add,
    print_gitignore_warning,
)
from common.config import get_session_auto_commit

def _auto_commit_workspace(repo_root: Path) -> None:
    if not get_session_auto_commit(repo_root):
        print("[OK] session_auto_commit: false — skipping git stage/commit.",
              file=sys.stderr)
        return

    current = get_current_task(repo_root)
    if current:
        paths = safe_trellis_paths_to_add(repo_root, task_name=Path(current).name)
    else:
        paths = [
            p for p in safe_trellis_paths_to_add(repo_root, task_name=None)
            if not p.startswith(".trellis/tasks/")
        ]
    if not paths:
        return

    success, _, err = safe_git_add(paths, repo_root)
    if not success:
        if "ignored by" in err.lower():
            print_gitignore_warning(paths)
        else:
            print(f"[WARN] git add failed: {err.strip()}", file=sys.stderr)
        return
```

行为契约：
- 白名单仅从磁盘上存在的路径构建；永不向 `git` 传递不存在的参数。
- `safe_git_add` 恰好运行 `git add -- <paths>` 一次。无重试，无 `-f`。
- `ignored by` 失败 → 调用 `print_gitignore_warning(paths)`。
- 任何其他失败 → 记录 stderr 并返回。不用不同标志重新尝试。
- `used_force` 始终为 `False`。不要引入将其设置为 `True` 的代码路径。

### 模式：`session_auto_commit` 配置门控（0.5.11 添加）

```yaml
# .trellis/config.yaml
session_auto_commit: false    # 模板默认值 — 文件已写入，git 不动
# session_auto_commit: true   # 选择加入自动暂存 + 自动提交
```

- `false`（模板默认）— 在触碰 git 之前提前返回。文件仍被写入；用户自行运行 `git status` / `git add` / `git commit`。
- `true` — `add_session.py` 和 `task.py archive` 通过上述辅助函数暂存 + 提交。
- 始终通过 `get_session_auto_commit(repo_root)` 读取。不要编写自定义 YAML 读取器。

---

## CLI 模式扩展模式

### 设计决策：`--mode` 用于上下文依赖输出

当脚本需要为不同用例提供不同输出时，使用 `--mode`（而不是单独的脚本或额外的标志）。

**示例**：`get_context.py` 提供两种模式：
- `--mode default` — 完整会话运行时（DEVELOPER、GIT STATUS、RECENT COMMITS、CURRENT TASK、ACTIVE TASKS、MY TASKS、JOURNAL、PATHS）
- `--mode record` — 聚焦输出用于 record-session（MY ACTIVE TASKS 优先，GIT STATUS、RECENT COMMITS、CURRENT TASK）

### 会话上下文 Git 契约

`common/session_context.py` 在渲染根 Git 状态之前必须使用 `git rev-parse --is-inside-work-tree` 探测 Trellis 根。当根是 Git 工作树时，渲染正常分支/状态/日志。当根不是 Git 工作树时，上下文不得渲染合成的根值，如 `Branch: unknown`、`Working directory: Clean`。它必须渲染显式非 Git 根提示。

---

## 解析结构化命令输出

### 关键：保留语义空白

许多 CLI 工具在前导/尾随空白字符中编码状态信息。**绝不在解析前盲目 `.strip()`。**

**示例 — `git submodule status` 输出格式**：

```
 abc1234 path/to/submodule (v1.0)     ← 空格前缀 = 已初始化
-def5678 path/to/other (v2.0)         ← 减号前缀 = 未初始化
+ghi9012 path/to/modified (v3.0)      ← 加号前缀 = 已修改（不同步）
```

```python
# BAD — .strip() 移除表示「已初始化」的前导空格
status_line = status_out.strip()
prefix = status_line[0]  # 读取提交哈希字符，而不是状态前缀！

# GOOD — 解析原始行，然后剥离单个字段
raw_line = status_out.rstrip("\n")  # 仅移除尾随换行符
if not raw_line:
    continue
prefix = raw_line[0]               # ' '、'-' 或 '+'
rest = raw_line[1:].strip()        # 现在可以安全 strip 其余部分
commit_hash = rest.split()[0]
```

---

## 配置辅助函数

`.trellis/config.yaml` 中的所有键必须通过 `common/config.py` 读取（或其 hook 侧镜像 `common/trellis_config.py`，用于不能导入完整任务辅助函数的 hooks）。两个模块共享相同的解析器链：

```
_load_config(repo_root)
  -> parse_simple_yaml(content)
    -> _strip_inline_comment(value)
    -> _unquote(value)
```

### 反模式：绕过 `_strip_inline_comment` 的自定义 YAML 读取器

症状：像 `key: value  # comment` 这样的值解析为 `value  # comment` 或 `value` 加上垃圾，取决于读取器的 `.split("#")` / `.strip()` 策略。不使用内联注释形式的测试通过；带有 `templates/trellis/config.yaml` 中 `# explanation` 注解的实时配置静默失败。

### 模式：`_load_config` 之上的类型化访问器

```python
# common/config.py
DEFAULT_SESSION_AUTO_COMMIT = False

def get_session_auto_commit(repo_root: Path | None = None) -> bool:
    config = _load_config(repo_root)
    raw = config.get("session_auto_commit", DEFAULT_SESSION_AUTO_COMMIT)
    if isinstance(raw, bool):
        return raw
    s = str(raw).strip().lower()
    if s in ("true", "yes", "1", "on"):
        return True
    if s in ("false", "no", "0", "off"):
        return False
    print(
        f"[WARN] invalid session_auto_commit value: {raw!r}; using false (default)",
        file=sys.stderr,
    )
    return DEFAULT_SESSION_AUTO_COMMIT
```

每个新键获得自己的 `get_<key>` 访问器。访问器拥有：默认常量、类型强制和无效值上带 stderr 警告的回退。

### 模式：布尔宽容

布尔访问器必须接受原生 YAML `true` / `false` 加上大小写不敏感的字符串别名 `true / false / yes / no / 1 / 0 / on / off`。任何其他回退到默认值，带 stderr 警告。

### 模式：测试 fixtures 必须包含内联注释形式

任何配置访问器的测试 fixtures 必须至少包含一行 `key: value  # comment` 形式。这是静默破坏自定义读取器的形式。没有此 fixture，`_strip_inline_comment` 中的回归未被检测到。

---

## Monorepo 配置 API（`common/config.py`）

### 配置函数

| 函数 | 返回 | 用途 |
|----------|--------|---------|
| `is_monorepo(repo_root)` | `bool` | config.yaml 中是否存在 `packages:` |
| `get_packages(repo_root)` | `dict[str, dict] \| None` | config.yaml 中的所有包 |
| `get_default_package(repo_root)` | `str \| None` | config.yaml 中的 `default_package` |
| `get_submodule_packages(repo_root)` | `dict[str, str]` | 带有 `type: submodule` 的包 |
| `get_spec_base(package, repo_root)` | `str` | `"spec"`（单仓库）或 `"spec/<package>"`（monorepo） |
| `validate_package(package, repo_root)` | `bool` | 包是否在配置中存在 |
| `resolve_package(task_pkg, repo_root)` | `str \| None` | 解析包：任务 → 默认 → None |
| `get_spec_scope(repo_root)` | `str \| list \| None` | `session.spec_scope` 配置值 |
| `get_hooks(event, repo_root)` | `list[str]` | 生命周期事件的 hook 命令 |

### Config.yaml Schema

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli

session:
  spec_scope: active_task

update:
  skip:
    - .claude/commands/trellis/my-custom.md

hooks:
  after_create:
    - "python3 .trellis/scripts/hooks/my_hook.py create"
```

### 任务 → 包绑定契约

**规则**：任务上的 `package` 字段在**任务创建时绑定并冻结到 `task.json.package`**。下游脚本读取该字段；它们不重新从路径、cwd 或运行时上下文解析包。

**`task create` 时的解析顺序**（`common/task_store.py:cmd_create`）：

| 优先级 | 来源 | 无效值时的行为 |
|---|---|---|
| 1 | CLI `--package <pkg>`（显式） | **Fail-fast**：打印可用包，exit 1 |
| 2 | `default_package`（config.yaml） | 警告到 stderr，回退到 `None` |
| 3 | `None` | 任务存储为 `package: null`（允许；spec 范围回退到全扫描） |

单仓库模式（`packages:` 在 config 中缺失）：`--package` 触发 stderr 警告并静默忽略；存储的 `package` 始终为 `None`。

**读取时的解析顺序**（任何读取现有任务的脚本）：

| 优先级 | 来源 |
|---|---|
| 1 | `task.json.package`（冻结的绑定） |
| 2 | `resolve_package(task_package=..., repo_root=...)` — 如果 `task.json.package` 缺失/无效则回退到 `default_package` |

---

## 错误处理

### 退出代码

| 代码 | 含义 |
|------|---------|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 使用错误（错误参数） |

### 错误消息

打印错误到 stderr 并带上下文：

```python
import sys

def error(msg: str) -> None:
    """打印错误消息到 stderr。"""
    print(f"Error: {msg}", file=sys.stderr)

if not repo_root:
    error("Not in a Trellis project (no .trellis directory found)")
    sys.exit(1)
```

---

## 参数解析

使用 `argparse` 实现一致的 CLI 接口：

```python
import argparse

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Task management",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 task.py create "Add login" --slug add-login
  python3 task.py list --mine --status in_progress
"""
    )

    subparsers = parser.add_subparsers(dest="command", required=True)

    create_parser = subparsers.add_parser("create", help="Create new task")
    create_parser.add_argument("title", help="Task title")
    create_parser.add_argument("--slug", help="URL-friendly name")

    list_parser = subparsers.add_parser("list", help="List tasks")
    list_parser.add_argument("--mine", "-m", action="store_true")
    list_parser.add_argument("--status", "-s", choices=["planning", "in_progress", "review", "completed"])

    args = parser.parse_args()

    if args.command == "create":
        return cmd_create(args)
    elif args.command == "list":
        return cmd_list(args)

    return 0
```

---

## 导入约定

### 包内相对导入

```python
# 在 task.py（根级别）中
from common.paths import get_repo_root, DIR_WORKFLOW
from common.developer import get_developer

# 在 common/developer.py 中
from .paths import get_repo_root, DIR_WORKFLOW
```

### 标准库导入

分组和排序导入：

```python
# 1. Future 导入
from __future__ import annotations

# 2. 标准库
import argparse
import json
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path

# 3. 本地导入
from common.paths import get_repo_root
from common.developer import get_developer
```

---

## 模块拆分模式

当脚本增长过大（300+ 行逻辑）时，将其拆分为聚焦模块。这些模式在 v0.4.0 重构 `task.py`（1375→456 行）、`git_context.py`（724→80 行）和 `status.py`（783→79 行）期间建立。

### 模式：入口 Shim

保持原始文件名作为从新模块导入的薄分发器。这保留了所有外部引用（`.md` 模板、进行 `from task import cmd_create` 的其他脚本）。

### 模式：循环依赖的惰性导入

当两个拆分模块需要彼此（A 从 B 导入，B 从 A 导入）时，在函数体内使用惰性导入。

### 模式：内部辅助函数以避免冗余文件读取

当多个公共函数读取相同文件并相互调用时，提取在预加载 `data: dict` 上操作的私有辅助函数。

---

## DO / DON'T

### DO

- 对所有路径操作使用 `pathlib.Path`
- 使用类型提示（Python 3.10+ 语法）
- 从 `main()` 返回退出代码
- 打印错误到 stderr
- 保持面向用户的 Python 命令平台感知
- 对所有文件操作使用 `encoding="utf-8"`

### DON'T

- 不要使用字符串路径拼接
- 当 `pathlib` 工作时不要使用 `os.path`
- 不要依赖 shebang 进行调用文档
- 不要对错误使用 `print()`（使用 stderr）
- 不要硬编码路径 - 使用 `common/paths.py` 中的常量
- 不要使用外部依赖（仅 stdlib）

---

## 迁移说明

> **历史背景**：脚本在 v0.3.0 中从 Bash 迁移到 Python 以实现跨平台兼容性。在 v0.5.0 中，`multi_agent/` 管道目录（`plan.py`、`start.py`、`status.py` 等）以及 `common/` 中的 `phase.py`、`registry.py` 和 `worktree.py` 被移除。`_bootstrap.py` shim 不再需要。