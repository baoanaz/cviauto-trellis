# 后端开发指南

> 本项目中后端开发的最佳实践。

---

## 概述

本目录包含后端开发指南。用你项目的特定约定填写每个文件。

---

## 指南索引

| 指南 | 描述 | 状态 |
|-------|-------------|--------|
| [目录结构](./directory-structure.md) | 模块组织、文件布局、设计决策 | 完成 |
| [脚本约定](./script-conventions.md) | .trellis/scripts/ 的 Python 脚本标准 | 完成 |
| [错误处理](./error-handling.md) | 错误类型、处理策略 | 完成 |
| [质量指南](./quality-guidelines.md) | 代码标准、禁止模式 | 完成 |
| [日志指南](./logging-guidelines.md) | 结构化日志、日志级别 | 完成 |
| [迁移系统](./migrations.md) | 模板文件的版本迁移系统 | 完成 |
| [发布流程](./release-process.md) | CI 独享发布、包版本化、发布轨道、清单连续性、子模块排序 | 完成 |
| [Trellis Core SDK](./trellis-core-sdk.md) | `@baoanaz/cviauto-core` / CLI 包边界、公共导出、构建和版本化契约 | 完成 |
| [平台集成](./platform-integration.md) | 如何添加对新 AI CLI 平台的支持 | 完成 |
| [Workflow-State 契约](./workflow-state-contract.md) | 每回合面包屑子系统：标记语法、状态写入器、生命周期事件、可达性 | 完成 |
| [Configurator 共享辅助函数](./configurator-shared.md) | `configurators/shared.ts` 公共接口：占位符替换、写入辅助函数、pull-based 序言、跨配置器不变量 | 完成 |
| [`tl mem` 命令](./commands-mem.md) | 跨平台 AI 会话记忆：子命令、schema、索引、清理管道、搜索相关性 | 完成 |
| [`trellis upgrade` 命令](./commands-upgrade.md) | 全局 CLI 自升级包装器：通道推断、npm 调用、失败行为 | 完成 |
| [`trellis update` 命令](./commands-update.md) | 更新管道：标志、计划编写、迁移触发器语义、应用阶段、幂等性、与 `migrations.md` 的边界 | 完成 |
| [`trellis workflow` 命令](./commands-workflow.md) | Workflow marketplace 模板、项目本地 workflow 切换、哈希所有权契约和解析器兼容性 | 完成 |
| [`trellis uninstall` 命令](./commands-uninstall.md) | 卸载编排：计划编写、结构化文件分发、执行阶段、`.trellis/` 移除 | 完成 |
| [Uninstall Scrubbers](./uninstall-scrubbers.md) | 结构化配置文件的纯清理器契约（`settings.json`、`hooks.json`、`package.json`、`config.toml`） | 完成 |
| [`trellis channel` 命令](./commands-channel.md) | 多智能体协作运行时：events.jsonl 协议、每 worker supervisor、provider adapter（claude / codex）、项目桶、临时/运行生命周期、ShutdownController 状态机 | 完成 |

---

## 开发前检查清单

编写后端代码前，根据你的任务阅读相关指南：

- 错误处理 → [error-handling.md](./error-handling.md)
- 日志 → [logging-guidelines.md](./logging-guidelines.md)
- 添加平台 → [platform-integration.md](./platform-integration.md)
- 修改 `init.ts` 流程（新触发器、分发分支、bootstrap/joiner）→ [platform-integration.md "Bootstrap & Joiner Task Auto-Generation"](./platform-integration.md) — 两点连接 + `.developer` 信号
- 脚本工作 → [script-conventions.md](./script-conventions.md)
- 迁移系统 → [migrations.md](./migrations.md)
- 构建发布 / 跨分支子模块协调 / 清单连续性 / npm 发布 → [release-process.md](./release-process.md)
- 编辑 `packages/core/**`，将可复用 CLI 逻辑移入 core，或更改来自 `@baoanaz/cviauto-core` 的 CLI 导入 → [trellis-core-sdk.md](./trellis-core-sdk.md)
- 添加任何原生（`.node` / C++ / `node-gyp`）依赖 → [quality-guidelines.md "Native dependency policy"](./quality-guidelines.md)
- 编辑 `[workflow-state:STATUS]` 面包屑块 / `task.json.status` 写入器 / 生命周期 hooks → [workflow-state-contract.md](./workflow-state-contract.md)
- 编辑 `configurators/shared.ts`（占位符替换、写入辅助函数、序言注入）→ [configurator-shared.md](./configurator-shared.md)
- 编辑 `commands/mem.ts`（子命令、平台索引器、搜索/清理管道）→ [commands-mem.md](./commands-mem.md)
- 编辑 `commands/upgrade.ts`（全局 CLI 自升级行为）→ [commands-upgrade.md](./commands-upgrade.md)
- 编辑 `commands/update.ts`（标志、计划、应用阶段、幂等性）→ [commands-update.md](./commands-update.md) — 清单机制仍在 [migrations.md](./migrations.md) 中
- 编辑 `commands/workflow.ts`、`utils/workflow-resolver.ts`、workflow marketplace 条目或 `init --workflow` 行为 → [commands-workflow.md](./commands-workflow.md)
- 编辑 `commands/uninstall.ts` 或 `utils/uninstall-scrubbers.ts` → [commands-uninstall.md](./commands-uninstall.md) + [uninstall-scrubbers.md](./uninstall-scrubbers.md)
- 编辑 `commands/channel/**`（events.jsonl 协议、supervisor、adapter、项目桶、channel 生命周期命令）→ [commands-channel.md](./commands-channel.md)

也阅读 [unit-test/conventions.md](../unit-test/conventions.md) — 特别是「When to Write Tests」章节。

---

## 质量检查

编写代码后，对照这些指南进行验证：

1. 运行 `git diff --name-only` 查看你更改了什么
2. 阅读上述每个已更改区域的相应指南
3. 始终检查 [quality-guidelines.md](./quality-guidelines.md)
4. 检查是否需要添加或更新测试：
   - 新纯函数 → 需要单元测试
   - Bug 修复 → 需要回归测试
   - 已更改的 init/update 行为 → 需要更新集成测试
5. 运行 lint 和 typecheck：
   ```bash
   pnpm lint && pnpm typecheck
   ```

---

**语言**: 所有文档应使用 **中文** 编写。
