<!-- TRELLIS:START -->
# Trellis 指令

这些指令面向在此项目中工作的 AI 助手。

本项目由 Trellis 管理。你需要的工作知识位于 `.trellis/` 下：

- `.trellis/workflow.md` — 开发阶段、何时创建任务、skill 路由
- `.trellis/spec/` — 按 package 和 layer 划分的编码指南（在特定 layer 编写代码前阅读）
- `.trellis/workspace/` — 每个开发者的日志和会话记录
- `.trellis/tasks/` — 活动和已归档的任务（PRD、研究、jsonl 上下文）

如果你的平台支持 Trellis 命令（如 `/trellis:finish-work`、`/trellis:continue`），优先使用它们而非手动步骤。并非每个平台都暴露所有命令。

如果你使用 Codex 或其他支持 Agent 的工具，额外的项目范围辅助工具可能位于：
- `.agents/skills/` — 可复用的 Trellis 技能
- `.codex/agents/` — 可选的自定义 subagent

由 Trellis 管理。此块之外的编辑会被保留；此块之内的编辑可能会被未来的 `trellis update` 覆盖。

<!-- TRELLIS:END -->

<!-- gitnexus:start -->
# GitNexus — 代码智能

本项目已被 GitNexus 索引为 **Trellis**（14336 个符号，20870 条关系，300 条执行流）。使用 GitNexus MCP 工具来理解代码、评估影响并安全导航。

> 索引过期？从项目根目录运行 `node .gitnexus/run.cjs analyze`——它会自动选择可用的运行器。还没有 `.gitnexus/run.cjs`？运行 `npx gitnexus analyze`（npm 11 崩溃 → `npm i -g gitnexus`；#1939）。

## 始终要做

- **编辑任何符号前必须运行影响分析。** 在修改函数、类或方法之前，运行 `impact({target: "symbolName", direction: "upstream"})` 并向用户报告影响范围（直接调用者、受影响的流程、风险等级）。
- **提交前必须运行 `detect_changes()`**，以验证你的变更只影响预期的符号和执行流。对于回归审查，对比默认分支：`detect_changes({scope: "compare", base_ref: "main"})`。
- **必须警告用户**，如果影响分析返回 HIGH 或 CRITICAL 风险，然后再继续编辑。
- 在探索不熟悉的代码时，使用 `query({query: "concept"})` 来查找执行流，而非 grep。它返回按相关度排序的按流程分组的结果。
- 当你需要某个特定符号的完整上下文——调用者、被调用者、参与哪些执行流——使用 `context({name: "symbolName"})`。

## 绝对不要

- 绝对不要在没有先运行 `impact` 的情况下编辑函数、类或方法。
- 绝对不要忽略影响分析中的 HIGH 或 CRITICAL 风险警告。
- 绝对不要用查找替换来重命名符号——使用能理解调用图的 `rename`。
- 绝对不要在没有运行 `detect_changes()` 检查受影响范围的情况下提交更改。

## 资源

| 资源 | 用途 |
|----------|---------|
| `gitnexus://repo/Trellis/context` | 代码库概览，检查索引新鲜度 |
| `gitnexus://repo/Trellis/clusters` | 所有功能区域 |
| `gitnexus://repo/Trellis/processes` | 所有执行流 |
| `gitnexus://repo/Trellis/process/{name}` | 逐步执行追踪 |

## CLI

| 任务 | 阅读此 skill 文件 |
|------|---------------------|
| 理解架构 / "X 是如何工作的？" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| 影响范围 / "改了 X 会破坏什么？" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| 追踪 bug / "为什么 X 失败了？" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| 重命名 / 提取 / 拆分 / 重构 | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| 工具、资源、schema 参考 | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| 索引、状态、清理、wiki CLI 命令 | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->