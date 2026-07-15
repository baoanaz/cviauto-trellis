# 开发工作流（Development Workflow）

---

## 核心原则（Core Principles）

1. **先计划后编码**——在开始之前弄清楚要做什么
2. **Spec 被注入，而非记忆**——指南通过 hook/skill 注入，而非从记忆中回忆
3. **持久化一切**——研究、决策和教训全部写入文件；对话可以被压缩，文件不会
4. **增量开发**——一次一个任务
5. **人为门控的学习沉淀**——只有当用户明确要求将新知识回写到 spec 时才执行

---

## Cviauto 系统（Cviauto System）

### 开发者身份（Developer Identity）

首次使用时，初始化你的身份：

```bash
python3 ./.cviauto/scripts/init_developer.py <your-name>
```

创建 `.cviauto/.developer`（已 gitignore）+ `.cviauto/workspace/<your-name>/`。

### Spec 系统（Spec System）

`.cviauto/spec/` 按包和层组织存放编码指南。

- `.cviauto/spec/<package>/<layer>/index.md`——入口点，包含**开发前检查清单（Pre-Development Checklist）**+**质量检查（Quality Check）**。实际指南位于其指向的 `.md` 文件中。
- `.cviauto/spec/guides/index.md`——跨包思维指南。

```bash
python3 ./.cviauto/scripts/get_context.py --mode packages   # 列出包 / 层
```

**何时更新 spec**：仅当用户明确要求将一个可复用的规则、模式、bug 修复预防经验或技术决策回写到 `.cviauto/spec/` 时才执行。

### 任务系统（Task System）

每个任务在 `.cviauto/tasks/{MM-DD-name}/` 下拥有自己的目录，包含 `task.json`、`prd.md`、可选的 `design.md`、可选的 `implement.md`、可选的 `research/`，以及面向支持子 agent 的平台的上下文清单（`implement.jsonl`、`check.jsonl`）。

```bash
# 任务生命周期
python3 ./.cviauto/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.cviauto/scripts/task.py start <name>          # 设置活跃任务（可用时作用于会话范围）
python3 ./.cviauto/scripts/task.py current --source      # 显示活跃任务及其来源
python3 ./.cviauto/scripts/task.py finish                # 清除活跃任务（触发 after_finish hooks）
python3 ./.cviauto/scripts/task.py archive <name>        # 移至 archive/{year-month}/
python3 ./.cviauto/scripts/task.py list [--mine] [--status <s>]
python3 ./.cviauto/scripts/task.py list-archive

# 代码-spec 上下文（通过 JSONL 注入到 implement/check agent 中）。
# `implement.jsonl` / `check.jsonl` 在 `task create` 时为支持子 agent 的平台
# 进行种子化；AI 在规划期间按需整理真实的 spec + research 条目。
python3 ./.cviauto/scripts/task.py add-context <name> <action> <file> <reason>
python3 ./.cviauto/scripts/task.py list-context <name> [action]
python3 ./.cviauto/scripts/task.py validate <name>

# 任务元数据
python3 ./.cviauto/scripts/task.py set-branch <name> <branch>
python3 ./.cviauto/scripts/task.py set-base-branch <name> <branch>    # PR 目标
python3 ./.cviauto/scripts/task.py set-scope <name> <scope>

# 层级（父/子）
python3 ./.cviauto/scripts/task.py add-subtask <parent> <child>
python3 ./.cviauto/scripts/task.py remove-subtask <parent> <child>

# PR 创建
python3 ./.cviauto/scripts/task.py create-pr [name] [--dry-run]
```

> 运行 `python3 ./.cviauto/scripts/task.py --help` 查看权威的、最新的列表。

**当前任务机制**：`task.py create` 创建任务目录，并在会话身份可用时自动设置每会话的活跃任务指针，使规划面包屑（breadcrumb）立即生效。`task.py start` 写入相同的指针（如果已设置则幂等），并将 `task.json.status` 从 `planning` 翻转为 `in_progress`。状态存储在 `.cviauto/.runtime/sessions/` 下。如果没有来自 hook 输入、`TRELLIS_CONTEXT_ID` 或平台原生会话环境变量的 context key，则没有活跃任务，此时 `task.py start` 会失败并给出会话身份提示。`task.py finish` 删除当前会话文件（状态不变）。`task.py archive <task>` 写入 `status=completed`，将目录移至 `archive/`，并删除仍指向该归档任务的运行时会话文件。

### 工作区系统（Workspace System）

在 `.cviauto/workspace/<developer>/` 下记录每个 AI 会话，用于跨会话跟踪。

- `journal-N.md`——会话日志。**每个文件最多 2000 行**；超出后自动创建 `journal-(N+1).md`。
- `index.md`——个人索引（总会话数、最后活跃时间）。

```bash
python3 ./.cviauto/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### 上下文脚本（Context Script）

```bash
python3 ./.cviauto/scripts/get_context.py                            # 完整会话运行时上下文
python3 ./.cviauto/scripts/get_context.py --mode packages            # 可用包 + spec 层
python3 ./.cviauto/scripts/get_context.py --mode phase --step <X.Y>  # 工作流步骤的详细指南
```

---

<!--
  WORKFLOW-STATE BREADCRUMB CONTRACT（在编辑下面的标记块之前阅读此注释）

  嵌入在下方 ## Phase Index 章节中的 [workflow-state:STATUS] 块是每个
  支持 AI 平台的 UserPromptSubmit hook 读取的每轮 `<workflow-state>`
  面包屑的**唯一**真实来源。inject-workflow-state.py（Python 平台）和
  inject-workflow-state.js（OpenCode 插件）仅解析它们——在 v0.5.0-rc.0
  之后，脚本中没有硬编码的回退字典。

  STATUS 字符集：[A-Za-z0-9_-]+。当 hook 找不到标记时，会降级为通用的
  "Refer to workflow.md for current step."行——刻意使其可见，以便用户注意
  并修复损坏的 workflow.md。

  约束条件（test/regression.test.ts）：
    每个标记为 `[required · once]` 的工作流演练步骤必须在其阶段的
    [workflow-state:*] 块中有匹配的执行提示行。面包屑是唯一的每轮通道；
    如果一个强制性步骤在那里没有被提及，AI 将静默地跳过它（Phase 1 规划门禁跳过
    和 Phase 3.4 提交跳过均由此类缺口导致）。

  标记 ↔ 阶段范围：
    [workflow-state:no_task]      → 没有活跃任务；Phase 1 之前
    [workflow-state:planning]     → 整个 Phase 1（status='planning'）
    [workflow-state:planning-inline] → Codex inline 变体，Phase 1
    [workflow-state:in_progress]  → Phase 2 + Phase 3.2-3.4
                                    （status 保持 'in_progress'，从
                                    task.py start 直到 task.py archive）
    [workflow-state:in_progress-inline] → Codex inline 变体，Phase 2/3
    [workflow-state:completed]    → 当前为 DEAD：cmd_archive 在同一个
                                    调用中翻转 status 并移动目录，因此
                                    解析器丢失了指针（保留此块用于未来的
                                    显式 in_progress→completed 转换）

  编辑检查清单：
    - 当你更改 [workflow-state:STATUS] 块时，还要检查匹配阶段中
      `[required · once]` 演练步骤的同步情况
    - 编辑后运行 `cviauto update` 将新的正文推送到下游用户项目
      （块级托管替换）
    - 完整运行时契约请参见：
      .cviauto/spec/cli/backend/workflow-state-contract.md
-->

## 阶段索引（Phase Index）

```
Phase 1: Plan    → 分类、获取任务创建同意、然后编写规划产物
Phase 2: Execute → 仅在任务状态为 in_progress 后才实施
Phase 3: Finish  → 验证、可选地更新 spec、提交并收尾
```

### 请求分类（Request Triage）

- 简单对话或小任务：仅询问本轮是否应创建 Cviauto 任务。如果用户说不需要，则在本会话中跳过 Cviauto。
- 复杂任务：询问用户是否可以创建 Cviauto 任务并进入规划阶段。如果用户说不需要，不要进行大范围的行内实现；解释、明确范围或建议拆分为更小的任务。
- 用户同意创建任务不等于同意开始实现。规划仍然先进行。

### 规划产物（Planning Artifacts）

- `prd.md`——需求、约束条件和验收标准。不要将技术设计或执行检查清单放在这里。
- `design.md`——复杂任务的技术设计：边界、契约、数据流、权衡、兼容性、上线/回滚形态。
- `implement.md`——复杂任务的执行计划：有序检查清单、验证命令、审查门禁和回滚点。
- `implement.jsonl` / `check.jsonl`——子 agent 上下文的 spec 和研究清单。它们不替代 `implement.md`。
- 轻量任务可以仅 PRD。复杂任务在 `task.py start` 之前必须有 `prd.md`、`design.md` 和 `implement.md`。

### 父/子任务树（Parent / Child Task Trees）

当一个用户请求包含多个可独立验证的交付物时使用父任务。父任务拥有源需求集、任务映射、跨子任务的验收标准和最终集成审查；除非它本身也有直接工作，否则通常不应是实现的目标。

将可独立规划、实现、检查和归档的交付物作为子任务。父/子结构不是依赖系统：如果一个子任务必须等待另一个子任务完成，将该顺序写在子任务的 `prd.md` / `implement.md` 中，并保持每个子任务的验收标准可独立测试。

使用 `task.py create "<title>" --slug <name> --parent <parent-dir>` 创建新的子任务。使用 `task.py add-subtask <parent> <child>` 链接现有任务，使用 `task.py remove-subtask <parent> <child>` 解除错误链接。

<!-- 每轮面包屑：当没有活跃任务时显示（Phase 1 之前）-->

[workflow-state:no_task]
没有活跃任务。首先对当前轮次进行分类，在创建任何 Cviauto 任务之前请求任务创建同意。
简单对话 / 小任务：仅询问本轮是否应创建 Cviauto 任务。如果用户说不需要，则在本会话中跳过 Cviauto。
复杂任务：询问用户是否可以创建 Cviauto 任务并进入规划阶段。如果用户说不需要，解释、明确范围或建议拆分为更小的任务。
[/workflow-state:no_task]

### Phase 1: Plan
- 1.0 创建任务 `[required · once]`（仅在获得任务创建同意之后）
- 1.1 需求探索 `[required · repeatable]`（`prd.md`；复杂任务还需要 `design.md` + `implement.md`）
- 1.2 调研 `[optional · repeatable]`
- 1.3 配置上下文 `[required · once]`——Claude Code、OpenCode、Codex（仅子 agent 分派模式；inline 模式跳过）
- 1.4 激活任务 `[required · once]`（审查门禁，然后 `task.py start`；status → in_progress）
- 1.5 完成标准

<!-- 每轮面包屑：贯穿整个 Phase 1（status='planning'）-->

[workflow-state:planning]
加载 `cviauto-brainstorm`；保持在规划阶段。
轻量级别：`prd.md` 可能足够。复杂级别：完成 `prd.md`、`design.md` 和 `implement.md`；在 `task.py start` 之前请求审查。
多交付物范围：考虑父任务加上可独立验证的子任务；依赖必须写在子产物的文档中，不能由目录树位置暗示。
子 agent 模式：在 start 之前将 `implement.jsonl` 和 `check.jsonl` 整理为 spec/research 清单。
[/workflow-state:planning]

<!-- 每轮面包屑：当 codex.dispatch_mode=inline 时贯穿整个 Phase 1。
     仅 Codex 的可选替代方案，对应 [workflow-state:planning]。主 agent
     在 Phase 2 直接编辑代码，因此跳过 jsonl 整理——
     inline 工作流加载 `cviauto-before-dev` 而非将 JSONL 注入
     子 agent。-->

[workflow-state:planning-inline]
加载 `cviauto-brainstorm`；保持在规划阶段。
轻量级别：`prd.md` 可能足够。复杂级别：完成 `prd.md`、`design.md` 和 `implement.md`；在 `task.py start` 之前请求审查。
多交付物范围：考虑父任务加上可独立验证的子任务；依赖必须写在子产物的文档中，不能由目录树位置暗示。
Inline 模式：跳过 jsonl 整理；Phase 2 通过 `cviauto-before-dev` 读取产物/spec。
[/workflow-state:planning-inline]

### Phase 2: Execute
- 2.1 实施 `[required · repeatable]`
- 2.2 质量检查 `[required · repeatable]`
- 2.3 回滚 `[on demand]`

<!-- 每轮面包屑：当 status='in_progress' 时显示。
     范围：全部 Phase 2 + Phase 3.2-3.4（status 保持 'in_progress'，
     从 task.py start 直到 task.py archive；只有 archive 会翻转它）。
     因此正文必须覆盖从实现到提交的每个必需步骤，包括可选的
     Phase 3.3 spec 回写和必需的 Phase 3.4 提交。-->

子 agent 分派协议适用于所有分派子 agent 的平台和所有子 agent，包括 Codex 子 agent 模式和 `cviauto-research`：每个分派 prompt 以 `Active task: <task path from task.py current>` 开头，然后是角色特定的指令。实现分派使用 `cviauto-implement` 和 `implement.jsonl` 上下文。

[workflow-state:in_progress]
工具说明：`cviauto-implement` / `cviauto-research` 仅为子 agent 类型（Task/Agent 工具，而非 Skill；不存在同名的 skill）。`cviauto-update-spec` 是一个 skill。`cviauto-check` 两者都存在；在代码变更后验证时优先使用 Agent 形式。
流程：`cviauto-implement` -> `cviauto-check` -> 提交（Phase 3.4）-> `/cviauto:finish-work`。仅当用户明确要求将经验教训回写到 spec 时才运行 `cviauto-update-spec`。
主会话默认：分派 implement/check 子 agent。子 agent 自我豁免：如果已经作为 `cviauto-implement` 运行，不要再生成另一个 `cviauto-implement` 或 `cviauto-check`；如果已经作为 `cviauto-check` 运行，不要再生成另一个 `cviauto-check` 或 `cviauto-implement`。分派仅在主会话中进行。
分派 prompt 以 `Active task: <task path from task.py current>` 开头。读取上下文：jsonl 条目 -> `prd.md` -> `design.md if present` -> `implement.md if present`。
[/workflow-state:in_progress]

<!-- 每轮面包屑：当 status='in_progress' 且 codex.dispatch_mode=inline 时显示。
     仅 Codex 的可选替代方案，对应 [workflow-state:in_progress]。主会话
     直接编辑代码而非分派子 agent。-->

[workflow-state:in_progress-inline]
流程：`cviauto-before-dev` -> 编辑 -> `cviauto-check` -> 验证 -> 提交（Phase 3.4）-> `/cviauto:finish-work`。仅当用户明确要求将经验教训回写到 spec 时才运行 `cviauto-update-spec`。
在 inline 模式下不要分派 implement/check 子 agent。
读取上下文：`prd.md` -> `design.md if present` -> `implement.md if present`，加上 skill 加载的相关 spec/research。
[/workflow-state:in_progress-inline]

### Phase 3: Finish
- 3.2 调试回顾 `[on demand]`
- 3.3 Spec 更新 `[on demand]`
- 3.4 提交变更 `[required · once]`
- 3.5 收尾提醒

> 注意：步骤 3.1 已合并到 2.2（最后一次迭代的全范围检查）和 3.4（提交前言）。编号保持稳定以避免破坏外部引用。

<!-- 每轮面包屑：当 status='completed' 时显示。
     目前在正常流程中为 DEAD：cmd_archive 在将任务目录移至 archive/ 的
     同一调用中写入 status='completed'，因此活跃任务解析器丢失了指针，
     hook 永远不会在已归档任务上触发。保留此块用于未来的状态转换重新设计
     （例如，显式的 in_progress→completed 命令）。通过相同的 spec
     渠道与活跃块一起编辑。-->

[workflow-state:completed]
代码已提交。运行 `/cviauto:finish-work`；如果有未提交内容，先返回 Phase 3.4。
[/workflow-state:completed]

### 规则（Rules）

1. 识别你所在的阶段，然后从该阶段的下一步继续
2. 在每个阶段内按顺序运行步骤；`[required]` 步骤不能被跳过
3. 阶段可以回滚（例如，Execute 发现 prd 缺陷 → 返回 Plan 修复，然后重新进入 Execute）
4. 标记为 `[once]` 的步骤如果输出已存在则跳过；不要重新运行
5. 产物存在性指导下一步；缺失 `design.md` / `implement.md` 对轻量任务是有效的，对复杂任务则是不完整的规划。

### 活跃任务路由（Active Task Routing）

当用户请求在活跃任务中匹配以下意图时，先路由，然后在需要时加载详细的阶段步骤。

[Claude Code, OpenCode, codex-sub-agent]

- 规划或需求不明确 -> `cviauto-brainstorm`。
- `in_progress` 实施/检查 -> 分派 `cviauto-implement` / `cviauto-check`。
- 反复调试 -> `cviauto-break-loop`；spec 更新 -> `cviauto-update-spec`。

[/Claude Code, OpenCode, codex-sub-agent]

[codex-inline]

- 规划或需求不明确 -> `cviauto-brainstorm`。
- 编辑前 -> `cviauto-before-dev`；编辑后 -> `cviauto-check`。
- 反复调试 -> `cviauto-break-loop`；spec 更新 -> `cviauto-update-spec`。

[/codex-inline]

### 护城河（Guardrails）

- 任务创建同意不等于实施同意；实施等待产物审查后的 `task.py start`。
- 仅 PRD 对轻量任务是有效的；复杂任务需要 `design.md` + `implement.md`。
- 规划必须持久化到任务产物中；检查必须在报告完成之前运行。

### 加载步骤详情（Loading Step Detail）

在每一步，运行以下命令获取详细指南：

```bash
python3 ./.cviauto/scripts/get_context.py --mode phase --step <step>
# 例如 python3 ./.cviauto/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1: Plan

目标：对请求进行分类，在需要任务时获取任务创建同意，并产出实施前所需的规划产物。

#### 1.0 创建任务 `[required · once]`

仅在获得任务创建同意之后创建任务目录。该命令将 status 设置为 `planning`，写入 `task.json`，创建默认的 `prd.md`，并在会话身份可用时自动指向新任务：

```bash
python3 ./.cviauto/scripts/task.py create "<task title>" --slug <name>
```

`--slug` 仅含人类可读的名称。**不要**包含 `MM-DD-` 日期前缀；`task.py create` 会自动添加该前缀。

对于任务树，先创建父任务，然后使用 `--parent <parent-dir>` 创建每个子任务。不要因为子任务存在就启动父任务；启动拥有下一个可独立验证交付物的子任务。

此命令成功后，每轮面包屑会自动切换到 `[workflow-state:planning]`，告知 AI 保持在规划阶段。

此处只运行 `create`——不要同时运行 `start`。`start` 会将 status 翻转为 `in_progress`，这会在规划产物审查之前将面包屑切换到实施阶段。将 `start` 保留到步骤 1.4。

当 `python3 ./.cviauto/scripts/task.py current --source` 已经指向某个任务时跳过此步骤。

#### 1.1 需求探索 `[required · repeatable]`

加载 `cviauto-brainstorm` skill，并根据该 skill 的指南与用户交互式地探讨需求。

Brainstorm skill 将引导你：
- 一次只问一个问题
- 优先调研而非询问用户
- 优先提供选项而非开放式问题
- 在每次用户回答后立即更新 `prd.md`
- 当交付物可独立验证时，将大范围拆分为父任务加子任务
- 保持 `prd.md` 聚焦于需求和验收标准
- 对于复杂任务，在实施开始前产出 `design.md` 和 `implement.md`

当考虑父/子拆分时：
- 当一个请求包含多个可独立验证的交付物时使用父任务。
- 父任务拥有源需求、子任务映射、跨子任务验收标准和最终集成审查。
- 子任务拥有可独立规划、实施、检查和归档的实际交付物。
- 父/子结构不是依赖系统。如果子任务 B 依赖于子任务 A，将顺序写入子任务 B 的 `prd.md` / `implement.md`。
- 启动拥有下一个交付物的子任务。除非父任务本身有直接的实施工作，否则不要启动父任务。

每当需求变更时返回此步骤，并修订相应的产物。

#### 1.2 调研 `[optional · repeatable]`

调研可以在需求探索期间的任何时候进行。它不限于本地代码——你可以使用任何可用工具（MCP 服务器、skills、网络搜索等）查找外部信息，包括第三方库文档、行业实践、API 参考等。

[Claude Code, OpenCode, codex-sub-agent]

生成调研子 agent：

- **Agent 类型**：`cviauto-research`
- **任务描述**：调研 <具体问题>
- **关键要求**：调研输出必须持久化到 `{TASK_DIR}/research/`

[/Claude Code, OpenCode, codex-sub-agent]

[codex-inline]

在主会话中直接进行调研，并将发现写入 `{TASK_DIR}/research/`。（对于 `codex-inline`，这样做避免了 `fork_turns="none"` 隔离，该隔离会阻止 `cviauto-research` 子 agent 解析活跃任务路径。）

[/codex-inline]

**调研产物规范**：
- 每个调研主题一个文件（例如 `research/auth-library-comparison.md`）
- 在文件中记录第三方库用法示例、API 参考、版本约束
- 记录你发现的未来可能有用的相关 spec 文件路径

Brainstorm 和调研可以自由交错——暂停以调研一个技术问题，然后返回与用户交谈。

**关键原则**：调研输出必须写入文件，而不仅仅是留在聊天中。对话可能被压缩；文件不会。

#### 1.3 配置上下文 `[required · once]`

[Claude Code, OpenCode, codex-sub-agent]

整理 `implement.jsonl` 和 `check.jsonl`，使 Phase 2 子 agent 获得正确的 spec/research 上下文。这些文件在 `task create` 时以一行自描述的 `_example` 种子化；你此时的工作是填入真实的条目。

**位置**：`{TASK_DIR}/implement.jsonl` 和 `{TASK_DIR}/check.jsonl`（已经存在）。

**格式**：每行一个 JSON 对象——`{"file": "<path>", "reason": "<why>"}`。路径是仓库根目录的相对路径。

**应该放入什么**：
- **Spec 文件**——`.cviauto/spec/<package>/<layer>/index.md` 以及与此任务相关的任何特定指南文件（`error-handling.md`、`conventions.md` 等）
- **调研文件**——子 agent 将需要查阅的 `{TASK_DIR}/research/*.md`

**不应该放入什么**：
- 代码文件（`src/**`、`packages/**/*.ts` 等）——这些由子 agent 在实施期间读取，而非在此预注册
- 你即将修改的文件——同理

**在两个文件之间拆分**：
- `implement.jsonl` → 实施子 agent 正确编写代码所需的 spec + research
- `check.jsonl` → 检查子 agent 的 spec（质量指南、检查规范，如果需要，相同的 research 也应放入）

这些清单不替代 `implement.md`。`implement.md` 是复杂任务的人类可读执行计划；jsonl 文件仅列出要注入或加载的上下文文件。

**如何发现相关 spec**：

```bash
python3 ./.cviauto/scripts/get_context.py --mode packages
```

列出每个包及其 spec 层及路径。选择与此任务领域匹配的条目。

**如何追加条目**：

可以直接在编辑器中编辑 jsonl 文件，或使用：

```bash
python3 ./.cviauto/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python3 ./.cviauto/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

一旦有真实条目存在，删除种子 `_example` 行（可选——消费者会自动跳过它）。

就绪门禁：`task.py start` 之前，`implement.jsonl` 和 `check.jsonl` 必须各包含至少一条真实的 `{"file": "...", "reason": "..."}` 条目。只有种子 `_example` 行不算就绪。

仅当两个文件都已包含真实整理条目时才跳过此步骤。

[/Claude Code, OpenCode, codex-sub-agent]

[codex-inline]

跳过此步骤。上下文由 `cviauto-before-dev` skill 在 Phase 2 中直接加载。

[/codex-inline]

#### 1.4 激活任务 `[required · once]`

在产物审查之后，将任务状态翻转为 `in_progress`：

```bash
python3 ./.cviauto/scripts/task.py start <task-dir>
```

对于轻量任务，`prd.md` 可能就足够。对于复杂任务，`prd.md`、`design.md` 和 `implement.md` 必须在 start 之前存在并已审查。在子 agent 分派平台上，`implement.jsonl` 和 `check.jsonl` 必须在 start 之前均包含真实的整理条目。运行时消费者为兼容性会容忍缺失或仅有种子条的清单，但这种容忍并不等于规划就绪状态。

此命令成功后，面包屑自动切换到 `[workflow-state:in_progress]`，Phase 2 / 3 的其余部分随即开始。

如果 `task.py start` 报错会话身份消息（没有来自 hook 输入、`TRELLIS_CONTEXT_ID` 或平台原生会话环境变量的 context key），按照错误提示设置会话身份，然后重试。

#### 1.5 完成标准

| 条件（Condition） | 必需（Required） |
|------|:---:|
| `prd.md` 存在 | ✅ |
| 用户确认任务应进入实施 | ✅ |
| `task.py start` 已运行（status = in_progress） | ✅ |
| `research/` 有产物（复杂任务） | 推荐 |
| `design.md` 存在（复杂任务） | ✅ |
| `implement.md` 存在（复杂任务） | ✅ |

[Claude Code, OpenCode, codex-sub-agent]

| `implement.jsonl` 和 `check.jsonl` 各包含至少一条真实整理条目（种子行不算） | ✅ |

[/Claude Code, OpenCode, codex-sub-agent]

---

## Phase 2: Execute

目标：将已审查的规划产物转化为通过质量检查的代码。

#### 2.1 实施 `[required · repeatable]`

[Claude Code, OpenCode, Pi]

生成实施子 agent：

- **Agent 类型**：`cviauto-implement`
- **任务描述**：实施已审查的任务产物，查阅 `{TASK_DIR}/research/` 下的资料；完成时运行项目 lint 和 type-check
- **分派 prompt 守卫**：告知生成的 agent 它已经是 `cviauto-implement` 子 agent，必须直接实施，不得生成另一个 `cviauto-implement` / `cviauto-check`。

平台 hook/plugin 自动处理：
- 读取 `implement.jsonl` 并将引用的 spec/research 文件注入到 agent prompt 中
- 注入 `prd.md`、`design.md`（如存在）和 `implement.md`（如存在）

[/Claude Code, OpenCode, Pi]

[codex-sub-agent]

生成实施子 agent：

- **Agent 类型**：`cviauto-implement`
- **任务描述**：实施已审查的任务产物，查阅 `{TASK_DIR}/research/` 下的资料；完成时运行项目 lint 和 type-check
- **分派 prompt 守卫**：Prompt 必须以 `Active task: <task path>` 开头，然后明确说明生成的 agent 已经是 `cviauto-implement`，必须直接实施，不得生成另一个 `cviauto-implement` / `cviauto-check`。

Codex 子 agent 定义自动处理上下文加载要求：
- 使用 `task.py current --source` 解析活跃任务，然后读取 `prd.md`、`design.md`（如存在）和 `implement.md`（如存在）
- 读取 `implement.jsonl` 并要求 agent 在编码之前加载每个引用的 spec/research 文件

[/codex-sub-agent]

[codex-inline]

1. 加载 `cviauto-before-dev` skill 以读取项目指南
2. 读取 `{TASK_DIR}/prd.md`，然后是 `design.md`（如存在），然后是 `implement.md`（如存在）
3. 查阅 `{TASK_DIR}/research/` 下的资料
4. 按照已审查的产物实施代码
5. 运行项目 lint 和 type-check

[/codex-inline]

#### 2.2 质量检查 `[required · repeatable]`

[Claude Code, OpenCode, Pi, codex-sub-agent]

生成检查子 agent：

- **Agent 类型**：`cviauto-check`
- **任务描述**：对照 spec 和任务产物审查所有代码变更；直接修复任何发现；确保 lint 和 type-check 通过
- **分派 prompt 守卫**：告知生成的 agent 它已经是 `cviauto-check` 子 agent，必须直接审查/修复，不得生成另一个 `cviauto-check` / `cviauto-implement`。

检查 agent 的工作：
- 对照 spec 审查代码变更
- 对照 `prd.md`、`design.md`（如存在）和 `implement.md`（如存在）审查代码变更
- 自动修复其发现的问题
- 运行 lint 和 typecheck 进行验证

[/Claude Code, OpenCode, Pi, codex-sub-agent]

[codex-inline]

加载 `cviauto-check` skill 并按其指南验证代码：
- Spec 合规性
- lint / type-check / tests
- 跨层一致性（当变更跨越多个层时）

如果发现问题 → 修复 → 重新检查，直到通过。

[/codex-inline]

**最后一轮（Phase 3.4 提交之前）**：任务的最后一次 2.2 必须运行全范围检查，而不仅仅针对最新的实施块。使用 `python3 ./.cviauto/scripts/get_context.py --mode packages` 列出所有受影响的包，然后加载每个包 spec 索引中的 Quality Check 部分。这能捕获中间迭代本地 2.2 无法发现的跨层/多包问题。

#### 2.3 回滚 `[on demand]`

- `check` 发现 prd 缺陷 → 返回 Phase 1，修复 `prd.md`，然后重新执行 2.1
- 实施方向错误 → 撤销代码，重新执行 2.1
- 需要更多调研 → 调研（与 Phase 1.2 相同），将发现写入 `research/`

---

## Phase 3: Finish

目标：确保代码质量，捕获经验教训，记录工作。

#### 3.2 调试回顾 `[on demand]`

如果此任务涉及反复调试（同一个问题多次修复），加载 `cviauto-break-loop` skill 以：
- 分类根本原因
- 解释为什么之前的修复失败了
- 提出预防措施

目标是捕获调试经验，使同类问题不再发生。

#### 3.3 Spec 更新 `[on demand]`

仅当用户明确要求将当前会话的知识回写到 `.cviauto/spec/` 时才运行此步骤，例如"沉淀当前对话中关于某功能为 spec"或"update spec with this rule"。

加载 `cviauto-update-spec` skill，在写任何内容之前准备一个方案：
- 新发现的模式或规范
- 你遇到的陷阱
- 新的技术决策

报告建议的目标文件、要添加的确切规则以及为什么它是可复用的。仅在用户确认方案后才写入 `.cviauto/spec/` 下的文档。如果用户没有要求 spec 回写，完全跳过此步骤。

#### 3.4 提交变更 `[required · once]`

**Spec 同步前言**：如果用户明确要求将知识回写到 `.cviauto/spec/`，先完成 Phase 3.3 然后再起草提交。否则，不要运行 `cviauto-update-spec`；spec 回写是人为门控且可选的。

AI 驱动此任务代码变更的批量提交，使 `/finish-work` 之后可以干净地运行。目标：先产出有意义的工作提交。任务归档和日志记录默认是本地的 Cviauto 记账操作，不应混入工作提交中。

**分步操作**：

1. **检查脏状态**：
   ```bash
   git status --porcelain
   ```
   快照每个脏路径。如果工作树是干净的，跳到 3.5。

2. **从近期的提交历史中学习提交风格**（使起草的提交信息融入其中）：
   ```bash
   git log --oneline -5
   ```
   注意前缀规范（`feat:` / `fix:` / `chore:` / `docs:` ……）、语言（中文/English）和长度风格。

3. **将脏文件分为两组**：
   - **本会话 AI 编辑的**——你在此会话中通过 Edit/Write/Bash 工具调用编写/编辑的文件。你知道变更了什么以及为什么。
   - **未识别的**——你在此会话中未触碰的脏文件（可能是用户的手动编辑、前一会话遗留的 WIP 或无关工作）。不要静默包含这些文件。

4. **起草提交计划**。将 AI 编辑的文件分组为逻辑提交（每个连贯变更单元一个提交，而非每个文件一个提交）。每个条目：`<提交信息（commit message）>`+ 文件列表。将未识别的文件单独列在底部。

5. **一次性展示计划，请求一次性确认**。格式：
   ```
   Proposed commits (in order):
     1. <message>
        - <file>
        - <file>
     2. <message>
        - <file>

   Unrecognized dirty files (NOT in any commit — confirm include/exclude):
     - <file>
     - <file>

   Reply 'ok' / '行' to execute. Reply with edits, or '我自己来' / 'manual' to abort.
   ```

6. **确认后**：按顺序为每个批次运行 `git add <files>` + `git commit -m "<msg>"`。不要使用 amend。不要推送。

7. **拒绝后**（用户回复"不行" / "我自己来" / "manual" / 对计划的任何反对）：停止。不要尝试第二个方案。用户将手动提交；一旦他们确认，你跳到 3.5。

**规则**：
- 任何地方都不要使用 `git commit --amend`。工作提交是有意义的 git 历史；finish-work 默认写入本地归档/日志记录。
- 在此步骤中绝不推送到远程。
- 如果用户想要不同的提交信息措辞但接受文件分组，编辑信息并再次确认一次——但如果他们拒绝分组，则退出到手动模式。
- 批量方案是一次性提示；不要每个提交都提示一次。

#### 3.5 收尾提醒

在上述步骤之后，提醒用户可以运行 `/finish-work` 来收尾（归档任务并在本地记录会话）。如果他们想要将经验教训回写到 spec，他们应在调用 finish-work 时明确说明。

---

## 自定义 Cviauto（面向 Fork 开发者）

本节面向想要修改 Cviauto 工作流本身的开发者。所有自定义都是通过编辑此文件完成的；脚本只是解析器。

### 更改某个步骤的含义

编辑上文 Phase 1 / 2 / 3 章节中对应步骤的演练正文。关键约束：
- 没有活跃任务时必须先进行分类，并在创建 Cviauto 任务之前请求任务创建同意。
- 规划必须区分轻量仅 PRD 任务和在 start 之前需要 `prd.md`、`design.md` 和 `implement.md` 的复杂任务。
- 每个必需的执行路径必须保持 Phase 3.4 提交提醒在 `/cviauto:finish-work` 之前可达。

所有标记块位于上方 `## Phase Index` 章节中，紧接在每个阶段摘要之后：

| 范围（Scope） | 对应标记 |
|---|---|
| 没有活跃任务（Phase 1 之前） | `[workflow-state:no_task]`（在 Phase Index ASCII 图之后） |
| 整个 Phase 1（任务已创建 → 准备就绪可实施） | `[workflow-state:planning]`（在 Phase 1 摘要之后） |
| Codex inline Phase 1 | `[workflow-state:planning-inline]` |
| Phase 2 + Phase 3.2–3.4（实施 + 检查 + 收尾） | `[workflow-state:in_progress]`（在 Phase 2 摘要之后） |
| Codex inline Phase 2 + Phase 3.2–3.4 | `[workflow-state:in_progress-inline]` |
| Phase 3.5 之后（已归档） | `[workflow-state:completed]`（在 Phase 3 摘要之后；**当前为 DEAD**） |

### 更改每轮提示文本

直接编辑对应 `[workflow-state:STATUS]` 块的正文。编辑后，运行 `cviauto update`（如果你是模板维护者）或重启你的 AI 会话（如果你在自定义自己的项目）——无需脚本变更。

### 添加自定义状态

添加一个新块：

```
[workflow-state:my-status]
your per-turn prompt text
[/workflow-state:my-status]
```

约束：
- STATUS 字符集：`[A-Za-z0-9_-]+`（允许下划线和连字符，例如 `in-review`、`blocked-by-team`）
- 一个生命周期 hook 必须将 `task.json.status` 写入你的自定义值，否则该标记永远不会被读取
- 生命周期 hooks 位于 `task.json.hooks.after_*`，绑定到 `after_create / after_start / after_finish / after_archive` 之一

### 添加生命周期 hook

向你的 `task.json` 添加 `hooks` 字段：

```json
{
  "hooks": {
    "after_finish": [
      "your-script-or-command-here"
    ]
  }
}
```

支持的事件：`after_create / after_start / after_finish / after_archive`。注意 `after_finish` ≠ 状态变更（它仅清除活跃任务指针）；使用 `after_archive` 用于"任务已完成"的通知。

### 完整契约

有关工作流状态机的运行时契约、所有状态写入器的位置、伪状态（`no_task` / `stale_<source_type>`）、hook 可达性矩阵以及其他深层细节，请参见：

- `.cviauto/spec/cli/backend/workflow-state-contract.md`——运行时契约 + 写入器表 + 测试不变量
- `.cviauto/scripts/inject-workflow-state.py`——实际解析器（仅读取 workflow.md，无嵌入文本）
