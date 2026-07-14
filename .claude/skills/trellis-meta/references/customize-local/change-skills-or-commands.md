# 修改本地 Skills、Commands、Prompts 和 Workflows

当用户想更改 AI 入口点、自动触发规则或显式命令行为时，编辑本地平台目录中的 skills、commands、prompts 或 workflows。

在编辑之前，先对你即将操作的 skill 进行分类：

- **捆绑的上游 skill** — `trellis-meta`、`trellis-spec-bootstrap`、`trellis-session-insight`、`trellis-channel`。其事实来源位于 Trellis CLI 仓库的 `packages/cli/src/templates/common/bundled-skills/<name>/` 中；在 `trellis init` / `trellis update` 时由 `getBundledSkillTemplates()` 自动分发到每个平台的 skill 根目录。此处的本地编辑会被 `.trellis/.template-hashes.json` 追踪，并在下次更新时被标记。
- **项目本地 skill** — 位于 `.{platform}/skills/` 下的其他所有内容。归用户所有，不会被 `trellis update` 刷新。

本文余下部分使用"skill"代指本地文件；两种情况下覆盖和冲突规则不同。

## 先阅读这些文件

1. `.trellis/workflow.md`
2. 目标平台的 skill/command/prompt/workflow 目录
3. 相关的 agent 或 hook 文件
4. 确认 `.trellis/spec/` 中是否已有项目规则
5. `.trellis/.template-hashes.json` — 确认你要编辑的 skill 是上游所有的（有对应条目）还是项目本地的（无对应条目）

## 选择哪种入口类型

| 目标 | 推荐做法 |
| --- | --- |
| AI 应自动知晓某项能力 | 添加或修改 skill。 |
| 用户希望通过命令手动触发 | 添加或修改 command/prompt/workflow。 |
| 团队项目约定 | 优先使用 `.trellis/spec/` 或项目本地 skill——切勿使用捆绑的 skill 目录。 |
| 为用户自己的项目微调捆绑 skill（`trellis-meta` 等） | 创建一个名称不同的项目本地兄弟 skill 来覆盖意图，或编辑 `.trellis/spec/`。在捆绑 skill 目录内的编辑仅在下一次 `trellis update` 之前有效，且每次都需要选择"保留"。 |
| 将更改回馈给上游 | 在 Trellis CLI 仓库中编辑 `packages/cli/src/templates/common/bundled-skills/<name>/`，而非部署后的副本。 |
| 更改 Trellis 流程语义 | 同步 `.trellis/workflow.md`。 |

## 修改 Skill

一个 skill 通常结构如下：

```text
<skill-name>/
├── SKILL.md
└── references/
```

`SKILL.md` 应简短，负责触发/路由。将长内容放入 `references/`，以便 AI 按需读取。

frontmatter 中的 description 应说明何时使用该 skill。示例：

```yaml
description: "Use when customizing this project's deployment workflow and release checklist."
```

不要编写模糊的 description，如 "helpful project skill"；它们可能会错误触发。

### 捆绑 vs. 项目本地

相同的目录结构由两种截然不同的所有权模型使用：

| 方面 | 捆绑（`trellis-meta`、`trellis-spec-bootstrap`、`trellis-session-insight`、`trellis-channel`） | 项目本地 |
| --- | --- | --- |
| 事实来源 | Trellis CLI 仓库中的 `packages/cli/src/templates/common/bundled-skills/<name>/` | 用户项目自身内部 |
| 分发方式 | 在 `trellis init` / `trellis update` 时由 `getBundledSkillTemplates()`（`packages/cli/src/templates/common/index.ts`）自动分发到每个平台 skill 根目录 | 由用户（或其他 skill）创建，永不移动 |
| Hash 追踪 | 每个文件记录在 `.trellis/.template-hashes.json` 中；更新时提示冲突 | 不追踪 |
| 本地编辑 | 允许，但在下次更新时会被标记为"用户已修改" | 自由编辑 |
| 正确的自定义方式 | 添加一个**新的**、**名称不同**的项目本地 skill 来补充（或替代）捆绑的 skill | 直接编辑文件 |

如果目标是"让我的项目 AI 在讨论发布说明时行为不同"，答案几乎始终是创建一个项目本地 skill，而不是对 `trellis-meta/` 动手术。

## 修改 Command/Prompt/Workflow

显式入口点应说明：

- 用户如何触发它。
- 需要读取哪些 `.trellis/` 文件。
- 需要运行哪些脚本。
- 完成后如何报告。

如果一个 command 仅是重复工作流规则，优先让它引用/读取 `.trellis/workflow.md`，而不是维护流程的第二份副本。

## 常见路径

| 平台 | 入口目录 |
| --- | --- |
| Claude Code | `.claude/skills/`、`.claude/commands/` |
| Cursor | `.cursor/skills/`、`.cursor/commands/` |
| OpenCode | `.opencode/skills/`、`.opencode/commands/` |
| Codex | `.agents/skills/`、`.codex/skills/` |
| Gemini CLI | `.agents/skills/`、`.gemini/commands/` |
| Kiro | `.kiro/skills/` |
| Qoder | `.qoder/skills/`、`.qoder/commands/` |
| CodeBuddy | `.codebuddy/skills/`、`.codebuddy/commands/` |
| GitHub Copilot | `.github/skills/`、`.github/prompts/` |
| Factory Droid | `.factory/skills/`、`.factory/commands/` |
| Pi Agent | `.pi/skills/` |
| Reasonix | `.reasonix/skills/`（无独立 commands 目录；斜杠命令由平台内置） |
| ZCode | `.agents/skills/`、`.zcode/commands/` |
| Kilo / Antigravity / Devin | workflows + skills |

以上每个目录都是四个捆绑 skill 的部署目标。每个平台在 `trellis init` 时获得完整副本，并在 `trellis update` 时刷新；无需手动配置。

## 添加项目本地 Skill

如果用户想记录团队私有的自定义内容，创建项目本地 skill——切勿将项目私有内容放入捆绑 skill 目录，因为 `trellis update` 会覆盖它。

```text
.claude/skills/project-trellis-local/
└── SKILL.md
```

对于多平台项目，在每个平台 skill 目录中添加等效版本，或在支持共享层的平台（Codex、Gemini CLI）上使用 `.agents/skills/`。

选择一个**不**与捆绑集合冲突的名称：

- `trellis-meta`
- `trellis-spec-bootstrap`
- `trellis-session-insight`
- `trellis-channel`

重名会导致 `getBundledSkillTemplates()` 在下一次更新时覆盖项目本地副本。常见的约定是使用项目名称作为前缀：`acme-trellis-deploy`、`acme-trellis-onboarding`。

## 注意事项

- 不要将每个平台的语法混入一个文件中。
- 不要仅修改一个平台的入口点却声称支持所有平台。
- 不要将长期工程约定隐藏在 command 中；将其写入 `.trellis/spec/`。
- 不要手动编辑任何 `.{platform}/skills/` 目录下的 `trellis-meta/`、`trellis-spec-bootstrap/`、`trellis-session-insight/` 或 `trellis-channel/` 中的文件并期望修改能持久——它们是捆绑的，会被 `trellis update` 刷新。要么贡献给上游，要么添加一个补充它们的项目本地 skill。
- 当 `trellis update` 报告捆绑 skill 文件存在"已被您修改"的冲突时，仅当你接受手动维护差异时才选择**保留**；否则接受覆盖并将意图作为项目本地 skill 重新实现。