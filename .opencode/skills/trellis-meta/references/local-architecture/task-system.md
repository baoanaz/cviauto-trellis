# 本地任务系统

Trellis 任务系统完全存储在用户项目的 `.trellis/tasks/` 下。每个任务是一个目录，包含需求、上下文、研究、状态和关系信息。

## 任务目录结构

```text
.trellis/tasks/
├── 04-28-example-task/
│   ├── task.json
│   ├── prd.md
│   ├── design.md
│   ├── implement.md
│   ├── implement.jsonl
│   ├── check.jsonl
│   └── research/
└── archive/
    └── 2026-04/
```

| 文件 | 用途 |
| --- | --- |
| `task.json` | 任务元数据：状态、负责人、优先级、分支、父子任务及类似字段。 |
| `prd.md` | 需求、约束和验收标准。轻量级任务可以只有 PRD。 |
| `design.md` | 复杂任务的技术设计：边界、契约、数据流、兼容性、权衡。 |
| `implement.md` | 复杂任务的执行计划：有序检查清单、验证命令、审查门禁、回滚点。 |
| `implement.jsonl` | implement Agent 必须首先阅读的 spec/research 文件列表。 |
| `check.jsonl` | check Agent 必须首先阅读的 spec/research 文件列表。 |
| `research/` | 研究产出物。复杂发现不应只存在于聊天中。 |

## `task.json`

`task.json` 记录任务状态和元数据。常见字段：

| 字段 | 含义 |
| --- | --- |
| `id` / `name` / `title` | 任务标识和标题。 |
| `status` | 状态，如 `planning`、`in_progress`、`review` 或 `completed`。 |
| `priority` | `P0`、`P1`、`P2`、`P3`。 |
| `creator` / `assignee` | 创建者和负责人。 |
| `package` | monorepo 中的目标包；可为空。 |
| `branch` / `base_branch` | 工作分支和 PR 目标分支。 |
| `children` / `parent` | 父子任务关系。 |
| `commit` / `pr_url` | 完成后的提交和 PR 信息。 |
| `meta` | 扩展字段。 |

## 父子任务树

父子任务关系用于工作结构。父任务将相关交付物分组到一个需求来源集下；它不是依赖调度器，也不替代子任务自己的规划文档。

当请求有多个可独立验证的交付物时使用父任务。父任务拥有：

- 来源需求和面向用户的范围。
- 子任务映射及其职责边界。
- 跨子任务验收标准和最终集成审查。

对于可以独立经历规划、实现、检查和归档的交付物使用子任务。如果一个子任务依赖另一个，将该依赖写入子任务的 `prd.md` / `implement.md`；不要依赖树的位置来暗示顺序。

创建新子任务：

```bash
python3 ./.trellis/scripts/task.py create "<子任务标题>" --slug <子任务-slug> --parent <父任务-目录>
```

链接或取消链接现有任务：

```bash
python3 ./.trellis/scripts/task.py add-subtask <父任务-目录> <子任务-目录>
python3 ./.trellis/scripts/task.py remove-subtask <父任务-目录> <子任务-目录>
```

父任务的 `children` 是历史列表。当子任务归档时，Trellis 保留该子任务名称在父任务中，以便在已完成的子任务移至 `archive/` 后 `[2/3 done]` 这样的进度仍然有意义。

AI 不应将阶段编号视为任务状态。任务进度主要由 `status`、文档存在情况（`prd.md`、可选的 `design.md` / `implement.md`）、JSONL 上下文是否为 sub-agent 模式配置以及 `workflow.md` 中的阶段描述决定。

## 活动任务

用户看到"当前任务"，但 Trellis 按会话存储活动任务状态。

```text
.trellis/.runtime/sessions/<context-key>.json
```

`task.py start` 将任务路径写入当前会话的运行时会话文件。`task.py current --source` 显示当前任务及其来源。不同的 AI 窗口可以指向不同的任务而不会互相覆盖。

如果平台或 shell 环境没有稳定的会话身份，`task.py start` 可能无法设置活动任务。AI 应阅读错误信息，检查平台 hook/会话环境，而非回退到共享全局指针。

## JSONL 上下文

`implement.jsonl` 和 `check.jsonl` 是供 sub-agent 首先阅读的上下文清单。它们不替代 `implement.md`；`implement.md` 是人类可读的执行计划。

格式：

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "后端约定"}
{"file": ".trellis/tasks/04-28-example/research/api.md", "reason": "API 研究"}
```

规则：

- 包含 spec 和研究文件。
- 不要包含即将被修改的代码文件。
- 不要将聊天中的临时结论作为唯一上下文。
- 种子行没有 `file` 字段；它们仅提示 AI 填入真实条目。

## 常用命令

```bash
python3 ./.trellis/scripts/task.py create "<标题>" --slug <slug>
python3 ./.trellis/scripts/task.py start <task>
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py add-context <task> implement <file> <reason>
python3 ./.trellis/scripts/task.py validate <task>
python3 ./.trellis/scripts/task.py finish
python3 ./.trellis/scripts/task.py archive <task>
```

修改任务系统时，AI 应优先使用脚本命令来维护结构。仅在脚本无法满足需求时才直接编辑 JSON/Markdown。

## 本地自定义点

| 需求 | 编辑位置 |
| --- | --- |
| 更改默认任务模板 | `.trellis/scripts/common/task_store.py` 和任务创建指令。 |
| 更改状态语义 | `.trellis/workflow.md`、workflow-state hook 逻辑和任务使用约定。 |
| 添加任务生命周期操作 | `.trellis/config.yaml` 中的 `hooks.after_*`。 |
| 更改上下文规则 | `.trellis/workflow.md` 中的规划文档指导和相关平台 agent/hook 指令。 |
| 更改归档策略 | `.trellis/scripts/common/task_store.py` / `task_utils.py`。 |

这些是用户项目中的本地文件。除非用户想向上游贡献，否则不要默认编辑 Trellis CLI 源码。