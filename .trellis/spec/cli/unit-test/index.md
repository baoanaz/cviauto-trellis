# 单元测试指南（Unit Test Guidelines）

> 本项目的测试规范和模式。

---

## 概述（Overview）

本项目使用 **Vitest** 搭配 TypeScript ESM。测试集中放置在 `test/` 目录下，镜像 `src/` 的结构。目标是编写快速、可复现、且最小化 mock 的测试。

---

## 指南索引（Guidelines Index）

| 指南（Guide） | 描述（Description） | 状态（Status） |
|-------|-------------|--------|
| [规范（Conventions）](./conventions.md) | 文件命名、结构、断言模式、测试隔离（环境变量泄漏防护）、何时编写测试 | 已完成（Done） |
| [Mock 策略（Mock Strategies）](./mock-strategies.md) | 什么需要 mock、如何 mock、以及最小化 mock 原则 | 已完成（Done） |
| [集成模式（Integration Patterns）](./integration-patterns.md) | 用于命令的函数级集成测试 | 已完成（Done） |

---

## 快速参考（Quick Reference）

```bash
# 运行所有测试
pnpm test

# Watch 模式
pnpm test:watch

# 运行指定的测试文件
pnpm test test/commands/init.integration.test.ts

# 运行覆盖率报告（终端 + HTML）
pnpm test:coverage
```

---

## 代码覆盖率（Code Coverage）

覆盖率通过 `@vitest/coverage-v8` 自动生成。配置在 `vitest.config.ts` 中。

- **终端**：`pnpm test:coverage` 打印每个文件的覆盖率表格
- **HTML 报告**：`./coverage/index.html`（已 gitignore，按需生成）
- **源码范围**：`src/**/*.ts`（排除 `src/cli/index.ts`）

**不要**维护手动覆盖率表——始终运行 `pnpm test:coverage` 获取真实数据。

---

## CI / 流水线策略（CI / Pipeline Strategy）

| 阶段（Stage） | 运行内容（What Runs） | 理由（Rationale） |
|-------|-----------|-----------|
| **pre-commit**（husky） | `lint-staged`（eslint + prettier） | 保持快速；不要在此添加测试，否则开发者会使用 `--no-verify` 跳过 |
| **CI**（GitHub Actions，PR 门禁） | `pnpm lint` → `pnpm build` → `pnpm test` | 完整套件；约 312 个测试运行约 1 秒，无需拆分 |

**何时重新考虑**：如果总测试时间超过 5 分钟，拆分为快速（单元）和慢速（集成）阶段。目前无需如此。

---

## 开发前检查清单（Pre-Development Checklist）

在编写或改进测试之前：

1. 阅读 [conventions.md](./conventions.md)——文件命名、结构、断言模式、何时编写测试
2. 阅读 [mock-strategies.md](./mock-strategies.md)——什么需要 mock、如何 mock、最小化 mock 原则
3. 对于命令级测试，阅读 [integration-patterns.md](./integration-patterns.md)

---

## 质量检查（Quality Check）

编写测试之后：

1. 确保测试遵循规范（命名、结构、断言）
2. 验证 mock 是最小化的——优先使用真实代码路径
3. 运行验证：
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
4. 检查覆盖率决策——报告任何缺口及理由

---

**语言（Language）**：所有文档应使用 **英文（English）** 编写。
