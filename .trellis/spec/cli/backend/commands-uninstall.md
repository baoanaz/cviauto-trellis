# `trellis uninstall` 命令

源码：`packages/cli/src/commands/uninstall.ts`

卸载命令如何从项目中移除每个 Trellis 写入的文件，原地清理结构化配置文件，并修剪空的管理目录 — 而不触及用户编写的相邻文件。

---

## 概述

`trellis uninstall` 是 `trellis init` / `trellis update` 的反操作：它移除 Trellis 写入的所有内容，并保留 Trellis 未写入的所有内容。

- **清单是权威的。**「Trellis 写入了什么」的唯一权威来源是 `.trellis/.template-hashes.json`。清单之外的文件永远不会被触碰，无论它们位于何处（例如，`.claude/hooks/` 下的用户添加脚本、`.cursor/commands/` 下的自定义命令）。
- **无用户修改门禁。**无论用户是否编辑了清单中列出的文件，它都会被移除。`update` 的语义（警告 / 保留修改过的文件）在此不适用 — 用户的意图是完全移除 Trellis。
- **两种文件类别。**清单条目分为：
  1. *不透明内容文件*（`.py`、`.md`、`.toml`、`.json` agents 等）— 直接删除。
  2. *结构化配置文件*（`settings.json`、`hooks.json`、`package.json`、`config.toml`）— 通过清理器（scrubber）处理，仅移除 Trellis 拥有的字段，并将修剪后的结果写回。如果没有任何有意义的内容保留，清理器返回 `fullyEmpty: true`，文件将被删除而不是重新写入。
- **`.trellis/` 被无条件移除。**任务、运行时状态、工作区日志、配置 — 全部。希望保留历史任务记录的用户必须在运行 `uninstall` 之前自行备份 `.trellis/tasks/`。
- **幂等。**对没有 `.trellis/` 的项目重新运行是友好的空操作。在部分失败后重新运行会拾取磁盘上仍然存在的任何内容并收敛。
- **尽力清理。**单个文件/目录的 `unlink`/`rmdir` 权限错误被吞掉；命令从不中途终止。最后的摘要报告计数但不枚举每个文件的失败。

有关每个清理器的*内容*（从 `.claude/settings.json` 移除哪些字段，`.codex/config.toml` 中什么算作 Trellis 注释等），参见 `uninstall-scrubbers.md` 获取每个文件的清理规则。

---

## 命令入口

在 `cli/index.ts` 中靠近其他顶层子命令连接：

```
trellis uninstall [-y|--yes] [--dry-run]
```

| 标志 | 类型 | 效果 |
|------|------|--------|
| `-y, --yes` | boolean | 跳过 `Continue?` 确认提示。 |
| `--dry-run` | boolean | 打印计划并退出，不修改任何内容。 |

没有 `--platform <name>` 或 `--keep-config` 标志。设计故意是全有或全无：部分卸载（例如，「仅从 Cursor 移除 Trellis，保留 Claude Code」）**超出范围**，因为清单不按平台分区 — 参见下面的*常见陷阱*。

命令接口位于 `commands/uninstall.ts:uninstall`，是由 `cli/index.ts` 消费的唯一导出。同一文件中的 `UninstallOptions` 接口与两个 CLI 标志一一对应。

---

## 计划编写（Plan Composition）

命令首先构建计划，打印它，可选择提示，然后执行。计划编写是 `cwd` + 清单内容的纯函数。

### 前置检查（在任何计划之前）

`commands/uninstall.ts:uninstall` 在顶部执行两个前置检查：

1. **`.trellis/` 必须存在。**如果缺失，打印灰色「not installed」消息并干净返回（exit 0）。这是幂等重新运行路径。
2. **清单必须存在且非空。**当 `.trellis/.template-hashes.json` 缺失或不可读时，`loadHashes(cwd)` 返回 `{}`。没有清单，无法区分 Trellis 拥有的平台文件和用户拥有的文件，因此命令拒绝继续并以红色错误消息 + `process.exit(1)` 退出。处于此状态的用户被告知可以手动删除 `.trellis/`。

### 计划器 — `commands/uninstall.ts:buildPlan`

输入：`cwd`、`hashes`（清单记录）。

对于 `hashes` 中的每个 POSIX 路径：

1. 通过 `path.join(cwd, ...posixPath.split("/"))` 解析绝对路径。
2. 在结构化文件分发表中查找路径（见下文）。
3. **无结构化规范匹配** → 记录为普通 `PlannedDeletion`。如果文件在磁盘上缺失，条目仍以 `missing: true` 记录（以便摘要可以将其报告为「skipped」，而不会与成功删除混淆）。
4. **规范匹配，磁盘上文件缺失** → 记录为 `PlannedDeletion { missing: true }`。不调用清理器。
5. **规范匹配，文件存在** → 读取文件，运行清理器：
   - 如果清理器返回 `fullyEmpty: true`，记录为 `PlannedDeletion { missing: false }`。文件将像任何其他清单条目一样被删除。
   - 否则，记录为 `PlannedModification`，携带预计算的 `ScrubResult`（清理后内容）加上用于人类可读计划输出的 `reason` 字符串。

`removeTrellisDir` 无条件设置为 `true` — 当 `buildPlan` 运行时，我们已经验证了 `.trellis/` 存在。

### 结构化文件分发表 — `commands/uninstall.ts:buildStructuredFileSpecs`

每个命令调用构建一次的 `Map<posixPath, StructuredFileSpec>`。每个条目将清单中列出的配置文件与知道如何精确编辑它的清理器配对。当前条目：

| 清单路径 | 清理器 | Hooks-JSON 模式 |
|---|---|---|
| `.claude/settings.json` | `scrubHooksJson` | `nested` |
| `.gemini/settings.json` | `scrubHooksJson` | `nested` |
| `.factory/settings.json` | `scrubHooksJson` | `nested` |
| `.codebuddy/settings.json` | `scrubHooksJson` | `nested` |
| `.qoder/settings.json` | `scrubHooksJson` | `nested` |
| `.codex/hooks.json` | `scrubHooksJson` | `nested` |
| `.cursor/hooks.json` | `scrubHooksJson` | `flat` |
| `.github/copilot/hooks.json` | `scrubHooksJson` | `flat` |
| `.opencode/package.json` | `scrubOpencodePackageJson` | 不适用 |
| `.pi/settings.json` | `scrubPiSettings` | 不适用 |
| `.codex/config.toml` | `scrubCodexConfigToml` | 不适用 |

添加一个发布结构化配置文件的新平台意味着向此表添加一行 — 计划器自动拾取它。**每个文件的清理语义位于 `uninstall-scrubbers.md`；不要在此重复它们。**

`StructuredFileSpec.scrub` 回调接收 `(content, deletedPaths)`。`deletedPaths` 是*此次卸载*的清单列出 POSIX 路径的完整集合，被 hooks-JSON 清理器用于识别 Trellis 管理的 `command` 字符串，而不错误匹配仅在 `echo` 或注释中提到路径的用户添加 hooks。

### 计划渲染 — `commands/uninstall.ts:renderPlan`

两列输出：

- **Will be deleted（N 个条目）** — 非缺失的删除加上一个代表 `.trellis/` 目录本身的合成 `WORKFLOW/` 行（仅当目录仍然存在时才打印，在前置检查之后它应该总是存在的）。
- **Will be modified（N 个文件）** — 结构化文件修改，每个都带有其分发条目的 `reason` 注释。
- **Skipped** — 灰色页脚，统计清单中已在磁盘上缺失的条目（仍记录在计划中但不可操作）。

这纯粹是外观上的；计划对象本身驱动执行。

---

## 确认与 Dry Run

打印计划后：

1. **`--dry-run`** — 打印「Dry run — no files were modified.」并返回。无提示，无变更，无 `process.exit`。
2. **`--yes`** — 跳过提示，直接进入执行。
3. **否则** — 通过 inquirer 提示 `Continue? [Y/n]`（默认 `Y`）。

### 非 TTY 守卫

如果 `process.stdin.isTTY` 为 false **且**既没有设置 `--yes` 也没有设置 `--dry-run`，命令拒绝提示并以非零退出，打印红色消息指示用户传递 `--yes` 或 `--dry-run`。这是一个故意 fail-closed 的 UX 选择，镜像了脚本化环境中的 `trellis update`。退出前的简短 `readline.createInterface(...).close()` 调用是防御性引用释放，以防其他内容打开了 stdin（主要是防御性的 — 进程无论如何都即将退出）。

如果用户在提示中回答「no」，打印黄色「Uninstall cancelled. No files modified.」并返回。**无部分执行；无需回滚。**

---

## 计划执行 — `commands/uninstall.ts:executePlan`

五个有序阶段。顺序对部分失败恢复很重要（中断的卸载将项目留在更可恢复的状态）：

### 阶段 1 — 先修改

将每个 `PlannedModification.result.content` 通过 `fs.writeFileSync` 写入其 `absPath`。在**删除之前**这样做意味着如果后续步骤崩溃，结构化配置文件至少已经剥离了其 Trellis 片段。这些文件中的用户数据（`package.json` 中的其他 deps、`settings.json` 中的其他 hooks、自定义键）被保留。

### 阶段 2 — 文件删除

对于每个 `missing` 为 false 的 `PlannedDeletion`，`fs.unlinkSync(absPath)`。错误被捕获并静默跳过 — 参见*边界*中的*尽力清理*。

删除时，每个已删除文件的父目录被添加到一个 `Set<string>` 的 `deletedDirCandidates`（清单路径的 POSIX dirname）。这些是可能刚刚变为空并符合修剪条件的目录。

### 阶段 3 — 递归删除 `.trellis/`

`fs.rmSync(trellisDir, { recursive: true, force: true })`。整个目录树在一次调用中消失。这在 `executePlan` 内是无条件的；唯一的门禁是 `uninstall()` 顶部的前置检查，它确定了目录存在且清单存在。

### 阶段 4 — 修剪空管理子目录

对于 `deletedDirCandidates` 中的每个目录，调用 `cleanupEmptyDirs(cwd, dirPosix)`（从 `commands/update.ts` 重新导出）。这自底向上遍历目录并移除在阶段 2 之后变为空的任何子目录 — 但它显式**拒绝移除管理根目录**（`.claude`、`.cursor`、`.codex` 等），因为正常的 `update` 流程需要它们持久化。

### 阶段 5 — 修剪空管理根目录

这是 `cleanupEmptyDirs` 故意不做的仅卸载修复。在阶段 4 之后，像 `.claude` 这样的平台根目录可能是空的（每个嵌套文件已移除，每个嵌套空子目录已修剪）。在卸载期间没有理由保留它，因此我们遍历 `ALL_MANAGED_DIRS`（排除 `DIR_NAMES.WORKFLOW`，因为阶段 3 已经处理了它），按斜杠计数**最深层优先**排序，并对为空的每个目录执行 `rmdirSync`。

移除最深层目录（例如 `.agents/skills`）后，循环**向上**遍历直到遇到非空父级或用完 POSIX 路径。这处理如下情况：
- `.agents/skills` 为空 → 移除 → `.agents` 现在可能为空 → 移除 → 完成。

最深层优先排序很重要：如果我们按注册表顺序遍历 `ALL_MANAGED_DIRS`，并尝试在 `.agents/skills` 之前移除 `.agents`，rmdir 会因为目录非空而失败。

返回 `{ deletedFiles, modifiedFiles, deletedDirs }` 用于绿色摘要行。

---

## `.trellis/` 处理

`.trellis/` 被完整移除 — 没有 `--keep-config` 或 `--keep-tasks` 标志。这包括：

| 子目录 | 状态 |
|---|---|
| `.trellis/scripts/` | 已移除（模板管理）。 |
| `.trellis/spec/` | 已移除（在 `update` 期间通过 `update.skip` 语义管理，但 uninstall 移除所有内容）。 |
| `.trellis/tasks/` | 已移除（用户数据）。 |
| `.trellis/workspace/` | 已移除（用户日志）。 |
| `.trellis/runtime/` | 已移除（会话状态）。 |
| `.trellis/config.yaml` | 已移除（用户配置）。 |
| `.trellis/.developer` | 已移除。 |
| `.trellis/.current-task` | 已移除。 |
| `.trellis/.template-hashes.json` | 已移除。 |

这对 `.trellis/` 中的用户数据是**故意破坏性的**。用户负责在运行 `uninstall` 之前备份 `tasks/` 或 `workspace/`，如果他们希望保留历史记录。计划输出打印 `WORKFLOW/  (entire directory, including tasks/runtime/config)`，因此这在确认提示之前是可见的。

> 理由：留下孤儿 `.trellis/` 内容的「软卸载」是比完全安装或完全卸载更糟糕的状态 — 剩余文件引用了已删除的脚本（`.trellis/scripts/`）和指向已删除 spec 文件的损坏子 agent 配置（`.trellis/tasks/<id>/implement.jsonl`）。要么保留 Trellis，要么干净地移除它。不存在半 Trellis 模式。

---

## 边界

### `uninstall` 不会做什么

- **不会触碰 `.template-hashes.json` 之外的任何文件。**`.claude/hooks/` 内用户添加的脚本、`.cursor/commands/` 内用户自定义命令、用户自己定义的项目本地 agents — 全部保留。`test/commands/uninstall.integration.test.ts` 中的测试 `#7` 覆盖了这一点。
- **不会变更结构化配置的用户编写部分。**清理器仅剥离 Trellis 发出的条目。`package.json` 中的其他 deps、`settings.json` 中的其他事件 hooks、`config.toml` 中的自定义 `[features]` 表条目 — 全部保留。测试 `#8` 覆盖了 `.claude/settings.json` 的这一点。
- **不会触碰 git 历史。**无 `git add`、无 `git commit`、无 `git rm`。用户需自行提交卸载后状态。（与 `update` 相同的约定。）
- **不会触碰 `~/.codex/config.toml` 或任何其他用户级配置。**Codex 的 hook 激活标志（`features.hooks = true`）位于用户的 home 配置中；我们从不编辑它。我们确实删除项目本地的 `.codex/config.toml`，它仅包含 `project_doc_fallback_filenames` + 一个注释块。
- **不会逆向迁移。**如果用户最初安装了 v0.4 并迁移到 v0.5，`uninstall` 移除 v0.5 形状的文件（无论当前清单包含什么）。它不会重建任何 v0.4 文件。

### 尽力清理

阶段 2、4、5 都使用带空处理程序的 try/catch。单个文件或目录的权限错误被吞掉。如果这些错误中的任何一个触发，摘要的「deleted N files」计数将少报。我们接受这种权衡：在卸载中途中止会让用户处于比尽力完成更糟糕的状态。

如果用户报告「uninstall 没有移除文件 X」，诊断路径是：

1. 文件在卸载前是否存在于 `.trellis/.template-hashes.json` 中？（如果不在，它从来都不是 Trellis 拥有的。）
2. 权限或 AV 软件是否阻止了 unlink？（卸载后 `ls -la` 该路径。）
3. 文件是否在结构化配置中，且清理后非完全为空？（检查文件内容。）

### 清单作为范围契约

每个行为决策都源于「此路径是否在清单中？」：

- 路径在清单中，无结构化规范 → unlink。
- 路径在清单中，有结构化规范，清理返回 `fullyEmpty` → unlink。
- 路径在清单中，有结构化规范，清理保留内容 → 写回修剪后的内容。
- 路径不在清单中 → 对 uninstall 不可见。

推论：当添加一个发出结构化配置文件的新平台/模板时，**你必须**（a）将路径添加到 `.template-hashes.json`（通过 `collectPlatformTemplates` 自动发生）并（b）向 `buildStructuredFileSpecs` 添加一个 `StructuredFileSpec` 行。忘记（b）意味着 uninstall 将直接 unlink 配置文件并带走任何用户添加的相邻内容。

---

## 常见陷阱

### 1. 不支持「按平台卸载」

没有 `--platform claude-code` 标志。原因：清单不按平台分区 — 它是一个扁平的 `Record<posixPath, sha256>`。推断「此条目属于 Claude Code」意味着前缀匹配 `.claude/`，这是脆弱的（`.agents/skills/` 由 Codex 和 Pi 共享；`.github/copilot/` 不在平台名称模式之外）。

如果用户想要只移除一个平台的文件，路径是在编辑 `config.yaml` 的平台列表后运行 `trellis update` — 该流程知道如何干净地取消平台配置。`uninstall` 是一次性完全移除。

### 2. 添加没有清理器的新结构化配置文件

**症状**：用户运行 `uninstall`，发现他们在 `.newplatform/settings.json` 中的自定义键消失了 — 整个文件被 unlink 了，因为计划器没有该文件的 `StructuredFileSpec`。

**原因**：清单跟踪该文件（好 — 计划器看到了它），但 `buildStructuredFileSpecs` 缺少该文件的一行，因此计划器进入「plain deletion」分支。

**修复**：在添加新平台的清单跟踪结构化配置时，始终同时添加一个 `StructuredFileSpec` 行。配套的清理器放在 `utils/uninstall-scrubbers.ts` 中 — 参见 `uninstall-scrubbers.md` 获取契约。

### 3. 忘记 `cleanupEmptyDirs` 不会触碰根目录

**症状**：卸载后，`.cursor/` 为空但仍然存在。

**原因**：`cleanupEmptyDirs`（与 `update.ts` 共享）拒绝移除 `ALL_MANAGED_DIRS` 中的任何内容，因为在 `update` 期间这些目录必须持久化。`executePlan` 的阶段 5 是回去修剪它们的仅卸载修复。

**修复**：这已经被正确处理。如果你修改阶段 5（例如，添加例外），请确保保持最深层优先排序 — 否则嵌套的管理目录（`.agents/skills`）会泄露。

### 4. 手动编辑后的清单漂移

**症状**：用户手动删除了某些 Trellis 文件，然后运行 `uninstall`。计划显示这些文件的「skipped N entries」（它们在磁盘上缺失），但不相关的结构化配置阶段仍然正确处理。

**原因**：按设计工作。计划器为任何已消失的清单列出文件记录 `missing: true`，然后在执行期间跳过它。

**注意**：没有「manifest is stale, please run `update` first」警告 — uninstall 是用户的紧急出口，不应要求任何事先干预。

### 5. Codex `[features] hooks = true` 在卸载后仍存在

**症状**：用户卸载了 Trellis，但 `~/.codex/config.toml` 仍然有 `[features]\nhooks = true`。

**原因**：该标志在**用户级** Codex 配置中，不是项目本地的。Trellis 从未写入它（README + 项目 `.codex/config.toml` 注释块指示用户手动添加它）。因此 `uninstall` 不删除它。

**修复**：将来在文档中说明 — 如果 Codex 是已配置的平台之一，在绿色摘要后添加一条关闭提醒。目前是静默的。

### 6. Hooks-JSON command-string 匹配是结构化的，不是子串

Hooks-JSON 清理器匹配每个 `command` 的**尾随空白分隔的 token**，而不是任意子串。一个用户定义的 hook，其主体仅回显已删除路径（`echo "see .claude/hooks/session-start.py"`）不会被移除 — 其尾随 token 是 `inspiration"`，而不是清单路径。这是正确的行为；参见 `uninstall-scrubbers.md` 获取完整匹配契约。

如果你需要扩展清理器以匹配不同的命令形状（例如，带引号的路径、`--script=path` 标志），同时更新 `uninstall-scrubbers.ts` 和 `test/utils/uninstall-scrubbers.test.ts` 中的 hooks-JSON 测试 — `uninstall.ts` 本身不需要更改。

---

## 测试约定

测试位于 `packages/cli/test/commands/uninstall.integration.test.ts`。文件模式：每个测试在新鲜 tmpdir 中运行 `init({ ..., force: true })` 以设置真实的 Trellis 安装，然后通过 `uninstall()` 执行一条路径。

参考案例（编号 = 文件中的测试 ID）：

| # | 场景 | 它锁定的内容 |
|---|---|---|
| 1 | `.trellis/` 缺失 | 友好空操作退出，无错误。 |
| 2 | `.trellis/` 存在，清单缺失 | 错误退出（手动清理提示）。 |
| 3 | `init claude+cursor → uninstall` | 之后项目是字节干净的。 |
| 4 | `--dry-run` | 无文件系统变更。 |
| 5 | 提示 `n` | 中止且不变更。 |
| 6 | 用户修改的清单文件仍被移除 | 清单成员资格胜过修改状态。 |
| 7 | 管理目录中的用户添加文件存活 | 清单是范围边界。 |
| 8 | `.claude/settings.json` 带有额外用户字段 | 清理器保留用户字段，剥离 Trellis hooks。 |
| 8a | 空管理目录已修剪（Kilo 案例，无结构化配置） | 阶段 4+5 清理。 |
| 8b | 清理后剩余内容时平台根目录存活 | 阶段 5 仅修剪空根目录。 |

添加新的结构化配置平台时：

1. 向分发表添加一行。
2. 在 `test/utils/uninstall-scrubbers.test.ts` 中为清理器本身编写单元测试。
3. 在此文件中添加一个镜像 `#8` 的集成测试 — init 该平台，将一些用户拥有的字段写入结构化配置，uninstall，断言用户字段存活且 Trellis 字段消失。

对这些测试**不要** mock `fs`；它们都使用真实的 tmpdirs。模式是：`beforeEach` 创建一个 tmpdir 并 `chdir` 进入，`afterEach` 恢复 `cwd` 并 `rmSync` 该 tmpdir。这能发现 Windows 路径 bug、权限问题和 mock fs 会隐藏的非预期副作用。

---

## 参考符号

| 符号 | 位置 |
|---|---|
| `uninstall` | `commands/uninstall.ts:uninstall` |
| `UninstallOptions` | `commands/uninstall.ts:UninstallOptions` |
| `buildStructuredFileSpecs` | `commands/uninstall.ts:buildStructuredFileSpecs` |
| `buildPlan` | `commands/uninstall.ts:buildPlan` |
| `renderPlan` | `commands/uninstall.ts:renderPlan` |
| `promptContinue` | `commands/uninstall.ts:promptContinue` |
| `executePlan` | `commands/uninstall.ts:executePlan` |
| `StructuredFileSpec` | `commands/uninstall.ts:StructuredFileSpec` |
| `PlannedDeletion` / `PlannedModification` / `UninstallPlan` | `commands/uninstall.ts` |
| `loadHashes` | `utils/template-hash.ts:loadHashes` |
| `cleanupEmptyDirs` | `commands/update.ts:cleanupEmptyDirs`（重新导出） |
| `ALL_MANAGED_DIRS` / `isManagedRootDir` | `configurators/index.ts` |
| `DIR_NAMES.WORKFLOW` | `constants/paths.ts:DIR_NAMES` |
| 清理器（`scrubHooksJson`, `scrubOpencodePackageJson`, `scrubPiSettings`, `scrubCodexConfigToml`） | `utils/uninstall-scrubbers.ts` — 参见 `uninstall-scrubbers.md` |
