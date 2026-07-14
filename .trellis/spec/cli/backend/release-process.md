# 发布流程

> Trellis monorepo 的发布、版本化、文档和 npm 发布规则。

---

## 概述

Trellis 从一个 git tag 发布两个 npm 包：

| 包 | 角色 | 发布者 |
|---|---|---|
| `@baoanaz/cviauto` | 面向用户的 CLI | 仅 GitHub Actions |
| `@baoanaz/cviauto-core` | CLI 和外部集成使用的可编程 core API | 仅 GitHub Actions |

该包对是版本锁定的。每个已发布版本必须为两个包存在，且具有完全相同的版本和 npm dist-tag。

---

## CI 独享发布

官方 npm 发布必须通过 `.github/workflows/publish.yml` 进行。

不要为官方 Trellis 包在本地运行 `npm publish` 或 `pnpm publish`。本地机器可以运行 `pnpm pack`、`release-preflight`、测试、lint、typecheck 和 dry-run 检查，但不能进行包发布。

如果 CI 发布看起来部分或不一致：

1. 检查 GitHub Actions 发布运行。
2. 验证公共 npm 可见性：
   ```bash
   npm view @baoanaz/cviauto@<version> version dist-tags --json --registry=https://registry.npmjs.org/
   npm view @baoanaz/cviauto-core@<version> version dist-tags --json --registry=https://registry.npmjs.org/
   ```
3. 修复工作流或发布脚本。
4. 当相同版本仍然是预期的发布产物时，重新运行 CI 路径或在修复后移动 tag。

不要通过本地发布一个缺失的包来补偿。这创建了没有 CI 来源的发布产物，并隐藏了下次发布的工作流失败。

发布工作流必须在发布后使用以下命令验证两个包：

```bash
node packages/cli/scripts/release-preflight.js verify-npm --package all
```

---

## 版本不变量

| 不变量 | 规则 |
|---|---|
| 共享版本 | `packages/cli/package.json` 和 `packages/core/package.json` 必须具有相同的 `version`。 |
| 共享 tag | Git tag `v<version>` 必须匹配两个包的版本。 |
| 共享 npm dist-tag | `-beta.N` 为 `beta`，`-rc.N` 为 `rc`，`-alpha.N` 为 `alpha`，GA 为 `latest`。 |
| 源依赖 | CLI 源使用 `workspace:*` 依赖 core。 |
| 打包依赖 | 已发布的 CLI 包必须依赖于确切发布版本的 `@baoanaz/cviauto-core`。 |

`packages/cli/scripts/release-preflight.js` 是这些检查的权威来源。

必需门控：

```bash
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
```

---

## 分支和发布轨道

| 轨道 | 分支模式 | 版本模式 | npm tag | 备注 |
|---|---|---|---|---|
| Stable | `main` | `X.Y.Z` | `latest` | 补丁/次/主版本 GA 发布。 |
| Beta | `feat/vX.Y.Z-beta` 或等效的长期 beta 分支 | `X.Y.Z-beta.N` | `beta` | 功能孵化。CLI 和 core 都发布 beta 版本。 |
| RC | 发布候选分支或稳定的 beta 分支 | `X.Y.Z-rc.N` | `rc` | GA 前验证。CLI 和 core 都发布 rc 版本。 |
| GA 提升 | 稳定发布分支 / `main` | `X.Y.Z` | `latest` | 将发布候选提升到稳定文档和最新 npm tag。 |

新的 beta 周期从当前稳定/发布基线开始，并使用下一个次或主版本，例如 `0.5.x` 之后的 `0.6.0-beta.0`。它不会在 beta 线已经移动到 RC 或 GA 之后继续旧的 beta 线。

稳定修复通常通过 cherry-pick 从 `main` 流向 beta/rc。仅 beta 的功能不会通过 cherry-pick 回流到 `main`；当需要时将它们重写为稳定就绪的提交。

---

## 文档站点（docs-site）生命周期

docs-site 根路径存放当前稳定文档。Beta 和 RC 内容位于 `beta/` 和 `rc/` 下。

| 转换 | 脚本 | 何时 |
|---|---|---|
| 启动新 beta | `docs-site/scripts/docs-beta-start.sh` | 在新的次/主版本第一次 `pnpm release:beta` 之前，例如 `0.6.0-beta.0`。 |
| Beta 到 RC | `docs-site/scripts/docs-beta-to-rc.sh` | 在第一次 `pnpm release:rc` 之前，例如 `0.6.0-rc.0`。 |
| RC 到 GA | `docs-site/scripts/docs-promote.sh` | 在 `pnpm release:promote` 之前。 |

每个补丁 beta、RC 或 GA 发布不运行这些生命周期脚本。它们添加 changelog MDX 文件，更新 `docs-site/docs.json`，先提交 docs-site 子模块，然后在主仓库中提升子模块指针。

完整文档详情位于 `.trellis/spec/docs-site/docs/release-lifecycle.md`。

---

## 子模块提交顺序

当发布涉及 `docs-site` 或 `marketplace` 时，先提交并推送子模块，然后在主仓库中提交子模块指针。

正确顺序：

```bash
cd docs-site
git add . && git commit -m "docs: changelog v<version>" && git push origin main

cd ..
git add docs-site
git commit -m "chore: bump docs-site for v<version>"
git push origin <branch>
```

`packages/cli/scripts/release.js` 从其自动发布前暂存中排除 `docs-site` 和 `marketplace`，因此子模块指针更改不能隐藏在通用发布提交中。

### 契约：每个已修改的子模块必须在版本 tag 之前推送

tag 触发的 `publish.yml` CI 对标记的提交运行 `git submodule update --init --recursive`。如果**任何**子模块指针引用子模块远程上不存在的 SHA，CI 在 checkout 时以以下错误失败：

```
fatal: remote error: upload-pack: not our ref <SHA>
fatal: Fetched in submodule path '<name>', but it did not contain <SHA>. Direct fetching of that commit failed.
```

这是每个子模块的。推送 `docs-site` 但忘记 `marketplace`（反之亦然）仍然会失败。在 `pnpm release` 之前验证所有子模块：

```bash
git submodule foreach 'sha=$(git rev-parse HEAD); git ls-remote origin $sha | grep -q $sha && echo "ok $name" || echo "FAIL $name $sha not on remote"'
```

任何 `FAIL` 行意味着：`cd <submodule> && git checkout -B main && git push origin main` 然后再打 tag。如果在发现缺失时 tag 已经推送，通过先推送子模块然后重新运行失败的 CI 作业（`gh run rerun <id> --failed`）来恢复 — 不需要新的 tag。

> **事件记录（2026-06, v0.6.4）。** 作为捆绑模板编辑的 parity mirror，`marketplace/workflows/native/workflow.md` 被触及，在子模块内提交，并在主仓库中提升了指针 — 但子模块本身从未被推送到其 `origin/main`。`pnpm release` 愉快地标记了 `v0.6.4`；CI 获取了新 tag，尝试实现 marketplace 指针 `680bcbb`，并在 checkout 时死亡。修复需要两个命令（`git -C marketplace push origin main` + `gh run rerun --failed`），但从主仓库 `git status` 中此失败模式是不可见的（子模块在本地是「clean」的），这正是为什么上述验证步骤是强制性的，而非建议性的。

### 契约：发布前扫描必须排除 `.trellis/`

`release.js` 中的发布前 `git add`（`chore: pre-release updates` 提交）**必须**从其 pathspec 中排除 `.trellis/`，与 `docs-site` 和 `marketplace` 一起：

```js
run("git add -A -- ':!docs-site' ':!marketplace' ':!.trellis'");
```

`.trellis/tasks/` 未被 gitignore，因此一个全覆盖的 `git add -A` 会扫入在发布会话中恰好存在的任何脏的进行中任务目录、工作区日志草稿和运行时产物。暂存 `.trellis/` 仅允许通过 `common/safe_commit.py` 的精确允许列表（参见 `script-conventions.md` 中的「unscoped `.trellis` staging」bug 类别）— 永远不通过发布时的全覆盖暂存。

> **事件记录（2026-06, #303）。** 一个仅排除 `docs-site`/`marketplace` 的 `release.js` 发布前 `git add -A` 将 6 个不相关的进行中 community-governance 任务文件两次扫入发布前提交（`5ee43ecc`、`ec123deb`）。维护者不得不三次 `git rm --cached`（`d66405d9`、`81960120`、`3c3219cf`）才最终追踪到草稿以停止泄漏（`e83233c9`）。相同的暂存范围缺陷也存在于 `add_session.py`（#303 主体）和即席人类/AI 的 `git add -A` 中。此契约存在是为了确保发布路由永远不能重新打开那个逃生舱。参见 `script-conventions.md` →「Absolute prohibition: never blanket-stage」获取完整 bug 类别记录。

---

## 跨分支的清单连续性

每个发布分支维护自己的 `packages/cli/src/migrations/manifests/<version>.json`。CLI update 逻辑遍历 `fromVersion` 和 `toVersion` 之间的清单链，因此用户可以通过其升级的每个已发布版本必须在发布分支上有一个本地清单。

当稳定补丁清单在 beta 分支上缺失时：

```bash
git show main:packages/cli/src/migrations/manifests/<version>.json \
  > packages/cli/src/migrations/manifests/<version>.json
git add packages/cli/src/migrations/manifests/<version>.json
git commit -m "chore: restore manifest <version> from main"
```

有意识地恢复已发布的清单。不要在发布分支之间自动合并整个清单目录，因为分支特定的清单可能提及在另一个分支上不存在的文件。

---

## 发布命令序列

根发布脚本委托给 CLI 包：

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

`packages/cli/scripts/release.js` 运行：

1. `check-manifest-continuity`
2. 对预发布/提升轨道运行 `check-docs-changelog --type beta|rc|promote`
3. core 测试
4. CLI 测试
5. 发布前提交，排除 `docs-site`、`marketplace` 和 `.trellis`
6. `bump-versions.js <type>` 一起更新两个包的版本
7. `release-preflight check-versions`
8. 版本提交，以版本字符串作为提交消息
9. git tag `v<version>`
10. 推送分支和 tags
11. GitHub Actions 发布工作流构建、测试、打包、发布并验证两个包

发布脚本不在本地发布。推送的 tag 是启动官方 npm 发布的内容。

---

## 发布工作流序列

`.github/workflows/publish.yml` 在 `v*` tag 推送和 GitHub Release 发布时运行。它对同一 tag 的重跑是幂等的。

必需顺序：

1. 安装依赖
2. `release-preflight check-versions --require-tag`
3. `pnpm typecheck`
4. `pnpm test`
5. `pnpm build`
6. `release-preflight verify-packed-cli`
7. `release-preflight publish-plan --github`
8. 如果缺失则发布 `@baoanaz/cviauto-core`
9. 如果缺失则发布 `@baoanaz/cviauto`
10. `release-preflight verify-npm --package all`

Core 先发布，因为 CLI 包在打包产物中依赖于确切的 core 版本。

---

## 发布声明资产的产物验证

任何声称某个功能是「bundled」、「installed automatically」或「included with Trellis」的 changelog、文档页面或 marketplace 条目必须针对构建的包产物进行验证，而不仅仅是针对源树。

在标记一个添加或更改了捆绑模板、skill、workflow、hook、脚本或生成平台资产的发布之前：

1. 运行 CLI 构建。
2. 从 `packages/cli/` 运行 `npm pack --dry-run --json` 并检查预期的 `dist/templates/**` 路径存在。
3. 在新鲜临时 git 仓库中使用构建的二进制文件（`node packages/cli/bin/trellis.js`）运行应安装该资产的面向用户命令。
4. 检查生成的文件和 `.trellis/.template-hashes.json` 中预期的路径。
5. 从临时仓库运行 `trellis update --dry-run` 并确认它报告项目已是最新。

当文档在代码分支实际添加可分发的文件之前或与之分开更新时，此门控是必需的。存在于另一个分支、`marketplace/` 或 docs 子模块中的源文件不是 npm 包包含它的证据。

内置多文件 skill 的示例：

```bash
pnpm --filter @baoanaz/cviauto build

cd packages/cli
npm pack --dry-run --json | grep 'dist/templates/common/bundled-skills/<skill>/SKILL.md'
cd ../..

tmpdir=$(mktemp -d /tmp/trellis-release-smoke-XXXXXX)
printf '{"name":"trellis-smoke","version":"0.0.0"}\n' > "$tmpdir/package.json"
git -C "$tmpdir" init -q
(
  cd "$tmpdir"
  node /path/to/Trellis/packages/cli/bin/trellis.js init -u smoke --yes --claude --codex
  test -f .claude/skills/<skill>/SKILL.md
  test -f .agents/skills/<skill>/SKILL.md
  grep -q '<skill>' .trellis/.template-hashes.json
  node /path/to/Trellis/packages/cli/bin/trellis.js update --dry-run
)
```

---

## 发布前检查清单

- [ ] 工作树是干净的，除了有意的发布更改。
- [ ] 相关编码规范已阅读。
- [ ] 目标版本的清单存在。
- [ ] 英文和中文 docs-site changelog 存在并 1:1 匹配。
- [ ] `docs-site/docs.json` 指向新 changelog。
- [ ] 子模块提交在主仓库指针提交之前推送。
- [ ] `node packages/cli/scripts/release-preflight.js check-versions` 通过。
- [ ] `node packages/cli/scripts/release-preflight.js verify-packed-cli` 通过。
- [ ] 发布声明捆绑资产在 `npm pack --dry-run --json` 和新鲜临时目录 `trellis init` / `trellis update --dry-run` 冒烟测试中验证。
- [ ] `pnpm lint && pnpm typecheck && pnpm test` 通过或阻塞项已记录。
- [ ] 破坏性发布在清单中包含 `migrationGuide` 和 `aiInstructions`。
- [ ] 官方包发布留给 CI。

---

## 交叉引用

- Core/CLI 代码所有权和包边界：`trellis-core-sdk.md`
- 清单格式和迁移类型：`migrations.md`
- 文档生命周期：`.trellis/spec/docs-site/docs/release-lifecycle.md`
- 原生依赖策略：`quality-guidelines.md`