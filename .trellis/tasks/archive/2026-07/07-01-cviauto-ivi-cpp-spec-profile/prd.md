# Cviauto 默认 Spec Marketplace 初始化

## 目标

让 Cviauto fork 的 `trellis init -u your-name --claude` 默认安装团队工程相关的 `.trellis/spec/`，而不是生成通用 backend/frontend/guides 模板，也不让团队成员在默认安装路径里选择 `Select a spec template: from scratch`。

默认 spec 来源改为 GitHub Spec Template Marketplace：

```bash
gh:baoanaz/cviauto-default-specs/marketplace
```

默认 template id：`Cviauto-spec`。

`marketplace/specs/Cviauto-spec/` 是安装后的 `.trellis/spec/` 内容。仓库根目录用于维护文档，不会安装进项目 spec。后续迁移到团队 Git 仓库时，只需要替换默认 registry source。

## 背景与决策

- 官方推荐用 Spec Template Marketplace 维护团队可复用 spec，而不是把团队 spec 写死进 CLI 内置 markdown 模板。
- 当前 Cviauto 只有一套默认 C++/IVI spec 起点，CLI 默认自动选择 `Cviauto-spec`，不让用户进入模板选择器。
- 团队成员不传 `--registry` / `--template` 时，Cviauto fork 自动使用 `gh:baoanaz/cviauto-default-specs/marketplace` + `Cviauto-spec`。
- 用户显式传 `--registry` 或 `--template` 时，显式参数优先生效。

## 需求

1. 默认 `trellis init -u <name> --claude` 使用 Cviauto default specs。
2. 默认安装后的结构为：

```text
.trellis/spec/
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

3. 默认安装不生成：
   - `.trellis/spec/backend/`
   - `.trellis/spec/frontend/`
   - `.trellis/spec/guides/`
4. 默认交互安装不展示 `Select a spec template:` / `from scratch`。
5. `index.md` 保留，因为它是 spec discovery 入口：
   - 顶层 `index.md` 指向 `common/` 和 `features/`。
   - `common/index.md` 简短列出通用 spec 和加载理由。
   - `features/index.md` 指导团队后续把倒车、ECALL 等功能专属 spec 放到 `features/`。
6. bootstrap task 改成 Cviauto 语义：
   - 解释 bootstrap task 是 `trellis init -u <name>` 首次初始化时自动创建的 `.trellis/tasks/00-bootstrap-guidelines/`。
   - related files 指向 `.trellis/spec/index.md`、`.trellis/spec/common/`、`.trellis/spec/features/`。
   - PRD 指导团队填充 common TODO 和新增 `features/cviauto-*.md` 功能 spec。
   - 不出现 ORM、React hooks、frontend components、accessibility 等通用 Web 占位提示。
7. 显式 `--registry` / `--template` 保持原语义，不被默认 Cviauto registry 覆盖。
8. 如果默认 Cviauto registry 安装失败，停止并提示错误，不静默回退到 backend/frontend/guides。
9. monorepo 项目仍可写入 `config.yaml` packages 信息，但默认 spec tree 由 registry 管理，不额外生成 per-package backend/frontend。

## 非目标

- 不实现公司内网 Git 仓库迁移；当前先用 `https://github.com/baoanaz/cviauto-default-specs`。
- 不实现多套业务模板；当前 marketplace 只包含 `Cviauto-spec`。
- 不做 `linux-cpp-ivi` `SpecProfile`、自动检测 CMake/IVI 信号或新增 `--spec-profile`。
- 不裁剪平台支持；只记录后续将平台收敛到 Claude、Codex、OpenCode。
- 不把倒车、ECALL 等具体功能 spec 写进默认 common。默认只提供 `features/cviauto-example.md` 示例。

## 验收标准

- [x] `cviauto-default-specs/marketplace/index.json` 声明 `Cviauto-spec` 模板。
- [x] `marketplace/specs/Cviauto-spec/` 可安装到 `.trellis/spec/`。
- [x] `trellis init -u dev --claude --yes` 在未传 registry/template 时安装 Cviauto spec。
- [x] 默认 init 生成 `.trellis/spec/index.md`、`common/`、`features/`。
- [x] 默认 init 不生成 `.trellis/spec/backend/`、`.trellis/spec/frontend/`、`.trellis/spec/guides/`。
- [x] 默认 init 写入 `.trellis/config.yaml` 的 `registry.spec.source: gh:baoanaz/cviauto-default-specs/marketplace` 和 `template: Cviauto-spec`。
- [x] 默认 bootstrap task title/description/relatedFiles/PRD 使用 Cviauto spec 语义。
- [x] monorepo 默认 init 不额外生成 per-package backend/frontend spec。
- [x] 显式 `--registry` direct mode 仍可覆盖默认 source。
- [x] 显式 `--registry --template` marketplace mode 仍可覆盖默认 source。
- [x] 聚焦测试覆盖 init integration。
- [x] 验证命令完成，或记录无法运行原因。
