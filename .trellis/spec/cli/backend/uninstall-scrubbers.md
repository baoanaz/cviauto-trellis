# Uninstall Scrubbers（卸载清理器）

`trellis uninstall` 如何对结构化配置文件（`settings.json`、`hooks.json`、`config.toml`、`package.json`）执行**段落级删除**，以便移除 Trellis 发出的字段，同时保持用户添加的相邻内容完整。

清理器位于 `utils/uninstall-scrubbers.ts`。它们是纯函数 — 不做 I/O，将文件内容作为输入，并返回新内容加上 `fullyEmpty` 标志。决定调用哪个清理器、读取文件、写入文件和删除空文件的编排逻辑位于 `commands/uninstall.ts:uninstall`（具体在 `buildPlan` 和 `executePlan` 中；参见 `commands-uninstall.md`）。

---

## 概述

### 为什么是段落级，而不是全文件删除

Trellis 写入的大多数文件是不透明的（`.py`、`.md`、`.ts`）— `trellis uninstall` 直接 `unlink` 它们。但少数平台配置文件是**与用户共享**的：

| 文件 | 共享什么 |
|------|----------------|
| `.claude/settings.json` | Trellis 写入 `hooks` 块；用户可能设置了 `env`、`model`、`permissions`、`version` |
| `.cursor/hooks.json` | 相同的想法，但是扁平 schema |
| `.opencode/package.json` | Trellis 添加了 `dependencies["@opencode-ai/plugin"]`；用户可能有其他 deps |
| `.pi/settings.json` | Trellis 添加了 `enableSkillCommands` 加上 `extensions`/`skills`/`prompts` 数组中的条目；用户可能有自己的条目 |
| `.codex/config.toml` | Trellis 写入一个文档化的 `project_doc_fallback_filenames` 行 + 一个注释块；用户可能添加了更多 TOML 指令 |
| `.codex/hooks.json`、`.gemini/settings.json`、`.factory/settings.json`、`.codebuddy/settings.json`、`.qoder/settings.json`、`.github/copilot/hooks.json` | 与 `.claude/settings.json` 相同的 hooks 块模式（有时扁平，有时嵌套） |

如果 `uninstall` 简单地 `rm` 这些文件，用户将丢失自己的配置。如果它**保留**它们，悬空的 Trellis hook 条目将指向已删除的脚本，平台将在下次会话时出错。

清理器遍历每个文件的结构，仅丢弃 Trellis 已知的部分，并报告是否有任何有意义的内容保留。

### 与调用者的契约

调用者（`commands/uninstall.ts:buildPlan`）负责：

- 从磁盘读取文件并将其原始文本传递给清理器。
- 比较结果中的 `fullyEmpty`：如果 `true`，文件排队等待删除；如果 `false`，新内容写回。
- 识别*哪些*路径算作「被此卸载删除」（传递给 hooks 形状的清理器作为 `deletedPaths`）。这是来自 `.trellis/.template-hashes.json` 的 POSIX 路径的完整列表。

清理器本身永不触碰文件系统。它们永不记录日志。它们返回。

---

## 清理器接口

所有清理器共享一个结果形状：

```ts
interface ScrubResult {
  content: string;     // 写回的清理后文本
  fullyEmpty: boolean; // true → 调用者应删除文件而不是写入
}
```

根据清理器是否需要知道卸载删除集，有两种不同的签名：

| 签名 | 使用者 |
|-----------|---------|
| `(content: string, deletedPaths: readonly string[], mode: "nested" \| "flat") → ScrubResult` | `utils/uninstall-scrubbers.ts:scrubHooksJson` |
| `(content: string) → ScrubResult` | `utils/uninstall-scrubbers.ts:scrubOpencodePackageJson`、`:scrubPiSettings`、`:scrubCodexConfigToml` |

Hooks-JSON 清理器需要删除集，因为它们通过**条目的命令是否引用正在被删除的路径**来识别 Trellis hook 条目。其他三个通过 Trellis 配置器硬编码的精确匹配值来识别 Trellis 内容。

### 通用不变量

每个清理器持有以下内容：

- **输入可能格式错误** — 如果 `JSON.parse`（或等效）抛出，返回 `{ content, fullyEmpty: false }`。调用者的外部流然后将文件不变地写回。我们从不半重写。
- **输入可能具有意外的形状** — 如果解析的根不是普通对象，返回 `{ content, fullyEmpty: false }`。相同的推理。
- **输出是规范化的** — JSON 形状的清理器使用 2 空格缩进和尾随换行符重新 `stringify`，即使没有进行更改。这是有意的；用户编写的格式是附带损害。调用者知道。
- **不抛出异常** — 清理器不得传播异常；通过 `fullyEmpty: false` 加上原始 `content` 展示「我无法清理此」。
- **无副作用** — 无 `fs.*`、无 `console.*`、无网络。纯函数。
- **幂等** — 在其自己的输出上运行清理器必须产生字节相同的内容（模 JSON 美化打印规范化）。

---

## 每平台清理器

### `utils/uninstall-scrubbers.ts:scrubHooksJson`

清理**八个**平台的 `hooks` 形状的 settings JSON。Schema 在不同平台之间略有不同，因此该函数接受一个 `mode` 选择器：

| 模式 | 文件 | Schema |
|------|-------|--------|
| `"nested"` | `.claude/settings.json`、`.gemini/settings.json`、`.factory/settings.json`、`.codebuddy/settings.json`、`.qoder/settings.json`、`.codex/hooks.json` | `hooks.{Event}.[ {matcher?, hooks: [ {command, ...} ]} ]` |
| `"flat"` | `.cursor/hooks.json`、`.github/copilot/hooks.json` | `hooks.{Event}.[ {command, ...} ]` |

算法：

1. 遍历 `root.hooks.{eventName}`。对于每个事件数组，删除其命令匹配已删除路径的条目；对于嵌套模式，先深入一层通过匹配器块的内部 `hooks` 数组。
2. 如果匹配器块的内部 `hooks` 变为空 → 丢弃整个块。
3. 如果事件数组变为空 → `delete root.hooks[eventName]`。
4. 如果 `root.hooks` 变为空对象 → `delete root.hooks`。
5. 当且仅当 `Object.keys(root).length === 0` 时 `fullyEmpty` 为 true。

`hooks` 之外的用户定义键（`env`、`model`、`permissions`、`version`）被逐字保留 — 仅触碰 Trellis 声明的 `hooks` 子树。

#### 路径匹配是**仅最后 token 匹配**，而非子串

辅助函数 `utils/uninstall-scrubbers.ts:commandMatchesDeletedPath` 通过取**尾随空白分隔的 token**（剥离周围的 `'`/`"`）来解析 hook 命令内的脚本路径。然后使用 `===` 或 `endsWith("/" + p)` 将该 token 与每个已删除路径进行比较（因此绝对路径也匹配）。

为什么不是子串包含？一个用户编写的 hook 如

```json
{ "command": "echo 'see .claude/hooks/session-start.py for context'" }
```

会天真地匹配 `".claude/hooks/session-start.py"` 并被错误删除。仅最后 token 更严格：这里的尾随 token 是 `context'`，而不是已删除路径。

此规则假设 Trellis 发出的形状：

```text
<python-cmd> <manifest-relative-path>
```

（例如 `python3 .claude/hooks/session-start.py`）。任何对 hook 命令发出的未来更改（额外尾随参数、不同启动器）必须更新配置器和此清理器。

#### 命令字段回退

`utils/uninstall-scrubbers.ts:getEntryCommand` 先读取 `command`，然后回退到 `bash`，然后 `powershell`。Copilot 的扁平 schema 使用双 `bash`/`powershell` 字段而不是统一的 `command`。任一字段足以识别 Trellis 条目；我们不要求两者都匹配，因为 Trellis 在两个字段上发出相同的脚本路径。

### `utils/uninstall-scrubbers.ts:scrubOpencodePackageJson`

清理 `.opencode/package.json`：

1. 删除 `dependencies["@opencode-ai/plugin"]`。
2. 如果 `dependencies` 最终为空 → 丢弃该字段。
3. 当且仅当结果根对象有零个键时 `fullyEmpty` 为 true。

这是最简单的清理器：只有一个字段要触碰，`package.json` 的其余部分（name、version、scripts、devDeps、…）由用户拥有。

### `utils/uninstall-scrubbers.ts:scrubPiSettings`

清理 `.pi/settings.json`：

1. 丢弃 `enableSkillCommands`（仅 Trellis 标志）。
2. 过滤三个数组中的 Trellis 发出条目（精确字符串匹配）：
   - `extensions` — 移除 `"./extensions/trellis/index.ts"`
   - `skills` — 移除 `"./skills"`
   - `prompts` — 移除 `"./prompts"`
3. 如果这些数组中的任何一个变为空 → 丢弃数组键。
4. 当且仅当根有零个键时 `fullyEmpty` 为 true。

`utils/uninstall-scrubbers.ts` 中的常量 `PI_TRELLIS_EXTENSION`、`PI_TRELLIS_SKILLS`、`PI_TRELLIS_PROMPTS` 定义了 Pi 配置器发出的确切字符串。如果配置器更改了发出的路径，此清理器必须同步更改 — 两半之间没有共享的权威来源。

### `utils/uninstall-scrubbers.ts:scrubCodexConfigToml`

清理 `.codex/config.toml`。与 JSON 清理器不同，这个是**基于行的**：没有真正的解析器，TOML 更难往返，而 Trellis 发出的文件足够小且扁平，标记行方法比结构化方法更安全。

Trellis 向此文件写入两个不同的内容类别：

1. 单个赋值 `project_doc_fallback_filenames = ["AGENTS.md"]`。
2. 一个前导注释块（header + `# NOTE: …` opt-in 提示）。

算法：

- 遍历行。丢弃任何：
  - 匹配赋值正则 `/^\s*project_doc_fallback_filenames\s*=/` 的行。
  - 其内部文本（在剥离 `#` 和空格之后）**精确**匹配 `trellisCommentMarkers` 中的字符串之一的注释行（`utils/uninstall-scrubbers.ts:scrubCodexConfigToml` 内的硬编码数组）。
  - 裸 `#` 注释行 — 这些在 Trellis 注释块内。
- 折叠由删除创建的连续空行。
- 修剪尾随空白。
- 当且仅当结果没有非空白字符时 `fullyEmpty` 为 true。

用户添加的行（他们自己的 TOML 键、他们自己的注释、空白间隙）存活，因为它们不匹配赋值正则且其注释文本不在 `trellisCommentMarkers` 中。

---

## 标记块格式

清理器通过三种不同的机制识别 Trellis 内容 — 没有单一的统一标记语法。

| 机制 | 使用者 | 示例 |
|-----------|---------|---------|
| **最后 token 路径匹配** 对照 `deletedPaths` | `scrubHooksJson` | 带有 `command = "python3 .claude/hooks/session-start.py"` 的 Hook 条目匹配，因为尾随 token 在删除集中 |
| **精确字符串匹配** 对照硬编码常量 | `scrubOpencodePackageJson`、`scrubPiSettings` | Pi `skills` 数组中的 `"./skills"`、`"@opencode-ai/plugin"` 作为 dep 键 |
| **硬编码注释行允许列表** + 赋值正则 | `scrubCodexConfigToml` | 其剥离文本匹配 `trellisCommentMarkers` 中任何一个的行 |

### 为什么没有「BEGIN TRELLIS / END TRELLIS」注释标记？

早期设计考虑将 Trellis 内容包装在定界块中（`# BEGIN TRELLIS …` / `# END TRELLIS`）。我们拒绝了，因为：

- **JSON / TOML 不能在数组/对象内携带内联注释，其方式每个解析器在往返时都保留。** Claude 的 `settings.json` 写入器和 Codex 的 `config.toml` 都在每次保存时重新 `stringify`，这要么会吃掉标记，要么迫使我们发布自定义序列化器。两者都不值得维护。
- **配置器已经产生结构上可识别的值**（特定键、特定路径、特定注释措辞）。识别这些结构是足够的 — 不需要标记。

代价是**跨 Trellis 版本的脆弱性**：当配置器更改它发出的路径或措辞时，清理器必须同步更新。参见「常见陷阱」获取显式规则。

### 遗留兼容性

如果未来的 Trellis 版本开始发出*新* hook 脚本路径或不同的 Pi 扩展路径，清理器必须识别**旧和新**至少一个主版本，否则升级后立即卸载的用户将泄露遗留字段。今天代码库尚未面临此问题 — 仅存在每种发出的一种形状。当第一个此类迁移落地时，在此记录。

---

## 哈希门控

清理器本身**不是哈希门控的**。关于文件是否可以被触碰的决定在上游：

- `commands/uninstall.ts:buildPlan` 读取 `.trellis/.template-hashes.json`，仅考虑清单中列出的文件。清单之外的文件永远不会被任何清理器看到。
- PRD 策略是「全删」— uninstall 移除清单中列出的文件，无论用户是否修改了它们。没有像 `update.ts` 那样的「user-modified, skip」分支。
- `--force` 在 `uninstall` 上不存在；唯一的标志是 `--yes`（跳过提示）和 `--dry-run`（仅计划）。

哈希匹配确实影响 `update.ts` 流程（保留用户编辑、`safe-file-delete` 允许列表）。它不影响 `uninstall`。如果你正在添加一个清理器并伸手去拿哈希门控，你可能在错误的地方编写迁移逻辑 — 参见 `migrations.md`。

---

## 边界

清理器不得：

- 读取或写入文件系统。所有 I/O 位于 `commands/uninstall.ts` 中。
- 记录日志。编排器拥有用户可见的输出。
- 触碰传入文件之外的任何文件。无 git 操作、无模板获取、无其他文件写入。
- 耦合到其他平台。每个清理器是自包含的：更改 `scrubPiSettings` 不得改变任何其他清理器的行为。
- 决定文件是否可删除。它们报告 `fullyEmpty`；调用者决定如何处理该位。
- 抛出异常。格式错误或意外的输入 → `{ content, fullyEmpty: false }`，以便调用者保持文件不变。

清理器被允许：

- 重新规范化 JSON 输出（重新缩进、排序等）— 当前实现使用 2 空格缩进重新美化打印。
- 丢弃由删除创建的空行连续运行（TOML 清理器这样做）。
- 在最后一个子项消失后删除兄弟字段（例如，在移除最后一个 dep 后丢弃空的 `dependencies`）。

---

## 常见陷阱

### 配置器发出新路径；清理器不知道

**症状**：`trellis uninstall` 在平台配置文件中留下过时的 Trellis 字段，因为清理器的硬编码匹配器（`PI_TRELLIS_EXTENSION`、`trellisCommentMarkers`）不识别新发出。

**原因**：配置器和清理器维护「Trellis 写入什么」的并行硬编码表。当配置器更改时（例如，将 Pi 扩展移动到新路径），清理器的表变得过时。

**修复**：任何更改配置器在清理器目标文件中发出的路径 / 字段名 / 注释措辞的 PR 必须在相同提交中更新匹配的清理器。添加一个回归测试，进行 configure → scrub → 断言为空的往返。

### 标记块被用户部分编辑

**症状**：`trellis uninstall` 后，`.codex/config.toml` 保留了 Trellis 注释块的一半（例如，用户删除了 `# NOTE:` 但留下了 `# Without this flag, …`）。

**原因**：`scrubCodexConfigToml` 在**每行精确文本**上匹配，而不是块边界。任何存活的 Trellis 已知行将被单独移除；任何其文本不再匹配允许列表的用户编辑行将被保留。

**缓解**：这是正确的行为 — 我们无法判断一个接近匹配的行是拼写错误还是有意的用户自定义。文档应警告用户：编辑 Trellis 发出的注释可能在卸载后留下片段。他们总是可以手动删除。

### 带尾随参数的 Hook 命令

**症状**：未来的配置器发出 `python3 .claude/hooks/session-start.py --verbose`，而 `commandMatchesDeletedPath` 不再匹配，因为尾随 token 现在是 `--verbose`，而不是脚本路径。

**缓解**：今天，所有 hook 命令恰好是两个 token（`<python-cmd> <script-path>`）。如果我们添加尾随参数，`commandMatchesDeletedPath` 需要扫描所有 token，而不仅仅是最后一个。更新辅助函数并添加回归测试。

### 嵌套标记 / 重复匹配器块

**症状**：平台的 `hooks.{Event}` 数组包含两个都针对 Trellis 的匹配器块。清理后，两者都应被移除。

**缓解**：`scrubHooksJson` 已经独立过滤每个条目。重复的 Trellis 条目被正确处理。嵌套中的嵌套不是任何平台发出的真实形状 — schema 恰好是两层深 — 但清理器的每条目过滤器也不会爆炸；它只是不会进一步递归。

### 外部工具在卸载前重写文件

**症状**：用户的编辑器或格式化器标准化了 `.codex/config.toml`（例如，重新排序键、更改注释换行）。清理器留下 Trellis 内容，因为它不精确匹配允许列表。

**缓解**：行允许列表方法故意严格以避免假阳性。如果用户的格式化器重写了 Trellis 内容，我们将其视为用户自定义并保留它。文档化变通方法：重新运行 `trellis init` 以恢复规范内容，然后 `trellis uninstall` 以干净地移除它。

### 调用者忘记传递 `deletedPaths`

**症状**：Hooks-JSON 清理器保留所有 hook 条目，因为 `deletedPaths` 参数为空。

**缓解**：TypeScript 捕获此 — `scrubHooksJson` 要求该参数。`commands/uninstall.ts:buildPlan` 中的管道从 `Object.keys(hashes)` 构造 `deletedPaths`，因此每个清单条目都在列表中。如果 hook 命令引用不在清单中的脚本，我们故意保留该条目（它可能是用户添加的，即使它指向 Trellis 形状的路径）。

### 清理器在清单之外的文件上被调用

**症状**：不是真正的症状 — `commands/uninstall.ts:buildPlan` 仅对同时出现在 `.template-hashes.json` 和 `buildStructuredFileSpecs` 中的路径分派清理器。清单之外的文件永远不会被清理。

**规则**：不要绕过此门控。在清单门控之外添加「清理具有此形状的任何文件」逻辑将冒修改 Trellis 从未写入的用户文件的风险。

---

## 测试约定

清理器的测试与实现并排作为纯函数测试 — 无 `tmp` 目录，无文件系统。每个清理器测试遵循此形状：

1. **Fixture** — 文件内容的字符串字面量（包含 Trellis 部分 + 用户拥有的部分）。
2. **调用** — 直接调用清理器。
3. **断言** — Trellis 部分已消失，用户部分完整，`fullyEmpty` 匹配预期。

### 每个清理器所需的测试案例

| 案例 | 要断言什么 |
|------|----------------|
| 纯 Trellis 内容 | 清理后，`fullyEmpty === true` |
| 混合 Trellis + 用户内容 | 清理后，`fullyEmpty === false`；用户内容逐字节存活（模 JSON 重新美化打印） |
| 仅用户内容 | 清理后，内容基本不变（模重新 stringify）且 `fullyEmpty === false` |
| 空文件 | `fullyEmpty === true` |
| 格式错误的输入（损坏的 JSON / 奇怪的形状） | 返回原始内容，`fullyEmpty: false` — 永不抛出异常 |
| 幂等性 | `scrub(scrub(x)).content === scrub(x).content` |

### 清理器特定案例

- `scrubHooksJson`：
  - 用户 hook 条目，其命令主体仅在 `echo` 或注释参数中*提及*已删除路径 → 保留（最后 token 规则）。
  - 带有 `bash` 字段而非 `command` 的 Hook 条目（Copilot 扁平 schema）→ 仍然匹配。
  - `deletedPaths` 中的多个已删除路径 → 所有匹配条目在一次传递中丢弃。
  - 两种模式（`"nested"`、`"flat"`）分别覆盖。
- `scrubCodexConfigToml`：
  - 用户在 Trellis 块之上/之下添加了自己的 TOML 键 → 保留。
  - 用户编辑了 Trellis 注释行（拼写错误）→ 该单行作为用户内容保留；Trellis 块的其余部分被移除。
- `scrubPiSettings`：
  - 用户在 `extensions`/`skills`/`prompts` 中有自己的条目 → 保留；仅移除 Trellis 条目。
- `scrubOpencodePackageJson`：
  - 用户有其他 dev/runtime deps → 保留。

### 跨领域集成测试

`commands/uninstall.ts` 集成测试应覆盖每个平台的**完整** init → uninstall 往返：确认在 `init({ <platform>: true })` 后跟 `uninstall({ yes: true })`，平台配置目录要么不存在（如果 Trellis 是唯一写入者），要么仅包含用户之前存在的内容。这捕获了配置器更改未在清理器更新中镜像的回归。

---

## 参考

源码：`packages/cli/src/utils/uninstall-scrubbers.ts`

调用者：`packages/cli/src/commands/uninstall.ts`（`buildStructuredFileSpecs`、`buildPlan`）

相关规范：
- `commands-uninstall.md` — 编排、plan-render-execute 流程、提示
- `migrations.md` — `safe-file-delete` 和 `update` 期间的哈希门控删除
- `platform-integration.md` — 配置器端：每个清理器目标文件被发出的位置

---

## 阅读时发现的潜在 TODO

- `commandMatchesDeletedPath` 假设 Trellis 发出的命令具有精确形状 `<python-cmd> <script-path>`。如果我们添加启动器标志或包装器，辅助函数需要更丰富的解析器（完整 token 扫描，可能丢弃已知 shell 前缀，如 `env VAR=val`）。
- Pi 精确字符串常量（`PI_TRELLIS_EXTENSION`、`PI_TRELLIS_SKILLS`、`PI_TRELLIS_PROMPTS`）复制了 Pi 配置器中存在的值。导出这些的共享模块将防止漂移；今天它们在两个地方独立硬编码。
- `scrubCodexConfigToml` 的注释行允许列表（`trellisCommentMarkers`）是手动维护的列表，镜像了配置器发出的注释块。与 Pi 相同的漂移风险。考虑从配置器使用的相同模板文件派生该列表。
- 尚无遗留标记兼容层。一旦一个配置器更改其发出，清理器将需要「匹配旧或新」分支和弃用窗口。在第一个迁移落地时在此规范中记录规则。
- 所有 hooks-JSON 清理器在每次调用时使用 2 空格缩进重新美化打印，即使没有进行更改。这静默地重写用户格式化（例如，制表符缩进的 JSON）。今天可接受；如果用户抱怨则标记。