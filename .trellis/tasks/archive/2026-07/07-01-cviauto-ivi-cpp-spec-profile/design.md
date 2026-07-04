# 设计：Cviauto Spec Marketplace

## 总体方案

不再新增 `SpecProfile` 或内置 `linux-cpp-ivi` markdown 模板。改用官方推荐的 registry 机制：

- Cviauto 默认 spec 维护在独立 Git 仓库：`baoanaz/cviauto-default-specs`。
- 该仓库的 `marketplace/index.json` 声明默认 spec template：`Cviauto-spec`。
- Cviauto fork 的 `trellis init` 在用户没有显式传 `--registry` / `--template` 时，自动把 registry source 和 template 设置为：

```text
registry: gh:baoanaz/cviauto-default-specs/marketplace
template: Cviauto-spec
```

这样默认命令仍是：

```bash
trellis init -u your-name --claude
```

但实际 spec 安装等价于：

```bash
trellis init -u your-name --claude --registry gh:baoanaz/cviauto-default-specs/marketplace --template Cviauto-spec
```

## registry 仓库结构

仓库根目录保留维护文档，`marketplace/specs/Cviauto-spec/` 对应安装后的 `.trellis/spec/`：

```text
cviauto-default-specs/
  HANDOFF.md
  marketplace/
    index.json
    specs/
      Cviauto-spec/
        README.md
        index.md
        common/
          index.md
          cviauto-jira-bug-workflow.md
          cviauto-ivi-mcu-protocol.md
          cviauto-multi-repo-layout.md
          cviauto-commit.md
        features/
          index.md
          cviauto-example.md
```

`marketplace/index.json` 的 `path` 必须是 `marketplace/specs/Cviauto-spec`，路径相对 Git 仓库根目录，不是相对 `index.json` 所在目录。

## CLI init 改动

在 `packages/cli/src/commands/init.ts`：

- 新增常量 `CVIAUTO_DEFAULT_SPEC_REGISTRY = "gh:baoanaz/cviauto-default-specs/marketplace"`。
- 新增常量 `CVIAUTO_DEFAULT_SPEC_TEMPLATE = "Cviauto-spec"`。
- 解析 registry 时：
  - `options.registry` 存在：使用用户显式 source。
  - `options.template` 存在但 `options.registry` 不存在：保持官方 marketplace 行为，不注入 Cviauto 默认 source。
  - 两者都不存在：使用 Cviauto 默认 source 和 template。
- `hasTemplateRequest` 继续只代表用户显式请求，避免普通 re-init 被默认 registry 误判成用户要刷新模板。
- 默认 registry marketplace template 安装失败时直接 return，不回退到内置 backend/frontend/guides。
- template 下载结果为 skipped 时也应设置 `useRemoteTemplate = true`，避免后续又生成内置 spec。

## workflow structure 改动

在 `packages/cli/src/configurators/workflow.ts`：

- monorepo 分支也尊重 `skipSpecTemplates`。
- 如果 registry 已经安装 `.trellis/spec/`，不再自动生成 per-package backend/frontend。
- 显式 monorepo per-package template 行为保持不变，因为那条路径不会设置 `skipSpecTemplates`。

## bootstrap task 改动

新增 `useCviautoSpec` 参数贯穿：

- `getBootstrapChecklistItems`
- `getBootstrapRelatedFiles`
- `getBootstrapPrdContent`
- `getBootstrapTaskJson`
- `createBootstrapTask`

当使用默认 Cviauto registry 时：

- checklist 指向 review common specs、填 TODO、新增 feature specs。
- relatedFiles 指向 `.trellis/spec/index.md`、`.trellis/spec/common/`、`.trellis/spec/features/`。
- PRD 解释 bootstrap task 的触发方式和 Cviauto spec 维护方式。
- task title 使用 `Bootstrap Cviauto Specs`。

## 显式参数兼容

- `--registry <source>`：用户 source 优先，不使用默认 Cviauto source。
- `--registry <source> --template <id>`：marketplace mode 保持。
- `--template <id>` without `--registry`：保持官方 marketplace 行为，不使用默认 Cviauto source。

## 后续计划

平台裁剪单独处理：后续将 Cviauto fork 支持的平台收敛到 Claude、Codex、OpenCode。这不是本任务范围。
