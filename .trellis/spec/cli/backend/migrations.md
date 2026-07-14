# 迁移系统（Migration System）

智能迁移系统，用于处理模板文件重命名和删除。

## 目录结构

```
src/migrations/
├── index.ts              # 迁移逻辑 (动态加载 JSON)
└── manifests/
    └── {version}.json    # 各版本迁移清单
```

## 添加新版本迁移

创建 `src/migrations/manifests/{version}.json`：

```json
{
  "version": "0.2.0",
  "description": "变更说明",
  "breaking": false,
  "recommendMigrate": false,
  "changelog": "一行变更摘要",
  "migrations": [
    {
      "type": "rename",
      "from": ".claude/commands/old.md",
      "to": ".claude/commands/new.md",
      "description": "重命名原因"
    },
    {
      "type": "delete",
      "from": ".trellis/scripts/deprecated.py",
      "description": "删除原因"
    }
  ]
}
```

**无需修改任何代码** - 构建时自动复制到 dist。

### Breaking 版本必须提供 `migrationGuide` + `aiInstructions`

任何 `breaking: true` + `recommendMigrate: true` 的 manifest 必须额外附带这两个字段：

```json
{
  "version": "0.5.0-beta.0",
  "breaking": true,
  "recommendMigrate": true,
  "migrationGuide": "## 0.4.x → 0.5.x: What This Release Actually Changes\n\n0.5.0-beta.0 is a breaking release...\n\n### 1. Skills got renamed: ...\n\n### 2. Six commands retired...",
  "aiInstructions": "When helping a user migrate from 0.4.x to 0.5.x:\n\n1. Check for retired commands first...\n2. Run trellis update --migrate...",
  "migrations": [ /* ... */ ]
}
```

**强制原因**（历史事故驱动）：`update.ts` 生成 migration task 时会枚举 `fromVersion` 到 `toVersion` 之间**所有**带 `migrationGuide` 的 manifest 拼成 task PRD。如果当前 breaking release 漏写 `migrationGuide`：

- 场景 A：用户从比 current 早 N 个版本升级 → migration task PRD 里全是 N-1 / N-2 时代的老 guide，**一字不提本次 breaking**
- 场景 B：中间所有 manifest 都没 `migrationGuide` → task **根本不生成**，用户以为 update 是安全的、实际踩一脸 breaking

历史事故：**0.5.0-beta.0**（206 条 migration、真正大 breaking）manifest 漏写 `migrationGuide`，导致 0.4 → 0.5 的用户一路迁盲。`0.5.0-beta.9` hotfix 回填了这份 guide，同时在 `packages/cli/scripts/create-manifest.js` 加了强制校验（`--stdin` 模式下 `breaking && recommendMigrate && !migrationGuide` 直接 exit 1）。

**字段语义**：
- `migrationGuide` —— 面向最终用户的 narrative，被模板化塞进 `.trellis/tasks/MM-DD-migrate-to-<version>/prd.md` 的 PRD section
- `aiInstructions` —— 面向 AI 的指令：帮用户迁移时 grep 什么、check 什么、常见坑；和 `migrationGuide` 分开避免把 AI 指令和人类说明写在一起

**何时 _不_ 需要**：
- 非 breaking 版本（`breaking: false`）：不需要 `migrationGuide`
- breaking 但 `recommendMigrate: false`：罕见（「breaking 但不建议 migrate」基本不存在），真要这样跑，没校验强制。

## 迁移类型

| Type | 必填字段 | 说明 |
|------|----------|------|
| `rename` | `from`, `to` | 重命名文件 |
| `rename-dir` | `from`, `to` | 重命名目录（包含所有子文件） |
| `delete` | `from` | 删除文件 |
| `safe-file-delete` | `from`, `allowed_hashes` | Hash 校验后自动删除废弃文件（无需 `--migrate`） |

### rename-dir 示例

```json
{
  "type": "rename-dir",
  "from": ".trellis/structure",
  "to": ".trellis/spec",
  "description": "重命名 structure 为 spec"
}
```

**特点**：
- 整个目录移动（包括用户添加的文件）
- 自动批量更新 hash 追踪
- 移动后自动清理空的源目录
- 嵌套目录按深度优先处理（避免父目录先移动导致子目录找不到）

### safe-file-delete 示例

```json
{
  "type": "safe-file-delete",
  "from": ".claude/commands/trellis/before-backend-dev.md",
  "description": "Replaced by before-dev.md",
  "allowed_hashes": ["7e35444de2a5779ef39944f17f566ea21d2ed7f4994246f4cfe6ebf9a11dd3e3"]
}
```

**工作机制**：
- **无需 `--migrate`** — 在每次 `trellis update` 时自动执行
- **Hash 校验** — 只有当文件内容的 SHA256 匹配 `allowed_hashes` 中的某个值时才删除
- **版本无关** — 从所有 manifest 收集 safe-file-delete 条目，不受版本范围限制
- 删除后自动清理 hash 记录和空目录

**分类逻辑**：

| 分类 | 条件 | 行为 |
|------|------|------|
| `delete` | 文件存在，hash 匹配，非 protected，非 update.skip | 删除文件 |
| `skip-missing` | 文件不存在 | 跳过 |
| `skip-modified` | 文件存在但 hash 不匹配（用户已修改） | 保留 |
| `skip-protected` | 路径在 PROTECTED_PATHS 中 | 保留 |
| `skip-update-skip` | 路径在 config.yaml `update.skip` 中 | 保留 |

## 分类逻辑

| 分类 | 条件 | 行为 |
|------|------|------|
| `auto` | 文件未被用户修改 / rename-dir | 自动迁移 |
| `confirm` | 文件已被用户修改 | 默认询问，`-f` 强制，`-s` 跳过 |
| `conflict` | 新旧路径都存在 | 跳过并提示手动解决 |
| `skip` | 旧路径不存在 / 路径受保护 | 无需操作 |

## `configSectionsAdded`（追加式 config.yaml 节）

可选 manifest 字段，声明本版本在 `.trellis/config.yaml` 引入的新顶层 section。`trellis update` 走完文件写入循环后会再扫一遍 `getConfigSectionsAddedBetween(fromVersion, toVersion)`，每条 entry 命中"目标文件存在 + sentinel 不在文件里"才会从打包模板里抽对应 section 追加到末尾。仅追加，幂等（重跑时 sentinel 已在）。

```jsonc
{
  "version": "0.5.7",
  "configSectionsAdded": [
    {
      "file": ".trellis/config.yaml",
      "sentinel": "codex:",                                 // 用户文件里出现这个 substring（注释或活配）就视为已存在
      "sectionHeading": "Codex (sub-agent dispatch behavior)" // 模板里 #--- 分隔块内 `# <heading>` 行匹配此值
    }
  ]
}
```

**字段语义**：

- `file` —— 目标文件相对仓库根的路径（当前只用过 `.trellis/config.yaml`，机制本身不限定）
- `sentinel` —— 幂等 gate：用户文件包含此 substring（live 或注释）就跳过。挑稳定的 token，比如新引入的顶层 YAML key
- `sectionHeading` —— 模板里 `#---` 分隔块内 `# <heading>` 那一行的内容，extractor 从此分隔块开始抽到下一个 `#---` 分隔块（或 EOF）

**为什么不直接覆盖 config.yaml**：用户基本都改过 `session_commit_message` / `packages` 等字段，hash 不匹配，常规 file-write 流程会触发 `y/n/d` 询问 —— `y` 丢自定义，`n` 拿不到新 section。`configSectionsAdded` 走 sentinel-gated 追加路径，绕过这个二选一。

**未来加新 section**：在对应版本 manifest 加一条 entry 即可，`update.ts` 不需要改。`packages/cli/src/templates/trellis/config.yaml` 模板里加对应 `#---` 分隔块和 section 内容，`trellis init` 走默认写入路径自然会拿到新 section。

## 受保护路径

以下路径不会被任何迁移操作修改或删除（用户数据）：

- `.trellis/workspace` — 开发者工作记录
- `.trellis/tasks` — 任务追踪
- `.trellis/spec` — 开发指南（用户自定义）
- `.trellis/.developer` — 开发者身份
- `.trellis/.current-task` — 当前任务指针

> 注意：`rename`/`rename-dir` 类型允许将文件迁移 **到** 受保护路径（例如 0.2.0 的 `agent-traces` → `workspace` 重命名），但不允许从受保护路径迁移。

## update.skip 配置

在 `config.yaml` 中配置跳过路径，防止 safe-file-delete 删除指定文件：

```yaml
update:
  skip:
    - .claude/commands/trellis/my-custom.md
    - .cursor/commands/
```

- 支持文件路径和目录路径（目录路径以 `/` 结尾，匹配所有子文件）
- 同时影响模板更新和 safe-file-delete

## 模板哈希追踪

- 存储位置：`.trellis/.template-hashes.json`
- 用途：检测用户是否修改过模板文件
- 原理：比较当前文件 SHA256 与存储的哈希值
- 初始化：`trellis init` 时自动创建
- 更新：`trellis update` 后自动更新被覆盖文件的哈希

### Manifest 所有权契约（CRITICAL — 数据丢失防护）

`.template-hashes.json` 是 `trellis uninstall` 的**唯一权威来源**。每个在此列出的键在卸载时都会被执行 `fs.unlinkSync`。因此 manifest 必须仅包含 **Trellis 在 init / update 期间实际写入的文件 — 绝不仅仅是碰巧存在于管理目录下的文件**。

#### 为什么这很重要

`.codex/`、`.claude/`、`.opencode/` 等包含平台特定的用户数据：
- `.codex/sessions/*.jsonl` — Codex 聊天历史
- `.codex/history` — Codex 提示历史
- `.claude/projects/<sanitized-cwd>/*.jsonl` — Claude Code 对话历史
- 用户添加的 `.codex/skills/<name>/`、`.claude/agents/<name>/`

如果 `initializeHashes` 遍历这些目录并哈希所有内容，uninstall 会忠实地删除用户数据。真实报告的事件：GitHub Issue #221（`.codex/sessions/` 被清空），PR #271（已存在的 `AGENTS.md` 被清空）。

#### 必需契约

**`initializeHashes(cwd, opts)`** 必须从 `opts.trackedPaths`（一个 `Set<string>`，包含 Trellis **本次运行实际写入**的路径）派生 manifest 集，而不是从平台目录的 `fs.readdirSync` 遍历。

该集合由 `utils/file-writer.ts` 中的 `startRecordingWrites()` / `stopRecordingWrites()` 仪器化生成。`writeFile()` 仅在以下情况调用 `recordWrite(absPath)`：

- 文件不存在 → 已写入（已记录）
- 文件存在且内容不同 → 已覆盖（已记录）

且**不记录**以下情况：

- 文件存在且内容字节相同（无磁盘写入）
- `writeMode` 为 `skip-existing` 且文件已存在（已跳过）
- 调用是追加模式（`appendFile`）

每个希望其写入被追踪的配置器必须通过 `writeFile()` 管道化 — 直接的 `fs.writeFileSync` 会绕过记录器。

#### `.trellis/` 遍历豁免

`.trellis/` 文件仍然通过递归遍历进行哈希（现有的 `collectFiles` 行为 + `EXCLUDE_FROM_HASH` 过滤器）。理由：`trellis uninstall` 第 3 步无论如何都会执行 `fs.rmSync('.trellis/', { recursive: true, force: true })`，因此遍历的爆炸半径是受控的。`.trellis/` 内的过度哈希仅影响 `trellis update` 的三方合并准确性，不影响卸载安全性。

#### 自愈契约：`pruneOrphanManifestKeys`

现有用户可能有来自较旧 trellis 版本的被污染的 manifest。`pruneOrphanManifestKeys(cwd, configuredPlatforms, hashes, opts)` 在 `trellis update` 和 `trellis uninstall` 的顶部（计划分类前）运行，并修剪孤儿键。

**保留集**（满足以下任一条件则保留键）：

1. 以 `.trellis/` 开头（遍历管理）
2. 路径出现在**任何**已配置平台的 `PLATFORM_FUNCTIONS[id].collectTemplates()` 输出中
3. 路径出现在**任何**迁移清单条目的 `from` 或 `to` 中（跨所有 `migrations/manifests/*.json`，不仅是待处理的）— 必须保留以便重命名/删除迁移逻辑仍有可用于比较的哈希
4. 路径是 `AGENTS.md` **且**磁盘上的文件包含 `TRELLIS_BLOCK_START` + `TRELLIS_BLOCK_END` 标记，**或**文件缺失。缺少标记的文件被视为用户拥有并被修剪。

`options.persist: false` 用于 dry-run 路径（例如 `uninstall --dry-run`）。

#### Wrong vs Correct

```typescript
// Wrong — 基于遍历的哈希用用户数据污染了 manifest
for (const dir of ALL_MANAGED_DIRS) {
  for (const f of collectFiles(cwd, dir)) {
    hashes[f] = sha256(read(f));   // 包含 .codex/sessions/foo.jsonl
  }
}

// Correct — manifest 精确反映 Trellis 本次运行写入的内容
startRecordingWrites();
await runConfigurators(cwd);       // 每个 writeFile() 调用 recordWrite()
const written = stopRecordingWrites();
initializeHashes(cwd, { trackedPaths: written });
```

#### 家目录守卫（R2 — 纵深防御）

即使有了上述 manifest 契约，当 `process.cwd()` 恰好是用户的家目录时，`trellis init` 和 `trellis uninstall` 仍然拒绝运行。使用 `utils/cwd-guard.ts` 中的 `isCwdHomedir()` — 它在两侧通过 `fs.realpathSync.native()` 进行比较，Windows 上小写化以实现不区分大小写，try/catch 在查找失败时默认允许。仅通过 `TRELLIS_ALLOW_HOMEDIR=1` 覆盖；`--force` **不**绕过。

#### 此区域任何更改所需的测试

- Integration: 在 `.codex/`、`.claude/`、`.opencode/` 下预填用户文件，运行 init+uninstall，断言用户数据被保留。
- Integration: 已存在的 `AGENTS.md`（skip-existing 路径），uninstall 保留它。
- Integration: 被污染的 manifest（手动注入的键）→ update 或 uninstall 修剪它，用户文件存活。
- Unit: `recordWrite` 仪器化 — 新建/覆盖记录，相同/跳过/追加不记录。
- Unit: `pruneOrphanManifestKeys` — 保留上述所有四个类别；仅当 pruned.length > 0 时才重写 manifest。
- Unit: `isCwdHomedir` — 符号链接的家目录匹配；子目录不匹配；Windows 不区分大小写。

### `workflow.md` 整文件更新契约

`.trellis/workflow.md` 不仅是文档。它是 `get_context.py`、`workflow_phase.py`、SessionStart 剥离器和每回合 workflow-state hooks 的运行时输入。

因此 `trellis update` 必须将 `workflow.md` 保持在正常的整文件模板路径上：

- 如果已安装文件的当前哈希与跟踪的哈希匹配，将整个文件更新为打包模板并刷新跟踪的哈希。
- 如果已安装文件被用户编辑，使用标准的已修改文件决策路径（`confirm`、`--force` 或 `--skip`）。
- 不要仅部分合并 `[workflow-state:*]` 标签块。

原因：运行时重要的路由标记和阶段标题也存在于 `[workflow-state:*]` 块之外。部分标签块合并可能在更新 hook 面包屑的同时留下过时的平台块，例如 `[Codex]` 而不是 `[codex-inline]` / `[codex-sub-agent]`，导致 `get_context.py --mode phase --platform codex` 在升级后返回空或错误的步骤细节。

对此的回归覆盖属于版本化的更新集成测试，而不仅仅是全新 init 模板测试：写入较旧的 `.trellis/.version`，上演较旧的哈希跟踪模板文件，运行 `trellis update`，然后断言已安装文件达到当前打包形状且版本戳已推进。对于运行时模板如 `workflow.md`，场景还必须断言运行时标记如 Codex 虚拟平台块在更新后存在。

## CLI 使用

```bash
trellis update              # 显示迁移提示
trellis update --migrate    # 执行迁移（修改过的文件会提示确认）
trellis update --migrate -f # 强制迁移（备份后执行）
trellis update --migrate -s # 跳过修改过的文件
```

## 相关文件

- `src/types/migration.ts` - 类型定义
- `src/migrations/index.ts` - 迁移逻辑
- `src/utils/template-hash.ts` - 哈希工具
- `src/commands/update.ts` - 更新命令集成
