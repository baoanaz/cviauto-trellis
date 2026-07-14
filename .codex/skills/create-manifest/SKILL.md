---
name: create-manifest
description: "Create a Trellis migration manifest and matching docs-site changelogs for a target release by analyzing commits since the previous release. Use when preparing a patch, beta, rc, or minor release manifest."
---

# 创建迁移清单（Create Migration Manifest）

基于自上次发布以来的提交（commits），为新的补丁（patch）、beta、rc 或次版本（minor）发布创建迁移清单。

## 参数

- `$ARGUMENTS` - 目标版本，例如 `0.5.15` 或 `0.6.0-beta.14`。如果省略，询问用户。

## 包发布模型（Package release model）

Trellis 当前从同一个 git tag 发布两个 npm 包：

- `@mindfoldhq/trellis`
- `@mindfoldhq/trellis-core`

两个包必须始终共享完全相同的版本和 npm dist-tag。源码使用 `workspace:*`；打包后的 CLI 必须依赖完全相同的已发布 core 版本。

官方 npm 发布（publishing）仅通过 CI 进行。绝不要使用本地 `npm publish` 或 `pnpm publish` 来弥补失败或部分的发布。本地验证可使用 `pnpm pack`、`release-preflight`、测试、lint、typecheck 和 `npm view`。

## 第 1 步：识别上次发布

```bash
git tag --sort=-v:refname | head -5
```

选择当前发布线（release line）上最近的一个发布 tag，例如 `v0.5.14` 或 `v0.6.0-beta.13`。

## 第 2 步：收集变更

```bash
git log <last-release-tag>..HEAD --oneline
git log <last-release-tag>..HEAD --oneline -- packages/cli/src/ packages/core/src/
git log <last-release-tag>..HEAD --oneline -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml
```

面向用户的更新日志（changelog）覆盖范围应专注于 `packages/cli/src/` 和 `packages/core/src/` 下的源码行为。发布连接（release wiring）、工作流（workflow）或包依赖变更仅在用户可观察到行为时才归入 `Internal`，例如安装/更新可靠性或多包可用性。

## 第 3 步：分析每个相关提交

对于每个触及相关源码或发布行为的提交：

1. 阅读 diff：
   ```bash
   git diff <parent>...<commit> -- packages/cli/src/ packages/core/src/ --stat
   git diff <parent>...<commit> -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml --stat
   ```
2. 分类为 `feat`、`fix`、`refactor` 或 `chore`。
3. 用 conventional commit 风格写一条单行的更新日志（changelog）条目。

舍弃纯 spec 编辑、机械重构和仅内部清理的内容，除非它们实质上改变了用户可观察到的行为。

## 第 4 步：起草更新日志（Changelog）

语气：技术参考文档。简短、清晰、朴实。不是故事，不是销售话术。遵循 `.trellis/spec/docs-site/docs/style-guide.md` -> "Changelog / Release Notes Voice"。

应该：

- 每个 `###` 小节以一句话陈述变更内容开头。然后是表格、代码或列表。结束。
- 使用功能名称作为标题，例如 `### Joiner onboarding task`。
- 包含可 grep 的标识符：文件路径、函数名称、标志（flag）名称、迁移条目。
- 在文档站点更新日志中英文和中文 1:1 镜像：相同的小节、相同的表格、相同的代码块；仅翻译正文。

不应该：

- 添加 "Why"、"Background" 或 "Rationale" 段落。
- 添加 Tests 小节或测试数量。
- 添加 Internal 条目，除非用户可观察到行为。
- 使用反问句、情感框架、填充性副词或营销语气。
- 使用结果导向的标题，这些标题容易过时或不可 grep。

长度上限：每个 `###` 小节保持在约 120 个词以内。

允许的顶级小节，按顺序排列：

1. `Enhancements`
2. `Bug Fixes`
3. `Internal` 仅在用户可观察时
4. `Upgrade`

跳过空的小节。

清单（manifest）中的 `changelog` 字段：

- 使用带有真实 `\n` 分隔符的单一字符串。
- 用粗体前缀分组：`**Enhancements:**`、`**Bug Fixes:**`、`**Internal:**`。
- 保持比 MDX 更新日志更短，因为它在 `trellis update` 期间在终端打印。

## 第 5 步：确定清单字段（Manifest Fields）

| 字段 | 如何决定 |
|------|---------|
| `breaking` | 任何破坏性 API 或行为变更。对于补丁/预发布修复默认 `false`。 |
| `recommendMigrate` | 任何用户应运行的重命名/删除迁移。对于补丁修复默认 `false`。当 `breaking=true` 且 `recommendMigrate=true` 时，`trellis update` 在无 `--migrate` 时以 1 退出。 |
| `migrations` | `rename`、`rename-dir`、`delete` 或 `safe-file-delete` 操作的列表。对于补丁修复通常为 `[]`。 |
| `migrationGuide` | 当 `breaking=true` 且 `recommendMigrate=true` 时为必填。插入生成迁移任务 PRD 的人工迁移指南。 |
| `aiInstructions` | 强烈建议与 `migrationGuide` 配套。提供给 AI 迁移辅助的指令。 |
| `notes` | 在更新过程中显示的简要终端指引。 |

没有 `migrationGuide` 的破坏性发布会产生破损的升级体验。`packages/cli/scripts/create-manifest.js` 会对此进行验证。

## 第 5a 步：每条迁移条目字段

| 字段 | 用途 | 是否必填 |
|------|------|---------|
| `type` | `rename`、`rename-dir`、`delete` 或 `safe-file-delete` | 是 |
| `from` | 相对于项目根目录的源路径 | 是 |
| `to` | 目标路径 | 重命名时必填 |
| `description` | 迁移做什么，在确认提示中显示 | 推荐 |
| `reason` | 用于已修改文件提示的版本特定上下文 | 可选 |
| `allowed_hashes` | 用于安全删除的已知纯净 SHA256 哈希 | `safe-file-delete` 时必填 |

`rename` 使用项目本地的 `.trellis/.template-hashes.json`；它不使用清单中的 `allowed_hashes`。

使用场景：

- 当文件移动且有替换路径时，使用 `rename`。
- 当文件被移除且无替换时，使用 `safe-file-delete`。
- 当被移除的文件已合并到另一个命令中时，使用 `safe-file-delete` 加 `notes`。

## 第 6 步：创建清单

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

对于包含许多重命名条目的破坏性发布，通过一个小型临时 Node 脚本生成条目，并将最终 JSON 传入 `create-manifest.js`。

## 第 7 步：创建文档站点更新日志（Docs-Site Changelogs）

此步骤对于每次发布都是强制性的。

创建两个文件：

1. `docs-site/changelog/v<version>.mdx`
2. `docs-site/zh/changelog/v<version>.mdx`

使用近期更新日志文件的格式。英文和中文结构必须 1:1 匹配。

更新 `docs-site/docs.json`：

- 在英文更新日志页面列表顶部添加 `"changelog/v<version>"`。
- 在中文更新日志页面列表顶部添加 `"zh/changelog/v<version>"`。
- 将导航栏（navbar）更新日志链接更新为新版本。

当 `<Note>` 或 `<Warning>` 块包含 markdown 列表时，闭合标签必须从第 0 列开始：

```mdx
<Note>
- bullet
</Note>
```

## 第 8 步：文档生命周期（Docs Lifecycle）

文档站点根路径是稳定的。开发周期内容位于 `beta/` 或 `rc/` 下。

| 过渡 | 脚本 | 何时执行 |
|------|------|---------|
| 启动新的 beta | `docs-site/scripts/docs-beta-start.sh` | 在首次新 minor/major 的 beta 之前，例如 `0.6.0-beta.0`。 |
| Beta 转 RC | `docs-site/scripts/docs-beta-to-rc.sh` | 在首个 rc 之前，例如 `0.6.0-rc.0`。 |
| RC 转 GA | `docs-site/scripts/docs-promote.sh` | 在 `pnpm release:promote` 之前。 |

每个补丁发布（如 `-beta.1`、`-rc.1`、`0.5.1`）不运行生命周期脚本。编写更新日志 MDX，更新 `docs.json`，提交并推送文档站点，然后更新主仓库的 submodule 指针。

完整参考：`.trellis/spec/docs-site/docs/release-lifecycle.md`。

## 第 9 步：发布前预检（Preflight Before Release）

仅运行本地验证；不要在本地发布。

```bash
node packages/cli/scripts/check-docs-changelog.js --type <beta|rc|promote>
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
pnpm lint
pnpm typecheck
pnpm test
```

仅对稳定补丁发布（release type 不要求该命令时）跳过 `check-docs-changelog`。

## 第 10 步：审查与确认

验证：

1. `packages/cli/src/migrations/manifests/<version>.json` 存在且是有效的 JSON。
2. 清单 `changelog` 以真实换行符渲染。
3. 两个文档站点更新日志 MDX 文件均存在且 1:1 匹配。
4. **所有** submodule 提交在主仓库指针提交之前已推送（当前为 `docs-site/` + `marketplace/`）。验证命令：`git submodule foreach 'sha=$(git rev-parse HEAD); git ls-remote origin $sha | grep -q $sha && echo "ok $name" || echo "FAIL $name $sha"'`。tag 触发的 CI 会执行 `git submodule update --init --recursive`，在首个未推送的指针上以 `fatal: remote error: upload-pack: not our ref <SHA>` 失败。
5. `@mindfoldhq/trellis` 和 `@mindfoldhq/trellis-core` 版本仍然匹配。

## 第 11 步：通过 CI 发布

使用项目发布脚本，这样 tag 会启动 CI：

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

CI 成功后，验证公共 npm：

```bash
npm view @mindfoldhq/trellis@<version> version dist-tags --json --registry=https://registry.npmjs.org/
npm view @mindfoldhq/trellis-core@<version> version dist-tags --json --registry=https://registry.npmjs.org/
```

如果 CI 失败或 npm 可见性有误，修复工作流/脚本并重新运行 CI 路径。不要用本地发布来填补缺口。

## 自测（Dogfooding）

破坏性发布必须在一个临时目录中进行端到端（end-to-end）迁移测试：

```bash
mkdir /tmp/migrate-test && cd /tmp/migrate-test && git init -q .
npx -y @mindfoldhq/trellis@<last-ga> init -y -u test --claude --cursor --<platforms>
node <repo>/packages/cli/dist/cli/index.js update --migrate --dry-run
yes | node <repo>/packages/cli/dist/cli/index.js update --migrate --force
yes | node <repo>/packages/cli/dist/cli/index.js update
```

关注孤儿文件（orphan files）、幂等性抖动（idempotency churn）和备份膨胀（backup bloat）。
