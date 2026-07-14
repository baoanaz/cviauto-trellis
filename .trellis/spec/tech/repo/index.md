# 仓库包映射（Repository Package Map）

这些指南描述了当前 Trellis 仓库的结构，以及 `.trellis/config.yaml` 中的包键（package key）如何映射到源代码和 spec。

## 用途（Purpose）

保持 Trellis 的包/spec 路由与实际仓库对齐，使 `get_context.py --mode packages`、任务包绑定（task package binding）和未来的 AI 会话加载正确的指南。

## 包映射（Package Map）

| 包键（Package key） | 路径（Path） | 包名（Package name） | Spec 路径 | 用途（Purpose） |
| --- | --- | --- | --- | --- |
| `cli` | `packages/cli` | `@baoanaz/cviauto` | `.trellis/spec/cli/**` | 面向用户的 CLI、模板、迁移、发布脚本和平台 configurators。 |
| `core` | `packages/core` | `@baoanaz/cviauto-core` | `.trellis/spec/core/**` | 可复用的 SDK/领域原语，用于 channel、mem、task 和 testing API。 |
| `docs-site` | `docs-site` | `trellis-docs` | `.trellis/spec/docs-site/**` | Mintlify 文档站点。此目录是 git submodule，不是 `pnpm-workspace.yaml` 的组成部分。 |

## 工作区与 Submodules

- `pnpm-workspace.yaml` 声明了 `packages/*`，因此 pnpm 工作区包为 `packages/cli` 和 `packages/core`。
- `.gitmodules` 声明 `docs-site` 和 `marketplace` 为 submodules。
- `docs-site` 有自己的包清单（package manifest）和 Trellis spec，因此它是一个已配置的 Trellis 包，类型为 `type: submodule`。
- `marketplace` 是一个 submodule，但目前没有包清单和 Trellis 包范围的 spec。除非它获得了包级别的实现所有权或 spec，否则不要将其添加到 `.trellis/config.yaml` 中。

## 契约（Contracts）

- `.trellis/config.yaml` 使用稳定的 Trellis 包键（`cli`、`core`、`docs-site`）而非 npm 包名。这些键是 spec 路径和任务包绑定的组成部分。
- `default_package` 为 `cli`；没有 `--package` 的新任务默认绑定到 CLI，因为大多数 Trellis 工作流/运行时变更是 CLI 拥有的。
- 现有任务保持其冻结的 `task.json.package`。更改 `.trellis/config.yaml` 不会追溯性地重新绑定旧任务。
- 包上下文输出由 `.trellis/scripts/common/packages_context.py` 生成，它会为每个已配置的包扫描 `.trellis/spec/<package>/<layer>/index.md`。

## 检查（Checks）

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
python3 "${CODEX_HOME:-$HOME/.codex}/skills/trellis-spec-maintainer/scripts/scan_spec_drift.py"
git diff --check -- .trellis/config.yaml .trellis/spec
```

如果未来的 checkout 在 Trellis scripts 目录下提供了包映射检查器，则在包映射验证时运行它。该辅助函数当前不在此仓库中。
