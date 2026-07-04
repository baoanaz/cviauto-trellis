# Cviauto 平台入口裁剪

## 目标

公司内部 fork 的用户入口只支持三种 AI 平台：

- Claude Code: `--claude`
- Codex: `--codex`
- OpenCode: `--opencode`

v1 采用“入口隐藏、内部保留”的 demo 方案：用户在 `trellis init` 中只看到这三种平台，旧平台源码、模板和测试不做大规模删除，避免 update、uninstall、template tracking、历史迁移等路径因为硬裁剪出现编译失败或运行崩溃。

## 背景

上一节点已把默认 spec 改成 Cviauto Direct Registry。当前节点继续内化公司环境：平台选择不再展示 upstream 的全平台覆盖，而是收敛到团队实际准备支持的 Claude、Codex、OpenCode。

用户明确要求：如果其他平台内容过多，先把入口去掉，让用户层无感；确保不会因为裁剪导致正常功能失效或崩溃。内容可控时再删除。

## 需求

1. `trellis init --help` 只暴露 `--claude`、`--codex`、`--opencode` 三个平台 flag。
2. 交互式平台选择列表只出现 Claude Code、Codex、OpenCode。
3. `-y` 默认安装仍只安装 `defaultChecked` 的公开平台。Cviauto v1 默认保留 Claude Code，Codex/OpenCode 需要显式 flag。
4. re-init 展示已安装平台时，只展示三种公开平台名称；旧平台目录即使存在也不展示给用户。
5. 旧平台 flag 从 CLI 入口移除；直接传入旧平台选项时不生成旧平台目录。
6. `trellis mem` 的公开 `--platform` 只保留 `claude|codex|opencode|all`，不再展示 Pi。
7. 生成的 `.trellis/workflow.md` 不再推荐或列出旧平台分组。
8. 内部 `AI_TOOLS`、`PLATFORM_FUNCTIONS`、旧模板目录先保留，作为兼容边界。

## 非目标

- 不在 v1 删除旧平台 configurator、template、migration、uninstall scrubber 或专项内部测试。
- 不修改历史 changelog 中已经发布过的平台描述，除非它们造成当前编译或测试失败。
- 不删除 Claude、Codex、OpenCode 依赖的 shared hooks、common skills、trellis scripts。
- 不做公司内网发布、版本号更新或 npm packaging 变更。

## 验收标准

- [x] `trellis init --help` 源码入口不再注册旧平台 flag。
- [x] init 公开 choices 只返回 Claude Code、Codex、OpenCode。
- [x] init integration 覆盖默认安装、三平台显式安装、旧平台选项忽略。
- [x] `trellis mem --help` 文案不再展示 Pi。
- [x] workflow 模板只描述 Claude Code、Codex、OpenCode 相关执行模式。
- [x] `pnpm --filter @mindfoldhq/trellis typecheck` 通过。
- [x] 平台裁剪聚焦测试通过。
