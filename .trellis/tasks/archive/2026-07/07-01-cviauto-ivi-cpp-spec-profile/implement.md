# 实现计划：Cviauto 默认 Spec Marketplace

## 当前决策

- [x] 放弃内置 `linux-cpp-ivi` profile 方案。
- [x] 不调用 `not-ace-tool` MCP；当前该工具链按用户要求视为断链。
- [x] 阅读官方 “定制 Spec Template Marketplace” 文档。
- [x] 先按 Direct Registry 模式实现。
- [x] 根据后续讨论迁移为 Marketplace 模式，默认 source 使用 `gh:baoanaz/cviauto-default-specs/marketplace`，默认 template 使用 `Cviauto-spec`。

## 改动项

1. `cviauto-default-specs` 仓库
   - [x] 迁移为 `marketplace/index.json` + `marketplace/specs/Cviauto-spec/`。
   - [x] 根目录新增 `HANDOFF.md` 作为维护文档，不安装进 `.trellis/spec/`。
   - [x] `Cviauto-spec/README.md` 总结 spec 适合写什么、不适合写什么。
   - [x] 保留 `common/` 和 `features/` 当前初始 spec。

2. Trellis CLI
   - [x] `init` 默认注入 `gh:baoanaz/cviauto-default-specs/marketplace` + `Cviauto-spec`。
   - [x] 显式 `--registry` / `--template` 优先。
   - [x] 默认 registry 安装失败时停止，不回退旧模板。
   - [x] remote/direct skipped 时仍跳过内置 spec 生成。
   - [x] monorepo registry 安装后不再生成 per-package backend/frontend。
   - [x] bootstrap task 增加 Cviauto spec 文案。

3. 测试
   - [x] 更新 init integration 测试默认 registry mock。
   - [x] 更新默认 spec 结构断言。
   - [x] 更新 monorepo 默认 spec 断言。
   - [x] 保留显式 registry/template 覆盖测试。

4. 文档
   - [x] 更新 `prd.md`。
   - [x] 更新 `design.md`。
   - [x] 更新 `implement.md`。
   - [x] 更新 `HANDOFF.md`。

## 验证计划

- [x] `pnpm --filter @mindfoldhq/trellis typecheck`
- [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/init.integration.test.ts`
- [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/workflow.integration.test.ts`
- [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/update.integration.test.ts`
- [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/uninstall.integration.test.ts`
- [x] `git diff --check`
- [x] `git -C /home/xuwenzheng/2_github/AI/cviauto-default-specs diff --check`

## 当前验证状态

本轮验证通过。`cviauto-default-specs` 仓库 diff 已检查，等待用户决定是否提交/推送该仓库。

## 后续任务

平台支持裁剪另起任务：只保留 Claude、Codex、OpenCode。
