# 核心后端指南（Core Backend Guidelines）

这些指南适用于 `packages/core`。

## 用途（Purpose）

`@baoanaz/cviauto-core` 拥有可复用的 SDK/领域原语（domain primitives），它们必须独立于 CLI 渲染和进程控制相关的关注点。

## 源码地图（Source Map）

| 区域（Area） | 路径（Path） | 用途（Purpose） |
| --- | --- | --- |
| 根导出（Root exports） | `packages/core/src/index.ts` | 包的根级公共 API。保持精简。 |
| Channel API | `packages/core/src/channel/` | 持久化的 channel/event API、reducer、worker、inbox、运行时契约（runtime contracts）。 |
| Mem API | `packages/core/src/mem/` | 持久化的 AI 会话读取器（reader）、搜索、过滤、对话提取和项目聚合。 |
| Task API | `packages/core/src/task/` | 可复用的任务记录（task record）、schema、phase 和 path 辅助函数。 |
| Testing API | `packages/core/src/testing/` | 面向包消费者的公共测试辅助函数。 |
| 测试（Tests） | `packages/core/test/` | Core 拥有的单元/集成覆盖。 |

## 契约（Contracts）

- Core API 不得打印终端输出、调用 `process.exit`、解析 CLI argv，或依赖 Chalk / Commander / Inquirer。
- CLI 代码必须通过公共导出（如 `@baoanaz/cviauto-core/channel`）导入 core，而非通过 `packages/core/src` 下的深层路径。
- 公共子路径必须在 `packages/core/package.json` 中显式声明。
- Core 和 CLI 以相同版本一起发布。
- 详细的包边界规则当前位于 `.trellis/spec/cli/backend/trellis-core-sdk.md`；请保持此文件与该边界规范一致，直到详细的 core 规则完全拆分到 `.trellis/spec/core/` 下。

## 开发前检查清单（Pre-Development Checklist）

- 在编辑 `packages/core/**` 或在 CLI 与 core 之间移动逻辑之前，阅读 `.trellis/spec/cli/backend/trellis-core-sdk.md`。
- 在添加或更改 core 测试之前，阅读 `.trellis/spec/cli/unit-test/conventions.md`。
- 对于 channel 变更，还需阅读 `.trellis/spec/cli/backend/commands-channel.md`。
- 对于 mem 变更，还需阅读 `.trellis/spec/cli/backend/commands-mem.md`。

## 质量检查（Quality Check）

运行与变更匹配的包级检查：

```bash
pnpm --filter @baoanaz/cviauto-core lint
pnpm --filter @baoanaz/cviauto-core typecheck
pnpm --filter @baoanaz/cviauto-core test
```

对于影响 CLI 导入或发布打包的变更，还需运行根级 typecheck 路径，以验证 CLI 声明解析：

```bash
pnpm typecheck
```
