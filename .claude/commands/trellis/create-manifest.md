# 创建迁移清单（Create Migration Manifest）

基于上一版本以来的提交，为新 patch、beta、rc 或 minor 版本创建迁移清单（migration manifest）。

## 参数（Arguments）

- `$ARGUMENTS` - 目标版本号，例如 `0.5.15` 或 `0.6.0-beta.14`。如省略，请询问用户。

## 包发布模型（Package release model）

Trellis 目前从同一个 git tag 发布两个 npm 包：

- `@mindfoldhq/trellis`
- `@mindfoldhq/trellis-core`

两个包必须始终保持完全相同的版本号和 npm dist-tag。源码使用 `workspace:*`；打包后的 CLI 必须依赖精确匹配的已发布 core 版本。

正式的 npm 发布仅通过 CI 进行。切勿使用本地 `npm publish` 或 `pnpm publish` 来弥补失败或不完整的发布。本地验证可使用 `pnpm pack`、`release-preflight`、测试（tests）、代码检查（lint）、类型检查（typecheck）和 `npm view`。

## 第 1 步：确定上一版本（Identify Last Release）

```bash
git tag --sort=-v:refname | head -5
```

选取当前发布线上最新的发布标签，例如 `v0.5.14` 或 `v0.6.0-beta.13`。

## 第 2 步：收集变更（Gather Changes）

```bash
git log <last-release-tag>..HEAD --oneline
git log <last-release-tag>..HEAD --oneline -- packages/cli/src/ packages/core/src/
git log <last-release-tag>..HEAD --oneline -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml
```

面向用户的 changelog 覆盖范围应重点关注 `packages/cli/src/` 和 `packages/core/src/` 下的源码行为变更。发布接线（release wiring）、工作流（workflow）或包依赖变更仅在用户可观察到行为变化时（例如安装/更新可靠性或多包可用性）才归入 `Internal`。

## 第 3 步：分析每个相关提交（Analyze Each Relevant Commit）

对于每个涉及相关源码或发布行为的提交：

1. 阅读 diff：
   ```bash
   git diff <parent>...<commit> -- packages/cli/src/ packages/core/src/ --stat
   git diff <parent>...<commit> -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml --stat
   ```
2. 分类为 `feat`、`fix`、`refactor` 或 `chore`。
3. 以 conventional commit 风格编写一行 changelog 条目。

过滤掉纯规格文档（spec）编辑、机械性重构和仅供内部使用的清理，除非它们对用户可观察到的行为产生了实质性改变。

## 第 4 步：起草 Changelog（Draft Changelog）

语气（Voice）：技术参考文档。简短、清晰、平实。不是故事，不是推销文案。遵循 `.trellis/spec/docs-site/docs/style-guide.md` → "Changelog / Release Notes Voice"。

应该做（Do）：

- 每个 `###` 小节以一句话开头，说明变更了什么。然后接表格、代码或项目符号即可。
- 使用功能名称作为标题，例如 `### Joiner onboarding task`。
- 包含可 grep 的标识符：文件路径、函数名、标志名、迁移条目。
- docs-site 的英文和中文 changelog 保持 1:1 镜像：相同的小节、相同的表格、相同的代码块；仅翻译行文。

不应该做（Do not）：

- 不要添加"Why"、"Background"或"Rationale"段落。
- 不要添加 Tests 小节或测试数量。
- 不要添加 Internal 条目，除非用户可观察到行为变化。
- 不要使用反问句、情感化表述、冗余副词或营销口吻。
- 不要使用结果式措辞的标题，这类标题随时间推移会过时且不可 grep。

长度上限：每个 `###` 小节应控制在约 120 词以内。

允许的顶级小节，按顺序排列：

1. `Enhancements`
2. `Bug Fixes`
3. `Internal`（仅在用户可观察到时）
4. `Upgrade`

跳过空小节。

清单 `changelog` 字段：

- 使用单个字符串，以真实的 `\n` 分隔。
- 以粗体前缀分组：`**Enhancements:**`、`**Bug Fixes:**`、`**Internal:**`。
- 保持比 MDX changelog 更简短，因为它在 `trellis update` 期间会在终端中打印。

## 第 5 步：确定清单字段（Determine Manifest Fields）

| 字段（Field） | 决策方式（How to decide） |
|---|---|
| `breaking` | 任何破坏性 API 或行为变更。patch/prerelease 修复默认 `false`。 |
| `recommendMigrate` | 任何用户应执行的 rename/delete 迁移。patch 修复默认 `false`。当 `breaking=true` 且 `recommendMigrate=true` 时，`trellis update` 会在未加 `--migrate` 时以退出码 1 退出。 |
| `migrations` | `rename`、`rename-dir`、`delete` 或 `safe-file-delete` 操作的列表。patch 修复通常为 `[]`。 |
| `migrationGuide` | 当 `breaking=true` 且 `recommendMigrate=true` 时必填。将人工迁移指南插入生成的迁移任务 PRD 中。 |
| `aiInstructions` | 强烈建议与 `migrationGuide` 一起提供。AI 迁移辅助的指令。 |
| `notes` | 更新期间显示的简短终端指引。 |

不含 `migrationGuide` 的破坏性发布会导致升级体验中断。`packages/cli/scripts/create-manifest.js` 会对此进行校验。

## 第 5a 步：每条迁移条目的字段（Per-Migration Entry Fields）

| 字段（Field） | 用途（Purpose） | 是否必填（Required） |
|---|---|---|
| `type` | `rename`、`rename-dir`、`delete` 或 `safe-file-delete` | 是 |
| `from` | 相对于项目根目录的源路径 | 是 |
| `to` | 目标路径 | rename 时必填 |
| `description` | 迁移执行的操作，显示在确认提示中 | 建议填写 |
| `reason` | 版本特定的上下文，用于修改文件的提示 | 可选 |
| `allowed_hashes` | 已知原始文件的 SHA256 哈希值，用于安全删除 | `safe-file-delete` 时必填 |

`rename` 使用项目本地的 `.trellis/.template-hashes.json`；不使用清单中的 `allowed_hashes`。

使用规则：

- 文件移动且有替换路径时，使用 `rename`。
- 文件已删除且无替换时，使用 `safe-file-delete`。
- 被删除的文件已合并到另一个命令中时，使用 `safe-file-delete` 加 `notes`。

## 第 6 步：创建清单（Create Manifest）

通过 stdin 传入 JSON：

```bash
cat <<'EOF' | node packages/cli/scripts/create-manifest.js
{
  "version": "<version>",
  "description": "<short description>",
  "breaking": false,
  "recommendMigrate": false,
  "changelog": "<changelog text with real newlines>",
  "notes": "<notes>",
  "migrations": []
}
EOF
```

对于包含大量 rename 条目的破坏性发布，使用一个小型临时 Node 脚本生成条目，然后将最终 JSON 通过管道传入 `create-manifest.js`。

## 第 7 步：创建 Docs-Site Changelog（Create Docs-Site Changelogs）

此步骤对于每个发布都是必需的。

创建两个文件：

1. `docs-site/changelog/v<version>.mdx`
2. `docs-site/zh/changelog/v<version>.mdx`

使用近期 changelog 文件的格式。英文和中文结构必须 1:1 匹配。

更新 `docs-site/docs.json`：

- 将 `"changelog/v<version>"` 添加到英文 changelog 页面列表的顶部。
- 将 `"zh/changelog/v<version>"` 添加到中文 changelog 页面列表的顶部。
- 将导航栏（navbar）中的 changelog 链接更新为新版本。

当 `<Note>` 或 `<Warning>` 块包含 markdown 列表时，闭合标签必须从第 0 列开始：

```mdx
<Note>
- bullet
</Note>
```

## 第 8 步：文档生命周期（Docs Lifecycle）

docs-site 根路径是稳定的。开发周期位于 `beta/` 或 `rc/` 下。

| 过渡（Transition） | 脚本（Script） | 时机（When） |
|---|---|---|
| 启动新 beta | `docs-site/scripts/docs-beta-start.sh` | 新 minor/major 的首个 beta 前，例如 `0.6.0-beta.0`。 |
| Beta 转 RC | `docs-site/scripts/docs-beta-to-rc.sh` | 首个 rc 前，例如 `0.6.0-rc.0`。 |
| RC 转 GA | `docs-site/scripts/docs-promote.sh` | `pnpm release:promote` 之前。 |

单个 patch 发布（`-beta.1`、`-rc.1`、`0.5.1`）不运行生命周期脚本。编写 changelog MDX，更新 `docs.json`，提交/推送 docs-site，然后更新主仓库的子模块指针。

完整参考：`.trellis/spec/docs-site/docs/release-lifecycle.md`。

## 第 9 步：发布前预检（Preflight Before Release）

仅运行本地验证；不要本地发布。

```bash
node packages/cli/scripts/check-docs-changelog.js --type <beta|rc|promote>
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
pnpm lint
pnpm typecheck
pnpm test
```

仅当发布类型不要求时才跳过 `check-docs-changelog`（如稳定 patch 发布可能不需要此命令）。

## 第 10 步：审查和确认（Review and Confirm）

验证：

1. `packages/cli/src/migrations/manifests/<version>.json` 存在且为有效 JSON。
2. 清单 `changelog` 渲染为真实换行符。
3. docs-site 的两个 changelog MDX 文件均已存在且 1:1 匹配。
4. **所有**子模块提交在主仓库指针提交之前已推送（当前涉及 `docs-site/` + `marketplace/`）。验证方式：`git submodule foreach 'sha=$(git rev-parse HEAD); git ls-remote origin $sha | grep -q $sha && echo "ok $name" || echo "FAIL $name $sha"'`。标签触发的 CI 会执行 `git submodule update --init --recursive`，遇到第一个未推送的指针时会失败并报 `fatal: remote error: upload-pack: not our ref <SHA>`。
5. `@mindfoldhq/trellis` 和 `@mindfoldhq/trellis-core` 版本号仍然一致。

## 第 11 步：通过 CI 发布（Publish Through CI）

使用项目发布脚本，以通过标签启动 CI：

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

CI 成功后，验证公开的 npm：

```bash
npm view @mindfoldhq/trellis@<version> version dist-tags --json --registry=https://registry.npmjs.org/
npm view @mindfoldhq/trellis-core@<version> version dist-tags --json --registry=https://registry.npmjs.org/
```

如果 CI 失败或 npm 可见性不正确，请修复工作流/脚本并重新运行 CI 路径。不要使用本地发布来填补空缺。

## Dogfooding（自用验证）

破坏性发布必须在临时目录中进行端到端迁移测试：

```bash
mkdir /tmp/migrate-test && cd /tmp/migrate-test && git init -q .
npx -y @mindfoldhq/trellis@<last-ga> init -y -u test --claude --cursor --<platforms>
node <repo>/packages/cli/dist/cli/index.js update --migrate --dry-run
yes | node <repo>/packages/cli/dist/cli/index.js update --migrate --force
yes | node <repo>/packages/cli/dist/cli/index.js update
```

留意孤立文件（orphan files）、幂等性扰动（idempotency churn）和备份膨胀（backup bloat）。
