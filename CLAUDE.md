# CLAUDE.md

减少常见 LLM 编码错误的行为指南。根据项目特定指令按需合并。

**权衡：** 这些指南偏向谨慎而非速度。对于琐碎任务，自行判断。

## 1. 先思考再编码

**不要假设。不要隐藏困惑。明确指出权衡。**

实现之前：
- 明确陈述你的假设。如果不确定，询问。
- 如果存在多种解释，呈现它们——不要默默选择。
- 如果有更简单的方案，说出来。在必要时提出反对意见。
- 如果有不清楚的地方，停下来。说出困惑所在。提问。

## 2. 简单优先

**解决问题的最少代码。不做任何推测性工作。**

- 不添加超出需求范围的功能。
- 不为仅使用一次的代码创建抽象。
- 不添加未被要求的"灵活性"或"可配置性"。
- 不为不可能发生的场景做错误处理。
- 如果你写了 200 行但它可以只用 50 行，重写它。

问自己："资深工程师会说这过度复杂吗？" 如果是，简化它。

## 3. 精准修改

**只动你必须动的。只清理你自己的烂摊子。**

编辑现有代码时：
- 不要"改进"相邻的代码、注释或格式。
- 不要重构没有问题的东西。
- 匹配现有风格，即使你会有不同的做法。
- 如果你发现无关的死代码，提出来——不要删除它。

当你的改动产生了孤儿：
- 移除由你的改动导致不再使用的 imports/变量/函数。
- 不要移除已存在的死代码，除非被要求。

检验标准：每一行改动都应该直接追溯到用户的请求。

## 4. 目标驱动执行

**定义成功标准。循环直到验证通过。**

将任务转化为可验证的目标：
- "添加验证" → "为无效输入编写测试，然后让它们通过"
- "修复 bug" → "编写能重现它的测试，然后让它通过"
- "重构 X" → "确保测试在重构前后都通过"

对于多步骤任务，陈述一个简短的计划：
```
1. [步骤] → 验证：[检查]
2. [步骤] → 验证：[检查]
3. [步骤] → 验证：[检查]
```

强大的成功标准让你能独立循环。薄弱的标准（"让它能工作"）需要不断澄清。

---

**这些指南在以下情况下是有效的：** diff 中更少的不必要改动、更少的因过度复杂导致的重写、澄清性问题在实现之前出现而非在错误之后。

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