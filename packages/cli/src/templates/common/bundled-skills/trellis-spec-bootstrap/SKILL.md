---
name: cviauto-spec-bootstrap
description: "Bootstrap project-specific Cviauto coding specs with a platform-neutral single-agent workflow. Use when creating or refreshing .cviauto/spec guidelines, analyzing a codebase with GitNexus, ABCoder, or source inspection, decomposing package/layer spec work, and writing real codebase-backed spec docs without placeholder text."
---

# Cviauto Spec 引导

使用此技能从真实代码库创建或刷新 `.cviauto/spec/` 指南。一个有能力 Agent 拥有完整循环：分析仓库、选择 spec 边界、编写文档、验证结果。此工作流不依赖特定的宿主、CLI 或 Agent 品牌。

## 工作流

1. 确认 Cviauto 已初始化并检查当前 `.cviauto/spec/` 树。
2. 使用最佳可用工具分析仓库架构：GitNexus、ABCoder、语言工具和直接源码阅读。
3. 仅在反映实际代码库时按 package 和 layer 分解 spec 工作。
4. 用项目中的具体模式、文件路径、示例和反模式填充或重塑 spec 文件。
5. 验证最终 spec 内部一致且不含模板占位符。

## 参考路由

| 需求 | 阅读 |
|------|------|
| 仓库架构分析 | [references/repository-analysis.md](references/repository-analysis.md) |
| Spec 工作分解与任务规划 | [references/spec-task-planning.md](references/spec-task-planning.md) |
| 编写高信号 Cviauto spec 文件 | [references/spec-writing.md](references/spec-writing.md) |
| GitNexus 和 ABCoder MCP 设置 | [references/mcp-setup.md](references/mcp-setup.md) |

## 操作规则

- 将模板视为起点，而非契约。当仓库需要时，删除、重命名、拆分或添加 spec 文件。
- 优先基于源码的规则而非通用建议。每条重要建议都应指向真实文件或重复出现的本地模式。
- 默认保持单执行者。可选的辅助 Agent 是实现细节，而非需求或用户可见的依赖。
- 除非目标项目已标准化在该平台上，否则不编写平台特定指令。
- 不在 `.cviauto/spec/` 中留占位符文本、空标题或复制的样板内容。

## 完成标准

- `.cviauto/spec/` 描述了项目当前的实际状态。
- 每个相关 package 或 layer 都有包含真实示例的实用编码指导。
- 不适用的模板部分已移除。
- `index.md` 文件与最终 spec 文件集匹配。
- 任何所需设置或分析假设已在相关 spec 或任务笔记中记录。