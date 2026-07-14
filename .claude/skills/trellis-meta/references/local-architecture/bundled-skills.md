# 内置技能（Bundled Skills）

"内置技能（Bundled skills）"是随 Trellis CLI npm 包发布的多文件内置技能。与市场技能（marketplace skills，用户单独安装到自己的 `.claude/skills/` 或其他平台技能根目录）不同，内置技能由 `trellis init` 自动写入每个受支持平台的技能根目录，并由 `trellis update` 保持同步。它们是 Trellis 本身的一部分，而非第三方内容。

一个内置技能是 `packages/cli/src/templates/common/bundled-skills/<skill>/` 下的一个目录，该目录已包含自己的 `SKILL.md`（带 YAML frontmatter）以及可选的 `references/`、资源文件或其他支持文件。Trellis 将整个目录树原样复制到每个平台的技能根目录，因此 references 保持懒加载（lazy-loadable），而不会被展平为一个巨大的 `SKILL.md`。

## 何为内置技能（vs. 邻近概念）

| 源路径 | 类型 | 分发方式 |
| --- | --- | --- |
| `templates/common/bundled-skills/<name>/` | 内置技能（多文件） | 整个目录复制到每个平台的技能根目录 |
| `templates/common/skills/<name>.md` | 单文件工作流技能 | 包裹 frontmatter，写入为 `<root>/<name>/SKILL.md` |
| `templates/common/commands/<name>.md` | 斜杠命令 / 提示词 | 写入每个平台的命令目录（`.claude/commands/trellis/`、`.cursor/commands/trellis-*.md`、`.gemini/commands/trellis/*.toml` 等） |
| `templates/<platform>/skills/` | 平台特定技能 | 仅写入该平台的目录（例如 `.codex/skills/`） |
| 用户技能，如 `.claude/skills/<my-skill>/` 等 | 市场或用户自创 | Trellis 完全不管理 |

Trellis CLI 绝不会触碰任何不由其自身模板加载器生成的文件。用户在平台技能根目录下手动放入的任何内容都会被保留。

## 当前内置技能（v0.6.0）

技能集合在运行时通过列举 `templates/common/bundled-skills/` 下的目录来发现：

| 技能 | 用途 |
| --- | --- |
| `trellis-meta` | 本技能。向在用户项目中工作的 AI 解释本地 Trellis 架构和自定义入口点。 |
| `trellis-session-insight` | 封装 `trellis mem` CLI，让 AI 知道何时以及如何查阅过往的 Claude Code / Codex / Pi Agent 对话日志。 |
| `trellis-spec-bootstrap` | 用于从真实代码库创建或刷新 `.trellis/spec/` 的平台中立工作流（可选集成 GitNexus / ABCoder）。 |
| `trellis-channel` | 能力技能，教导 AI 何时使用 `trellis channel` 进行多代理协作、论坛/帖子持久化看板和调度器-等待模式。 |

列表在运行时发现，因此只需在 `bundled-skills/` 下添加新目录即可注册新技能（参见下文「添加新的内置技能」）。

## 内置技能在各平台的落位

每个平台配置器在 `trellis init` 期间调用 `writeSkills(<root>, <workflowSkills>, resolveBundledSkills(ctx))`。`resolveBundledSkills` 读取 `templates/common/bundled-skills/` 下的每个目录，解析占位符，并返回一个扁平的 `{relativePath, content}` 条目列表。`writeSkills` 然后将其映射到平台的技能根目录下。

| 平台 | 内置技能根目录 | 备注 |
| --- | --- | --- |
| Claude Code | `.claude/skills/<skill>/` | `configureClaude` |
| Cursor | `.cursor/skills/<skill>/` | `configureCursor` |
| Codex | `.agents/skills/<skill>/` | `configureCodex` 写入共享的 `.agents/skills/` 根目录，Gemini CLI 0.40+ 也会读取 |
| Gemini CLI | `.agents/skills/<skill>/` | 与 Codex 共享同一根目录；两个配置器必须产生字节级相同的输出 |
| Kiro | `.kiro/skills/<skill>/` | `configureKiro`（基于技能的平台——无命令） |
| Qoder | `.qoder/skills/<skill>/` | `configureQoder` |
| Codebuddy | `.codebuddy/skills/<skill>/` | `configureCodebuddy` |
| Copilot | `.github/skills/<skill>/` | `configureCopilot` |
| Droid | `.factory/skills/<skill>/` | `configureDroid` |
| Antigravity | `.agent/skills/<skill>/` | `configureAntigravity` |
| Devin | `.devin/skills/<skill>/` | `configureDevin` |
| Kilo | `.kilocode/skills/<skill>/` | `configureKilo` |
| OpenCode | （由 `collectOpenCodeTemplates` 处理） | 使用相同的 `resolveBundledSkills(ctx)` 输出 |
| Pi、Reasonix | （各自的收集器） | 相同的 `resolveBundledSkills(ctx)` 输出 |

两条路径使用相同的数据：

1. `configureX(cwd)` 在 `trellis init` 期间写入文件。
2. `collectPlatformTemplates(platformId)`（在 `configurators/index.ts` 中）返回一个 `Map<filePath, content>`，`trellis update` 用它来检测漂移并填充 `.trellis/.template-hashes.json`。两者必须产生字节级相同的输出，因此它们都调用 `resolveBundledSkills(ctx)` 和 `collectSkillTemplates(root, …, resolveBundledSkills(ctx))`。

## 分发接线（Dispatch Wiring，代码路径）

将内置技能自动分发到平台技能根目录的机制位于两个文件中：

1. `packages/cli/src/templates/common/index.ts`
   - `listDirectories("bundled-skills")` 枚举磁盘上的技能。
   - `listBundledSkillFiles(skillDir)` 递归遍历每个技能目录，为每个文件返回 `{relativePath, content}`。
   - `getBundledSkillTemplates()` 返回缓存的 `CommonBundledSkill[]`。

2. `packages/cli/src/configurators/shared.ts`
   - `resolveBundledSkills(ctx)` 将该列表展平为 `ResolvedSkillFile[]`，包含 `<skill>/<relativePath>` 路径和已解析的占位符。
   - `writeSkills(skillsRoot, workflowSkills, bundledSkills)` 将工作流技能和内置技能文件写入 `skillsRoot` 下。
   - `collectSkillTemplates(skillsRoot, workflowSkills, bundledSkills)` 以 `Map<filePath, content>` 的相同形式返回，供 update / hash 管线使用。

每个支持技能的平台配置器都导入这两个辅助函数（参见 `claude.ts`、`cursor.ts`、`codex.ts`、`gemini.ts`、`kiro.ts`、`qoder.ts`、`codebuddy.ts`、`copilot.ts`、`droid.ts`、`antigravity.ts`、`devin.ts`、`kilo.ts`）。`index.ts` 中的 `PLATFORM_FUNCTIONS` 注册表也在每个 `collectTemplates` 闭包内调用 `resolveBundledSkills(ctx)`，以确保 `trellis update` 跟踪保持一致。

## 添加新的内置技能

分发结构和接线已经是通用的，因此添加技能只需要文件变更和分发验证。

1. **创建目录树。**

   ```
   packages/cli/src/templates/common/bundled-skills/<my-skill>/
     SKILL.md                     # YAML frontmatter + 正文
     references/                  # 可选
       <topic>.md
     assets/                      # 可选（任何可读作 utf-8 的内容）
   ```

2. **编写合法的 `SKILL.md` 头部。** frontmatter 至少需要包含：

   ```yaml
   ---
   name: <my-skill>
   description: "AI 何时应使用此技能。触发短语放在此处。"
   ---
   ```

   `description` 是每个平台的自动触发机制匹配的依据，因此应描述用户意图的触发条件，而非技能的内部实现。

3. **在适当位置使用占位符。** 内置技能内容经过 `resolvePlaceholders(file.content, ctx)` 处理。任何 `{{platform_name}}`、`{{python_cmd}}` 等由 `resolvePlaceholders` 支持的 token 都会按平台被替换。

4. **无需分发接线。** `listDirectories("bundled-skills")` 自动发现新目录，因此在下次 `trellis init` 或 `trellis update` 时所有平台都会收到。

5. **在发布前验证分发路径。** 跳过以下任一步骤都曾导致功能被文档记录为内置，但发布的 npm tarball 中缺少文件：

   - 源文件存在于要打标签的分支上。
   - `pnpm --filter @mindfoldhq/trellis build` 将资源复制到 `dist/templates/common/bundled-skills/<skill>/`。
   - `npm pack --dry-run --json` 包含预期的 `dist/**` 路径。
   - 在全新的临时项目中，`trellis init` 写入 `.claude/skills/<skill>/SKILL.md`、`.agents/skills/<skill>/SKILL.md` 等。
   - `.trellis/.template-hashes.json` 列出了生成的文件。
   - 在该临时项目中运行 `trellis update --dry-run` 报告 "Already up to date!"。

6. **添加迁移清单条目**，如果该技能是在其他项目将升级到的新版本中添加的。没有显式清单条目时，文件会通过 `trellis update` 的「缺失文件」标准分支落地，但清单能让变更在 changelog 中可见。

## 本地覆盖内置技能

不存在正式的「项目本地技能」机制（例如 `.trellis/skills/`）。内置技能以平台根目录为锚点，因此任何覆盖也以平台根目录为锚点。

受支持的覆盖模式依赖于 `trellis update` 中现有的模板哈希差异（template-hash diff）：

1. 直接编辑本地文件。例如：`.claude/skills/trellis-meta/SKILL.md`。
2. 该文件的哈希现在与 `.trellis/.template-hashes.json` 中的条目不一致。
3. 下次 `trellis update` 会检测到用户修改，并保持该文件不变（Trellis 绝不会在未经显式 `--force` 的情况下覆盖用户修改的文件）。

注意事项：

- 覆盖仅对您编辑的那个平台生效。要跨平台覆盖同一技能（例如同时覆盖 Claude Code 和 Codex），您必须编辑 `.claude/skills/<name>/` 和 `.agents/skills/<name>/` 两者。
- 未来的 `trellis update --force` 会覆盖本地编辑。请将覆盖内容纳入版本控制，以便需要时重新应用。
- 在同一平台技能根目录下以不同文件夹名称安装的市场技能（例如 `.claude/skills/my-custom-meta/`）不会被 Trellis 触及，当目标是添加行为而非修改内置技能时，这是更干净的选择。
- 团队私有约定应放在 `.trellis/spec/` 或独立的市场风格本地技能中，而非修改 `trellis-meta` 本身。请参阅 `customize-local/add-project-local-conventions.md`。

## 从项目中移除内置技能

没有按项目排除内置技能的标志。有两个选项：

1. **删除每个平台技能根目录中的目录。** `trellis update` 会发现文件缺失，与 `.template-hashes.json` 对比，并将删除操作视为与其他用户修改相同——除非传入 `--force`，否则不会静默重新创建目录。

2. **固定一个不包含该技能的 Trellis 版本。** 内置技能集合在构建时确定，因此安装旧版 CLI 是永久排除当前版本所包含技能的唯一方式。

第三种选项——全局禁用所有内置技能——不受支持。分发在每个配置器中是无条件的。添加这样的标志需要修改 `configurators/index.ts` 中的 `PLATFORM_FUNCTIONS` 和每个 `configureX` 函数。

## 操作规则（Operating Rules）

- 将 `templates/common/bundled-skills/` 视为内置技能存在的唯一事实来源。不要手动维护按平台划分的技能列表。
- 不要在内置的 `SKILL.md` 中添加平台特定逻辑。如果某个行为是平台特定的，请将其放入 `templates/<platform>/skills/` 中。
- 不要将内置技能与特定 CLI 二进制文件（例如 `trellis mem`）耦合，除非在技能的描述和 references 中明确说明该依赖——使用旧版本的用户可能没有该命令。
- 不要在内置技能中存储项目私有内容。内置技能是公开的，会分发给所有用户；项目规则应放在 `.trellis/spec/` 或本地技能中。