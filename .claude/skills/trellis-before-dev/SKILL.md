---
name: trellis-before-dev
description: "Discovers and injects project-specific coding guidelines from .trellis/spec/ before implementation begins. Reads spec indexes, pre-development checklists, and shared thinking guides for the target package. Use when starting a new coding task, before writing any code, switching to a different package, or needing to refresh project conventions and standards."
---

# 开发前准备

在开始编码任务前，阅读相关的开发指南。

执行以下步骤：

1. **阅读当前任务文档**：
   - `prd.md` — 需求和验收标准
   - `design.md`（如存在）— 技术设计
   - `implement.md`（如存在）— 执行顺序和验证计划

2. **发现 package 及其 spec 层级**：
   ```bash
   python3 ./.trellis/scripts/get_context.py --mode packages
   ```

3. **确定哪些 spec 适用于当前任务**，依据：
   - 正在修改哪个 package（如 `cli/`、`docs-site/`）
   - 工作类型（后端、前端、单元测试、文档等）
   - 任务文档中引用的任何 spec/research 路径

4. **阅读每个相关模块的 spec 索引**：
   ```bash
   cat .trellis/spec/<package>/<layer>/index.md
   ```
   按照索引中的 **"Pre-Development Checklist"（开发前检查清单）** 部分执行。

5. **阅读 Pre-Development Checklist 中列出的、与当前任务相关的具体指南文件**。索引本身不是目标——它指向实际的指南文件（如 `error-handling.md`、`conventions.md`、`mock-strategies.md`）。阅读这些文件以了解编码标准和模式。

6. **始终阅读共享指南**：
   ```bash
   cat .trellis/spec/guides/index.md
   ```

7. 理解需要遵循的编码标准和模式，然后继续制定开发计划。

此步骤在编写任何代码之前**必须执行**。