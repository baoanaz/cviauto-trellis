# 改进单元测试（Improve Unit Tests）

在代码变更后使用此命令来提高测试覆盖率。

## 使用方式（Usage）

```text
/trellis:improve-ut
```

## 真实来源（Source of Truth）

发现并阅读单元测试规格文档：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

在输出中查找具有 `unit-test` 规格层（spec layer）的包。

对于每个找到的模块，阅读其 `index.md` 并遵循 **"Pre-Development Checklist"** 部分。阅读索引中列出的所有指南文件。

> 如果本命令与单元测试规格文档冲突，以规格文档为准。

---

## 执行流程（Execution Flow）

1. 检查变更：
   - `git diff --name-only`
2. 使用单元测试规格文档确定测试范围：
   - 哪些必须是单元测试（unit）vs 集成测试（integration）vs 回归测试（regression）
   - 哪些必须是 mock vs 真实文件系统流程
3. 相应地添加/更新测试（镜像现有测试结构）
4. 运行验证：

```bash
pnpm lint
pnpm typecheck
pnpm test
```

5. 报告覆盖率决策和剩余缺口。

---

## 输出格式（Output Format）

```markdown
## 单元测试覆盖率计划（UT Coverage Plan）
- 已变更区域（Changed areas）：...
- 测试范围（Test scope）（unit/integration/regression）：...

## 测试更新（Test Updates）
- 已添加（Added）：...
- 已更新（Updated）：...

## 验证（Validation）
- pnpm lint：通过/失败
- pnpm typecheck：通过/失败
- pnpm test：通过/失败

## 缺口 / 后续工作（Gaps / Follow-ups）
- <无 或 明确说明理由>
```
