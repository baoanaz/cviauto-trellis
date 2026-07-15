# 本地 Spec 系统

`.cviauto/spec/` 是用户的项目特定工程 spec 库。Cviauto 不是让 AI 记忆约定；而是在适当的时机注入相关 spec 或要求 AI 阅读它们。

## 目录模型

常见的单仓库结构：

```text
.cviauto/spec/
├── backend/
│   ├── index.md
│   └── ...
├── frontend/
│   ├── index.md
│   └── ...
└── guides/
    ├── index.md
    └── ...
```

常见的 monorepo 结构：

```text
.cviauto/spec/
├── cli/
│   ├── backend/
│   │   ├── index.md
│   │   └── ...
│   └── unit-test/
│       ├── index.md
│       └── ...
├── docs-site/
│   └── docs/
│       ├── index.md
│       └── ...
└── guides/
    ├── index.md
    └── ...
```

`index.md` 是每层的入口点。它应列出开发前检查清单和质量检查。具体指南在同一个目录中的其他 Markdown 文件中。

## 包配置

`.cviauto/config.yaml` 可以声明包：

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli
```

AI 可以运行：

```bash
python3 ./.cviauto/scripts/get_context.py --mode packages
```

此命令列出当前项目的包和 spec 层。将此输出作为配置上下文 JSONL 时的参考。

## Spec 如何进入任务

在任务进入实现之前，当任务需要超出任务文档的 spec 或研究上下文时，规划可以将相关 spec 写入 `implement.jsonl` / `check.jsonl`：

```jsonl
{"file": ".cviauto/spec/cli/backend/index.md", "reason": "CLI 后端约定"}
{"file": ".cviauto/spec/cli/unit-test/conventions.md", "reason": "测试预期"}
```

Sub-agent 或平台前置指令读取这些 JSONL 文件并加载引用的 spec。在不支持 sub-agent 的平台上，AI 应根据工作流直接阅读相关 spec。

## Spec 应包含什么

Spec 应包含项目的可执行工程约定，而非泛泛的最佳实践：

- 文件应放在哪里。
- 错误处理应如何表达。
- API、hooks 和命令的输入/输出契约。
- 被禁止的模式。
- 需要测试的情况。
- 项目特定的陷阱及如何避免。

当 AI 在实现或调试过程中学到新规则时，应更新 `.cviauto/spec/`，而不仅仅在聊天中总结。

## 本地自定义点

| 需求 | 编辑位置 |
| --- | --- |
| 添加新的 spec 层 | `.cviauto/spec/<package>/<layer>/index.md` 和相应的指南文件。 |
| 更改 monorepo spec 映射 | `.cviauto/config.yaml` 中的 `packages` / `default_package` / `spec_scope`。 |
| 更改 AI 在实现前阅读哪些 spec | 任务的 `implement.jsonl`。 |
| 更改 AI 在检查期间阅读哪些 spec | 任务的 `check.jsonl`。 |
| 更改何时应更新 spec | `.cviauto/workflow.md` 中的阶段 3.3 和 `cviauto-update-spec` skill。默认原生工作流仅在用户明确要求将知识推广到 spec 时才运行。 |

## 边界

`.cviauto/spec/` 是用户的项目规范，不是 Cviauto 内置模板的永久副本。AI 应鼓励用户根据实际项目代码更新它，而非将 Cviauto 默认模板视为不可变文档。