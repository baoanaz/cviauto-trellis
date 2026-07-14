---
name: trellis-check
description: "Comprehensive quality verification: spec compliance, lint, type-check, tests, cross-layer data flow, code reuse, and consistency checks. Use when code is written and needs quality verification, before committing changes, or to catch context drift during long sessions."
---

# 代码质量检查

对最近编写的代码进行全面质量验证。结合 spec 合规性、跨层安全和提交前检查。

---

## 步骤 1：识别变更内容

```bash
git diff --name-only HEAD
git status
```

## 步骤 2：阅读任务文档和适用 Spec

按顺序阅读当前任务文档：

- `prd.md`
- `design.md`（如存在）
- `implement.md`（如存在）

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

对每个变更的 package/layer，阅读其 spec 索引，并按照其中的 **Quality Check** 部分执行：

```bash
cat .trellis/spec/<package>/<layer>/index.md
```

阅读引用的具体指南文件——索引只是指针，不是目标。

## 步骤 3：运行项目检查

运行项目的 lint、类型检查和测试命令。在继续之前修复所有失败。

## 步骤 4：对照检查清单审查

### 代码质量

- [ ] Linter 通过？
- [ ] 类型检查器通过（如适用）？
- [ ] 测试通过？
- [ ] 没有遗留调试日志？
- [ ] 没有抑制警告或绕过类型安全？

### 测试覆盖

- [ ] 新函数 → 已添加单元测试？
- [ ] Bug 修复 → 已添加回归测试？
- [ ] 变更行为 → 已更新现有测试？

### Spec 同步

- [ ] `.trellis/spec/` 是否需要更新？（新模式、新约定、经验教训）

> "如果我修复了一个 bug 或发现了不明显的东西，我是否应该记录它，以便未来的我不会遇到同样的问题？" → 如果答案是 YES，更新相关的 spec 文档。

## 步骤 5：跨层维度（如适用）

如果变更仅限于单一层，跳过此步骤。

### A. 数据流（变更涉及 3+ 层）

- [ ] 读流程追踪正确：Storage → Service → API → UI
- [ ] 写流程追踪正确：UI → API → Service → Storage
- [ ] 类型/模式在层间正确传递？
- [ ] 错误正确传播到调用方？

### B. 代码复用（修改常量、创建工具函数）

- [ ] 在创建新的之前搜索了现有类似代码？
  ```bash
  grep -r "pattern" src/
  ```
- [ ] 如果 2+ 处定义了相同值 → 提取为共享常量？
- [ ] 批量修改后，所有出现的地方都已更新？

### C. 导入/依赖（创建新文件）

- [ ] 导入路径正确（相对 vs 绝对）？
- [ ] 没有循环依赖？

### D. 同层一致性

- [ ] 使用相同概念的其他地方是否一致？

---

## 步骤 6：报告并修复

报告发现的违规项并直接修复。修复后重新运行项目检查。