---
name: python-design
description: "Python design patterns for CLI scripts and utilities — type-first development, deep modules, complexity management, and red flags. Use when reading, writing, reviewing, or refactoring Python files, especially in .trellis/scripts/ or any CLI/scripting context. Also activate when planning module structure, deciding where to put new code, or doing code review."
---

# CLI 脚本的 Python 设计

编写可维护 Python CLI 工具和实用程序的设计模式和原则。
基于 *A Philosophy of Software Design*（Ousterhout），并根据脚本上下文进行了适配。

## 何时激活

- 编写或修改 Python 文件
- 规划模块分解
- 代码审查 Python 变更
- 重构感觉"混乱"的脚本
- 添加新的子命令或工具函数

## 核心论点

**核心挑战是管理复杂性，而非添加功能。**

复杂性是任何让代码难以理解或修改的东西。它有三个症状：

1. **变更放大** — 一个小改动需要在很多地方进行编辑
2. **认知负荷** — 做安全修改必须在脑中持有太多上下文
3. **未知的未知** — 你不知道自己不知道什么（最危险的一种）

复杂性是渐进积累的。它通过数百个小决策累积而来，而非一个灾难性错误。因此：**关注小事**。

---

## 原则 1：深层模块

模块的价值是隐藏的功能量 vs 暴露的接口量的比率。

```
深层模块（好）：              浅层模块（坏）：
┌──────────┐                 ┌──────────────────────────┐
│ 简洁的   │                 │ 复杂的接口               │
│ 接口     │                 │ 很多参数、很多方法        │
├──────────┤                 ├──────────────────────────┤
│          │                 │                          │
│  丰富的  │                 │  薄弱的实现              │
│  实现    │                 │                          │
│          │                 └──────────────────────────┘
│          │
└──────────┘
```

**实用检验**：如果调用者必须理解模块内部如何工作才能正确使用它，该模块就太浅了。

### 示例：任务数据访问

```python
# 浅层 — 调用者必须知道 JSON 结构、文件路径、错误处理
def _read_json_file(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)

# 每个调用者独立执行这些操作：
task_path = tasks_dir / name / "task.json"
data = _read_json_file(task_path)
title = data.get("title") or data.get("name", "")
status = data.get("status", "planning")
assignee = data.get("assignee", "")
```

```python
# 深层 — 调用者获得所需，模块隐藏 JSON/路径/解析
@dataclass(frozen=True)
class TaskInfo:
    name: str
    title: str
    status: str
    assignee: str
    priority: str
    directory: Path

def load_task(tasks_dir: Path, name: str) -> TaskInfo | None:
    """按目录名加载任务。未找到时返回 None。"""
    ...

def list_active_tasks(tasks_dir: Path) -> list[TaskInfo]:
    """列出所有未归档任务，按优先级排序。"""
    ...
```

深层版本吸收了复杂性：JSON 解析、字段默认值、目录扫描、归档过滤。调用者只需处理类型化数据。

---

## 原则 2：类型优先开发

类型在实现之前定义契约。此工作流能早期发现设计问题：

1. **定义数据形状** — 先定义 dataclass 或 TypedDict
2. **定义函数签名** — 参数和返回类型
3. **按类型约束实现** — 让类型检查器指导完整性
4. **在边界处验证** — 运行时检查仅在数据进入系统的地方进行

### 内部数据的 Frozen Dataclass

```python
from dataclasses import dataclass
from typing import Literal

@dataclass(frozen=True)
class AgentRecord:
    agent_id: str
    task_name: str
    worktree_path: Path
    platform: Literal["Codex", "codex", "cursor"]
    status: Literal["running", "done", "failed"]
    branch: str
```

Frozen dataclass 是不可变的——不会意外修改，可安全传递。

### 外部 JSON 形状的 TypedDict

当数据来自文件（task.json、config.yaml、registry.json）时，使用 TypedDict 记录预期形状：

```python
from typing import TypedDict, Required, NotRequired

class TaskData(TypedDict):
    title: Required[str]
    status: Required[str]
    assignee: NotRequired[str]
    priority: NotRequired[str]
    parent: NotRequired[str]
    children: NotRequired[list[str]]
```

这消除了分散的 `.get("field", default)` 调用——形状被一次文档化。

### 领域原语的 NewType

当两个字符串表示不同的含义时，让类型系统强制执行：

```python
from typing import NewType

TaskName = NewType("TaskName", str)    # 目录名，如 "03-10-v040"
BranchName = NewType("BranchName", str)  # git 分支，如 "feat/v0.4.0"

def create_branch(task: TaskName) -> BranchName:
    return BranchName(f"task/{task}")
```

### 状态的区分联合类型

当实体可以处于不同状态且具有不同数据时：

```python
@dataclass(frozen=True)
class Pending:
    status: Literal["pending"] = "pending"

@dataclass(frozen=True)
class Running:
    status: Literal["running"] = "running"
    pid: int
    worktree: Path

@dataclass(frozen=True)
class Completed:
    status: Literal["completed"] = "completed"
    branch: str
    commit: str

AgentState = Pending | Running | Completed

def handle(state: AgentState) -> None:
    match state:
        case Running(pid=pid, worktree=wt):
            check_process(pid)
        case Completed(branch=br):
            create_pr(br)
        case Pending():
            pass
```

类型检查器确保每个状态都被处理。不再有 `if data.get("status") == "running"` 那种遗漏分支的情况。

---

## 原则 3：信息隐藏

每个模块应封装设计决策。当相同的知识出现在多个模块中时，信息已泄漏。

### 脚本中常见的泄漏模式

**JSON schema 知识散布在各处：**
```python
# 不好 — 9 个文件都知道如何遍历任务并解析 task.json
for d in sorted(tasks_dir.iterdir()):
    if d.name == "archive" or not d.is_dir():
        continue
    task_json = d / "task.json"
    if task_json.exists():
        data = json.loads(task_json.read_text())
        title = data.get("title") or data.get("name", "")
        ...
```

```python
# 好 — 一个模块拥有任务遍历逻辑
# common/tasks.py
def iter_active_tasks(tasks_dir: Path) -> Iterator[TaskInfo]:
    """产出所有活动（未归档）任务。"""
    for d in sorted(tasks_dir.iterdir()):
        if d.name == "archive" or not d.is_dir():
            continue
        info = _load_task_json(d)
        if info:
            yield info
```

**文件格式细节泄漏到各层：**
```python
# 不好 — 调用者知道它是 JSON，知道路径约定
registry_path = trellis_dir / "registry.json"
data = json.loads(registry_path.read_text())
data["agents"][agent_id] = {...}
registry_path.write_text(json.dumps(data, indent=2))

# 好 — 模块隐藏存储格式
registry = AgentRegistry(trellis_dir)
registry.add(agent_id, task=task_name, platform="Codex")
```

---

## 原则 4：将复杂性向下推

当复杂性不可避免时，模块应在内部吸收它，而非将其推给调用者。模块有少数开发者但有很多用户——模块作者处理一次复杂性，好过每个调用者独立处理它。

```python
# 不好 — 将复杂性推给每个调用者
def run_git(args: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(["git"] + args, capture_output=True, text=True)

# 每个调用者必须：检查 returncode，解码 stderr，处理编码，
# 去除空白，处理仓库未找到，等等。

# 好 — 吸收复杂性
def run_git(args: list[str], *, cwd: Path | None = None) -> str:
    """运行 git 命令，返回 stdout。失败时引发 GitError。"""
    result = subprocess.run(
        ["git"] + args,
        capture_output=True, text=True, encoding="utf-8",
        errors="replace", cwd=cwd,
    )
    if result.returncode != 0:
        raise GitError(args[0], result.stderr.strip())
    return result.stdout.strip()
```

### 向上推复杂性的反模式

- 返回原始 `subprocess.CompletedProcess` 并让调用者检查 `.returncode`
- 引发通用异常，调用者必须解析
- 使用配置参数来避免做决策
- 当类型化对象能让调用者跳过验证时，返回 `dict`

---

## 原则 5：将错误定义出存在

异常处理是复杂性的主要来源。最佳策略是设计语义，使错误条件根本不是错误。

```python
# 不好 — key 不存在时引发异常
def remove_agent(registry: dict, agent_id: str) -> None:
    if agent_id not in registry["agents"]:
        raise KeyError(f"Agent {agent_id} 未找到")
    del registry["agents"][agent_id]

# 好 — 保证后置条件：agent 不在 registry 中
def remove_agent(registry: dict, agent_id: str) -> None:
    """确保此调用后 agent_id 不在 registry 中。"""
    registry["agents"].pop(agent_id, None)
```

```python
# 不好 — 目录已存在时引发异常
def init_workspace(path: Path) -> None:
    if path.exists():
        raise FileExistsError(f"{path} 已存在")
    path.mkdir()

# 好 — 保证后置条件：目录存在
def ensure_workspace(path: Path) -> Path:
    """确保工作区目录存在。返回路径。"""
    path.mkdir(parents=True, exist_ok=True)
    return path
```

关键洞察：按其**后置条件**（"此次调用后，X 为真"）而非前置条件（"调用前 X 必须为真"）来定义操作。

---

## 原则 6：KISS 和三次法则

### KISS — 保持简单

选择有效的最简单方案。复杂性必须由具体（而非假设的）需求来证明其合理性。

```python
# 过度设计 — 为 3 个格式化器使用 registry 模式
class FormatterRegistry:
    _registry: dict[str, type] = {}
    @classmethod
    def register(cls, name: str): ...
    @classmethod
    def create(cls, name: str): ...

# 简单 — 就一个字典
FORMATTERS = {"json": format_json, "text": format_text, "table": format_table}

def format_output(fmt: str, data: Any) -> str:
    formatter = FORMATTERS.get(fmt)
    if not formatter:
        raise ValueError(f"未知格式: {fmt}")
    return formatter(data)
```

### 三次法则

在提取抽象之前，等到有**三个**模式实例。两个是巧合；三个才是模式。过早抽象比重复更糟糕，因为：

- 它通过共享抽象将不相关的代码耦合在一起
- 它使每个实例更难独立理解
- 它产生将未来案例塞入抽象的压力，即使它们不适合

**但是**：当确实达到三个时，立即提取。不要让它达到九个。

---

## 原则 7：单一职责和模块边界

每个模块应该有**一个变更的理由**。当模块增长到超过约 300 行时，检查它是否有多重职责。

### 分解信号

在以下情况下拆分：
- 文件有多个由注释标题分隔的"部分"
- 你只需要从一个大型模块中导入一个函数
- 模块不同部分的测试没有共享的 setup
- 对某一职责的变更不需要理解另一职责

### 如何拆分

按**信息隐藏**（封装了什么知识）拆分，而非按执行顺序（什么何时运行）。

```python
# 不好 — 按执行顺序拆分（时间分解）
# step1_parse_args.py, step2_validate.py, step3_execute.py
# 所有三个都必须知道命令结构

# 好 — 按职责拆分
# task_store.py    — 拥有 task.json 读/写、schema、遍历
# task_cli.py      — 拥有 argparse、子命令路由
# task_display.py  — 拥有格式化、颜色、表格输出
```

---

## 原则 8：一致的共享基础设施

当多个脚本需要相同的能力时，在 `common/` 中一次性提供。

| 能力 | 应放在 | 不应在 |
|-----------|---------------|--------|
| JSON 文件读/写 | `common/io.py` | 每个脚本的 `_read_json_file` |
| 终端颜色 + 日志 | `common/log.py` | 每个脚本的 `Colors` 类 |
| Git 命令执行 | `common/git.py` | 以 `_` 为前缀的私有 `_run_git_command` |
| 任务数据访问 | `common/tasks.py` | 即兴的 task.json 解析 |
| 路径常量 | `common/paths.py`（已有） | 硬编码字符串 |

**命名**：如果函数被其他模块使用，它是公共 API——不要用 `_` 前缀。

---

## 原则 9：结构化 CLI 输出解析

解析 shell 命令（git、grep 等）的输出时，尊重语义空白：

```python
# 不好 — .strip() 破坏了语义空白
# git submodule status 前缀：' ' = 已初始化，'-' = 未初始化，'+' = 已变更
line = output_line.strip()  # 丢失了前缀字符！

# 好 — 仅去除尾部换行
line = output_line.rstrip("\n\r")
prefix = line[0] if line else " "
```

当解析结构化命令输出时，始终记录每个字段位置的含义。

---

## 红旗信号快速参考

在代码审查和自我审查中使用：

| 信号 | 含义 |
|--------|--------------|
| **浅层模块** | 接口几乎和实现一样复杂 |
| **信息泄漏** | 相同的 JSON schema / 文件格式知识在多个模块中 |
| **重复工具** | 相同的辅助函数被复制到多个文件 |
| **上帝模块** | 文件 > 500 行，包含多个不相关的职责 |
| **透传函数** | 函数仅将参数转发给具有相似签名的另一个函数 |
| **魔法 `.get()` 链** | `data.get("x") or data.get("y", "")` — 缺少类型定义 |
| **sys.path 黑客** | `sys.path.insert(0, ...)` — 改为修复包结构 |
| **私有命名的公共 API** | `_function` 被 3+ 个外部模块导入 |
| **原始 Dict 传递** | 通过 4+ 个函数调用传递 `dict` — 使用 dataclass |
| **重复遍历** | 相同的目录扫描 / 文件解析模式在 3+ 处 |
| **宽泛异常捕获** | `except Exception:` 而不重新引发 — 隐藏 bug |
| **时间分解** | 模块按"什么何时运行"而非"什么知道什么"拆分 |

---

## 设计检查清单（编写代码前）

1. **类型优先**：在编写逻辑之前定义数据形状
2. **模块深度检查**：接口会比实现更简单吗？
3. **重复扫描**：在创建新的工具之前 `grep -r "pattern" .`
4. **职责检查**：这属于已有模块吗？
5. **错误设计**：你能将错误定义出存在吗？
6. **命名精确性**：名称能否在不阅读实现的情况下传达含义？

## 设计检查清单（代码审查期间）

1. **红旗信号扫描**：对照上表检查 diff
2. **类型安全**：新数据形状是否用类型记录？
3. **信息隐藏**：变更是否泄漏了实现细节？
4. **一致性**：是否遵循模块中已有的模式？
5. **深度**：通用路径对调用者是否简单？

---

## 战略性投资

将每次变更的约 **10-20%** 花在改进周围设计上。

能工作的代码是必要的但不充分的。软件开发的增量应该是**抽象**，而不仅仅是功能。每次变更应该让代码库比你发现它时稍微好一点。

这不是完美主义——它是复利。小的设计改进会累积成一个随时间推移显著更易于使用的系统。