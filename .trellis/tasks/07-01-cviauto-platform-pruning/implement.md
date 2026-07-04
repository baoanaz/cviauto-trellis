# 实现计划：Cviauto 平台入口裁剪

## 步骤

1. 收敛 CLI 入口
   - [x] `trellis init` 删除无关 `.option("--...")`。
   - [x] banner/help 文案改成 Cviauto 三平台。
   - [x] 不再处理公开 CLI 中不存在的 Windsurf alias。

2. 增加公开平台 allow-list
   - [x] 新增 `PUBLIC_INIT_PLATFORM_IDS`。
   - [x] 新增 `getPublicInitToolChoices()`。
   - [x] Codex 公开显示名改为 `Codex`，避免旧平台说明进入用户选择列表。

3. 收敛 init/reinit 行为
   - [x] 初次 init 使用 public choices。
   - [x] re-init 使用 public choices。
   - [x] re-init 已安装平台展示过滤到 public choices。
   - [x] 旧平台选项从内部对象传入时不生成旧平台目录。

4. 收敛 mem 和 workflow 用户入口
   - [x] `trellis mem --platform` 公开范围改为 `claude|codex|opencode|all`。
   - [x] `packages/cli/src/templates/trellis/workflow.md` 改为三平台文案。
   - [x] 本仓库 `.trellis/workflow.md` 同步三平台文案。

5. 更新测试
   - [x] `configurators/index.test.ts` 增加 public choices 断言。
   - [x] `init.integration.test.ts` 改为三平台入口和旧平台忽略断言。
   - [x] `mem-helpers` / `mem-integration` 去掉 Pi 公开平台断言。
   - [x] `templates/trellis.test.ts` 改为三平台 workflow 断言。

6. 验证
   - [x] `pnpm --filter @mindfoldhq/trellis-core build`
   - [x] `pnpm --filter @mindfoldhq/trellis typecheck`
   - [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/init.integration.test.ts test/configurators/index.test.ts test/commands/mem-helpers.test.ts test/commands/mem-integration.test.ts test/templates/trellis.test.ts`
   - [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/workflow.integration.test.ts`
   - [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/update.integration.test.ts`
   - [x] `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/uninstall.integration.test.ts`
   - [x] `git diff --check`
   - [x] 最终用户可见旧平台入口扫描

## 当前边界

没有删除 `AI_TOOLS` 的旧平台条目，也没有删除旧平台 configurator/template 目录。这是有意保留：当前任务按 demo v1 先让用户层无感，避免大规模硬删造成 update/uninstall/template tracking 运行时风险。
