# 修改本地 Spec 结构

当用户想更改 AI 遵循的工程约定、添加新的 spec 层或调整 monorepo 包映射时，编辑 `.trellis/spec/` 和 `.trellis/config.yaml`。

## 先阅读这些文件

1. `.trellis/config.yaml`
2. `.trellis/spec/`
3. `.trellis/workflow.md` 中的规划产物指导和 Phase 3.3
4. 当前 task 的 `implement.jsonl` / `check.jsonl`

## 常见需求

| 需求 | 编辑位置 |
| --- | --- |
| 添加 backend/frontend/docs/test 的 spec 层 | `.trellis/spec/<layer>/` 或 `.trellis/spec/<package>/<layer>/` |
| 添加共享思维指南 | `.trellis/spec/guides/` |
| 调整 monorepo 包 | `.trellis/config.yaml` 中的 `packages` |
| 更改默认包 | `.trellis/config.yaml` 中的 `default_package` |
| 控制 spec 扫描范围 | `.trellis/config.yaml` 中的 `spec_scope` |
| 让 task 读取新的 spec | Task 的 `implement.jsonl` / `check.jsonl` |

## 添加 Spec 层

单仓库示例：

```text
.trellis/spec/security/
├── index.md
└── auth.md
```

Monorepo 示例：

```text
.trellis/spec/webapp/security/
├── index.md
└── auth.md
```

`index.md` 应包含：

- 该层适用于哪些代码。
- 开发前检查清单（Pre-Development Checklist）。
- 质量检查（Quality Check）。
- 指向具体指南文件的链接。

## 更新上下文

添加 spec 并不意味着每个 task 都会自动读取它。当前 task 必须在 JSONL 中引用它：

```bash
python3 ./.trellis/scripts/task.py add-context <task> implement ".trellis/spec/webapp/security/index.md" "Security conventions"
python3 ./.trellis/scripts/task.py add-context <task> check ".trellis/spec/webapp/security/index.md" "Security review rules"
```

## 更改 Monorepo 包

示例 `.trellis/config.yaml`：

```yaml
packages:
  webapp:
    path: apps/web
  api:
    path: apps/api
default_package: webapp
```

编辑后运行：

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

使用此输出来确认 AI 能看到正确的包和 spec 层。

## 注意事项

- Specs 是用户项目约定，可根据项目需求更改。
- 不要将临时任务信息放入 specs；将临时信息放入 task 中。
- 不要将长期约定仅放在 agent 或 command 中；将其保存在 specs 中。
- 更改 spec 结构后，检查现有 task JSONL 文件是否仍然指向存在的文件。