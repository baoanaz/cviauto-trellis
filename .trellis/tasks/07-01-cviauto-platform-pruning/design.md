# 设计：Cviauto 三平台公开入口

## 核心原则

先裁剪用户入口，不硬删内部平台实现。

原因：

- 当前 platform registry、templates、update、uninstall、template hash tracking、migration tests 互相耦合较多。
- 直接删除旧平台文件会扩大风险面，容易引入编译失败或运行时缺失文件。
- 用户当前真正关心的是安装和使用时不要看到无关平台。

因此 v1 采用 public allow-list：内部 registry 仍可保留 upstream 平台数据，`trellis init` 和用户可见文案只读取 Cviauto 公开平台集合。

## 公开平台集合

在 `packages/cli/src/configurators/index.ts` 中新增：

- `PUBLIC_INIT_PLATFORM_IDS`
- `getPublicInitToolChoices()`

公开集合固定为：

| AITool | CLI flag | 主要目录 | 备注 |
| --- | --- | --- | --- |
| `claude-code` | `--claude` | `.claude/` | 继续作为 `-y` 默认平台 |
| `codex` | `--codex` | `.codex/` + `.agents/skills/` | 保留 shared Agent Skills 写入 |
| `opencode` | `--opencode` | `.opencode/` | 保留 JS plugin 模式 |

Codex 的公开显示名覆盖为 `Codex`，避免内部 registry 里关于其他平台读取 `.agents/skills` 的说明出现在用户选择列表。

## 入口行为

- `packages/cli/src/cli/index.ts`
  - 只注册 `--claude`、`--codex`、`--opencode`。
- `packages/cli/src/commands/init.ts`
  - init 和 re-init 都使用 `getPublicInitToolChoices()`。
  - `-y` 使用公开集合里的 `defaultChecked`。
  - 旧平台选项即使从内部对象传入，也不会命中 explicit tool selection。
  - re-init 的 configured platform 文案只显示公开平台名称。
- `packages/cli/src/commands/mem.ts`
  - `--platform` 公开范围改为 `claude|codex|opencode|all`。
  - Pi adapter 源码保留，避免 core 层硬删风险。

## 文档和模板

- `packages/cli/src/templates/trellis/workflow.md`
  - 平台分组收敛到 Claude Code、Codex、OpenCode。
  - 不再出现 Cursor/Gemini/Copilot/Pi 等平台入口。
- `.trellis/workflow.md`
  - 同步当前仓库内的 Trellis 工作流文档，方便本仓库后续 agent 按新口径工作。

## 测试策略

- `configurators/index.test.ts`
  - 保留全量 internal registry 测试。
  - 新增 public init choices 只包含三平台的断言。
- `init.integration.test.ts`
  - 默认安装只断言 Claude Code。
  - 显式多平台安装断言 Claude/Codex/OpenCode。
  - 新增旧平台选项被忽略、不生成旧目录的断言。
- `mem-*` 测试
  - public platform help 和 helper 测试改为 OpenCode，不再把 Pi 作为公开平台。
- `templates/trellis.test.ts`
  - workflow 模板断言只保留三平台执行模式。

## 后续删除策略

下一步若要继续“内容可控就删除”，建议按平台分批做：

1. 先选一个完全不依赖 shared path 的旧平台，例如 template/configurator 最孤立的平台。
2. 删除 platform registry entry、configurator、template、专项测试。
3. 跑 typecheck、init/update/uninstall/template tracking 相关测试。
4. 每个平台一个小提交，避免一次性删除导致定位困难。
