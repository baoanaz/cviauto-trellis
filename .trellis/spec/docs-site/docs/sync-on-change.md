# Docs-Site 同步矩阵（Sync Matrix）

> 当 Trellis 的**工作流（workflow）**、**平台（platforms）**、**命令（commands）**或**技能（skills）**发生变更时，哪些 docs-site 页面必须同步更新。这是一份面向文档的具体"审计所有写入者（Audit ALL Writers）"检查清单。

---

## 为什么需要此文档

Docs-site 是一个落后于模板代码的 submodule。在发布变更时遗漏文档更新会产生虚假声明（文档说"运行 `init-context`"，而该命令已被移除）。这已经发生过——参见 init-context-removal 任务（2026-04-23），其中在一次实现之后仍有 8 个 MDX 页面引用了已删除的命令。

经验法则：**如果变更涉及 `packages/cli/src/templates/` 或 `packages/cli/src/migrations/`，在合并前 grep 以下矩阵。**

## 版本范围门禁（Version Scope Gate）

在应用以下任何触发器之前，确定变更行为属于稳定版、beta 还是 RC 文档。文件路径必须与该决策匹配：

- 稳定版 / GA 内容：root 版本化路径，如 `start/**`、`advanced/**` 及其 `zh/**` 镜像。
- Beta 内容：仅 `beta/**` 和 `zh/beta/**`。
- RC 内容：仅 `rc/**` 和 `zh/rc/**`。

永远不要将 beta 工作流、产物模型、平台契约或安装说明复制到 root 版本化路径中，直到 GA 推广。Root 是 Release 选择器所服务的内容。

### 必需的反向目录树 grep

对于版本特定的变更，在提交前 grep 不应包含新行为的目录树。例如，在 beta 专用工作流变更之后：

```bash
cd docs-site
rg -n "task-creation consent|codex-mode|<trellis-workflow>|planning artifact|`design\\.md`|`implement\\.md`" \
  start advanced guides zh/start zh/advanced zh/guides -g "*.mdx"
```

如果在 root release 文档中发现了新的 beta 术语，停止并将变更移至 `beta/**` / `zh/beta/**`。

---

## 触发器 1：阶段结构变更（Phase Structure Changes）

范围：任何对 `packages/cli/src/templates/trellis/workflow.md` 的编辑，包括添加/删除步骤、重命名阶段、或更改 required/optional/once 标签。

| 文件（en + zh） | 需同步的内容 |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `start/install-and-first-task.mdx` | Phase 1/2/3 演练块（英文版约第 215-240 行）——使步骤编号 + 动作动词与 `workflow.md` 的阶段索引保持同步 |
| `start/everyday-use.mdx` | 任务生命周期 ASCII 图 + 按阶段的 bash 示例 |
| `advanced/architecture.mdx` | 阶段概览图（如有） |
| `concepts/workflow.mdx`（如存在） | 阶段定义章节 |

### Grep 命令（docs-site）

```bash
cd docs-site && grep -rln "Phase 1\|Phase 2\|Phase 3\|phase-1\|phase-2\|phase-3\|workflow\.md" \
  --include="*.mdx" | grep -v "release/\|changelog/\|blog/"
```

### 模板内路由引用（关键——grep 原始步骤编号，而不仅仅是"Phase N.N"）

当某个步骤被删除/重新编号时，对它的引用存在于**不止于** `workflow.md` 中。它们使用**原始编号路由语法**，而 `"Phase 3.1"` 的 grep 会遗漏它们。过往漂移：0.6.1 删除了 Phase 3.1 但 `continue.md` 仍保留了 `check passed → **3.1**` 的路由（被用户发现，在 0.6.2 中修复）。

审计**所有这些文件**，包括源码和所有独立副本：

| 文件（File） | 引用形式 |
| --- | --- |
| `packages/cli/src/templates/common/commands/continue.md` | resume-routing 表格：`status=... → **<step>**` |
| `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/customize-local/change-workflow.md` | resume-at 状态转换表格：`Phase <step> (...)` |
| `packages/cli/src/templates/copilot/prompts/finish-work.prompt.md` | Phase 3 ASCII 流程列表 |
| `marketplace/workflows/{native,tdd,channel-driven-subagent-dispatch}/workflow.md` | 完整的独立工作流副本——相同的步骤正文 + Phase Index + breadcrumb 范围 |

能捕获原始编号路由的 grep 模式（从仓库根目录运行）：

```bash
# 原始编号路由箭头 / 加粗步骤引用 / step-N.N 在模板 + marketplace 中的所有位置
grep -rnE "→ \*\*[0-9]\.[0-9]+\*\*|-> \*\*[0-9]\.[0-9]+\*\*|step [0-9]\.[0-9]+|Phase [0-9]\.[0-9]+|\*\*[0-9]\.[0-9]+\*\*" \
  packages/cli/src/templates/ marketplace/ \
  --include="*.md" --include="*.toml" --include="*.prompt.md" \
  | grep -v "/dist/"
```

同时验证脚本能容忍当前不存在的步骤：`python3 .trellis/scripts/get_context.py --mode phase --step <deleted>` 必须返回友好的"Step not found"，而不是崩溃。

---

## 触发器 2：平台新增/删除/重命名（Platform Add / Remove / Rename）

范围：任何对 `packages/cli/src/types/ai-tools.ts` 中 `AI_TOOLS`、`task_store.py` 中 `_SUBAGENT_CONFIG_DIRS`，或 `workflow.md` 中平台标记块的编辑。

### 新增平台

| 文件（en + zh） | 需同步的内容 |
| ------------------------------------------- | ----------------------------------------------------------------------------------- |
| `ai-tools/<platform>.mdx` | **新文件**——平台特定的设置 + 注意事项页面 |
| `ai-tools/index.mdx`（如存在） | 新平台的列表条目 |
| `docs.json` | 在 `languages[0]`（en）和 `languages[1]`（zh）分组中都添加导航条目 |
| `start/install-and-first-task.mdx` | 平台表格（hook-inject vs pull-based vs agent-less） |
| `advanced/multi-platform.mdx` | Class-1 / Class-2 / agent-less 分组表格 |
| `advanced/appendix-d.mdx`（平台注意事项/quirks） | 如有则添加注意事项行 |
| `release/` 镜像副本 | Release 冻结副本在下次 release-cut 时更新，而非立刻 |

### 删除平台

| 文件（File） | 需同步的内容 |
| -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `ai-tools/<platform>.mdx` | 删除该页面 |
| `ai-tools/index.mdx` | 删除列表条目 |
| `docs.json` | 删除导航条目（两种语言） |
| `start/install-and-first-task.mdx`、`advanced/multi-platform.mdx`、`advanced/appendix-d.mdx` | 删除引用 |
| `changelog/<version>.mdx` | 记录删除的 changelog 条目 |

### 重命名（如"iFlow"被移除）——等同于删除 + changelog 中的迁移说明。

### Grep 命令

```bash
cd docs-site && grep -rln "<platform-name>" --include="*.mdx" --include="*.json"
```

---

## 触发器 3：`task.py` 命令新增/删除/重命名

范围：任何对 `task.py` 子解析器注册或其分派的拆分模块（`task_store.py`、`task_context.py`）的编辑。

| 文件（en + zh） | 需同步的内容 |
| ------------------------- | ---------------------------------------------------------------- |
| `advanced/appendix-b.mdx` | **`task.py` 子命令参考表格**——添加/删除行 |
| `start/everyday-use.mdx` | 任务生命周期流程箭头 + 按步骤的 bash 示例 |
| `advanced/appendix-c.mdx` | 如果变更影响 `task.json` 字段，更新 schema 注释 |

### 过往漂移的证据

`init-context` 的移除（2026-04-23）涉及了以上三个文件；第一轮扫视遗漏了它们。只有后续审查问题（"哪些文档站地方需要更新"）才捕获了它们。

### Grep 命令

```bash
cd docs-site && grep -rln "task\.py <subcommand-name>\|`<subcommand-name>`" --include="*.mdx" \
  | grep -v "release/\|changelog/"
```

---

## 触发器 4：Skill 新增/删除/重命名

范围：任何对 `packages/cli/src/templates/common/skills/` 或 `packages/cli/src/templates/{platform}/skills/` 的编辑。

| 文件（en + zh） | 需同步的内容 |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `start/everyday-use.mdx` | 顶部 skill 表格（约第 15-18 行）+ 每个 skill 的描述章节 |
| `advanced/appendix-b.mdx` | Skill 参考表格（如有） |
| `start/install-and-first-task.mdx` | Phase 演练中的 skill 名称 |
| 跨工作流文档的 Skill Routing 表格 | 必须匹配 `workflow.md` 中按平台拆分的 Skill Routing |

### Grep 命令

```bash
cd docs-site && grep -rln "trellis-<skill-name>" --include="*.mdx" \
  | grep -v "release/\|changelog/\|blog/"
```

---

## 触发器 5：JSONL / 任务元数据 Schema 变更

范围：任何对 `implement.jsonl` / `check.jsonl` 种子格式、`task.json` schema 或消费者契约（hook / prelude / `read_jsonl_entries`）的编辑。

| 文件（en + zh） | 需同步的内容 |
| --------------------------- | --------------------------------------------------------------------------------------------- |
| `advanced/appendix-c.mdx` | `task.json` schema 块——每个字段有注释；与 `task_store.py` 保持同步 |
| `start/everyday-use.mdx` | "Seeded on Create, AI Curates in Phase 1.3"章节（或其替代）+ 示例 JSONL 块 |
| `advanced/architecture.mdx` | 上下文注入图（如有） |
| `concepts/*.mdx` | 如果任何概念页面解释了 jsonl，则区分 seed vs curated 行 |

### 需保持同步的契约

- **Seed 行 schema**：`{"_example": "..."}`——没有 `file` 字段
- **Curated 行 schema**：`{"file": "<path>", "reason": "<why>"}`
- **消费者行为**：没有 `file` 的行会被每个消费者跳过（hook、prelude、validate、list-context）
- **READY 门禁**：仅含 seed 行的 jsonl → NOT ready（必须至少有一行 curated）

参见 `.trellis/spec/cli/backend/platform-integration.md` → "Agent-Curated JSONL Contract (Phase 1.3)" 获取代码侧的契约。

---

## 触发器 6：Changelog & 迁移

每个发布版本必须具有：

| 文件（en + zh） | 需同步的内容 |
| -------------------------- | ---------------------------------------------------------------------------------- |
| `changelog/v<version>.mdx` | Release notes——列出用户可见的变更、breaking-change 警告、升级步骤 |
| `docs.json` | 新 changelog 页面的导航条目（两种语言） |
| `release/` 目录树 | Release 冻结副本——仅在 release-cut 时更新，不在开发期间更新 |

`packages/cli/src/migrations/manifests/` 中的迁移清单需要有匹配的 changelog 条目。清单的 `changelog` + `aiInstructions` 字段是权威文本；changelog MDX 应链接到或改写它们。

## 触发器 7：`.trellis/config.yaml` 模板或读取器变更

范围：任何对 `packages/cli/src/templates/trellis/config.yaml`、`packages/cli/src/templates/trellis/scripts/common/` 下配置读取器，或 update 清单中 `configSectionsAdded` 行为的编辑。

| 文件（en + zh，release + beta） | 需同步的内容 |
|---|---|
| `advanced/configuration.mdx` | 添加/删除/重命名配置键、默认值、可接受值及 update 行为 |
| `advanced/appendix-a.mdx` | 如果文件的职责发生变更，更新 `.trellis/config.yaml` 单行用途说明 |
| `start/everyday-use.mdx` | 仅当该键影响日常任务/会话操作时更新 |
| `changelog/v<version>.mdx` | 记录用户可见的配置行为或迁移交付 |

### Grep 命令

```bash
cd docs-site && grep -rln "config.yaml\|session_auto_commit\|codex.dispatch_mode\|update.skip" \
  --include="*.mdx" --include="docs.json" \
  | grep -v "node_modules/"
```

**规则**：模板是已交付示例的真实来源，但 `advanced/configuration.mdx` 是面向用户的参考文档。如果一个键被代码支持但有意不在当前模板中（例如，遗留兼容性），配置页面应明确说明，而非静默省略。

---

## 双语纪律（Bilingual Discipline）

**`*.mdx` 下的每次更新必须在 `en/` 和 `zh/` 路径中都执行。** zh/ 目录树完全镜像 en 目录树——相同的文件名、相同的章节标题、相同的顺序。

### 常见漂移来源

1. 编辑了 en，忘记了 zh → `zh/start/everyday-use.mdx` 落后数周
2. 导航条目仅添加到 `languages[0]` → 页面仅在英文侧边栏中渲染
3. 代码块被翻译（不要翻译代码——只翻译叙述文字）

### 检测

```bash
cd docs-site
# 查找在 en 中存在但 zh 中不存在（或反之）的页面
diff <(find . -name "*.mdx" -not -path "./zh/*" -not -path "./release/*" -not -path "./node_modules/*" | sed 's|^\./||' | sort) \
     <(find zh -name "*.mdx" | sed 's|^zh/||' | sort)
```

非零输出 = 孤立页面。合并前处理。

---

## 非触发器（不要更新文档）

| 变更 | 不更新文档的原因 |
| ------------------------------------------------------ | ---------------------------------------------- |
| 不改变用户可见行为的内部重构 | 没有用户可见契约被改变 |
| 恢复已文档化行为的 Bug 修复 | 文档已经描述正确行为 |
| 测试新增 | 测试不是用户可见的 |
| 迁移清单内容变更 | 已被 `changelog/v<version>.mdx` 捕获 |

---

## 合并前的审计流程

1. 运行与你的变更匹配的触发器部分的 grep 命令
2. 打开每个命中项——你的变更后该页面是否仍然准确？
3. 对于任何过时的命中项：同时更新 `en` 和 `zh` 版本
4. 如果你添加/删除了页面：在两种语言树的 `docs.json` 导航中更新
5. 如果变更影响多个触发器（例如，删除命令 + 删除平台），运行所有相关的 grep

机械化优于英雄主义。不要依赖记忆或审查来捕获漂移。
