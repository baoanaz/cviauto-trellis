# `trellis update` 命令

`trellis update` 如何将用户项目的捆绑 Trellis 资产（Python 脚本、workflow.md、AGENTS.md、平台配置）从 `.trellis/.version` 中记录的版本升级到已安装 CLI 的版本。

本规范涵盖命令管道、标志、交互式接口以及 update 编排的子系统。清单机制 — schema 字段、迁移类型、哈希门控语义 — 位于 `migrations.md`。本文档引用该文档而不是重复它。

---

## 概述

面向用户的契约：

- 输入：包含 `.trellis/` 的项目目录、PATH 上的 CLI 二进制文件。
- 输出：磁盘上的捆绑模板匹配 CLI 版本；`.trellis/.version` 已推进；修改过的文件被保留或备份；当 `--migrate` 时重命名/删除的文件被迁移；通过哈希验证的 `safe-file-delete` 清理了遗留弃用文件；当升级跨越带有 `migrationGuide` 的破坏性版本时创建后续迁移任务。
- 副作用：`.trellis/.backup-<timestamp>/` 处的快照备份、`.trellis/.template-hashes.json` 被重写、可选的 `.trellis/tasks/<MM-DD>-migrate-to-<version>/` 任务树。

两个大的不变量：

1. **幂等**：成功运行后立即重新运行 `trellis update` 打印 `✓ Already up to date!` 并不写入任何内容。如果你在干净重新运行上看到自动更新反复变化，原因几乎总是 `collectTemplateFiles` 中未解析的占位符（参见常见陷阱）。
2. **用户编辑永不静默覆盖**。Trellis 管理模板之外的任何内容都在 `PROTECTED_PATHS` 中；任何其哈希与记录值不同的模板内容落入冲突提示或 `--force` / `--skip-all` / `--create-new` 策略。

---

## 命令入口

通过 Commander 在 `cli/index.ts` 中连接：

```text
trellis update
  [--dry-run]            仅预览
  [-f, --force]          覆盖所有已更改的文件；同时绕过最终的 "Proceed?" 确认并强制修改过的迁移
  [-s, --skip-all]       跳过所有已更改的文件；同时在 --migrate 下自动跳过修改过的迁移
  [-n, --create-new]     为已更改的文件写入 `.new` 副本
  [--allow-downgrade]    允许 CLI < 项目版本
  [--migrate]            应用待处理的文件迁移（重命名/删除）
```

`cli/index.ts` 中的动作处理程序构造 `UpdateOptions` 并调用 `commands/update.ts:update`。今天没有环境变量覆盖接口 — 标志是唯一的旋钮。（注意：`commands/update.ts:update` 中的 `setupProxy()` 为 npm 版本检查读取 `HTTP_PROXY` / `HTTPS_PROXY`，但那是唯一的环境变量输入。）

`UpdateOptions` 是公共接口：

```typescript
interface UpdateOptions {
  dryRun?: boolean;
  force?: boolean;
  skipAll?: boolean;
  createNew?: boolean;
  allowDowngrade?: boolean;
  migrate?: boolean;
}
```

注意 `force` / `skipAll` / `createNew` 在精神上是互斥的，但代码不强制互斥。它们在 `commands/update.ts:promptConflictResolution` 中按优先级顺序检查。`force` 也兼作「non-interactive」— 它跳过 `commands/update.ts:update` 中的全局 `Proceed?` 确认。

---

## 更新计划编写（Update Plan Composition）

### 1. 收集捆绑模板

`commands/update.ts:collectTemplateFiles` 是产生「磁盘上应该是什么」快照的唯一位置。来源，按顺序：

| 来源 | 字节来自哪里 |
|---|---|
| `.trellis/scripts/` 下的 Python 脚本 | `templates/trellis/index.ts:getAllScripts` |
| `.trellis/config.yaml` | `templates/trellis/index.ts:configYamlTemplate` |
| `.trellis/.gitignore` | `templates/trellis/index.ts:gitignoreTemplate` |
| `.trellis/workflow.md` | `templates/trellis/index.ts:workflowMdTemplate`（整文件哈希门控，见下文） |
| 根 `AGENTS.md` | `commands/update.ts:buildAgentsMdTemplate`（管理块合并） |
| 每个平台的文件 | 通过 `configurators/index.ts:getConfiguredPlatforms` 检测到的每个平台的 `configurators/index.ts:collectPlatformTemplates` |
| `.claude/settings.json` `statusLine` | 通过 `commands/update.ts:preserveExistingClaudeStatusLine` 保留 |

平台通过 `cwd` 中的目录存在性自动发现。有一个例外：如果 `commands/update.ts:needsCodexUpgrade` 返回 true（遗留 Trellis 跟踪了 `.agents/skills/` 但尚未存在 `.codex/`），则 `commands/update.ts:update` 传递 `extraPlatforms: new Set(["codex"])` 以强制 Codex 模板收集，以便升级可以创建 `.codex/`。

收集后，`collectTemplateFiles` 运行两个最终遍历：

1. `update.skip` 过滤，通过 `commands/update.ts:loadUpdateSkipPaths` — 删除匹配 `.trellis/config.yaml` 中 `update.skip` 列表的路径。当更新是带有 `recommendMigrate` 的破坏性版本时**被绕过**（`breakingBypass`）；参见「迁移触发器语义」。
2. 对每个值应用 `configurators/shared.ts:replacePythonCommandLiterals`，以便 init 时和 update 时的字节在同一操作系统上字节相同。这是保持幂等性工作的关键步骤 — 参见常见陷阱。

### 2. 整文件 workflow.md 更新和 AGENTS.md 管理块合并

这两个面向运行时的文件有不同的更新契约：

- **`.trellis/workflow.md`** 保持在正常的整文件模板路径上。`collectTemplateFiles` 插入捆绑的 `workflowMdTemplate`；`analyzeChanges` 通过将当前文件哈希与 `.trellis/.template-hashes.json` 比较来决定是自动更新、提示、跳过还是创建 `.new`。不要仅部分合并 `[workflow-state:*]` 块。
- **`AGENTS.md`**（`commands/update.ts:buildAgentsMdTemplate`）仅通过 `commands/update.ts:replaceTrellisManagedBlock` 合并 `<!-- TRELLIS:START -->`…`<!-- TRELLIS:END -->` 区域；如果不存在标记，则追加模板管理块。遗留未跟踪哈希白名单 `LEGACY_UNTRACKED_AGENTS_MD_BLOCK_HASHES` 允许原始的 pre-tracking AGENTS.md 在没有「modified by you」假阳性的情况下自动更新（参见 `commands/update.ts:isKnownUntrackedTemplate`）。

为什么 workflow 是整文件的：`.trellis/workflow.md` 由 `get_context.py`、`workflow_phase.py`、SessionStart 剥离器和每回合 workflow-state hooks 解析。运行时重要的标题和平台标记存在于 `[workflow-state:*]` 块之外。仅更新标签块可能使面包屑变得最新，但留下过时的阶段或平台路由部分。

通过 `trellis workflow --template` 或 `trellis init --workflow` 选择的非原生 workflow 变体被有意从 `.trellis/.template-hashes.json` 中移除。这使得 `trellis update` 将文件分类为用户管理而不是自动更新回捆绑的原生 workflow。

### 3. 分析磁盘状态

`commands/update.ts:analyzeChanges` 遍历模板映射中的每个条目并产生一个 `ChangeAnalysis`：

| 桶 | 条件 |
|---|---|
| `newFiles` | 模板有；磁盘无；无存储哈希 |
| `userDeletedFiles` | 模板有；磁盘无；**存储哈希存在** → 尊重删除，不重新添加 |
| `unchangedFiles` | 磁盘内容 === 模板内容 |
| `autoUpdateFiles` | 磁盘与模板不同；存储哈希匹配当前内容（或已知未跟踪的 AGENTS.md）→ 用户未编辑；安全写入 |
| `changedFiles` | 磁盘与模板不同；存储哈希缺失或过时 → 用户已编辑；需要决策 |

此分桶是打印计划和写入阶段的基础。

---

## 标志语义

### `--dry-run`

运行完整管道直到并包括打印计划和破坏性变更横幅，然后在 `Proceed?` 确认之前返回。无文件写入，无备份，无版本提升。与 `--migrate` 安全组合：`commands/update.ts:update` 允许打印迁移计划但停止在 `executeMigrations` 运行之前。参见 `update.integration.test.ts > #2 dry run makes no file changes even when changes exist` 和 `> #23 breaking-change gate allows --dry-run without --migrate`。

### `--force` / `-f`

三个含义，全在这个单独的标志中：

1. **冲突解决**（`commands/update.ts:promptConflictResolution`）：对于 `changedFiles` 中的每个条目，选择 `overwrite` 而不询问。
2. **迁移模式**（`commands/update.ts:executeMigrations`）：对于每个 `confirm` 桶迁移，视为 `rename`/`delete`（无内联 `.backup`）。`.trellis/.backup-<timestamp>/` 下的完整快照是此模式中唯一的安全网 — 参见 `update.integration.test.ts > #26 rename-anyway does NOT leave an inline .backup`。
3. **最终确认**（`commands/update.ts:update`）：跳过全局 `Proceed?` 提示。这使得 `trellis update --force --migrate` 对 CI / 脚本化升级可行。

### `--skip-all` / `-s`

`--force` 的镜像，用于「保留我的编辑」意图：`changedFiles` 被跳过；修改过的 `confirm` 迁移被跳过（你会在下次更新时看到它们被标记，直到手动清理）。也跳过最终确认。

### `--create-new` / `-n`

仅对已更改的文件 — 在原始文件旁边写入 `<path>.new`。迁移不受影响。`update()` 末尾的提示行提醒用户手动合并 `.new` 文件。

### `--allow-downgrade`

允许 `cliVersion < projectVersion`。没有它，`update()` 提前退出并显示帮助消息。有了它，警告仍然打印，然后管道像升级一样运行。两个版本之间的迁移不是「反向应用」— `getMigrationsForVersion` 始终走 低→高（参见 `migrations.md`），因此带有文件更改的降级是尽力的，用户必须手动清理。降级时不生成迁移任务。

### `--migrate`

选择应用文件迁移（重命名/删除/目录重命名）。没有它：迁移在计划中列出但不执行；打印「Tip: Use --migrate」提示。有了它：

1. `commands/update.ts:executeMigrations` 在分类计划上运行。
2. `update()` 中的硬编码 0.2.0 `traces-*.md → journal-*.md` 重命名运行（workspace/<dev>/ 模式遍历；不能存在于清单中，因为路径包含变量开发者 slug）。

`safe-file-delete` 迁移独立于 `--migrate` — 当它们的哈希门控通过时它们总是运行（参见应用阶段）。`migrations.md` 中的理由。

### 标签标志（`--tag <beta|rc|latest>`）

目前 `trellis update` 上没有 `--tag` 标志。版本选择是隐式的：`update()` 始终使用已安装 CLI 的版本（`constants/version.ts:VERSION`）。想要特定 CLI 通道的用户应先运行 `trellis upgrade --tag beta`（或 `latest` / `rc`），然后运行 `trellis update`。`commands/update.ts:getLatestNpmVersion` 中的 npm 版本检查仅查看 `latest` dist-tag，纯粹是咨询性的（「⚠️ Your CLI is behind npm」）。

---

## 迁移触发器语义

### 待处理迁移

`commands/update.ts:update` 调用 `migrations/index.ts:getMigrationsForVersion(projectVersion, cliVersion)` 获取迁移集，然后合并**孤儿迁移** — 源仍然存在而目标不存在的条目，无论版本范围如何。当先前的更新提升了 `.trellis/.version` 但某个迁移被跳过或中断时，孤儿会出现；它们被添加到 `pendingMigrations` 以便下次 `--migrate` 清理它们。

迁移状态然后通过 `commands/update.ts:classifyMigrations` 针对当前哈希和模板运行：

| 类别 | 触发器 |
|---|---|
| `auto` | 源未修改，目标空闲或匹配模板 |
| `confirm` | 源被用户修改（哈希不匹配） |
| `conflict` | 源和目标都存在且有用户内容 |
| `skip` | 源缺失，或路径是 `PROTECTED_PATHS` |

执行前的排序通过 `commands/update.ts:sortMigrationsForExecution`：更深层的 `rename-dir` 优先，然后是其他 `rename-dir`，然后是 `rename` / `delete`。对嵌套目录重命名至关重要 — 没有深度排序，父级移动将使子条目指向已死的源。

### 破坏性变更门控（The breaking-change gate）

这是防止跨主版本意外半迁移的安全机制。在 `commands/update.ts:update` 中，`classifyMigrations` 之后：

```text
if (pendingMigrationCount > 0
    && !options.migrate
    && !options.dryRun
    && cliVsProject > 0
    && projectVersion !== "unknown"
    && metadata.breaking
    && metadata.recommendMigrate)
  → process.exit(1)
```

为什么硬失败：替代路径在成功时静默提升 `.trellis/.version`，将弃用文件永远留在新架构旁边作为孤儿。用户在很久以后才收到信号，当 `update` 在每次发布时重新标记相同的孤儿列表。

硬失败条件，所有这些都必须为 true：

- 存在真正的迁移工作待处理（排除 `safe-file-delete`）
- 未传递 `--migrate`
- 未传递 `--dry-run`（预览始终允许）
- 升级是真正的升级（不是同版本，不是降级）
- 版本范围跨越至少一个同时具有 `breaking: true` **且** `recommendMigrate: true` 的清单

在 `update.integration.test.ts > #22 breaking-change gate exits 1 when --migrate is missing`、`> #23 ... allows --dry-run`、`> #24 ... allows --migrate to proceed` 中测试。

### `breakingBypass` 对 `update.skip`

当破坏性变更门控触发且 `--migrate` 已设置时，`commands/update.ts:update` 计算 `breakingBypass = true` 并将其线程化到 `collectTemplateFiles` 和 `collectSafeFileDeletes` 中。该绕过导致 `update.skip` 对新模板写入**和** `safe-file-delete` 清理都被忽略。

理由：在破坏性升级期间遵守 `update.skip` 会使项目永久处于半迁移状态 — 旧的弃用文件在受跳过的路径下持续存在，而新命令永远不会落地。`safe-file-delete.allowed_hashes` 中的哈希检查仍然是安全网（用户自定义文件仍然以「skip-modified」理由跳过）。用户对非弃用文件的自定义在写入时仍然由每个文件的冲突提示守卫。

---

## 应用阶段（Apply Phase）

`commands/update.ts:update` 中的操作顺序（在 `Proceed?` 确认之后，非 dry-run 时）：

1. **备份** — `commands/update.ts:createFullBackup` 将每个 `BACKUP_DIRS`（= `configurators/index.ts:ALL_MANAGED_DIRS`）条目加上 `BACKUP_FILES`（= `AGENTS.md`）快照到 `.trellis/.backup-<ISO-timestamp>/` 中。`commands/update.ts:shouldExcludeFromBackup` 过滤掉之前的备份、`node_modules/`、用户数据目录（`workspace/`、`tasks/`、`spec/`、`backlog/`、`agent-traces/`）和平台原生工作树目录（`/worktrees/`、`/worktree/`）。`commands/update.ts:collectAllFiles` 中从不跟随符号链接（和 Windows 目录 junction）— 指向祖先的 junction 会无限循环。

2. **迁移**（仅当 `--migrate`）— `commands/update.ts:executeMigrations` 首先运行 `auto` 项（按深度排序），然后通过 `commands/update.ts:promptMigrationAction` 运行 `confirm` 项（或 `--force` / `--skip-all` 短路）。提示的默认操作是 `backup-rename`：在重命名旁边留下用户修改内容的 `<new-path>.backup`，以便用户可以在不深入快照的情况下内联 diff。哈希跟踪通过 `utils/template-hash.ts:renameHash` / `removeHash` 更新。空源目录由 `commands/update.ts:cleanupEmptyDirs` 修剪（由 `configurators/index.ts:isManagedPath` + `isManagedRootDir` 门控 — 永不删除管理根目录本身，永不跨越到非管理路径）。常规迁移之后，运行硬编码的 `traces-*.md → journal-*.md` workspace 遍历。

3. **`safe-file-delete`** — `commands/update.ts:executeSafeFileDeletes` 删除 `delete` 操作桶中的文件（哈希匹配，未受保护，不在 `update.skip` 中，除非被绕过），移除它们的哈希条目，并修剪空父目录。`migrations.md` 涵盖了完整分类矩阵。

4. **新文件写入** — 直接 `mkdir -p` + `writeFileSync`。`.sh` 和 `.py` 获得 `chmod 755`。

5. **自动更新写入** — 与新文件相同，但文件已存在。

6. **冲突解决** — 对于每个 `changedFiles` 条目，调用 `commands/update.ts:promptConflictResolution`。`applyToAll` 载体对象捕获 `[a]` / `[s]` / `[n]`「Apply to all」选择，以便用户只需对一批类似提示决定一次。结果可以是 `overwrite`（写入 + chmod）、`skip`（空操作）或 `create-new`（写入 `<path>.new`）。

7. **`configSectionsAdded`** — 仅在真正的升级上（`cliVsProject > 0`，`projectVersion !== "unknown"`）。`commands/update.ts:applyConfigSectionsAdded` 遍历来自 `migrations/index.ts:getConfigSectionsAddedBetween` 的条目，按 `file::sentinel` 去重，跳过其 sentinel 已在用户文件中的任何条目（幂等），并追加通过 `commands/update.ts:extractConfigSection` 提取的命名 section。这是唯一可以在不经过冲突提示的情况下增长 `.trellis/config.yaml` 的路径 — 按设计，因为用户通常编辑 `config.yaml` 的其他部分（`session_commit_message`、`packages` 等），哈希不匹配覆盖要么丢失这些编辑（`y`）要么使项目缺少新 section（`n`）。参见 `migrations.md` § `configSectionsAdded` 获取 schema。

8. **版本戳** — `commands/update.ts:updateVersionFile` 将 `cliVersion` 写入 `.trellis/.version`。

9. **哈希刷新** — 每个新写入的文件（`newFiles`、`autoUpdateFiles`、覆盖的 `changedFiles`，加上来自 `collectMissingAgentsMdHash` 的任何 `missingAgentsMdHash` 条目）通过 `utils/template-hash.ts:updateHashes` 重新计算并保存其哈希。`.new` 副本和跳过的文件**不**更新其哈希 — 原始文件的记录哈希继续驱动下次更新冲突决策。

10. **迁移任务创建** — 仅当升级跨越带有 `breaking: true` AND 非空 `migrationGuide` 的清单时（通过 `migrations/index.ts:getMigrationMetadata` 收集）。`update()` 写入 `.trellis/tasks/<MM-DD>-migrate-to-<cliVersion>/`，包含 `task.json`（通过 `utils/task-json.ts:emptyTaskJson` 构建）和 `prd.md` 列出每个 guide 和 AI 指令块。如果目录已存在则跳过。Assignee 通过严格的正则 `name=<value>` 从 `.trellis/.developer` 读取 — 不要将其更改为原始 `.trim()`（参见常见陷阱）。

11. **运行结束横幅** — 破坏性变更横幅和 `--migrate` 建议被有意最后打印，以避免在长更新中滚出屏幕。

---

## 哈希与幂等性

`.trellis/.template-hashes.json` 是使 `analyzeChanges` 工作的契约。Schema 和辅助函数位于 `utils/template-hash.ts`。Update 通过以下方式与之交互：

- `update()` 顶部的 `loadHashes(cwd)`
- 用于内联检查的 `computeHash(content)`（`isKnownUntrackedTemplate`、`safe-file-delete` 匹配）
- `classifyMigrations` 中的 `isTemplateModified(cwd, path, hashes)`
- 迁移期间的 `renameHash` / `removeHash`
- 末尾的 `updateHashes(cwd, files)`

`migrations.md` 文档化了与 `safe-file-delete` 迁移中 `allowed_hashes` 的关系：哈希文件跟踪「Trellis 安装的字节」（以便 update 可以检测用户编辑）；`allowed_hashes` 是清单祝福用于自动删除的「已知原始字节」的有界集合。它们是不同的集合 — 用户文件可能具有记录的哈希但不具备 `allowed_hashes` 资格。

幂等性不变量（「在干净仓库上重新运行 update 不写入任何内容」）依赖于三项清洁工作：

1. **`collectTemplateFiles` 以与 init 相同的方式解析所有占位符。**最常见的 bug 是忘记在配置器的 `collectTemplates` lambda 内将新占位符通过 `configurators/shared.ts:replacePythonCommandLiterals`（或每个平台的 `resolvePlaceholders`）管道化。Init 写入已解析的字节；update 收集未解析的模板；每次运行哈希不匹配。参见 `platform-integration.md > Common Mistakes > "Template placeholder not resolved in collectTemplates"`。
2. **Init 和 update 对存在哪些文件达成一致。**`collectTemplateFiles` 列出的任何内容也必须由 `init` 创建，否则 update 在每次运行时会自动添加它。参见 `platform-integration.md > Common Mistakes > "Template listed in update but not created by init"`。
3. **运行时模板是字节稳定的。**`workflowMdTemplate` 和 `buildAgentsMdTemplate` 在给定相同输入时跨运行应返回相同内容。CLI 通过 `update.integration.test.ts > #1 same version update is a true no-op`（之前/之后的完整快照）测试这一点。

---

## 与 `init` 的边界

Update 和 init 共享相同的模板生产者：

| 辅助函数 | 生产者 |
|---|---|
| 收集平台文件 | `configurators/index.ts:collectPlatformTemplates`（init 通过 `configurePlatform` 写出它们；update 通过 `PLATFORM_FUNCTIONS` 中的并行 `collectTemplates` lambda 收集它们） |
| 检测平台 | `configurators/index.ts:getConfiguredPlatforms` |
| 备份根目录 | `configurators/index.ts:ALL_MANAGED_DIRS`（也是 update 中 `BACKUP_DIRS` 的来源） |
| 空目录清理门控 | `configurators/index.ts:isManagedPath` / `isManagedRootDir` |
| Python 脚本捆绑 | `templates/trellis/index.ts:getAllScripts` |
| Init 哈希播种 | `utils/template-hash.ts:initializeHashes`（init）；update 通过 `updateHashes` 保持其新鲜 |

Update 独有的内容：

- 捆绑原生 `workflow.md` 的整文件哈希门控更新；非原生 workflow 通过移除 workflow 哈希条目成为用户管理的。
- `AGENTS.md` 的管理块合并（init 直接写入捆绑模板）。
- `.trellis/.backup-<timestamp>/` 处的快照备份。
- 迁移计划 + 执行。
- `configSectionsAdded` 追加路径。
- npm 版本咨询检查（init 目前没有远程检查）。
- 迁移任务生成。

Init 没有「之前这里有什么」的概念 — 它始终假定干净的状态，并由 `--force` / `--skip-existing` 门控。Update 是唯一通过哈希推理先前状态的命令。

---

## 与 `migrations.md` 的边界

`migrations.md` 是以下内容的规范参考：清单 schema（所有字段包括 `breaking` / `recommendMigrate` / `migrationGuide` / `aiInstructions` / `configSectionsAdded`）、迁移类型（`rename` / `rename-dir` / `delete` / `safe-file-delete`）、每种类型的分类规则、哈希关系（`allowed_hashes` vs `.template-hashes.json`）、`update.skip` 配置、受保护路径和遍历表辅助函数（`getMigrationsForVersion` / `getAllMigrations` / `getMigrationMetadata` / `getConfigSectionsAddedBetween`）。

本文档不重复这些内容中的任何一个。扩展 update 行为时，决定你的更改位于线的哪一侧：

- 新清单字段 → `migrations.md`，加上 `update.ts` 中的消费者连接。
- 新 CLI 标志、新交互式提示、新写入阶段、新横幅 → 这里。
- 新迁移*类型* → 两者：在 `migrations.md` 中定义类型和分类，在 `update.ts:executeMigrations` 中定义执行器。

---

## 常见陷阱

### 多版本跳跃链（v0.4 → v0.5+）

`getMigrationsForVersion(from, to)` 遍历 `manifest.version` 严格高于 `from` 且 ≤ `to` 的每个清单。从 v0.4 到 v0.5.6 的跳跃按版本顺序应用来自 0.4.x.y、0.5.0.0、0.5.1、…、0.5.6 的迁移。如果这些清单中有任何是 `breaking` + `recommendMigrate: true`，破坏性门控对整个跳跃触发一次。后果：推迟了多个版本升级的用户在没有 `--migrate` 时看到单个硬失败，但迁移列表可能非常长。在大跳跃上运行 `--migrate` 之前先用 `--dry-run` 测试。

### Breaking + recommendMigrate 必须发布 `migrationGuide`

`migrations.md` 文档化了这一点：具有 `breaking: true` AND `recommendMigrate: true` 的清单必须也定义 `migrationGuide`（并且按惯例 `aiInstructions`）。update.ts 关心的原因是迁移任务生成器：`getMigrationMetadata` 聚合跳跃中每个清单的 `migrationGuides`；如果破坏性清单缺少它，用户要么得到（a）一个全是旧 guides 且没有提及实际破坏性版本的 task PRD，要么（b）如果范围内每个 guide 都缺失，则根本没有 task。历史事件：0.5.0-beta.0 发布时没有 `migrationGuide`，并在 0.5.0-beta.9 中被热修复。`packages/cli/scripts/create-manifest.js` `--stdin` 模式现在在清单编写时对此组合硬失败。

### 孤儿迁移

如果 `.trellis/.version` 说你已经在最新 CLI 上，但过时的 `from` 路径仍然在磁盘上存在而新 `to` 不存在，那就是孤儿。`update()` 始终扫描 `getAllMigrations()` 查找孤儿，无论版本范围如何，并将它们添加到 `pendingMigrations`。它们在打印计划中显示为「⚠️ Detected incomplete migrations from previous updates」。原因：先前的运行在 `migrations` 执行和 `updateVersionFile` 之间中断；先前的运行通过 `[s]` 跳过了迁移，用户期望它之后应用；清单编写错误（一个引用在 v0.4 发布之前就已移动的路径的 v0.4 条目）。三者都以相同方式解决：`trellis update --migrate`。

### 备份膨胀

每个非平凡运行创建 `.trellis/.backup-<timestamp>/`。`BACKUP_EXCLUDE_PATTERNS` 阻止用户数据树和平台工作树进入，但快照仍然包括每个平台目录中的每个管理配置文件。配置了 8 个以上平台的超级用户在几个月内可能积累数百 MB 的备份。目前没有自动修剪 — Trellis 将备份视为用户数据（「清理由你决定」）。如果你添加自动修剪，它必须是可选择的，并且不得删除比上次成功版本转换更新的备份（否则调试回滚路径消失）。

### 管理目录下的 `node_modules/`

OpenCode 的插件模式在 `.opencode/` 下安装 npm 依赖。没有 `/node_modules/` 在 `BACKUP_EXCLUDE_PATTERNS` 中，每个备份都会快照整个依赖树（`update.integration.test.ts > #27 backup skips managed node_modules dependency trees` 回归测试了这一点）。添加一个包含依赖的新平台时，验证模式仍然捕获它们；如果平台使用非标准路径，扩展 `BACKUP_EXCLUDE_PATTERNS`。

### `.developer` raw-trim 陷阱

`init_developer.py` 将 `.trellis/.developer` 写为 `key=value` 行：

```text
name=<developer-name>
initialized_at=<iso8601>
```

使用 `fs.readFileSync(...).trim()` 读取文件并使用结果作为 `assignee` 会将 `name=` 前缀和 `initialized_at` 行嵌入到任务中。`commands/update.ts:update` 末尾的迁移任务创建器正是出于这个原因使用严格的正则 `/^\s*name\s*=\s*(.+?)\s*$/m`。不要「简化」它。

### 添加占位符后的幂等性反复变化

症状：每次 `trellis update` 显示相同的 hooks/settings 文件为自动更新。根本原因：配置器的 `configure()` 在写入前解析占位符，但 `collectTemplates` 返回未解析的模板。修复：每个占位符必须在两处都解析。最清晰的模式是在 `configurators/<platform>.ts` 的两个代码路径内共享一个 `resolvePlaceholders(...)` 调用。参见 `platform-integration.md > Common Mistakes > "Template placeholder not resolved in collectTemplates"`。

### 用户从未触碰的文件上的「Modified by you」

这里有两种失败模式：

1. 文件是在该路径存在哈希跟踪之前写入的（遗留安装）。AGENTS.md 的解决方案是 `LEGACY_UNTRACKED_AGENTS_MD_BLOCK_HASHES`。为其他路径添加相同的逃生舱是可以接受的，但应是最后的手段 — 正确的修复是回填哈希。
2. 两个写入器为相同路径产生了字节不同的内容。典型案例：`.agents/skills/<skill>/SKILL.md` 由 Codex 和 Gemini 配置器写入，带有平台特定的 `{{CMD_REF:name}}` 解析。修复：对共享目标使用 `configurators/shared.ts:resolvePlaceholdersNeutral`。参见 `platform-integration.md > "Rule: .agents/skills/ writes use resolvePlaceholdersNeutral()"`。

### `--allow-downgrade` 是陷阱

迁移是仅向前 的。降级同时保持在相同主版本上的用户通常可以侥幸成功（模板恢复，用户文件保留），但任何依赖于自目标版本以来已应用迁移的内容（例如，重命名的目录、在其新名称下恢复的已删除遗留文件）都会损坏。`--allow-downgrade` 确实是一个逃生舱，而不是受支持的工作流。

### Codex 双层升级

旧 Trellis 使用 `.agents/skills/` 作为 Codex configDir；当前 Trellis 使用 `.codex/` 加上共享的 `.agents/skills/` 层。`commands/update.ts:needsCodexUpgrade` 通过查找哈希文件中的命令即技能 标记条目（`trellis-continue/SKILL.md`、`trellis-finish-work/SKILL.md`）来检测遗留状态，然后排除其当前模板收集器声明这些相同标记路径的任何已配置非 Codex 平台。具有私有命令接口的当前非 Codex 平台，例如 ZCode，不得在 `.agents/skills` 下声明这些标记路径；这使组合安装不产生哈希反复变化，并使 Codex 遗留检测器保持无歧义。当检测到遗留 Codex 时，`update()` 将 `codex` 注入 `extraPlatforms`，以便 `collectTemplateFiles` 产生缺失的 `.codex/` 文件。不要在没有类似紧密标记和非所有者排除的情况下为任何其他情况添加基于哈希的平台检测 — 这里的假阳性会创建虚假目录。

### 看起来像 bug 但不是 bug 的事情

- `Proceed?` 提示即使在唯一的「变更」是版本提升时也要求确认。其中一些情况在提示前短路（无文件更改、无迁移、无 safe-deletes — 参见 `analyzeChanges` 后的提前返回）；其他情况合法地有值得确认的更改。
- `getLatestNpmVersion` 失败（「unable to fetch」）在 npm 端是静默的，并打印一条灰色行。代理设置在 `commands/update.ts:update` 中通过 `utils/proxy.ts:setupProxy` 发生；在未设置 `HTTP_PROXY` / `HTTPS_PROXY` 的情况下位于企业代理后的用户将永远看到灰色行。这是故意的 — npm 检查仅是咨询性的。

---

## 测试约定

集成测试位于 `test/commands/update.integration.test.ts`（编号案例 `#1 .. #27` 加上命名的案例如 `workflow-md-r4`）。Fixture 模式：

```typescript
beforeEach: mkdtemp + cwd-spy + console-mute + fetch-stub
setupProject(): await init({ yes: true, force: true })
test body:
  1. 变更临时项目以模拟场景（删除文件、编辑文件、交换哈希、编辑 config.yaml……）
  2. call await update({ ...flags })
  3. 断言文件系统状态和（可选）inquirer mock 状态
afterEach: restoreAllMocks + rm -rf tmp
```

外部 mock：`figlet`（横幅）、`inquirer`（提示；通常默认 `{ proceed: true }` 并为迁移操作和冲突解决提示进行每测试覆盖）、`node:child_process.execSync`（Python 检测）、`globalThis.fetch`（npm 注册表）。无文件系统或 VERSION mock — 测试依赖于真实的 CLI 版本和真实的捆绑模板。

哈希文件辅助函数 `readHashesV2` / `writeHashesV2`（在测试文件中定义）绕过 `utils/template-hash.ts` 注入精确的哈希状态。当测试的行为依赖于难以通过 `init` + edit 构造的特定已跟踪 vs 已修改条件时使用它们。

带有 `@internal Exported for testing only` JSDoc 标签导出的内部辅助函数：

- `loadUpdateSkipPaths`
- `extractConfigSection`
- `applyConfigSectionsAdded`
- `shouldExcludeFromBackup`
- `cleanupEmptyDirs`
- `sortMigrationsForExecution`

这些在 `test/commands/update-internals.test.ts` 中进行单元测试。不要为测试而扩大 `commands/update.ts` 的公共接口 — 将添加内容保留在这些 `@internal` 导出中。

扩展 update 时应测试的内容：

| 更改 | 必需测试 |
|---|---|
| 新 `UpdateOptions` 标志 | 执行该标志的新 `#NN` 集成案例 |
| 新写入阶段 | 快照式测试（完整仓库之前/之后）和哈希跟踪断言 |
| 新影响幂等性的辅助函数 | 「重新运行不产生更改」测试（模型：`#1 same version update is a true no-op`） |
| 新受保护路径或备份排除模式 | `update-internals.test.ts` 中的 `shouldExcludeFromBackup` 单元测试 |
| 新迁移类型 | 添加分类 + 执行单元测试，然后在集成套件中添加多步骤场景 |
| `workflow.md` / `AGENTS.md` 的块合并更改 | 至少一个测试断言「用户散文保留」和「管理块已更新」 |

当测试调用 `getAllMigrations()` 或 `getMigrationsForVersion` 时，它正在执行与 `migrations/index.ts` 的边界 — 保持这些断言窄（例如，「此清单的 safe-file-delete 触发」），以便它们不会在每次清单列表增长时都中断。
