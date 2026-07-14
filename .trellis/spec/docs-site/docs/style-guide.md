# 风格指南（Style Guide）

> 文档的写作风格和内容标准。

---

## 语调与语气（Voice and Tone）

### 指南

| 方面（Aspect） | 指导原则 |
| ---------- | ------------------------------------------------------- |
| **语调（Voice）** | 专业、友好、直接 |
| **时态（Tense）** | 现在时（"点击按钮"而非"你将点击"） |
| **人称（Person）** | 第二人称（"你可以……"而非"用户可以……"） |
| **语气（Mood）** | 指令使用祈使句（"运行该命令"） |

### 示例

**好：**

> Run the following command to start the server.

**避免：**

> The user should run the following command to start the server.

---

## 页面结构（Page Structure）

### 标准页面模板

```mdx
---
title: 'Clear, Action-Oriented Title'
description: 'What the reader will learn or accomplish (150 chars)'
---

Brief introduction paragraph explaining what this page covers.

## First Major Section

Content here...

### Subsection if needed

More detail...

## Second Major Section

Content here...

## Next Steps

Links to related content or next actions.
```

### 标题层级（Heading Hierarchy）

| 级别（Level） | 用法（Usage） |
| ----- | ---------------------------------------- |
| H1    | 永远不要使用（标题来自 frontmatter） |
| H2    | 主要章节 |
| H3    | 子章节 |
| H4    | 极少需要，尽可能避免 |

---

## 写作指南（Writing Guidelines）

### 标题（Titles）

| 类型（Type） | 格式（Format） | 示例（Example） |
| --------------- | ------------- | ------------------------------------- |
| 页面标题 | Title Case | "Getting Started with the API" |
| 章节标题 | Sentence case | "Configure your settings" |
| 描述（Description） | Sentence | "Learn how to set up authentication." |

### 技术架构类页面开头

技术架构页面应以系统论点开头，然后立即用具体的范围、模块和真实来源文件加以支撑。当产品定位提及正在记录的架构时是可接受的；面向读者的叙事性描述则不是。

**好：**

> Trellis is a Team-level Agent Harness with built-in LLM wiki. In implementation terms, that means two systems share the same project files: the agent harness controls workflow execution, and the LLM wiki stores specs, tasks, research, and journals.

**避免：**

> This page is for contributors and fork modders: engineers extending Trellis itself, not end users.

**原因**：架构文档应当保留概念模型，但开头必须迅速成为技术地图。面向读者的标签和无依据的定位性文字会让页面读起来像推介而不是技术契约。

### 列表（Lists）

**使用无序列表的情况：**

- 非顺序性条目
- 功能列表
- 需求列表

**使用有序列表的情况：**

1. 分步说明
2. 有序流程
3. 按优先级排列的条目

### 代码引用（Code References）

- 使用反引号引用内联代码：`npm install`
- 使用代码块显示多行代码
- 始终指定语言以进行语法高亮

---

## 内容类型（Content Types）

### 概念性内容（Conceptual Content）

解释某个事物是什么以及为什么重要。

```mdx
## What is Authentication?

Authentication verifies the identity of users accessing your API.
It ensures that only authorized users can perform actions.
```

### 流程性内容（Procedural Content）

完成某项任务的分步说明。

```mdx
## Set Up Authentication

1. Navigate to the Dashboard
2. Click **Settings** > **API Keys**
3. Click **Generate New Key**
4. Copy the key and store it securely
```

### 参考性内容（Reference Content）

技术规范和 API 细节。

```mdx
## API Response Codes

| Code | Meaning      |
| ---- | ------------ |
| 200  | Success      |
| 400  | Bad Request  |
| 401  | Unauthorized |
| 500  | Server Error |
```

### 架构类内容（Architecture Content）

架构和系统概览页面应在列出组件之前先解释请求或工作流路径。

```mdx
## From one request

Explain how a user action moves through the system:
input -> state lookup -> context selection -> execution -> verification
-> persistence.

## Component recap

Summarize each component after the reader understands why it appears.
```

**原因**：以组件为先的页面迫使读者在理解每个组件解决的问题之前就去记忆名称。以工作流为先的路径展示了每个文件、hook、脚本或角色何时变得必要，然后回顾表格会加强该模型。

**参考细节**：将详尽的字段表格、路径矩阵和每个平台的配置放在参考页面或附录中。架构页面应当进行总结并链接到这些参考资料，而非重复它们。

---

## 格式化标准（Formatting Standards）

### 强调（Emphasis）

| 样式（Style） | 用法（Usage） | Markdown |
| -------- | ---------------------------- | ------------ |
| **加粗** | UI 元素、重要术语 | `**text**` |
| _斜体_   | 引入新术语 | `*term*` |
| `代码`   | 命令、文件名、代码 | `` `code` `` |

### 链接（Links）

**内部链接：**

```mdx
See the [quickstart guide](/quickstart) for setup instructions.
```

**外部链接：**

```mdx
Read the [official documentation](https://example.com/docs).
```

### 图片（Images）

```mdx
![Alt text description](/images/screenshot.png)
```

始终包含描述性的 alt 文本。

---

## 最佳实践（Best Practices）

### DO

- 从最重要的信息开始
- 使用具体示例
- 保持段落简短（最多 3-4 句）
- 在技术内容中包含代码示例
- 链接到相关内容

### DON'T

- 假设读者拥有先验知识而不链接到前置条件
- 在没有解释的情况下使用行话
- 写大段文字而不设置视觉分隔
- 跳过图片的 alt 文本
- 使用模糊的语言（"simply"、"just"、"easily"）

---

## Changelog / Release Notes 语调

Release notes（`docs-site/changelog/v*.mdx` 和 `docs-site/zh/changelog/v*.mdx`）由决定是否升级的运维人员和回答版本问题的 AI agent 阅读。它们是**参考文档**，而不是产品叙事。语调应匹配 `kubectl` / Rust release notes，而非营销文案。

### 规范：技术语调（Technical voice）

**是什么**：每个章节以一句话陈述变更内容开头，接着是具体标识符（文件路径、函数名、标志、迁移条目）。优先使用表格、代码块和列表，而非段落。不设反问句、不带感情色彩的语言、不使用填充副词。

**为什么**：浏览 changelog 的用户希望快速回答"这会影响我吗，我该做什么？"。叙事背景（"然后呢？然后就没然后了"）将实际变更推到页面更深处，并告诉读者该如何感受，而非告诉他们变更了什么。这也会随着时间的推移而显得陈旧——六个月后唯一的读者是 grep `phase.py` 或 `init.ts:1370` 的 AI，而不是重温 UX 故事的人。

**示例（changelog 条目）：**

```markdown
### Joiner onboarding task

`trellis init` now dispatches on two filesystem flags:

| `.trellis/` | `.trellis/.developer` | Generated task |
|---|---|---|
| missing | n/a | `00-bootstrap-guidelines` (creator, unchanged) |
| present | missing | `00-join-<slug>` (new: joiner flow) |
| present | present | none (same-dev re-init) |

`.trellis/.developer` is the per-checkout signal because it's listed in
`.trellis/.gitignore` and therefore absent on fresh clones.
`.trellis/workspace/<name>/` cannot serve this role — it's committed to git.
```

**相关**：上文的 `Best Practices > DON'T > use vague language`。Changelog 中的叙事性修饰语是同一反模式在文档层面的体现。

### 不要：Changelog 中的叙事性故事

**问题示例**：

```markdown
### Joiner 引导任务——新开发者不再进来一脸懵

这个版本之前，新开发者在一个已有 Trellis 项目上第一次跑 `trellis init` 几乎啥都不做：
只往 `.trellis/.developer` 写了个身份文件，然后呢？然后就没然后了。打开 AI 工具面对
的是一片空白，不知道 Trellis 是什么、团队约定在哪、自己该做什么。队友只能反复在
群里解释工作流。

beta.9 起，`trellis init` 按两个文件的存在状态分三种场景派发：
```

**为什么不好**：

- 反问句（"然后呢？然后就没然后了"）和情绪化表达（"一脸懵"、"反复在群里解释"）无助于升级决策。
- 实际变更（按两个标志派发 → 三个分支）被埋在第三段。
- 语言会随时间变得陈旧。六个月后，"一脸懵"读起来像噪音；派发表格仍然有效。
- 标题是结果陈述（"不再进来一脸懵"），而非功能名称。难以 grep。

**应改为**：

```markdown
### Joiner onboarding task

`trellis init` now dispatches on (`.trellis/`, `.trellis/.developer`) presence
to generate three task types: creator bootstrap, joiner onboarding, or no task.
```

以变更开头。背景（如有）放在第二段或可折叠的"Why"子章节中——不要放在开篇句中。

### 不要：章节膨胀

**不要在 changelog 中发布以下章节：**

- `## Tests` / `## Test Coverage`——"847/847 通过" / "5 个新回归测试"属于 commit message 的内容。用户关心的是行为，而非测试数量。
- `## Internal`（默认）——重构函数重命名、内部标志翻转、spec 文件编辑。仅在多平台/多版本设置中改变了用户可观察行为时才包含 Internal 条目。否则删除。
- `## Why` / `## Background` / `## Rationale`——多句解释。如果变更无法从一句话开头 + 表格/代码中清楚表达，说明条目过于模糊——拆分或精简。长篇理由属于任务 PRD 或 commit body。

**长度上限**：每个 `###` 章节不超过约 120 个单词。超过意味着你在解释而不是描述——需精简。

**允许的顶级章节**（有序，跳过空章节）：`Enhancements`（`feat`）、`Bug Fixes`（`fix`）、`Internal`（仅在用户可观察时）、`Upgrade`。不要有空标题。

### 章节标题规则

- **使用功能名称，而非结果**：`### Joiner onboarding task`，而不是 `### New developers aren't thrown into a black box anymore`。
- **跨翻译保持稳定**：在 `docs-site/changelog/` 和 `docs-site/zh/changelog/` 中使用相同的技术名词。
- **可 grep**：包含用户可能搜索的确切标识符（`task.json`、`trellis init`、`/trellis:finish-work`）。

### 背景故事放在别处

产品叙事（"我们为什么这样做"、用户引言、设计理由）应放在：

- **任务 PRD**（`.trellis/tasks/<task>/prd.md`）——开发期间
- **博客文章**（`docs-site/blog/`）——用于营销
- **Spec 决策记录**（`spec/*/` 设计决策章节）——用于持久的架构选择

Changelog 只记录发布了什么以及用户如何升级。

---

## 代码级文档的真实来源纪律（Source-of-Truth Discipline for Code-Level Docs）

当某个页面记录的是**代码级契约**——JSON schema、CLI 子命令表格、配置字段列表、文件路径引用、默认值——**先打开源文件**，逐字复制列表（字段顺序、名称、默认值），然后再写一行文字。不要凭记忆记录，也不要在未重新验证的情况下传播现有文档已有的内容。

### 为什么

文档会静默漂移。`task.json` schema 文档声称 `task.py create-pr` 和 `rejected` 状态在多个版本中存在——两者都从未在源码中出现过。Schema 字段顺序被打乱，注释描述了代码未实现的行为（"commit hash filled on archive"而实际上 `archive` 只写入了 `completedAt`）。这些每一个都离真相仅差约 30 秒的验证时间。

### 规则

在编写或编辑代码级参考文档之前：

1. 确定**规范来源（canonical source）**——通常是一个单独的文件（如 `task_store.py`、`init.ts`、Zod schema）。在文档中链接到它，以便审查者可以交叉检查。
2. **从源码复制字段顺序**。不要字母排序，不要"为了可读性"重新排列。
3. **在 commit message 中引用源码行号**（`task_store.py:147-172`），以便溯源可追踪。
4. 当注释描述了"何时填充此字段"——grep 每一个写入者。如果唯一的写入者是 `create()`，写明"写入为 null；没有其他代码路径更新它"——不要凭空捏造生命周期事件。
5. 当存在多个具有不同形态的写入者时（例如 `task_store.py` vs `init.ts` vs `update.ts`），要么记录所有变体，要么记录规范的那个，并提交一个代码清理任务以收敛它们。**不要用乐观的描述性文字掩盖分歧。**

### 常见错误：从之前的文档记录

**症状**：文档说字段 X 或子命令 Y 存在。读者尝试。什么也没发生。

**原因**：文档是从自身的先前版本复制来的。之前的版本就是错的。该字段/子命令是目标性的、已被移除或从未合并。

**修复**：对于每个代码级声明，grep 源码。如果没有代码路径写入/读取它，删除该声明。

**预防**：在编辑现有参考页面时，将之前的内容视为未经验证。唯一可信的版本是源文件。

---

## JSONL 上下文注入内容

当编写教用户了解 `implement.jsonl` / `check.jsonl` / `research.jsonl` 条目的文档、技能、命令或模板时，执行此内容规则：

### 规则

JSONL 条目指向**spec 文件**（`.trellis/spec/**`）或任务的**研究输出**（`{TASK_DIR}/research/**`）。它们不指向原始源文件（`src/services/foo.ts`）或原始源码目录（`packages/<pkg>/`）。

### 为什么

子 agent（Sub-agent）已经有 `Read` / `Grep` 工具。它们会按需拉取代码。将源文件注入 prompt：

- 在每次子 agent 生成时消耗 token，但这些代码可能与当前轮次无关
- 使 JSONL 条目快速衰减（代码会变动；JSONL 固定的路径在重构的那一刻就已过时）
- 给 AI 一种错误印象，认为注入的文件是"权威"代码，使 AI 偏向于使用它们，即使更好的代码存在于别处

相比之下，spec 和研究输出正是子 agent 在接触代码之前需要了解的规则和背景。它们是正确的载体。

### 示例

```jsonl
# Good — specs + research
{"file": ".trellis/workflow.md", "reason": "Workflow contract"}
{"file": ".trellis/spec/backend/api-module.md", "reason": "API module conventions"}
{"file": ".trellis/tasks/02-27-user-login/research/", "type": "directory", "reason": "Upstream research outputs"}

# Bad — raw code
{"file": "src/services/auth.ts", "reason": "Existing auth patterns"}
{"file": "src/services/", "type": "directory", "reason": "Existing service patterns"}
```

### 编写者检查

当你添加 JSONL 示例或编写调用 `task.py add-context` 的技能时：

- [ ] 路径是否在 `.trellis/spec/` 或 `{TASK_DIR}/research/` 下？
- [ ] 如果你想指向 `src/` 或 `packages/`，问自己：这真的是 agent 需要提前知道的*规则*，还是 agent 在需要时自己 grep 就能找到的代码？

---

## 墓碑章节：删除，不要归档

当内容因功能被移除而过时时，**直接删除内容**。不要留下"What was removed in vX.Y"表格或独立的"Appendix X: feature (removed)"页面。

### 为什么

墓碑章节：

- 污染 TOC 和页内侧边栏
- 重复了属于 changelog / migration manifest 而非参考文档的迁移指导
- 教读者学会浏览时忽略某些章节——"噪音章节"也会让他们习惯性地忽略合法内容
- 跨版本累积（每个版本添加一个；没有一个被删除）

### 规则

当功能被移除时：

1. 删除记录该功能的章节/页面。
2. 将"转而应做什么"的指导放在**一个地方**——release changelog 或 migration manifest 的 `notes` 字段。在移除该功能的那个版本的页面顶部用 `<Note>` 链接到它，然后在下一个版本中删除该提示。
3. 如果之前的章节被频繁交叉引用，检查入链并重定向它们；不要为了保留 URL 而保留墓碑。

### 示例

**错误**（在 0.5 审计中实际观察到的回归）：

```markdown
## Appendix E: worktree.yaml (removed)

This appendix previously documented…  Both the pipeline and this file
were removed in 0.5.0-beta.0 along with…
```

**正确**：删除 `appendix-e.mdx`，从 `docs.json` 中移除。在 0.5.0-beta.0 changelog 中注明 Multi-Agent Pipeline 已被移除，`worktree.yaml` 不再被读取。

---

## 管理 Release / Beta 双轨

Docs-site 有两个版本轨道：**Beta**（跟踪最新的 `@beta` npm 发布，当前为 0.5.x）和 **Release**（跟踪最新的稳定版，当前为 0.4.0 GA）。用户从版本下拉菜单中选择。只有部分内容与版本关联。

### 哪些是双轨的，哪些是单源的

| 同样存在于 `release/` 和 `zh/release/` 中 | 单源（仅顶层） |
|---|---|
| `guide/ch01` – `ch13`（概念、命令、平台矩阵） | `use-cases/` |
| `guide/appendix-a` – `appendix-f` | `showcase/` |
| `guide/index.mdx`、`index.mdx`（着陆页） | `blog/` |
| `changelog/`（版本条目） | `skills-market/` |
|  | `templates/` |
|  | `contribute/` |

**经验法则**：任何描述*Trellis 目前如何工作*的内容是双轨的（因为这每个版本都会变）。任何营销、社区或资源发现类的内容保持单源——这些页面不因版本而变化，维护两份容易漂移的副本只会浪费精力而无用户收益。

如有疑问，问自己："0.4 用户是否会在此页面上看到与 0.5 用户真正不同的内容？"如果不会，就是单源的。

### 平台数量的真实来源

平台数量会跨版本漂移（0.4 = 14 个平台，0.5 = 移除 iFlow 后为 13 个）。**始终从你正在记录的版本的 CLI 源码中推导数量，而非从之前的文档。**

```bash
# 对于 Release 轨道（记录 0.4.0 GA）
git ls-tree v0.4.0 packages/cli/src/configurators/ | grep '\.ts$' \
  | awk -F'[\t/]' '{print $NF}' | grep -v 'index\|shared\|workflow'

# 对于 Beta 轨道（记录当前 HEAD）
ls packages/cli/src/configurators/*.ts | xargs -n1 basename \
  | grep -v 'index\|shared\|workflow'
```

数量 = `（configurator 文件数量）-（index.ts + shared.ts + workflow.ts）`。

### 特定版本的每个平台目录布局

要记录 `trellis init --<platform>` 在给定版本中实际写入的内容：

```bash
git show v0.4.0:packages/cli/src/configurators/qoder.ts | head -60
git ls-tree -r v0.4.0 packages/cli/src/templates/qoder/
```

不要从记忆中或从当前 beta 模板推断——0.5 在 0.4 中没有 `hooks/` 和 `rules/` 的平台上添加了这些目录，因此当前 beta 的列表会错误地描述 0.4。

### 孤立的 changelog 文件

当 `release/changelog/v*.mdx` 文件在磁盘上存在但在 `docs.json` 的 Release 下拉中没有条目时，它就是死内容——Mintlify 不会在任何导航中渲染它，用户只能通过猜测 URL 来访问。删除它。

```bash
# 列出孤立文件（磁盘上存在，但不在 docs.json 中）
cd docs-site
for f in release/changelog/*.mdx; do
  base=$(basename "$f" .mdx)
  grep -q "\"release/changelog/$base\"" docs.json || echo "$f"
done
```

常见来源：当轨道使用 `cp -r` 从 beta 分支出来时，预发布 changelog 文件也一起过来，但 Release 下拉被手动白名单限制为仅稳定版本。结果：每种语言产生 30+ 个孤立 MDX。

### 每个轨道叫什么

- **Beta 轨道** = `guide/`、`changelog/`、`index.mdx`（在顶层）——最新的 `@beta` 内容
- **Release 轨道** = `release/guide/`、`release/changelog/`、`release/index.mdx`——最新稳定版的快照
- `docs.json` 导航有独立的 Beta 和 Release 块。每种语言（EN、ZH）都有两者，因此**总共 4 个导航块**。

在轨道之间切换内容是通过 `cp -r` 手动更新 `docs.json` 来完成的——没有自动化。重构时记得更新**所有四个导航块**（EN Beta、EN Release、ZH Beta、ZH Release）。

### 当稳定版 GA 升级时

当 0.5 达到 GA 时：

1. 决定是将 beta 内容推广到 release（覆盖冻结的 0.4 快照）还是保留两个轨道。通常是推广。
2. `cp -r guide/ release/guide/`（EN）和 `cp -r zh/guide/ zh/release/guide/`（ZH）
3. 更新 `docs.json` 中 release 轨道的 Changelog 白名单，包含新的稳定版本
4. 更新 docs.json navbar 中的版本切换器标签（Release = "最新稳定版" 而非 "0.4"）
5. 从 `release/changelog/` 中删除不应出现在仅稳定版白名单中的预发布 changelog 文件
6. Beta 轨道继续向下一 major（0.6）演进

### 常见错误：从当前模板记录 Release 轨道

**症状**：你编写 Release 轨道文档（记录 0.4.0 GA）并从当前目录树中获取细节——例如 `cat packages/cli/src/configurators/qoder.ts` 或 `ls packages/cli/src/templates/qoder/`。结果：文档声称 0.4.0 生成的路径仅存在于 0.5 beta 中（`.qoder/rules/`、`.qoder/hooks/`），或者 0.5 独有的平台被记录为 0.4 的。用户在 0.4.0 上尝试 `trellis init --qoder` 时看到完全不同的布局。

**原因**：当前目录树始终是 beta 当前版本。Release 轨道文档必须反映已标记的稳定版本，这才是 `@stable` 用户实际得到的内容。

**修复**：在编写 Release 文档时始终查询已标记的版本。Release 轨道中对文件路径、配置形态或平台能力的每一个内联引用都应追溯到 `git show v<stable-version>:...` 或 `git ls-tree v<stable-version> ...`，永远不要追溯到工作目录树。

**预防**：当你打开一个文件来记录 Release 轨道的行为时，第一个按键应该是 `git show v<version>:` 而不是 `cat`。如果觉得这样不方便，保持一个终端标签页固定在 `git log --oneline v<stable-version>^..v<stable-version>` 上，使标签始终在范围内。

### 常见错误：从现有文档中计算平台数量

**症状**：文档说 Trellis 支持 N 个平台，但实际数量不同。最坏情况：你从之前的文档继承了一个错误的数字，将其传播，然后花一个会话来重新修复每个提及的地方。（在 0.4.0 Release 审计中观察到：之前的文档声称 6 个平台，下一轮达到 12 个，实际是 14——CodeBuddy 和 Antigravity 被静默发布但从未被记录。）

**原因**：文档会静默漂移。当向 CLI 添加平台时，文档更新是手动的且容易被遗忘。从文档计算数量会将之前的每次遗漏都叠加起来。

**修复**：规范数量是 `git ls-tree v<version> packages/cli/src/configurators/ | grep '\.ts$' | grep -vE 'index|shared|workflow' | wc -l`。

**预防**：当平台数量出现在文档中（表格、标语、架构图、FAQ）时，在相信之前的文档之前，针对目标版本的 configurator 目录交叉检查。将每个平台数量声明视为未经验证，直到你亲自运行了该计数。

---

## 质量检查清单（Quality Checklist）

发布前：

- [ ] 标题清晰且具有描述性
- [ ] Description 不超过 160 字符
- [ ] 标题遵循层级（H2 > H3）
- [ ] 代码示例经过测试且正确
- [ ] 链接有效且指向正确的页面
- [ ] 图片具有 alt 文本
- [ ] 内容可快速浏览（列表、表格、短段落）
- [ ] 对于代码级参考页面：每个字段/子命令/标志追溯到你在编写时打开的具名源文件
- [ ] JSONL 示例注入 spec 或研究，而非原始代码
- [ ] 对于已移除的功能，没有"removed in vX.Y"的墓碑章节
- [ ] 如果你触碰了双轨页面（`guide/*`、`appendix-*`、`index.mdx`），同时更新了 Beta 和 Release 副本（EN 和 ZH 各一份 = 共 4 个文件需触碰）
- [ ] 如果你触碰了单源页面（`use-cases/`、`showcase/`、`blog/`、`skills-market/`、`templates/`、`contribute/`），没有在 `release/` 下创建副本
- [ ] 平台数量/列表追溯到 `git ls-tree v<target-version> packages/cli/src/configurators/`，而非之前的文档或记忆
- [ ] 所有四个 `docs.json` 导航块（EN Beta / EN Release / ZH Beta / ZH Release）保持一致
