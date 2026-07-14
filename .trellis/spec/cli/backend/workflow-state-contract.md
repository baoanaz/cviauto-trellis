# Workflow-State 面包屑契约

> `inject-workflow-state.py` / `inject-workflow-state.js` 注入到每个
> UserPromptSubmit 中的每回合 `<workflow-state>` 面包屑的运行时契约。

---

## 概述

面包屑是**唯一**在 Trellis 任务活跃时触发的每回合通道。它用于主 AI 会话，而子 agent 上下文通常通过 class-1 平台上的 `inject-subagent-context` 或 class-2 平台上的 pull-based 序言到达。主机行为仍然可能在子 agent 回合内展示面包屑，而 hooks 目前不暴露稳定的主 vs 子 agent 身份信号。因此：**workflow 逐步指南为给定阶段要求的每个 `[required · once]` 步骤也必须在该阶段的面包屑标签块中提及，并且面包屑文本在被子 agent 读取时必须是安全的。** 如果必需的门控缺失，主会话中的 AI 将静默跳过它们。围绕规划门控和 Phase 3.4 提交提醒的先前 bug 正是命中了这种失败模式。

本文档是运行时机制的权威来源。面向用户的面包屑正文位于 `.trellis/workflow.md`；本规范涵盖了**围绕**它的所有内容（解析器、写入器、生命周期、可达性）。

---

## 标记语法

每个面包屑正文位于 `.trellis/workflow.md` 的管理块中：

```
[workflow-state:STATUS]
<一行或多行正文文本>
[/workflow-state:STATUS]
```

- STATUS 字符集：`[A-Za-z0-9_-]+`（字母、数字、下划线、连字符）。示例：`planning`、`in_progress`、`in-review`、`blocked-by-team`。
- 正文逐字读取并内联到 `<workflow-state>` 块中。
- 开始和结束标签都必须以相同的 STATUS 字符串结尾。

Python hook（`packages/cli/src/templates/shared-hooks/inject-workflow-state.py`）和 OpenCode plugin（`packages/cli/src/templates/opencode/plugins/inject-workflow-state.js`）都使用的正则：

```
[workflow-state:([A-Za-z0-9_-]+)]\s*\n(.*?)\n\s*[/workflow-state:\1]
```

### 不变量：解析器正则 ↔ 剥离正则必须使用相同的 `\1` 反向引用

标记语法有两个正则消费者：

1. **解析器** — 提取标签内容用于面包屑发出。位于 `inject-workflow-state.py`（`_TAG_RE`）和 `inject-workflow-state.js`。
2. **剥离器** — 从 SessionStart 注入的 workflow.md 范围内移除标签块（因此 AI 不会读两次每个块 — 一次在 workflow 概述中，一次在每回合面包屑中）。位于 `session-start.py`（shared / codex / copilot 副本）、`workflow_phase.py` 和任何未来 SessionStart 等效脚本。

两个正则都必须使用 `\1` 反向引用变体 — `[workflow-state:([A-Za-z0-9_-]+)]...[/workflow-state:\1]` — 因此它们仅匹配格式良好的对（打开和关闭上相同的 STATUS）。非反向引用变体如 `[workflow-state:[A-Za-z0-9_-]+]...[/workflow-state:[A-Za-z0-9_-]+]` 允许 `STATUS_A...STATUS_B` 不匹配，如果用户打错了关闭标签，这可能吞掉周围内容。

**漂移的症状**：解析器会拒绝为打错标签的块发出内容（因为解析器使用 `\1`），但剥离器会静默地从 SessionStart 负载中消费它（因为剥离器使用了宽松形式）。最终结果：AI 通过任一通道都看不到该内容 — 静默丢失。

**测试不变量**：`test/regression.test.ts` `[strip-breadcrumb] _strip_breadcrumb_tag_blocks only strips matched STATUS pairs` 覆盖了剥离侧的三种边界情况（匹配、不匹配、嵌套孤儿）。解析器已经通过 `\1` 在结构上强制执行相同状态配对。

---

## 运行时契约

1. 在每个 UserPromptSubmit（或平台等效 — 参见 hook 可达性矩阵）上，hook 接收包含 `cwd` 的 stdin JSON。
2. 它从 `cwd` 向上遍历以查找 `.trellis/`。如果无，exit 0。
3. 它调用 `common.active_task.resolve_active_task()` 查找每会话活跃任务。如果缺失 → 状态为伪 `no_task`。如果指针是过时的（任务目录已删除）→ 状态为 `stale_<source_type>`。
4. 否则它从已解析的任务目录读取 `task.json.status`。
5. 它打开 `.trellis/workflow.md` 并解析每个 `[workflow-state:STATUS]` 块。
6. Codex 可能基于 `codex.dispatch_mode` 将 `planning` / `in_progress` 映射到 `planning-inline` / `in_progress-inline`；所有其他平台使用纯状态。
7. 它在已解析的映射中查找当前状态。如果找到 → 发出 `<workflow-state>...</workflow-state>` 中的块正文。如果未找到 → 发出通用行 `Refer to workflow.md for current step.`
8. 输出 JSON 具有形状：

   ```json
   {"hookSpecificOutput": {
     "hookEventName": "<platform-event-name>",
     "additionalContext": "<workflow-state>...</workflow-state>"
   }}
   ```

   平台主机将 `additionalContext` 注入为该回合的系统级前言。

   共享 hook 通过 `_detect_platform()` 检测平台并发出匹配值：

   | 检测到的平台 | `hookEventName` 值 |
   |---|---|
   | gemini | `BeforeAgent` |
   | 所有其他（claude、cursor、codex、qoder、codebuddy、droid、copilot、kiro） | `UserPromptSubmit` |

   添加新的 hook-capable 平台，其每回合事件名称不是 `UserPromptSubmit` 时，扩展 `_detect_platform()` 和 `inject-workflow-state.py` 中的 `hook_event_name` 选择器（以及 OpenCode `.js` plugin，如果新平台共享其 `chat.message` 风格信封）。不要在**任何**新的发出点硬编码 `UserPromptSubmit`。

---

## 权威来源

`workflow.md` 是**面包屑正文文本的唯一可编辑来源**。hook 脚本（`.py` 和 `.js`）仅包含解析器，没有回退文本。

**为什么没有回退字典**：在 v0.5.0-beta.20 之前，两个 hook 脚本都发布了一个镜像 workflow.md 内容的 `_FALLBACK_BREADCRUMBS` / `FALLBACK_BREADCRUMBS` 字典。镜像不可避免地漂移（每个文件中的措辞润色不同），架构邀请复制粘贴偏差。移除回退将三个来源折叠为一个。当 `workflow.md` 缺失或标签不存在时，hook 降级到通用行 — 对用户可见，作为他们可以修复的明显 bug，而不是被静默掩盖。

要自定义面包屑措辞，编辑 `.trellis/workflow.md` 中的 `[workflow-state:STATUS]` 块。无需更改脚本。

### Update 边界

`[workflow-state:STATUS]` 块不是 `workflow.md` 中唯一对运行时敏感的内容。阶段标题、步骤标题和平台标记块如 `[codex-inline, Kilo, Antigravity, Devin]` 在加载步骤特定指令时由 `workflow_phase.py` / `get_context.py` 解析。

因此，当安装的文件仍然匹配其跟踪的模板哈希时，`trellis update` 必须将 `workflow.md` 作为一个管理模板文件更新。它不能仅部分合并 `[workflow-state:*]` 块。用户编辑受正常的基于哈希的已修改文件流程保护，而不是通过在自动更新期间保留标签块之外的任意散文。

回归不变量：包含过时 Codex 标记（`[Codex]` 加上 `[Kilo, Antigravity, Windsurf]`）的旧哈希跟踪 workflow 必须被当前打包模板替换，以便 `--platform codex` 可以解析到 `codex-inline` 或 `codex-sub-agent` 并仍然加载 Phase 2.1 细节。

---

## 状态写入器表

下表枚举了写入 `task.json.status` 的每个代码路径 — 即每个可以改变下次触发哪个面包屑的路径。**添加新写入器需要更新本规范。**

| # | 写入器 | 文件:行号 | 值 | 触发器 |
|---|--------|-----------|-------|---------|
| 1 | `cmd_create` | `packages/cli/src/templates/trellis/scripts/common/task_store.py:206` | `"planning"` | `task.py create "<title>"`（当会话身份可用时也自动设置会话活跃任务指针 — 参见 04-30-workflow-state-commit-gap PRD 中的 R7） |
| 2 | `cmd_start` | `packages/cli/src/templates/trellis/scripts/task.py:114-115, 128-129` | `"in_progress"`（以先前的 `"planning"` 为门控；`cmd_start` 中的两个分支） | `task.py start <dir>` |
| 3 | `cmd_archive` | `packages/cli/src/templates/trellis/scripts/common/task_store.py:337` | `"completed"`（无条件翻转 + archive `mv`） | `task.py archive <dir>` |
| 4 | `emptyTaskJson` 工厂 | `packages/cli/src/utils/task-json.ts:54` | `"planning"`（默认） | TS 调用者（init、update） |
| 5 | `getBootstrapTaskJson` | `packages/cli/src/commands/init.ts:535` | `"in_progress"`（覆盖） | `trellis init`（创建者路径） |
| 6 | `getJoinerTaskJson` | `packages/cli/src/commands/init.ts:587` | `"in_progress"`（覆盖） | `trellis init`（加入者路径） |
| 7 | 通过 `emptyTaskJson` 的 migration-task | `packages/cli/src/commands/update.ts:2483-2494` | `"planning"`（覆盖工厂） | 破坏性变更清单的 `trellis update --migrate` |

**没有其他写入器存在。** 没有 hook 脚本写入 `task.json.status` — 由 `grep -rn '"status"' .trellis/scripts/` 验证。Linear-sync hook（`linear_sync.py`）仅写入 `meta.linear_issue`。

---

## 生命周期事件 ≠ 状态转换

生命周期事件在任务管理命令上触发，而不是在状态更改上触发。订阅者必须理解差异：

| 事件 | 发出时 | 触发时的状态 |
|-------|------------|-------------------|
| `after_create` | `cmd_create` 结束 | `"planning"`（刚刚写入） |
| `after_start` | `cmd_start` 结束 | 如果状态是 `"planning"` 则为 `"in_progress"`；否则不变。重新运行 `start` 不会重新触发状态翻转。 |
| `after_finish` | `cmd_finish` 结束 | **不变** — `cmd_finish` 仅清除每个会话的活跃任务指针。状态保持其原样（通常为 `"in_progress"`）。 |
| `after_archive` | `cmd_archive` 结束 | `"completed"`（刚刚写入，然后目录移动到 `archive/YYYY-MM/`） |

**常见错误**：订阅 `after_finish` 以在外部系统（Linear、Jira）中标记任务「完成」。`after_finish` 意味着「AI 会话关闭了对此任务的指针」— 任务可能在不同会话中恢复。任务「完成」的正确事件是 `after_archive`。

---

## 可达性矩阵

在正常流程中实际触发哪些面包屑：

| 状态 | 可达性 | 备注 |
|--------|--------------|-------|
| `no_task` | ✅ 可达 | 伪状态；当 `resolve_active_task()` 返回无指针时发出。 |
| `planning` | ✅ 可达 | 在 `cmd_create`（现在当会话指针可用时自动设置）之后和 `cmd_start` 之前。`planning-inline` 是相同任务状态的 Codex 内联模式面包屑正文。 |
| `in_progress` | ✅ 可达 | 在 `cmd_start` 之后，直到 `cmd_archive`。`in_progress-inline` 是相同任务状态的 Codex 内联模式面包屑正文。 |
| `completed` | ❌ 在正常流程中不通 | `cmd_archive` 写入 `status="completed"` 并立即将任务目录移动到 `archive/`。`clear_task_from_sessions` 中的会话指针清理在移动之前运行，因此解析器在同一调用中丢失指针。workflow.md 中的块正文保留用于未来的状态转换重新设计（例如，显式的 `in_progress → completed` 命令），但没有当前代码路径产生它。 |
| `stale_<source_type>` | ✅ 可达（罕见） | 当会话指针引用已删除的任务目录时合成。通过 `build_breadcrumb` 发出通用正文，因为没有 `stale_*` 标签被发布。 |

**测试不变量**（`test/regression.test.ts`）：workflow-state 块必须保留无法从模型记忆中恢复的运行时门控：`no_task` 分类并询问任务创建同意；planning 区分轻量级 PRD 仅任务和需要 `prd.md`、`design.md` 和 `implement.md` 的复杂任务；in-progress 在 `/trellis:finish-work` 之前保持提交步骤可到达。参见：

- `test that workflow.md [workflow-state:in_progress] mentions commit (Phase 3.4)`
- `test that workflow.md [workflow-state:planning] mentions planning artifact gate`
- `test that workflow.md [workflow-state:no_task] asks for task-creation consent`

---

## 自定义状态

分支可以定义自定义状态。要这样做：

1. 向 `.trellis/workflow.md` 添加一个 `[workflow-state:my-status]...[/workflow-state:my-status]` 块（STATUS 字符集：`[A-Za-z0-9_-]+`）。
2. 添加一个生命周期 hook（`task.json.hooks.after_*`），在适当的事件时写入 `task.json.status = "my-status"`。没有写入器，标签永远不会被读取，因为没有任务携带该状态。
3. （可选）将状态添加到本规范（`.trellis/spec/cli/backend/workflow-state-contract.md`）的写入器表中，当将自定义发布到其他仓库时。

---

## Hook 可达性矩阵

面包屑**用于**主 AI 会话。子 agents 有自己的上下文加载路径，但主机平台可能仍然为子回合运行每回合面包屑 hooks 或继承主会话每回合上下文。Trellis 不得依赖子 agent 内部的面包屑绝对不可见性。

| 通道 | 主会话 | Hook-inject 子 agent | Pull-prelude 子 agent | Extension-backed 子 agent |
|---------|:------------:|:---------------------:|:----------------------:|:--------------------------:|
| `<workflow-state>` 每回合面包屑 | ✅ | ⚠️ 可能的主机依赖暴露 | ⚠️ 可能的主机依赖暴露 | ⚠️ 可能的主机依赖暴露 |
| `inject-subagent-context`（`implement.jsonl`/`check.jsonl` + 任务产物注入） | ❌ | ✅ | ❌ | ❌ |
| Pull-based prelude（`shared.ts:buildPullBasedPrelude`） | 不适用 | 不适用 | ✅ | 回退 |

Hook-inject 平台：claude、cursor、codebuddy、droid、kiro（`agentSpawn`）、opencode（JS plugin）。
Pull-prelude 平台：codex、gemini、qoder、copilot。
Extension-backed 平台：pi。
无 hook：kilo、antigravity、devin。

**影响**：子 agent 必需的指导仍必须通过 hook-inject 平台的 `inject-subagent-context`、pull-prelude 平台的 `buildPullBasedPrelude` 或 extension-backed 平台的 Pi 扩展 prompt 构建器传播。所有路径必须使用相同的任务产物顺序：jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`。面包屑文本还必须如果子 agent 看到它是安全的：主会话分发指导必须自我豁免 `trellis-implement` / `trellis-check` 读取器，以便它们直接实现或检查，而不是 spawn 嵌套的 Trellis 子 agents。

---

## DO

- 编辑 `.trellis/workflow.md` 的 `[workflow-state:STATUS]` 块以更改面包屑正文；永不触碰解析器脚本。
- 保持 `trellis update` 对哈希跟踪的 `workflow.md` 使用整文件行为。仅面包屑标签更新是不够的，因为这些标签之外的平台路由标记也是运行时输入。
- 引入新状态写入器时向本规范添加写入器表行。
- 编辑面包屑正文后运行回归测试。
- 向 workflow 逐步指南添加 `[required · once]` 步骤时，在同一提交中向该阶段的面包屑标签块添加匹配的强制执行行。

## DON'T

- 不要将回退面包屑字典重新添加到 `inject-workflow-state.py` 或 `.js`。漂移在结构上是保证的。
- 不要为 `workflow.md` 实现特殊部分合并，除非每个消费标题、平台块和面包屑标签的运行时解析器都有显式的兼容性策略和升级测试覆盖。
- 不要引入 `task.json.status` 写入器而不更新本规范。
- 不要订阅 `after_finish` 来检测任务完成 — 它的意思不是你想的那样。使用 `after_archive`。
- 不要静默将写入器重新路由到不同状态，而不审计每个面包屑消费者（`session-start.py`、`inject-workflow-state.py`、`task.py list` 等）。
- 不要依赖子 agent 看不到面包屑。如果指导与子 agent 相关，通过上述适当通道传播，并保持面包屑措辞自我豁免。

---

## 强制触发器（更改时必须更新本规范）

- 标记语法（正则 / 字符集）
- Hook 脚本结构化更改（解析器、输出信封、什么读取 `task.json.status`）
- `trellis update` 中的 `workflow.md` 更新语义
- 新 `task.json.status` 写入器（任何变更该字段的路径）
- 更改契约的面包屑正文（例如，移除 `[required · once]` 强制执行行 — 在 PR 描述中标记）
- 添加到 `run_task_hooks` 的新生命周期事件
- 可达性更改（例如，连接使 `completed` 可达的新状态转换）

交叉引用：`cli/backend/quality-guidelines.md`「Routing Fixes: Audit ALL Entry Paths」— 该审计模式是本规范为面包屑子系统强制执行的内容。