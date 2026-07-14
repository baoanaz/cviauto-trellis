# Configurator 共享辅助函数

`packages/cli/src/configurators/shared.ts` 如何结构化：它导出什么，每个辅助函数保证什么，以及平台配置器何时应使用共享逻辑 vs 编写自己的逻辑。

有关每个平台的集成机制（每个平台写入哪个目录，每个平台注册哪些 hooks），参见 `platform-integration.md`。本规范仅涵盖跨领域辅助函数。

---

## 概述

`configurators/shared.ts` 的存在是为了防止平台配置器（`configurators/claude.ts`、`configurators/cursor.ts`、`configurators/codex.ts`、`configurators/gemini.ts`、`configurators/iflow.ts`、`configurators/kiro.ts`、`configurators/qoder.ts`、`configurators/copilot.ts`、`configurators/codebuddy.ts`、`configurators/droid.ts`、`configurators/kilo.ts`、`configurators/antigravity.ts`、`configurators/devin.ts`、`configurators/pi.ts`、`configurators/opencode.ts`）独立重新实现相同的逐字节渲染、写入和序言注入逻辑。配置器之间的漂移可靠地变成 bug：

- 如果两个平台对 `{{PYTHON_CMD}}` 的渲染不同，`trellis update` 的模板哈希比较在每次安装后报告幻象差异。
- 如果两个都写入 `.agents/skills/` 的配置器按平台解析 `{{CMD_REF}}`，最后写入者胜出并覆盖另一个（参见 `platform-integration.md`「Rule: `.agents/skills/` writes use `resolvePlaceholdersNeutral()`」）。
- 如果 `configure*()` 通过辅助函数写入但 `collectTemplates()` 字节渲染原始模板，哈希跟踪在每次 `trellis update` 时反复变化。

辅助函数属于 `shared.ts` 当（a）两个或更多配置器需要相同行为**或**（b）单个配置器在 init 写入路径**和** update 收集路径中都需要该辅助函数 — 将其放在 shared.ts 中强制两者调用相同的代码。

辅助函数**不**属于 `shared.ts` 当它编码平台特定的格式化（例如，Codex TOML agents、OpenCode plugin JSON、Kiro JSON agents）。那些保留在每平台配置器中。

---

## 公共辅助函数名单

### Python 命令解析

`configurators/shared.ts:setResolvedPythonCommand` — 由 `commands/init.ts` 在探测主机（`python` / `python3` / `py -3`）后调用一次。所有后续渲染拾取已解析的值。

`configurators/shared.ts:resetResolvedPythonCommand` — 测试辅助函数。不通过 init 进行的渲染单元测试必须在 `beforeEach`/`afterEach` 中调用此函数，以避免在案例之间泄露模块状态。

`configurators/shared.ts:getPythonCommandForPlatform` — 如果 init 已运行则返回已解析的命令；否则返回静态默认值（Windows 上的 `python`，其他平台的 `python3`）。可选的 `platform` 参数仅为单元测试存在；生产调用者不得传递它（传递它会绕过已解析的缓存）。

`configurators/shared.ts:replacePythonCommandLiterals` — 逐行将文字 `python3` 替换为已解析的命令，**排除 shebang 行**（`#!`）。幂等；当已解析的命令是 `python3` 时为空操作。在写入时应用，以便即使是原始的 `.py`、`.toml`、`.md` 内容（不经过 `resolvePlaceholders` 的模板）也能在 Windows 上获得正确的命令。每个公共写入辅助函数（`writeSkills`、`writeAgents`、`writeSharedHooks`）在写入前调用此函数 — 进行自己 `await writeFile(...)` 的配置器必须显式调用它。

### 占位符替换

`configurators/shared.ts:resolvePlaceholders` — 标准渲染器。解析 `{{PYTHON_CMD}}`、`{{CMD_REF:name}}`、`{{EXECUTOR_AI}}`、`{{USER_ACTION_LABEL}}`、`{{CLI_FLAG}}`，以及用于 `AGENT_CAPABLE` 和 `HAS_HOOKS` 的条件块 `{{#FLAG}}…{{/FLAG}}` / `{{^FLAG}}…{{/FLAG}}`。清理由已删除条件留下的连续空行。没有 `TemplateContext` 时它仅解析 `{{PYTHON_CMD}}`（用于 `settings.json`、`hooks.json` 等的遗留模式）。

`configurators/shared.ts:resolvePlaceholdersNeutral` — 相同的占位符集，但将 `{{CMD_REF:name}}` 渲染为 `` `name` (Trellis command) `` 而不是替换平台的命令前缀。每当渲染的文件目标是 `.agents/skills/` 时使用此函数。两个配置器（当前为 Codex，Gemini CLI 0.40+ 通过 workspace 别名，未来的 agentskills.io 消费者）写入该路径；如果任何一个使用平台特定渲染器，渲染后的 SKILL.md 将字节不同，第二个配置器会静默覆盖第一个。

### 模板包装

`configurators/shared.ts:wrapWithSkillFrontmatter` — 用一个 `---\nname: <name>\ndescription: "<desc>"\n---\n\n` 前缀包装已解析的 skill 主体。描述来自模块私有的 `SKILL_DESCRIPTIONS` 注册表，按裸 skill 名称索引（`trellis-` 前缀在查找前剥离）。当描述缺失时抛出 — 这是有意的：一个没有描述就发布的 skill 在生产中会静默使 AI 自动触发匹配器失败，因此我们在 init 时大声失败。

`configurators/shared.ts:wrapWithCommandFrontmatter` — 对命令面板条目使用相同形状（`---\nname: …\ndescription: …\n---`）。使用单独的 `COMMAND_DESCRIPTIONS` 注册表。当前仅被 Qoder 的 `resolveCommands(ctx)` → 自定义命令 frontmatter 路径使用。两个注册表存在的目的是：skill 描述是针对 AI 匹配器的长散文；命令描述是显示在面向用户面板中的一行祈使句。

### 高级模板解析器

这些返回 `ResolvedTemplate[]`（`{ name, content }`），是配置器的规范入口点。使用它们；不要在配置器中手动拼接 `getCommandTemplates() + resolvePlaceholders + wrapWithSkillFrontmatter` — 那样会重新实现过滤和跳过规则，这就是漂移蔓延的方式。

`configurators/shared.ts:resolveCommands` — 将命令模板作为纯命令（无 frontmatter）返回。由具有原生命令接口的平台使用（Cursor、Claude、Gemini、OpenCode 等）。在 `agentCapable && hasHooks` 平台上过滤掉 `start.md` — SessionStart 风格的 hook 注入了 workflow 概述，因此面向用户的 `/start` 将是冗余的。**条件是双标志的，不是单标志的**（0.6.4 中在 ZCode init bug 之后更改）：具有 `agentCapable=true, hasHooks=false` 的平台（Codex、ZCode、OpenCode、Reasonix）保留 `start`，以便用户可以手动加载 workflow 上下文 — 没有 hook 为他们触发。

Pi 是在 `configurators/pi.ts` 中处理的例外：`session_start` 仅通知，不能变更模型可见的上下文，因此 Pi 保留生成的 `.pi/prompts/trellis-start.md` 回退，而其扩展通过第一个 `before_agent_start` 注入紧凑的启动上下文。配置器仍必须通过 `resolveCommands({ ...ctx, hasHooks: false })` 派生回退，而不是直接读取公共命令模板，以便占位符渲染和未来的命令转换保持集中。

`configurators/shared.ts:resolveSkills` — 返回 5 个单文件 workflow skills（`brainstorm`、`before-dev`、`check`、`break-loop`、`update-spec`），包装了 skill frontmatter 和平台特定的 `{{CMD_REF}}` 渲染。由「both」平台使用 — 那些发出原生命令和 skills 的平台（Qoder、带有 `.cursor/skills` 的 Cursor、Devin）。

`configurators/shared.ts:resolveSkillsNeutral` — 相同的 5 个 skills，但使用 `resolvePlaceholdersNeutral`。对任何目标是 `.agents/skills/` 的 skill 集使用此函数。

`configurators/shared.ts:resolveAllAsSkills` — 将命令模板折叠为 skill 格式（带有 `trellis-` 前缀和 skill frontmatter）。由仅 skills 平台使用（Codex、Kiro、Qoder 在发出 workflow skills 时）。仅当 `agentCapable && hasHooks` 时过滤 `start`（与 `resolveCommands` 相同的规则）；没有 hooks 的仅 skills 平台（Codex、Reasonix）获得 `trellis-start` skill，以便 `<trellis-bootstrap>` 注意到并手动 `/skill trellis-start` 调用可以解析。

`configurators/shared.ts:resolveAllAsSkillsNeutral` — 相同，但是中性的。由 Codex / ZCode 用于 `.agents/skills/` 中的命令即 skill 文件（`trellis-continue/SKILL.md`、`trellis-finish-work/SKILL.md`，以及 — 在无 hook 平台上 — `trellis-start/SKILL.md`）。当多个平台写入 `.agents/skills/` 时，要求字节相同；通过中性渲染器运行是使其成立的原因。

`configurators/shared.ts:resolveBundledSkills` — 将多文件内置 skills（当前为 `trellis-meta`）解析为 `ResolvedSkillFile[]`。每个条目在 skill 名称下有一个 POSIX 相对路径（例如，`trellis-meta/references/core/template-pipeline.md`）。捆绑的 `SKILL.md` 已经拥有自己的 frontmatter — 此辅助函数**不**包装它。配置器必须将这些传递给 `writeSkills()`（init）和 `collectSkillTemplates()`（update），以保持哈希跟踪对齐。

### 写入辅助函数

`configurators/shared.ts:writeSkills` — 将单文件 workflow skills 写入为 `<skillsRoot>/<name>/SKILL.md`，加上任何捆绑 skill 文件在其相对路径。在每次写入时调用 `replacePythonCommandLiterals`。幂等。

`configurators/shared.ts:writeAgents` — 将 agent 定义写入为 `<agentsDir>/<name><ext>`。默认扩展名是 `.md`；对 Codex 传递 `".toml"`，对 Kiro 传递 `".json"`。由每个具有 agents 目录的配置器使用。

`configurators/shared.ts:writeSharedHooks` — 从 `templates/shared-hooks/` 复制为 `platform` 注册的平台无关 Python hook 脚本，对每个应用 `replacePythonCommandLiterals`。列表由 `templates/shared-hooks/index.ts:getSharedHookScriptsForPlatform` 确定。Class-2（pull-based）平台获得相同列表**减** `inject-subagent-context.py` — 它们不能变更子 agent 提示。扩展支持的平台（Pi Agent）根本不能调用此函数。

`configurators/shared.ts:collectSkillTemplates` — 返回 `writeSkills` 产生的相同 `Map<path, content>`，用于哈希跟踪。`writeSkills` 和 `collectSkillTemplates` 都接受相同的 `(skillsRoot, skills, bundledSkills)`，因此配置器可以在 init 和 update 路径之间共享单个已解析集。在任一调用中跳过捆绑参数是使两条路径漂移的规范方式。

### 基于拉取的序言（class-2 平台）

`configurators/shared.ts:SubAgentType` — `"implement" | "check"`。`research` 被有意排除 — research 不依赖于活跃任务；它遍历 spec 树。

`configurators/shared.ts:buildPullBasedPrelude` — 返回标准的「Required: Load Trellis Context First」块。由 hook 不能注入子 agent 提示的 class-2 平台使用（Gemini、Qoder、Codex、Copilot）。序言告诉子 agent：（1）从分发提示中读取 `Active task: <path>`；（2）回退到 `task.py current --source`；（3）询问用户。为什么需要所有三层，参见 `platform-integration.md`「Active task discovery on class-2 platforms (issue #225)」。

`configurators/shared.ts:detectSubAgentType` — 从像 `trellis-implement.md` 这样的文件名返回 `"implement"` / `"check"` / `null`。剥离 `.md`、`.toml`、`.prompt.md`。对 `trellis-research` 和未知名称返回 `null` — 它们跳过序言。

`configurators/shared.ts:injectPullBasedPreludeMarkdown` — 在 markdown agent 的 YAML frontmatter 之后插入序言，或如果没有 frontmatter 则前置它。

`configurators/shared.ts:injectPullBasedPreludeToml` — 在 Codex 的 `developer_instructions = """` 块内插入序言。如果正则不匹配则为空操作（防御性 — Codex agents 总是有 `developer_instructions`，但如果未来的 agent 跳过它，序言只是被省略而不是破坏 TOML）。

`configurators/shared.ts:applyPullBasedPreludeMarkdown` — 对 `AgentContent` 列表应用。由 class-2 markdown 配置器使用的便利包装器；其 `name` 不解析为 `implement`/`check` 的 agents 不变地通过。

`configurators/shared.ts:applyPullBasedPreludeToml` — Codex 的 TOML 等效。

转换必须在 class-2 平台的**两个** `configure*()`（写入路径）和 `collectPlatformTemplates.*`（清单路径）中应用；否则哈希跟踪会反复变化。

### Copilot frontmatter 标准化

`configurators/shared.ts:normalizeCopilotMarkdownAgents` — Copilot 的 `tools:` frontmatter 使用与规范 Claude 词汇表不同的词汇表（`read` / `edit` / `search` / `execute` / `web` / `exa/*` vs `Read` / `Write` / `Edit` / `Glob` / `Grep` / `Bash` / `mcp__exa__*`）。此辅助函数将 markdown agent 的 `tools:` 行从规范词汇重写为 Copilot 词汇。在写入和收集路径中都应用。

内部的 `mapLegacyToolToCopilot` 表是映射的权威来源；如果 Copilot 扩展其工具词汇表，编辑该 switch 并添加回归测试。

---

## 占位符替换语义

解析在**模板写入时**发生（`trellis init`、`trellis update`）。没有运行时占位符 — 当 hook 脚本或 agent 定义写入磁盘时，每个 `{{…}}` 已消失。

### 替换表

| 占位符 | 来源 | 解析者 | 注意 |
|-------------|--------|-------------|-------|
| `{{PYTHON_CMD}}` | `getPythonCommandForPlatform()` | `resolvePlaceholders`、`resolvePlaceholdersNeutral`、`replacePythonCommandLiterals`（逐行，每次写入时额外应用） | Init 在探测主机后解析一次；测试必须 `resetResolvedPythonCommand()` |
| `{{CMD_REF:name}}` | `ctx.cmdRefPrefix` | `resolvePlaceholders`（每平台）/ `resolvePlaceholdersNeutral`（`` `name` (Trellis command) ``） | 对任何 `.agents/skills/` 写入使用中性形式 |
| `{{EXECUTOR_AI}}` | `ctx.executorAI` | 两个渲染器 | 用于提示散文的 AI 执行器描述 |
| `{{USER_ACTION_LABEL}}` | `ctx.userActionLabel` | 两个渲染器 | UI 标签，例如「in chat」 |
| `{{CLI_FLAG}}` | `ctx.cliFlag` | 两个渲染器 | 例如 `claude`、`codex`，在 `--platform` 示例中使用 |
| `{{#AGENT_CAPABLE}}…{{/AGENT_CAPABLE}}` | `ctx.agentCapable` | 两个渲染器 | 当 true 时保留块 |
| `{{^AGENT_CAPABLE}}…{{/AGENT_CAPABLE}}` | `ctx.agentCapable` | 两个渲染器 | 当 false 时保留块 |
| `{{#HAS_HOOKS}}…{{/HAS_HOOKS}}` | `ctx.hasHooks` | 两个渲染器 | 当 true 时保留块 |
| `{{^HAS_HOOKS}}…{{/HAS_HOOKS}}` | `ctx.hasHooks` | 两个渲染器 | 当 false 时保留块 |

添加新占位符需要三处更改 — `shared.ts` 顶部的正则常量、`resolvePlaceholders` 中的替换，以及 `resolvePlaceholdersNeutral` 中的相同替换。忘记中性渲染器对任何写入 `.agents/skills/` 的平台来说是一个静默 bug。

### 条件块清理

在条件块被剥离后，两个渲染器运行 `RE_BLANK_LINES = /\n{3,}/g` → `\n\n` 以折叠已删除块留下的空白区域。这意味着模板可以使用通过空行与周围散文分隔的 `{{#FLAG}}…{{/FLAG}}`，当标志为 false 时不会产生 5 行间隙。

---

## 跨配置器不变量

配置器必须遵守这些。它们不由类型强制执行；`test/configurators/` 和 `test/regression.test.ts` 中的测试捕获大多数违规。

- **Init 和 update 逐字节一致。**`configure*()` 在 init 期间写入的每个文件必须在 `collectPlatformTemplates.*` 中以字节相同的内容出现，用于 update 哈希跟踪。任何写入后转换（`resolvePlaceholders`、`replacePythonCommandLiterals`、`wrapWithSkillFrontmatter`、`injectPullBasedPreludeMarkdown`、`normalizeCopilotMarkdownAgents`）必须在两个路径中都运行。
- **`replacePythonCommandLiterals` 在写入时运行。**此文件中的辅助函数已在 `writeSkills` / `writeAgents` / `writeSharedHooks` 内调用它。进行自己 `await writeFile(...)` 的配置器必须显式调用它。如果 `collectTemplates()` 返回替换后的字符串，写入必须产生相同的字符串。
- **`.agents/skills/` 写入使用 `resolvePlaceholdersNeutral`。**参见 `platform-integration.md`「Rule: `.agents/skills/` writes use `resolvePlaceholdersNeutral()`」。每平台 skill 根目录（`.claude/skills/`、`.qoder/skills/` 等）继续使用 `resolvePlaceholders`。
- **Class-2 agent 定义携带基于拉取的序言。**`applyPullBasedPreludeMarkdown` / `applyPullBasedPreludeToml` 必须在每个 class-2 平台的 `trellis-implement` 和 `trellis-check` 定义上运行（research 有意豁免）。
- **基于拉取的序言措辞在每个 class-2 平台上相同。**它们都调用 `buildPullBasedPrelude`。手写自己序言的平台破坏了 `platform-integration.md`「Active task discovery on class-2 platforms」中记录的跨平台契约。
- **仅在 `agentCapable && hasHooks` 平台上过滤 `start.md`。**`filterCommands` 是私有的；`resolveCommands` / `resolveAllAsSkills` / `resolveAllAsSkillsNeutral` 应用它。当 `hasHooks=false` 时过滤器有意保留 `start`（Codex / ZCode / OpenCode / Reasonix）— 这些平台没有 SessionStart 风格的 hook 来注入打开上下文，因此用户需要一个可调用的 `start`。配置器不得绕过这些解析器并直接调用 `getCommandTemplates()` — 这会重新引入带 hook 平台上不需要的 `start`。反过来，**配置器不得重新实现自己的「filter start」规则** — 这就是 0.5.5 → 0.6.4 Codex 特殊情况辅助函数（`resolveCodexTrellisStartSkill`）泄露到代码库并停留了三个发布线的方式。Pi 是唯一批准的提示回退例外，并且它仍然通过带有 Pi 上下文调整为 `hasHooks: false` 的 `resolveCommands` 获得 `start`。
- **Skill / 命令描述位于 `SKILL_DESCRIPTIONS` / `COMMAND_DESCRIPTIONS`。**添加 workflow skill 或面板命令需要在此添加描述；包装器辅助函数在描述缺失时在 init 时抛出。
- **捆绑 skills 已拥有 frontmatter。**`wrapWithSkillFrontmatter` 不得应用于 `resolveBundledSkills` 输出。`writeSkills` 和 `collectSkillTemplates` 正是出于这个原因分别接受捆绑文件。
- **Hooks 目录写入通过 `writeSharedHooks(dir, platform)`。**`platform` 参数驱动每平台包含列表。Class-2 平台自动丢失 `inject-subagent-context.py` — 配置器不得传递自己的任意文件列表。

---

## 边界

`configurators/shared.ts` 不：

- **编码平台特定布局。**每个平台写入的位置（`.claude/`、`.codex/`、`.gemini/` 等）由每平台配置器决定。共享辅助函数接受 `dir` 参数，不计算它。
- **读取用户输入。**Init 提示、`--user`、`--force` 标志、项目类型检测 — 全部在 `commands/init.ts` 和平台配置器的主体中。
- **触碰网络。**无模板获取；无版本探测。一切操作在从 `templates/common/index.ts` 和 `templates/shared-hooks/index.ts` 加载的捆绑模板上运行。
- **变更注册表。**`types/ai-tools.ts:AI_TOOLS` 从此文件是只读的。添加平台首先更新注册表，然后配置器文件消费它。
- **决定能力标志。**`agentCapable` / `hasHooks` 来自在 `configurators/index.ts` 中构建的 `TemplateContext`；共享辅助函数仅读取它们。
- **触碰用户拥有的 spec 内容。**`.trellis/spec/`、`.trellis/.developer`、`.trellis/tasks/`、`.trellis/workspace/`、`.trellis/.current-task` 是受保护路径，由 `commands/update.ts` 迁移逻辑拥有，不由配置器拥有。
- **缓存已解析 Python 命令以外的任何内容。**唯一的模块状态（`resolvedPythonCommand`）存在是因为 init 运行一次，配置器之后被重复调用。任何具有跨调用生命周期的其他内容属于 `commands/init.ts` 调用点，不在这里。

---

## 常见陷阱

### 向 `shared.ts` 添加平台特定行为

Wrong：

```typescript
// 在 shared.ts 中
export function wrapClaudeAgent(name: string, content: string): string {
  return `---\nname: ${name}\ntype: claude-agent\n---\n${content}`;
}
```

Correct：该包装属于 `configurators/claude.ts:configureClaude`。仅当第二个配置器需要它们时才将辅助函数提升到 `shared.ts`。

### 忘记 `.agents/skills/` 的中性渲染器

Wrong：

```typescript
// 在 configurators/codex.ts 中
files.set(".agents/skills/check/SKILL.md", resolvePlaceholders(tmpl, ctx));
```

Correct：

```typescript
files.set(".agents/skills/check/SKILL.md", resolvePlaceholdersNeutral(tmpl, ctx));
```

或调用 `resolveSkillsNeutral(ctx)` / `resolveAllAsSkillsNeutral(ctx)`。中性渲染器使字节相同在目标相同路径的平台之间成立。

### Init 通过辅助函数写入，update 收集渲染原始内容

Wrong：

```typescript
// configureFoo
await writeAgents(dir, applyPullBasedPreludeMarkdown(agents));
// collectFoo
files.set(`${dir}/${a.name}.md`, a.rawContent);  // 缺少序言
```

Correct：在两个路径中将相同的 agent 列表通过 `applyPullBasedPreludeMarkdown` 输入，然后将结果分别传递给 `writeAgents` 和 `collectTemplates`。在每次稳定安装上的 `trellis update` 之后，哈希跟踪器必须报告零更改。

### 在配置器中直接调用 `getCommandTemplates()`

Wrong：

```typescript
const cmds = getCommandTemplates();   // 无条件包含 start.md
for (const cmd of cmds) {
  await writeFile(path.join(dir, `${cmd.name}.md`), cmd.content);
}
```

Correct：

```typescript
for (const cmd of resolveCommands(ctx)) {
  await writeFile(path.join(dir, `${cmd.name}.md`), cmd.content);
}
```

`resolveCommands` 仅为 `agentCapable && hasHooks` 平台过滤 `start`，并运行 `resolvePlaceholders`。直接迭代会重新引入不需要它的平台上的 `start`（带 hook 的平台）并跳过占位符解析。

Pi 特定回退：

```typescript
const start = resolveCommands({ ...piCtx, hasHooks: false }).find(
  (command) => command.name === "start",
);
```

这仅因为 Pi 的 `session_start` 事件不能注入模型可见的上下文才被允许。将回退保留在 Pi 的配置器中，不要在共享过滤逻辑中。

### 忘记在自定义写入中调用 `replacePythonCommandLiterals`

Wrong：

```typescript
// 绕过 writeAgents / writeSkills 的自定义写入
await writeFile(path.join(dir, "custom.py"), template);
```

Correct：

```typescript
await writeFile(path.join(dir, "custom.py"), replacePythonCommandLiterals(template));
```

如果 init 写入 `python3` 但主机是 Windows 上 `python3` 不存在的环境，脚本在运行时会静默失败。此文件导出的每个辅助函数已处理它；即席写入必须显式调用它。

### 缺少 skill / 命令描述

Wrong：在 `templates/common/skills/foo.md` 下添加新 skill 模板而不注册其描述。

Correct：编辑 `configurators/shared.ts` 中的 `SKILL_DESCRIPTIONS` 添加新条目，然后添加一个回归测试断言 `wrapWithSkillFrontmatter("trellis-foo", "...")` 不抛出。init 时的抛出是防止发布 AI 匹配器永远无法触发的 skill 的安全网。

### 对 research 应用序言

Wrong：

```typescript
// 在 configureGemini 中，手动
for (const agent of agents) {
  agent.content = injectPullBasedPreludeMarkdown(agent.content, "implement");
}
```

这对即使没有活跃任务的 `trellis-research` 也应用序言。Correct：使用 `applyPullBasedPreludeMarkdown(agents)` — `detectSubAgentType` 对 research 返回 `null`，因此辅助函数将其不变地通过。

### Class-1 平台调用 `applyPullBasedPreludeMarkdown`

Wrong：一个 hook-inject 平台（Claude、Cursor、CodeBuddy、OpenCode、Kiro、Droid）在其 agent 定义上运行 `applyPullBasedPreludeMarkdown`。

Correct：hook-inject 平台通过 `inject-subagent-context.py`（或 OpenCode 的 plugin）注入上下文。将序言添加到 agent 定义会重复上下文负载 — 一次通过 hook 提示变更，一次通过 agent 的启动自加载。仅 class-2 平台应用序言。

### 在配置器辅助函数内直接读取 `process.platform`

Wrong：

```typescript
// 在每平台配置器中
const pythonCmd = process.platform === "win32" ? "python" : "python3";
```

Correct：

```typescript
const pythonCmd = getPythonCommandForPlatform();
```

`process.platform` 忽略 init 填充的已解析缓存。在 Windows 主机上 init 解析为 `py -3` 时，错误的形式写入文字 `python` 并在运行时失败。

### 在模块作用域缓存

Wrong：在 `shared.ts` 中添加第二个模块级 `let` 来记忆已解析 Python 命令以外的任何内容。

Correct：配置器从 `configurators/index.ts:configurePlatform` 和 `configurators/index.ts:collectPlatformTemplates` 调用。通过参数传递派生值。此文件中唯一的模块状态是 `resolvedPythonCommand`，它存在是因为 init 在与配置器驱动的没有 init 的测试运行中基于独立的进程边界运行。

---

## 测试约定

此文件中的大多数行为由以下覆盖：

- `test/configurators/index.test.ts` — 执行 `resolvePlaceholders`、`resolvePlaceholdersNeutral`、条件块、`start` 过滤、`wrapWithSkillFrontmatter` 缺失描述时抛出。
- `test/configurators/platforms.test.ts` — 每平台 `configurePlatform()` 写入预期文件，`collectPlatformTemplates()` 返回匹配内容。
- `test/regression.test.ts` — 历史问题门控：init/update 之间的 pull-based 序言对齐（issue #225）；`.agents/skills/` 中性渲染字节相同；Codex `trellis-start` skill 在 init 和 update 之后都出现。
- `test/templates/<platform>.test.ts` — 相关解析器返回每个平台的预期集合。

向 `shared.ts` 添加新辅助函数时：

1. 在 `test/configurators/index.test.ts` 中添加单元测试，直接执行契约（输入 → 输出、错误案例、幂等性）。
2. 如果辅助函数被 `configure*()` 和 `collectTemplates()` 两者调用，添加一个回归测试断言两者输出之间字节相同，至少对于一个平台（`test/regression.test.ts` 是正确的归宿 — 与现有的 `[init-update-parity]` 案例分组）。
3. 如果辅助函数引入新占位符，一起扩展 `resolvePlaceholders` 和 `resolvePlaceholdersNeutral`；`test/configurators/index.test.ts` 的测试套件包括捕获单个渲染器添加的「中性渲染器相等性」案例。
4. 如果辅助函数更改现有模板的渲染输出，运行 `pnpm test` 并目视确认平台集成测试中的差异；失败通常指向 init/update 对的一侧缺少转换。

删除辅助函数时：

- 首先在每个配置器中删除使用（`grep -r "helperName" packages/cli/src/configurators/`），然后从 `shared.ts` 中移除。首先从 `shared.ts` 移除会留下如果导入仍然存在则可以编译的过时调用点 — TypeScript 仅捕获裸引用，而不是稍后意外重新引入相同名称的已删除导出。
- 删除后运行 `pnpm typecheck`，然后运行 `pnpm test` — 类型错误通常在这里出现在测试失败之前，因为每个配置器直接导入 `shared.ts`。
