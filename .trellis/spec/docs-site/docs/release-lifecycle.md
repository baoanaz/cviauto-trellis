# Docs-Site 发布生命周期（Release Lifecycle）

> `docs-site/` 如何在 `release-only`、`release+beta`、`release+rc` 状态中组织，以及驱动这些转换的三个脚本。

---

## 约定：root = 当前稳定版本

目录布局为每个位置固定了一个角色：

| 路径（Path） | 角色（Role） |
| --------------------------------------- | ---------------------------------------- |
| `docs-site/{start,advanced,...}`（root） | **当前稳定版本**（最新 GA）。默认。 |
| `docs-site/beta/{start,advanced,...}`   | 活跃的 **beta** 周期（当存在时）。 |
| `docs-site/rc/{start,advanced,...}`     | 活跃的 **RC** 周期（从 beta 重命名）。 |

非版本化的目录树（`blog/`、`showcase/`、`contribute/`、`skills-market/`、`templates/`、`use-cases/`、`marketplace/`、`concepts/`、`essentials/`、`api-reference/`、`ai-tools/`、`guides/`、`snippets/`、`images/`、`logo/`）仅位于 root 下，被所有版本读取。

## 版本路径约束（Version path invariant）

在编辑版本化文档之前，确定内容所属的发布线，并验证文件路径与该线匹配：

| 目标发布线 | 编辑路径 | 不要编辑 |
| ------------------- | ---------------------------------------- | ------------------------------------ |
| 当前稳定版 / GA | `docs-site/{start,advanced,...}` | `docs-site/beta/**` 或 `rc/**` |
| 活跃 beta | `docs-site/beta/{start,advanced,...}` | root `docs-site/{start,advanced}` |
| 活跃 RC | `docs-site/rc/{start,advanced,...}` | root `docs-site/{start,advanced}` |
| 中文稳定版 | `docs-site/zh/{start,advanced,...}` | `docs-site/zh/beta/**` 或 `rc/**` |
| 中文 beta | `docs-site/zh/beta/{start,advanced,...}` | root `docs-site/zh/{start,advanced}` |
| 中文 RC | `docs-site/zh/rc/{start,advanced,...}` | root `docs-site/zh/{start,advanced}` |

不要使用渲染页面中的版本下拉标签作为来源范围的证明。Mintlify 从一个仓库和 `docs.json` 渲染所有版本，因此唯一可靠的真实来源是 MDX 路径加上匹配的 `docs.json` 版本块。

当 beta 专用内容意外落到 root 中时，Release 选择器下会向发布用户展示 beta 行为。请将其视为发布文档事故，而非渲染问题。

### 版本化变更的 pre-commit 审计

在提交工作流、阶段、产物、安装或平台行为变更之前，运行路径范围审计：

```bash
cd docs-site
git diff --name-only --cached

# 对于仅限 beta 的行为，变更文件必须在 beta/ 或 zh/beta/ 下。
# 对于稳定版行为，变更文件必须是 root 版本化路径或 zh/ root 版本化路径。
```

然后在相反的目录树中 grep 版本特定标记。以 beta 工作流变更为例：

```bash
rg -n "task-creation consent|codex-mode|<trellis-workflow>|planning artifact|`design\\.md`|`implement\\.md`" \
  start advanced guides zh/start zh/advanced zh/guides -g "*.mdx"
```

该命令应返回零匹配，不相关的文件名提及（如 `trellis-implement.md`）除外。

---

## 4 个生命周期状态

```
T0  release-only          ← 周期之间的稳态
        │   docs.json: versions = ["Release"]
        │   files:     root/{start, advanced, ...}
        │
        ▼   启动 beta 周期
T1  release + beta
        │   docs.json: versions = ["Release", "Beta"]
        │   files:     root/...    +  beta/{start, advanced, ...}
        │
        ▼   beta → rc
T2  release + rc
        │   docs.json: versions = ["Release", "RC"]
        │   files:     root/...    +  rc/{start, advanced, ...}     (将 beta/ 重命名为 rc/)
        │
        ▼   rc → release（GA 晋级）
T3  release-only           ← 回到 T0；root 是新的 GA
        │   docs.json: versions = ["Release"]
        │   files:     root/...    (rc/* 内容合并到 root，rc/ 被删除)
        ▼
```

---

## 脚本（Scripts）

`docs-site/scripts/` 中的三个 POSIX shell 脚本：

| 脚本（Script） | 转换（Transition） | 功能描述 |
| -------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `docs-beta-start.sh` | T0 → T1 | 将版本化内容（`start/`、`advanced/`、`index.mdx`）从 root 复制到 `beta/`。同时镜像 `zh/`。 |
| `docs-beta-to-rc.sh` | T1 → T2 | `git mv beta rc`（以及 `zh/beta` → `zh/rc`）。在 `rc/*` 内容中批量文本替换 `@beta` → `@rc`。 |
| `docs-promote.sh` | T2 → T3 | 检测开发目录树（优先 `rc/` 再 `beta/`），用开发内容覆盖 root 版本化内容，在 `zh/` 中镜像，`git rm` 开发目录树。 |

这三个脚本**仅做内容复制/重命名**。它们不触碰 `docs.json` 或横幅——这些需要手动编辑，因为它们是决策驱动的。

### 手动跟进步骤

每个脚本结束时都会输出一份检查清单，列出维护者在提交前必须完成的 `docs.json` 编辑和内容清理工作。始终执行：

| 在以下操作之后 | 编辑 `docs.json` |
| -------------------- | ---------------------------------------------------------------------------------------------- |
| `docs-beta-start.sh` | 添加 `"Beta"` 版本块到 `versions[]`。添加横幅。将 beta 安装命令改为 `@beta`。 |
| `docs-beta-to-rc.sh` | 将 `"Beta"` 标签重命名为 `"RC"`。将每个页面条目 `beta/* → rc/*` 更新。更新横幅。 |
| `docs-promote.sh` | 从 `versions[]` 中删除 `"Beta"` / `"RC"` 版本块。删除横幅。更新 navbar `href`。 |

---

## 何时使用哪个脚本

| 场景（Scenario） | 脚本（Script） | 触发时机（Trigger） |
| --------------------------------------- | ------------------------------------- | --------------------------------------------- |
| 新 minor / major 的首个 beta（如 `0.6.0-beta.0`） | `docs-beta-start.sh` | 在 `.0` 的 `pnpm release:beta` 之前 |
| Beta 周期稳定 → 首个 RC | `docs-beta-to-rc.sh` | 在 `-rc.0` 的 `pnpm release:rc` 之前 |
| RC 稳定 → 发布 GA | `docs-promote.sh` | 在 `pnpm release:promote` 之前 |
| 后续 beta / rc 补丁（`-beta.1`、`-rc.1` 等） | （无需——只需编写 changelog mdx） | 每个补丁；无需结构变更 |

**补丁发布流程**（`-beta.1` → `-beta.2`、`-rc.1` → `-rc.2` 等）：只需创建 `changelog/v<version>.mdx`（英文 + 中文），添加到 `docs.json` 中页面列表顶部，更新 navbar href。无需调用脚本。

---

## 一次性历史翻转（0.5.0 GA）

在 0.5.0 之前，布局是反向的：`root/` 保存**开发**内容（RC），`release/` 保存**之前的 GA** 归档（0.4.0）。在 0.5.0 GA 时，我们翻转为上述约定：

- Root 内容（即之前的 `0.5.0-rc.X`）就地变为新的稳定版 `0.5.0` GA
- `release/`（0.4.0 归档）被删除（`git rm -r`）；0.4.x 文档仍然可通过 `v0.4.0` git 标签访问
- `docs.json` 从 2 个版本折叠为 1 个版本（仅 `Release`）
- 引入 3 个脚本以保持后续生命周期可复现

此次翻转之后，每个后续周期都使用脚本；不再需要进一步的手动重组。

---

## 首个真实周期运行：0.6.0 GA（2026-06-15）

0.5.0 翻转创建了脚本；**0.6.0 GA 是第一个真正端到端运行 T0→T1→T2→T3 链并使用 `docs-promote.sh` 的周期**。以下记录笔记以区分 0.5.0 的先例（其本身偏离标准流程，因为它是一次性历史翻转）。

### `docs.json` 转换与 0.5.0 不同

| 周期 | 翻转前状态 | 正确的编辑模式 |
|---|---|---|
| 0.5.0（历史翻转） | `RC` 块使用 **root** 路径，`Release` 块使用 `release/*` 路径（旧 GA 归档） | 将 `RC` 重命名为 `Release` 标签，**删除**旧的 `Release` 块，`git rm -r release/` |
| 0.6.0（标准流程） | `RC` 块使用 `rc/*` 路径，`Release` 块使用 **root** 路径（当前 GA） | **删除** `RC` 块（其 `rc/*` 路径在 `docs-promote.sh` 删除 rc/ 目录时消失），保持 `Release` 不变（其 root 路径现在服务于晋级后的 v0.6 内容），设置 `Release.default = true` |

标准流程的具体编辑列表（`docs-promote.sh` 之后，两种语言）：

1. `delete d['banner']`
2. 从 `versions[]` 中完全删除 `RC` 版本块
3. 设置 `Release.default = true`（该标志之前在 `RC` 上）
4. 将 `changelog/v<NEW_GA>` 和 `zh/changelog/v<NEW_GA>` 插入到每个 `Release` 块的 `Changelog` 页面列表顶部
5. 将 `navbar.links[label=Changelog].href` 更新为 `/changelog/v<NEW_GA>`

### 首个双包 GA 晋级

0.6.0 是第一个 `@mindfoldhq/trellis`（CLI）和 `@mindfoldhq/trellis-core`（SDK）同步发布的 GA。`bump-versions.js promote` 重写两个 `package.json` 文件，并将 CLI 的 `dependencies["@mindfoldhq/trellis-core"]` 从 `workspace:*` 改为发布时的确切版本。`release-preflight verify-packed-cli` 专门用于在此处捕获分歧——在 `pnpm release:promote` 之前始终运行它。

### 过时的 navbar Changelog `href` 陷阱

0.6.0 周期发布了 24 个 beta + 1 个 RC，而 `docs.json` 中的 navbar `Changelog` href 在整个过程中从未更新——在 GA 准备时它仍然停留在 `/changelog/v0.6.0-beta.22`。每补丁的 beta/rc 提交将新的 mdx 添加到导航页面列表，但通常忘记更新 navbar href。决策规则：**GA 晋级 PR 是修复 navbar href 的最后机会**，因为 GA 是读者真正开始点击顶部栏 Changelog 链接的时刻。

### 发布前对抗性验证具有负载性质

0.6.0 GA 准备流程在 `pnpm release:promote` 之前运行了 10 agent 的发布前验证，捕获了 2 个原本会随版本发布出去的 RED 阻塞项：

1. `@mindfoldhq/trellis@beta` 在生命周期翻转后仍残留在 bunded-skill markdown 表格中
2. Manifest 的 `**Bundled skills**` 部分仅列出了 4 个实际发布的内置技能中的 3 个

两个阻塞项都仅是文本层面的问题（无代码缺陷）；两者只会让用户感到尴尬而非功能受损。尽管如此，对抗性验证证明了其价值——建议在未来的每个 GA 上都运行等效检查。这 10 个角度（内置技能 + manifest + changelogs 英文/中文 + docs.json + root 内容 + 预检 + 测试 + 狗粮自用 + npm-ready）可推广到任何后续 minor 版本。

---

## 陷阱（Gotchas）

### `docs.json` 不会自动更新

脚本仅操作内容目录树。忘记 `docs.json` 的跟进会导致：

- `T1 → T2`：页面仍然解析到 `beta/...` URL，但下拉标签是 `RC`（点击即 404）
- `T2 → T3`：内容已删除但过时的 `RC` 下拉仍保留（每个页面都 404）

始终在脚本 + 手动编辑之后在本地运行 `mintlify dev`，以便在推送前捕获路由漂移。

### 横幅（Banner）具有粘性

RC 横幅在 rc.0–rc.7 之间一直都是 `"📦 Reading **RC** docs (0.5.0-rc.0)..."`，因为没有任何东西自动更新其中的版本。可以：

- 将横幅视为"一般 RC 文档——检查 `trellis --version` 获取你的安装版本"（当前模式），或者
- 将其作为 `docs-beta-to-rc.sh` 跟进的一部分来更新（当前脚本没有——它们只打印提醒）

### MDX `<Note>` / `<Warning>` 闭合标签不得缩进

当 `<Note>` 块包含 markdown 列表时，prettier 会自动缩进闭合标签以与列表对齐：

```mdx
<Note>
- bullet
  </Note>   ← 破坏 Mintlify 解析器："Expected closing tag </Note> after end of listItem"
</Note>     ← 正确：闭合标签在第 0 列
```

如果你通过 `lint-staged` + prettier 提交，预期会出现重新缩进。手动修正后重新提交，或者如果项目后续支持则添加 `// prettier-ignore`。在推送包含这些块的 changelog mdx 之前，始终运行 `pnpm dev`（mintlify）。

### RC 与 GA 准备重叠时的 Stash 工作流

如果你正在准备 GA 内容（`changelog/v0.5.0.mdx`、scripts/、`release/` 删除），同时仍需要发布一个额外的 rc.X：

```bash
cd docs-site
git stash push -u -m "GA promote prep"  # 暂存 GA 变更
# ... 在 rc.X 上工作（changelog mdx + docs.json 更新）...
git commit && git push
git stash pop                            # 恢复 GA 准备；解决 docs.json 冲突
```

`docs.json` 在 pop 时的冲突是预期的——rc.X 提交在页面列表顶部添加了 `v0.5.0-rc.X`，而 stash 在顶部有 `v0.5.0`。保留两者，`v0.5.0` 在前（GA），然后是 `v0.5.0-rc.X`，然后是更早的条目。
