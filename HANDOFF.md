# 交接文档

当前仓库：`/home/xuwenzheng/2_github/AI/Trellis`

当前分支：`cviauto/internalize-v0`

## 目标

- 把用户可见层面的 Trellis 白标成 Cviauto。
- CLI 命令使用 `cviauto`，README 安装入口指向 `https://github.com/baoanaz/cviauto-trellis`。
- 初始化后的运行目录从 `.trellis/` 改为 `.cviauto/`。
- 生成给用户/AI 平台看的命令、skill、agent、hook 文案默认使用 Cviauto / cviauto。
- 保留必要的 legacy Trellis 兼容识别，用于迁移、卸载和旧项目清理。
- 不自动执行 spec 沉淀；只有用户明确要求时才走 update-spec。

## 当前进度

已完成的大节点：

- 前置节点已提交：
  - `0a32f354 feat: lighten Trellis finish workflow`
  - `e15982df fix: tune Cviauto init prompts`
- `packages/cli/src/constants/paths.ts` 已把 workflow 根目录切到 `.cviauto`。
- `packages/cli/src/cli/index.ts` 的公开 program name、帮助、升级提示已切到 `cviauto` / Cviauto。
- `README.md` 已改为 Cviauto README，安装示例使用：
  - `git clone https://github.com/baoanaz/cviauto-trellis.git`
  - `pnpm install`
  - `pnpm build`
  - `npm install -g ./packages/cli`
  - `cviauto init -u your-name`
- `packages/cli/src/commands/upgrade.ts` 目标已改为 `github:baoanaz/cviauto-trellis`，成功提示检查 `cviauto --version` / `which cviauto`。
- `packages/core/package.json` 包名已改为 `@mindfoldhq/cviauto-core`，CLI 依赖也已改为 `@mindfoldhq/cviauto-core: workspace:*`。
- 根 `package.json` 的 core build/test/lint/typecheck 过滤器已更新到 `@mindfoldhq/cviauto-core`。
- 已执行 `pnpm install --lockfile-only` 和 `pnpm install`，`pnpm-lock.yaml` / workspace 依赖已刷新。
- 公开生成面已切到 Cviauto：
  - `/trellis:*` -> `/cviauto:*`
  - `trellis-*` 生成名 -> `cviauto-*`
  - `.github/hooks/trellis.json` -> `.github/hooks/cviauto.json`
  - `.pi/extensions/trellis/index.ts` 生成路径 -> `.pi/extensions/cviauto/index.ts`
  - `.devin/workflows/cviauto-*.md`
  - `.cursor/commands/cviauto-*.md`
  - `.pi/prompts/cviauto-*.md`
  - `.agents/skills/cviauto-*`
- `packages/cli/src/templates/template-utils.ts` 新增生成名/内容转换逻辑：
  - 源码模板目录可继续叫 `trellis-*`。
  - 通过 reader 和 configurator 输出时统一转换成 `cviauto-*` / Cviauto。
- `packages/cli/src/configurators/shared.ts` 已让 command-as-skill、workflow skill、bundled skill 输出为 `cviauto-*`。
- `packages/cli/src/utils/uninstall-scrubbers.ts` 已加入 Cviauto 新路径和 Trellis legacy 路径兼容，特别是 Pi extension 和 Codex config scrub。
- AGENTS 模板块已改为 `<!-- CVIAUTO:START -->` / `<!-- CVIAUTO:END -->`，update/manifest-prune 同时兼容旧 `TRELLIS` marker。
- init 过程中不再询问安装 Trellis statusLine，statusLine 只保留 `--with-statusline` 显式开关。
- Kiro hook 源码已物理改名：
  - 删除 `packages/cli/src/templates/kiro/hooks/trellis-workflow-state.kiro.hook`
  - 新增 `packages/cli/src/templates/kiro/hooks/cviauto-workflow-state.kiro.hook`
- OpenCode runtime lib 已改为 `packages/cli/src/templates/opencode/lib/cviauto-context.js`，插件 import 已同步；`session-utils.js` 兼容读取旧 `metadata.trellis`，新写入 `metadata.cviauto`。
- Python common config 源码已从 `trellis_config.py` 改为 `cviauto_config.py`，`git_context.py` 已改为 `from .cviauto_config import read_trellis_config`。
- workflow 注入标签已切换到 `<cviauto-workflow>...</cviauto-workflow>`，涉及 shared-hooks、Codex、Copilot、OpenCode、Pi。
- init/update 的几处旧测试期望已改为 Cviauto 文案或 CVIAUTO marker：
  - `packages/cli/test/commands/init-internals.test.ts`
  - `packages/cli/test/commands/init.integration.test.ts`
  - `packages/cli/test/commands/update.integration.test.ts`

已验证：

```bash
pnpm --dir packages/cli exec vitest run test/templates/cursor.test.ts test/templates/codex.test.ts test/templates/reasonix.test.ts test/templates/trae.test.ts test/templates/kiro.test.ts test/templates/trellis.test.ts test/configurators/shared.test.ts test/utils/template-hash.test.ts test/configurators/index.test.ts
pnpm --dir packages/cli exec vitest run test/templates/opencode.test.ts test/configurators/platforms.test.ts test/templates/pi.test.ts test/templates/shared-hooks.test.ts test/configurators/index.test.ts --reporter=dot
pnpm --dir packages/cli exec vitest run test/commands/init-internals.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts --reporter=dot
pnpm --dir packages/cli exec vitest run test/regression.test.ts --reporter=dot
pnpm --dir packages/cli exec vitest run test/scripts/add-session.integration.test.ts test/commands/init-uninstall-overdelete.integration.test.ts --reporter=dot
pnpm --filter @mindfoldhq/trellis test
pnpm typecheck
pnpm test
pnpm build
pnpm lint
git diff --check
```

验证结果：

- `pnpm typecheck` 已通过。
- `pnpm test` 已通过：core 297 个测试、CLI 1250 个测试。
- `pnpm build` 已通过。
- `pnpm lint` 已通过。
- `git diff --check` 已通过。
- 模板/配置器定向测试已通过：9 个测试文件、190 个测试。
- OpenCode / Pi / Kiro 相关定向测试已通过：5 个测试文件、169 个测试。
- init/update 集成测试已通过：3 个测试文件、92 个测试。
- regression 已通过：318 个测试。
- add-session / init-uninstall-overdelete 定向测试已通过：2 个测试文件、16 个测试。
- 完整 CLI 测试已通过：51 个测试文件、1250 个测试。
- dist smoke 已通过：临时仓库生成 `.cviauto/`，未生成 `.trellis/`，也未生成 `commands/trellis*`、`skills/trellis*`、`agents/trellis*`。
- GitNexus `detect_changes()` 未能运行：本 checkout 没有可用的 GitNexus MCP 工具，且 `gitnexus` 命令不存在；已用 `git diff --check`、`git status`、白标残留扫描和完整测试矩阵替代。

最新刚修过的测试文件：

- `packages/cli/test/templates/cursor.test.ts`
- `packages/cli/test/templates/codex.test.ts`
- `packages/cli/test/templates/trae.test.ts`
- `packages/cli/test/templates/reasonix.test.ts`
- `packages/cli/test/templates/kiro.test.ts`
- `packages/cli/test/configurators/index.test.ts`
- `packages/cli/test/templates/opencode.test.ts`
- `packages/cli/test/templates/pi.test.ts`
- `packages/cli/test/templates/shared-hooks.test.ts`
- `packages/cli/test/configurators/platforms.test.ts`
- `packages/cli/test/registry-invariants.test.ts`
- `packages/cli/test/regression.test.ts`
- `packages/cli/test/commands/update.integration.test.ts`
- `packages/cli/test/commands/init-uninstall-overdelete.integration.test.ts`
- `packages/cli/vitest.config.ts`

这些测试现在验证“生成器返回的 Cviauto 输出”，不再要求源码模板文件名也改成 `cviauto-*`。

## 有效的方法

- 白标策略采用“两层命名”：
  - 用户可见输出、生成到目标项目的文件、README、CLI 命令全部用 Cviauto / cviauto / `.cviauto`。
  - 源码内部目录、旧 manifest、legacy marker 可以保留 Trellis 名称，只要生成输出被转换，且 uninstall/update 能识别旧形态。
- `template-utils.ts` 的转换函数是关键入口，不要在所有模板文件里手工改文件名：
  - `toCviautoGeneratedName(name)`
  - `toCviautoGeneratedContent(content)`
- 对 `.agents/skills/` 仍要使用 neutral renderer，避免多平台写同一个 shared skill 时产生 hash churn。
- 测试应优先验证 `getAllAgents()` / `collectPlatformTemplates()` / `resolve*()` 的生成结果，而不是假设源码模板路径已改名。
- Pi 是特殊平台：
  - 源码仍可在 `templates/pi/extensions/trellis/index.ts.txt`。
  - 生成路径应是 `.pi/extensions/cviauto/index.ts`。
  - uninstall scrubber 需要同时认 `./extensions/cviauto/index.ts` 和旧 `./extensions/trellis/index.ts`。
- Kiro 主 agent 现在应生成 `cviauto`，但源码文件仍是 `templates/kiro/agents/trellis.json`。
- 下一个 AI 继续时不要 dispatch implement/check sub-agent；当前是 inline 模式，主会话直接修改和验证。

## 失败的尝试

- 直接把测试里的 `trellis-*` 全量替换成 `cviauto-*` 后，一批测试失败：
  - 原因是源码模板文件名没有全部物理改名，生成器在读取时转换名称。
  - 修法是让测试通过 `getAllAgents()` / `collectPlatformTemplates()` 取生成结果，而不是 `fs.readFileSync(.../cviauto-*.md)` 硬读源码路径。
- 全量 `pnpm test` 早前跑过一次未通过：
  - 有一次 core lock timeout，单跑 core 后通过，可能是偶发。
  - CLI 失败大多来自旧命名期望，已改成验证生成结果。
- `pnpm --filter @mindfoldhq/trellis test -- test/templates/opencode.test.ts` 会把参数传得不理想，可能跑成全量或 0 tests。
  - 定向 CLI 测试推荐用：`pnpm --dir packages/cli exec vitest run <file...>`。
- `regression.test.ts` 最大问题不是业务逻辑，而是测试仍在硬读源码路径，例如 `templates/*/agents/cviauto-*.md`。
  - 已改成通过 `collectPlatformTemplates(<platform>)` 读取生成结果。
  - 源码模板实际仍可叫 `trellis-*`，生成器负责输出 Cviauto 名称和内容。
- 完整 CLI suite 曾触发 Vitest 10s timeout，但相关用例单跑正常。
  - 已把 `packages/cli/vitest.config.ts` 的 `testTimeout` / `hookTimeout` 统一提高到 30s，避免并发全量 suite 的假超时。

## 下一步

当前任务已达到提交状态。若后续继续迭代，优先事项是：

1. 如要继续收紧白标残留，可复跑用户可见面扫描：

   ```bash
   rg -n "\.trellis|/trellis:|/trellis-|commands/trellis|workflows/trellis-|prompts/trellis-|hooks/trellis\.json|npm install -g @mindfoldhq/trellis|@mindfoldhq/trellis@|trellis init|trellis update|trellis upgrade|Trellis supports|Managed by Trellis|This project is managed by Trellis|# Trellis|<!-- TRELLIS" README.md packages/cli/src/cli packages/cli/src/commands packages/cli/src/configurators packages/cli/src/templates/markdown packages/cli/src/templates/trellis packages/cli/src/templates/shared-hooks packages/cli/src/templates/opencode packages/cli/src/templates/pi packages/cli/src/templates/common/commands packages/cli/src/templates/common/skills packages/cli/src/templates/codex/skills packages/cli/src/templates/copilot/prompts packages/cli/src/templates/copilot/hooks packages/cli/src/templates/codex/hooks packages/cli/src/templates/common/bundled-skills packages/cli/package.json packages/core/package.json
   ```

   注意：命中不一定都是问题。以下情况可能是允许的：
   - 源码目录名 `templates/trellis`
   - legacy marker 兼容
   - uninstall/update 对旧 Trellis 形态的兼容识别

2. 若要彻底改 npm package identity，把 CLI 包名从 `@mindfoldhq/trellis` 改成 Cviauto，应单独做 packaging/release pass。

3. 不要 push，除非用户明确要求。

## 注意事项

- 用户已经创建了空仓库：`https://github.com/baoanaz/cviauto-trellis`。
- 当前 CLI 包名 `packages/cli/package.json` 仍是 `@mindfoldhq/trellis`，bin 只暴露 `cviauto`。这是为了减少发布脚本和旧 package identity 的一次性风险。若用户之后要求 npm 包也彻底改名，应单独做一轮 packaging/release pass。
- `packages/cli/src/templates/common/bundled-skills/trellis-*` 目录仍存在，当前靠生成器转成 `cviauto-*`。如果后续要物理重命名目录，必须同步 update/hash/migration/uninstall 测试。
- 大量 `packages/cli/src/migrations/manifests/*.json` 已被改动。提交前需要确认这是预期白标迁移策略，而不是不必要的历史 manifest churn。
- 不要修改本仓库 `.trellis/` 项目管理文件作为白标交付内容，除非用户明确要求；当前白标目标是 CLI 生成物和用户可见层。
