# 验证与发布——端到端 SDK 发布工程

本文档涵盖从"构建在我的机器上成功了"到"用户可以 `npm install` 而没有任何痛点"之间的一切。它是观点明确的、代码密集的、逐工具介绍的。

关于 `exports` 字段形状，参阅 `package-json-exports.md`。关于打包器配置（tsdown / tsup / unbuild），参阅 `tsdown-bundling.md`。本文档假设构建已经产生了 `dist/`。

---

## 1. 概述——三大支柱

一个可防御的 SDK 发布建立在三大支柱之上。跳过任何一个，你就会发布痛点。

| 支柱                              | 工具                                  | 回答的问题                                                  |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| **(a) 构建产物验证** | `publint`、`@arethetypeswrong/cli`、冒烟测试 | "tarball 在 Node CJS / Node ESM / 打包器 / Deno / Bun 中真的能用吗？" |
| **(b) 版本与变更日志管理**    | `changesets`、semver、npm `dist-tag`     | "自上次发布以来有什么变化，什么版本反映了它？" |
| **(c) 发布流程**                | GitHub Actions、`changesets/action`、npm provenance | "包如何从绿色 CI 构建中到达用户，并且是可证明的？" |

以下所有内容都映射到这三个支柱之一。CI 必须强制执行**所有**它们——本地纪律是必要的，但不够充分。

任何生产级 SDK 的最低门槛：

```bash
pnpm build           # 产生 dist/
pnpm test            # 单元 + 集成
pnpm publint         # 对 package.json + dist/ 的静态检查
pnpm attw --pack     # 跨运行时/解析器的类型解析
pnpm pack --dry-run  # 显示将发布什么
```

然后 `changesets` 编排（b），`changesets/action` 编排（c）。

---

## 2. 发布前验证：`publint`

**一句话：** `publint` 是一个用于你即将发布的包的静态 linter。它捕获 `package.json` 和 `dist/` 中的错误配置，这些配置 npm 会接受，但消费者会在安装时遇到。

它不运行代码。它读取 `package.json`，遍历 `exports`/`main`/`module`/`types` 映射，打开每个引用的文件，并应用规则目录。

### 接线

```jsonc
// package.json
{
  "scripts": {
    "lint:publish": "publint --strict",
    "prepublishOnly": "pnpm build && pnpm lint:publish && pnpm attw --pack"
  },
  "devDependencies": {
    "publint": "^0.3.0"
  }
}
```

`prepublishOnly` 在 `npm publish` 和 `pnpm publish` 上自动运行。**它在 yarn 4 之前的 `yarn publish` 上不运行**——所以不要依赖它作为你唯一的门禁；也在 CI 中设门禁。

### 关键命令

| 命令                            | 作用                                                                |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `publint`                          | 对当前包进行 lint；报告警告 + 错误                          |
| `publint --strict`                 | 将警告视为错误（在 CI 和 `prepublishOnly` 中使用）              |
| `publint ./packages/foo`           | 对 monorepo 中的特定包进行 lint                                       |
| `publint --pack pnpm`              | 在 lint 之前使用 `pnpm pack` 将 tarball 物化（最准确）   |
| `npx publint <pkg-name>`           | 从 registry 对已发布的包进行 lint（审计依赖）         |

### 规则目录

完整规则集在 <https://publint.dev/rules>。按严重性分组的高价值规则：

**错误（发布前必须修复）：**

- `IMPLICIT_INDEX_JS_INVALID_FORMAT` — `main` 解析到 `index.js`，但文件内容的格式与 `type` 字段不匹配。
- `FILE_DOES_NOT_EXIST` — `main`/`module`/`types` 指向 tarball 中不存在的文件。最常见原因：忘记在 `files` 中列出 `dist`。
- `FILE_INVALID_FORMAT` — 文件使用 CJS 但 `type: "module"`（或反之）。
- `EXPORTS_VALUE_INVALID` — `exports` 值不以 `./` 开头。
- `EXPORTS_GLOB_NO_MATCHED_FILES` — 类似 `"./components/*": "./dist/components/*.js"` 的模式匹配零个文件。
- `USE_EXPORTS_BROWSER` — 使用顶层 `browser` 字段；应该是 `exports` 内的一个条件。
- `USE_TYPE_MODULE` — 包包含 `.js` ESM 文件但没有 `type: "module"`（Node 会将它们视为 CJS）。

**警告（应该修复）：**

- `TYPES_NOT_EXPORTED` — `exports` 暴露了运行时文件但没有 `types` 条件；消费者获得 `any`。
- `EXPORTS_TYPES_INVALID_FORMAT` — `types` 条件顺序错误（`types` 必须在每个条件对象中**第一个**出现）。
- `MODULE_SHOULD_BE_ESM` — `module` 字段存在但指向 CJS。
- `FIELD_INVALID_VALUE_TYPE` — `keywords` 是字符串，`files` 缺失等。
- `DEPRECATED_FIELD_JSNEXT` — 使用 `jsnext:main`（早已弃用）。

### 常见失败和修复

```jsonc
//  错误 — types 条件顺序错误，会静默地破坏 TS 消费者
"exports": {
  ".": {
    "import": "./dist/index.mjs",
    "types": "./dist/index.d.ts"   //  必须放在最前面
  }
}

//  正确
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

```jsonc
//  错误 — dist/ 没有被发布
"files": ["src", "README.md"]

//  正确
"files": ["dist", "README.md", "LICENSE"]
```

**在发布前验证 `npm publish` 实际会上传什么**：

```bash
npm pack --dry-run
# 列出每个文件，打印解包大小。
# 不在此列表中的任何内容都不会到达消费者。
```

---

## 3. 发布前验证：`@arethetypeswrong/cli`（attw）

**一句话：** `attw` 模拟每个主要 TS 解析器——Node10、Node16/NodeNext（CJS）、Node16/NodeNext（ESM）、bundler——如何解析你的包的类型和运行时，并告诉你它们在哪里不一致。

这是混合 CJS+ESM 包的单一最高杠杆工具。如果你发布双格式并且不在 CI 中运行 `attw`，你会发布带有破损类型的包。

### 安装 + 接线

```bash
pnpm add -D @arethetypeswrong/cli
```

```jsonc
{
  "scripts": {
    "attw": "attw --pack . --profile node16",
    "prepublishOnly": "pnpm build && publint --strict && pnpm attw"
  }
}
```

### 关键命令

| 命令                                       | 作用                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `attw --pack .`                               | 运行 `npm pack`，然后检查 tarball（最准确——检查实际发布的内容）            |
| `attw --pack . --profile node16`              | 使用 Node16 / NodeNext 配置文件（现代；现在大多数应用使用）                    |
| `attw --pack . --profile esm-only`            | 如果你的包是纯 ESM，断言不存在 CJS 解析路径                     |
| `attw your-pkg@1.2.3`                         | 从 npm 检查已发布的版本                                                    |
| `attw --pack . --ignore-rules cjs-resolves-to-esm` | 抑制特定规则（仅在有理由时使用，例如，故意的纯 ESM） |
| `attw --pack . --format json`                 | 机器可读；输入到 CI 注释中                                            |

### attw 模拟的解析模式

| 模式               | 由谁使用                                            | 读取哪个字段/条件                  |
| ------------------ | -------------------------------------------------- | -------------------------------------------- |
| **node10**         | TS `moduleResolution: "node"`（旧默认值）        | `main`、`types` 和 `typesVersions`         |
| **node16-cjs**     | TS `moduleResolution: "node16"`，CJS 导入者      | `exports[".".require.types]` 然后 `.require` |
| **node16-esm**     | TS `moduleResolution: "node16"`，ESM 导入者      | `exports[".".import.types]` 然后 `.import`   |
| **bundler**        | TS `moduleResolution: "bundler"`（Vite、webpack）   | `exports[".".types]` + 第一个匹配的条件  |

### 常见失败模式

完整目录：<https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/README.md>

| 问题                        | 症状                                                                              | 修复                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **伪装成 CJS（Masquerading as CJS）**        | 文件扩展名 `.js` + `type: "commonjs"` 但包含 ESM（`import` 关键字）        | 将 ESM 输出构建为 `.mjs`，或设置 `type: "module"` + 将 CJS 构建为 `.cjs`                    |
| **伪装成 ESM（Masquerading as ESM）**        | 文件扩展名 `.js` + `type: "module"` 但包含 `require()` 调用               | 将 CJS 构建为 `.cjs` 扩展名                                                                    |
| **FalseCJS** / **FalseESM**    | 类型说一件事，运行时交付另一件事（例如，`.d.ts` 导出 class，`.js` 导出 default + class 但打包错误） | 对 CJS 类型使用 `.d.cts`，对 ESM 类型使用 `.d.mts`；让打包器同时产出两者                 |
| **缺失解析（Missing Resolution）**         | `exports` 有 `require` 条件但没有对应的 `.cjs` 类型                              | 在每个 `.cjs` 旁边添加 `.d.cts`                                                              |
| **NoResolution**               | 解析器根本找不到包的入口点                                       | 添加缺失的条件（CJS 消费者用 `require`，ESM 用 `import`）                        |
| **仅 CJS / 仅 ESM 类型**  | 你发布了两种运行时但只有一种类型文件                                     | 同时产出 `.d.cts` 和 `.d.mts`（tsdown/tsup 通过 `dts: true` + 双格式做到这一点）              |
| **内部解析错误（Internal-resolution errors）** | 你的 `dist/index.mjs` 导入 `./utils.js` 但只有 `./utils.mjs` 存在             | 在打包器输出中匹配扩展名；如果配置正确，现代打包器可以处理这一点          |

### 阅读 attw 输出

```
┌───────────────────┬──────────────────────────────────────────┐
│                   │ "my-sdk"                                 │
├───────────────────┼──────────────────────────────────────────┤
│ node10            │ 🟢                                       │
│ node16（from CJS） │ 🟢（CJS）                                 │
│ node16（from ESM） │ 🟢（ESM）                                 │
│ bundler           │ 🟢                                       │
└───────────────────┴──────────────────────────────────────────┘
```

全部绿色 = 发布。任何红色 = 消费者会出问题。黄色（⚠️）= 警告，通常是伪装（Masquerading）；调查。

---

## 4. 构建输出冒烟测试

静态检查会遗漏运行时问题。针对实际 tarball 运行冒烟测试。

### 树内冒烟测试

```bash
# 在 pnpm build 之后：
node --print "require('./dist/index.cjs').myFunction"
node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(m.myFunction))"
```

每个命令应该打印出不是 `undefined` 的内容。如果打印 `undefined`，你的 `exports` 映射或打包器的命名导出产出是坏的。

### 树外 tarball 测试（黄金标准）

```bash
# 1. 打包
pnpm pack
# 产生 my-sdk-1.0.0.tgz

# 2. 在临时目录中安装
mkdir /tmp/smoke-test && cd /tmp/smoke-test
npm init -y
npm install /path/to/my-sdk-1.0.0.tgz

# 3. CJS 消费者
node --print "require('my-sdk').myFunction.toString().slice(0, 50)"

# 4. ESM 消费者
cat > test.mjs << 'EOF'
import { myFunction } from 'my-sdk';
console.log('OK:', typeof myFunction);
EOF
node test.mjs

# 5. TypeScript 消费者
cat > test.ts << 'EOF'
import { myFunction } from 'my-sdk';
const x: ReturnType<typeof myFunction> = myFunction();
EOF
npx tsc --noEmit --strict --moduleResolution node16 --module nodenext test.ts
```

如果其中任何一个失败，**不要发布**。已发布的产物将以完全相同的方式对用户失败。

### 在 CI 中自动化

```yaml
- name: "smoke test tarball"
  run: |
    pnpm build
    pnpm pack
    mkdir /tmp/smoke && cd /tmp/smoke
    npm init -y
    npm install $GITHUB_WORKSPACE/*.tgz
    node --print "require('my-sdk').version"
    node --input-type=module -e "import('my-sdk').then(m => { if (!m.version) process.exit(1); })"
```

---

## 5. SDK 作者的 Semver 速查

Semver：**MAJOR.MINOR.PATCH** 加上可选的**预发布标识符**和**构建元数据**。

```
1.2.3                  稳定发布
1.2.3-alpha.0          预发布（alpha 线）
1.2.3-beta.5           预发布（beta 线）
1.2.3-rc.1             预发布（发布候选）
1.2.3+sha.abc1234      构建元数据（在优先级比较中被忽略）
0.0.0-pr-123-sha-abc   临时 / 快照发布
```

### MAJOR.MINOR.PATCH 合约

| 升级  | 何时                                                                | 示例                                                              |
| ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| MAJOR | 向后不兼容的 API 变更                                   | 移除导出的内容，更改函数签名，提高 Node 最低版本      |
| MINOR | 向后兼容的功能新增                               | 新的可选参数，新的导出，扩展的枚举                     |
| PATCH | 向后兼容的 bug 修复                                        | 修复错误计算，修复类型收窄，性能改进       |

**仅内部"重构"而没有可观察到的变更 → 不升级。** 一个 bump type 为 `none` 的 changeset（changesets 支持 `---` 空正文形式，但大多数团队只是跳过写一个）。

### 预发布标识符

`1.0.0-alpha.0` 在 `1.0.0` 之前。优先级顺序：

```
1.0.0-alpha.0 < 1.0.0-alpha.1 < 1.0.0-beta.0 < 1.0.0-beta.5 < 1.0.0-rc.0 < 1.0.0
```

**细微之处：** `1.0.0-alpha` < `1.0.0-alpha.0`（无标识符 < 数字标识符 0）。始终包含尾部 `.N`，以便优先级是全序的。

### `0.x` 制度

根据 semver §4：**任何 `0.x.y` 可能随时有破坏性变更。** 约定：

- `0.x.0` → 破坏性变更（MINOR 位置充当 MAJOR）
- `0.x.y` → 非破坏性（PATCH 位置充当 MINOR + PATCH 组合）

这是像 `changesets` 这样的工具实际实现的：在 `0.x` 中，"major" 升级只升级 minor。

**ZeroVer（`0ver.org`）**：一个永远停留在 `0.x` 的运动，以避免 `1.0` 的社会承诺。在 `0.x` 上停留多年的流行项目：`npm`、`bun`（在 1.0 之前）、`htop`、`streamlit`。不要在没有意图的情况下遵循这个——停留在 `0.x` 向企业用户发出 API 不稳定的信号。

**升级到 `1.0.0` 当**：公共 API 已文档化化，测试覆盖面很高，并且你承诺对破坏性变更遵守 semver 纪律。

---

## 6. 预发布通道与 npm dist-tags

一个 **dist-tag** 是一个命名的指针（类似于 npm 的 git 标签），解析到特定版本。每个包至少有一个 `latest`。

### `latest` 标签

`npm install pkg` 解析到 `pkg@latest`。默认情况下，`npm publish` 写入 `latest`。**这对预发布是危险的。**

### 约定标签

| 标签            | 含义                                                      | 示例消费者命令                  |
| -------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `latest`       | 当前稳定版                                                | `npm install next`                        |
| `next`         | 下一个主版本的预发布线                                 | `npm install @trpc/server@next`           |
| `beta`         | 下一个主版本的 Beta 通道                                    | `npm install ai@beta`                     |
| `rc`           | 发布候选                                             | `npm install next@rc`                     |
| `canary`       | 最新、每次提交                                   | `npm install next@canary`                 |
| `alpha`        | 最早的预发布                                          | `npm install ai@alpha`                    |
| `experimental` | 非路线图实验（React 使用这个）                           | `npm install react@experimental`          |
| `nightly`      | 每日构建（在 npm 中不常见；在 Rust/CI 中常见）           | `npm install some-pkg@nightly`            |
| `snapshot`     | 临时的，每个 PR / 每次提交                                | `npm install ai@snapshot`                 |

### 解析如何工作

```bash
npm install pkg            # → pkg@latest
npm install pkg@beta       # → `beta` dist-tag 指向的版本
npm install pkg@1.2.3      # → 确切版本
npm install pkg@^1.2.3     # → 最高的 1.x.y >= 1.2.3（且不是预发布版本）
```

**关键：** npm 的范围匹配器（`^`、`~`、`>=`）默认排除预发布版本。`^1.0.0` 不会安装 `1.5.0-beta.0`。这是故意的，也是好的——保持稳定用户远离预发布。

### 管理 dist-tags

```bash
# 列出当前标签
npm dist-tag ls my-pkg
# latest: 1.4.2
# beta: 2.0.0-beta.3
# canary: 2.0.0-canary.47

# 添加标签（将其指向现有版本）
npm dist-tag add my-pkg@1.4.1 stable-legacy

# 移除标签（不会取消发布版本）
npm dist-tag rm my-pkg beta

# 以非 latest 标签发布
npm publish --tag beta
pnpm publish --tag canary --no-git-checks
```

### **永远不要将预发布发布到 `latest`**

```bash
# 错误 — 将 2.0.0-beta.0 发布为 `latest`，每个 `npm install pkg` 现在都会获得一个 beta 版本
npm publish

# 正确
npm publish --tag beta
```

**恢复** 如果你意外地将预发布标记为 `latest`：

```bash
# 1. 将 latest 重新指向之前的稳定版
npm dist-tag add my-pkg@1.4.2 latest

# 2. 将预发布重新标记到它应该的位置
npm dist-tag add my-pkg@2.0.0-beta.0 beta

# 3. 沟通（Twitter、Discord、GitHub 发布说明）——在错误发布和修复之间
#    的安装可能已经将 beta 拉取为 latest。
```

你**不能**取消发布（有罕见的例外，参见第 12 节）。你只能重新指向标签和对坏版本使用 `npm deprecate`。

---

## 7. 完整生命周期：alpha → beta → rc → stable → 下一个循环

### 阶段定义

| 阶段      | 用途                                              | API 稳定性      | 受众               | 进入下一阶段前的浸泡时间 |
| ---------- | ---------------------------------------------------- | ------------------ | ---------------------- | --------------------- |
| **alpha**  | 内部 / 功能探索，dogfood                    | 无——任何东西都可能变动 | 维护者、设计合作伙伴 | 天到周         |
| **beta**   | 功能完成；收集真实世界反馈      | API 可能根据信号变化 | 早期采用者         | 周                 |
| **rc**     | 冻结；仅修复阻塞性 bug                            | 锁定              | 对生产环境感兴趣的用户 | 通常 1-2 周     |
| **stable** | 生产就绪（`latest` 标签）                       | 锁定              | 所有人               | 直到下一个主版本      |
| **patch**  | 稳定线上的 bug 修复                          | 锁定              | 所有人               | 持续            |

### 状态图

```
                ┌────────────────────────────────────────────────┐
                │  v1.0.0 稳定线                            │
                │                                                │
                │   1.0.0 ──► 1.0.1 ──► 1.0.2 ──► 1.1.0 ──► …   │
                │                                                │
                └─────────────────┬──────────────────────────────┘
                                  │
                          新的主版本分支
                                  │
                                  ▼
   2.0.0-alpha.0 ─► 2.0.0-alpha.5 ─┐
                                   │ 功能冻结
                                   ▼
   2.0.0-beta.0 ─► 2.0.0-beta.7 ─┐
                                 │ API 冻结
                                 ▼
   2.0.0-rc.0 ─► 2.0.0-rc.2 ─┐
                             │ 零阻塞 + 浸泡通过
                             ▼
   2.0.0  ────────────────► （标签 `latest` → 2.0.0）
                             │
                             ▼
   2.0.0 ──► 2.0.1 ──► 2.0.2 ──► 2.1.0 ──► …  （新的稳定线，重复）


   并行：                            （同时，在 `release/1.x` 分支上）
   1.0.2 ──► 1.0.3 ──► 1.0.4 ──► …      上一个稳定版的补丁
```

### 转换触发器

| 转换          | 触发器                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| alpha → beta        | 功能冻结：所有计划的功能已合并；没有新的 API 对外接口                  |
| beta → rc           | API 冻结：没有更多的设计变更；只有阻塞性 bug                            |
| rc → stable         | 零 P0/P1 开放 + 最低浸泡期（通常同一个 rc.N 需要 7-14 天）     |
| stable → stable.+1  | Bug 修复、内部变更、依赖安全更新                             |
| stable → 下一个循环 | 需要新的破坏性变更 → 切出新的主版本分支，开始 alpha       |

### 多条活跃线的分支策略

当 `2.0.0` 发布时，你不会立即停止支持 `1.x`。使用长期存在的发布分支：

```
main                  ← 活跃开发（下一个主版本：3.0.0-alpha）
release/2.x           ← 当前稳定线；补丁：2.0.1、2.1.0
release/1.x           ← LTS / 上一个稳定版；补丁：1.4.5
```

每个分支上的 Changesets：

- `main`：对新主版本 `pre enter alpha`。
- `release/2.x`：稳定模式；升级产生 `2.0.1`、`2.1.0` 等。
- `release/1.x`：稳定模式；升级产生 `1.4.5` 等。在此分支的 `.changeset/config.json` 中设置 `baseBranch: "release/1.x"`。

CI 从每个分支以不同的 `--tag` 发布：

- `main` → `--tag alpha` 或 `--tag canary`
- `release/2.x` → `--tag latest`
- `release/1.x` → `--tag lts`（或 `1-lts`、`v1` 等）

---

## 8. 真实世界 SDK 发布节奏——案例研究

以下所有版本号均截至 2026-05-13 从 npm registry 中提取。`npm view <pkg> versions --json` 和 `npm view <pkg> dist-tags` 确认了它们。

### 8.1 Next.js（`next`）

**策略：** 每次提交 canary，每周 stable，并行 LTS 分支。

- **标签：** `latest`、`canary`、`rc`、`beta`、`backport`，加上历史线（`next-15-3`、`next-14`、`next-13` 等——每个支持的 minor 一个）
- 最近的 canary 运行（示例）：`16.3.0-canary.0` → `16.3.0-canary.1` → … → `16.3.0-canary.19`（当前）
- 稳定节奏：`16.2.1` → `16.2.2` → `16.2.3` → `16.2.4` → `16.2.5` → `16.2.6`（`latest`）
- 主版本前：`15.0.0-rc.1`，当前 `16.0.0-beta.0`
- 安装命令：
  ```bash
  npm install next             # 16.2.6（latest）
  npm install next@canary      # 16.3.0-canary.19（今天的 canary）
  npm install next@rc          # 15.0.0-rc.1
  npm install next@beta        # 16.0.0-beta.0
  npm install next@next-14     # 14.2.35（LTS 线）
  ```

Vercel 的发布脚本在**每次合并到 main** 时发布一个 canary，然后每周将最近的 canary 提升为 stable。

### 8.2 vercel/ai

**策略：** alpha + beta + canary 三重预发布，每个 PR 的 snapshot，并行 `ai-v5` 和 `ai-v6` 主版本线。

- **标签：** `latest`（6.0.180）、`alpha`（5.0.0-alpha.15）、`beta`（7.0.0-beta.116）、`canary`（7.0.0-canary.133）、`snapshot`（0.0.0-bf6e4b15-20260402200305）、`ai-v5`（5.0.188）、`ai-v6`（6.0.132）
- 最近的 beta 序列：`7.0.0-beta.103` → `7.0.0-beta.104` → … → `7.0.0-beta.116`
- 然后他们切出 canary：`7.0.0-canary.117` → `7.0.0-canary.118` → … → `7.0.0-canary.133`
- **Snapshot 模式：** PR 驱动的预览版本，命名为 `0.0.0-{sha}-{timestamp}`——可通过 `npm install ai@0.0.0-bf6e4b15-20260402200305` 安装。这让 PR 作者在合并前在真实应用中测试变更。
- 安装命令：
  ```bash
  npm install ai                # 6.0.180（latest，v6 稳定版）
  npm install ai@ai-v5          # 5.0.188（v5 LTS）
  npm install ai@beta           # 7.0.0-beta.116（下一个主版本）
  npm install ai@canary         # 7.0.0-canary.133（每个 PR 构建）
  ```

### 8.3 tRPC（`@trpc/server`）

**策略：** `next` 用于主版本预发布，alpha 标记的功能分支，并行 v10 LTS。

- **标签：** `latest`（11.17.0）、`next`（11.13.0）、`canary`（11.16.1-canary.20）、`v10`（10.45.4），加上功能分支 alpha 如 `tmp-main`（10.46.0-alpha-tmp-0202-nosideeffects-main.26）
- 最近节奏：`11.13.0` → `11.13.1` → `11.13.2` → `11.13.3` → `11.13.4` → `11.13.5-canary.0` → `11.13.5-canary.1` → … → `11.14.0` → `11.14.1-canary.0` → `11.14.1` → … → `11.17.0`
- 注意模式：稳定版 `11.X.0` 发布，然后 `11.X.1-canary.N` 累积，然后稳定版 `11.X.1` 发布，然后新的 minor `11.(X+1).0` 开始。
- 他们在历史上对 v11 使用了 `changesets pre enter beta`；现在使用 `next` 标签进行持续的预发布。
- 安装：
  ```bash
  npm install @trpc/server         # 11.17.0
  npm install @trpc/server@next    # 11.13.0（下一个主版本预览 / 大型功能）
  npm install @trpc/server@v10     # 10.45.4（LTS）
  ```

### 8.4 Storybook

**策略：** `next` 用于即将到来的主版本，每个 PR 的 canary，加上每个主版本的标签 LTS。

- **标签：** `latest`（10.3.6）、`next`（10.4.0-alpha.19）、`canary`（`0.0.0-pr-34569-sha-67fab295`），加上 `v7`（7.6.24）、`v8`（8.6.18）、`v9`（9.1.20），以及每个主版本的 canary（`v7-canary`、`v8-canary`、`v9-canary`）。
- 最近的 next 线：`10.4.0-alpha.0` → `10.4.0-alpha.1` → … → `10.4.0-alpha.19`
- 最近的 stable：`10.3.0-beta.1` → `10.3.0-beta.2` → `10.3.0-beta.3` → `10.3.0` → `10.3.1` → … → `10.3.6`（当前 `latest`）
- 三重轨道意味着用户可以留在 `latest`，选择加入 `next` 获取即将到来的功能，或固定到主版本 LTS 标签。

### 8.5 Stripe Node SDK

**策略：** 手动（无 changesets），严格的 semver-major 用于破坏性变更，每月节奏。

- 单一通道：仅 `latest`。没有 `beta` / `rc` / `canary`。预发布是例外。
- 主版本升级与 Stripe API 版本绑定（例如，当 Stripe API 发布破坏性变更时，SDK 升级主版本）。
- 教训：如果你的 SDK 包装了一个带有自己版本控制的外部 API，你的 semver 跟踪**SDK 的对外接口**，而不是 API。对被包装 API 的破坏性变更是 MINOR，如果你的 SDK 通过选择加入的方式门控它们，则是 MINOR；如果是强制性的，则是 MAJOR。

### 案例研究对比

| 项目    | 通道                                  | 每个 PR 构建        | LTS 分支             | 工具                  |
| ---------- | ----------------------------------------- | -------------------- | ------------------------ | ------------------------ |
| Next.js    | `latest`、`canary`、`rc`、`beta`          | 否（canary = main）   | 是（`next-15-3` 等）   | 自定义                   |
| vercel/ai  | `latest`、`alpha`、`beta`、`canary`、`snapshot` | 是（`0.0.0-{sha}`）  | 是（`ai-v5`、`ai-v6`）   | changesets               |
| tRPC       | `latest`、`next`、`canary`、`v10`         | 是（canary）         | 是（`v10`）              | changesets               |
| Storybook  | `latest`、`next`、`canary`、`v7..v9`      | 是（`0.0.0-pr-N`）   | 是（每个主版本一个标签）  | 自定义 + 类似 changesets |
| Stripe     | 仅 `latest`                             | 否                   | 无公共              | 手动              |

---

## 9. 预发布模式下的 Changesets

**一句话：** changesets 是一个工作流，其中每个 PR 添加一个小的 markdown 文件描述其影响，发布管道将这些文件聚合为版本升级 + 变更日志条目。

### 稳定模式流程（回顾）

```bash
# 1. 作者在 PR 旁编写一个 changeset
pnpm changeset
# 交互式：选择受影响的包，选择 semver 升级，编写面向用户的摘要
# 产生 .changeset/some-name.md：
#   ---
#   "@myorg/sdk": minor
#   ---
#   Added support for X
git add .changeset && git commit -m "feat: add X"

# 2. 发布时（在 main 上，在 CI 中）
pnpm changeset version    # 升级 package.json 版本 + 写 CHANGELOG.md + 删除 .md 文件
pnpm changeset publish    # 将所有升级的包发布到 npm
```

### 预发布模式

`changesets pre enter <tag>` 将仓库翻转为预发布模式。在预发布模式下，`changeset version` 产出 `X.Y.Z-tag.N` 形式的版本。

```bash
# 进入 beta 模式
pnpm changeset pre enter beta
# 创建 .changeset/pre.json——必须提交！

# 现在像往常一样编写 changesets
pnpm changeset            # → .changeset/blue-cats-jump.md

# 版本 + 发布
pnpm changeset version    # 升级 "1.0.0" → "1.0.0-beta.0"
pnpm changeset publish    # 自动使用 --tag beta 发布（使用 pre.json 的 tag）

# 更多变更 → 更多 changesets → 下一次升级是 1.0.0-beta.1
# ...

# 退出预发布模式
pnpm changeset pre exit
# 删除 .changeset/pre.json
git add .changeset && git commit -m "chore: exit beta"
# 下一次 `pnpm changeset version` 产生 1.0.0（稳定版）
```

### `.changeset/pre.json`（状态文件）

```json
{
  "mode": "pre",
  "tag": "beta",
  "initialVersions": {
    "@myorg/sdk": "0.9.4",
    "@myorg/utils": "0.9.4"
  },
  "changesets": ["blue-cats-jump", "wise-mountains-sing"]
}
```

此文件跟踪：当前的预发布标签，预模式开始时每个包的初始版本，以及哪些 changesets 已被应用。**提交它。不要手动编辑它**（changesets 管理它）。

### 规范的 "beta → rc" 转换

当 beta-5 功能完成且 API 冻结时，切出 `rc.0`：

```bash
pnpm changeset pre exit              # 退出 beta 模式
pnpm changeset pre enter rc          # 进入 rc 模式
pnpm changeset version               # 升级 1.0.0-beta.5 → 1.0.0-rc.0
pnpm changeset publish               # 使用 --tag rc 发布
```

版本号重置了预发布计数器（`.5 → .0`），但保留了底层的 `1.0.0` 目标。`@beta` 上的消费者不受影响；新用户必须显式选择加入 `@rc`。

### rc → stable 转换

```bash
pnpm changeset pre exit              # 退出 rc 模式
pnpm changeset version               # 升级 1.0.0-rc.2 → 1.0.0（稳定版！）
pnpm changeset publish               # 使用 --tag latest 发布
```

### 陷阱

- **在 stable 之前忘记 `pre exit`。** 症状：你想要 `1.0.0` 但得到了 `1.0.0-beta.6`。恢复：`pnpm changeset pre exit`，然后再次 `pnpm changeset version`。如果你已经发布了，使用 `npm dist-tag rm` 删除错误的预发布（版本保留在 registry 中但不再被指向）。
- **在 PR 中途中添加 `pre enter`。** 不要。将 `pre enter`/`pre exit` 作为它们自己的提交落地，以便审查者看到模式变更。
- **多包不匹配。** 如果一个包在 `1.0.0-beta.3` 而另一个在 `0.5.2-beta.0`，这是可以的——pre.json 独立跟踪每个包。但混合模式（一个在预发布，一个不在）是不可能的，因为 pre.json 是仓库范围的。
- **在周期中更改预标签。** 要从 `alpha` 切换到 `beta`，你必须 `pre exit` 然后 `pre enter beta`。没有 `pre switch`。
- **Snapshot 发布**：`changeset version --snapshot pr-123` 产出类似 `0.0.0-pr-123-20260513120000` 的版本，而不消耗 changesets——非常适合临时的每个 PR 构建。参见第 10 节。

---

## 10. GitHub Actions 发布管道

`changesets/action` GitHub Action 实现了一个"版本 PR"模式：当在 `main` 上有待处理的 changesets 时，它会打开（或更新）一个升级版本和编写变更日志的 PR。合并该 PR 会触发发布。

### 最小工作管道

来源：<https://github.com/changesets/action>（README，逐字形状）：

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write   # 推送 commits / tags
      pull-requests: write   # 打开 Version PR
      id-token: write   # npm provenance（参见第 11 节）
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0   # changesets 需要完整历史

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Verify
        run: |
          pnpm publint --strict
          pnpm attw --pack

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### 版本 PR 模式如何工作

1. 开发者打开 PR → 添加 `.changeset/foo.md` → 合并到 `main`。
2. 工作流在 `main` 上运行。`changesets/action` 看到有待处理的 changeset 且**没有版本 PR 存在**，所以它打开一个。
3. 版本 PR 的 diff：升级 `package.json` 版本，更新 `CHANGELOG.md`，删除 `.changeset/foo.md`。
4. 更多 PR 落地 → 工作流运行 → 更新版本 PR（它保持打开并吸收新的 changesets）。
5. 当你准备好时，合并版本 PR。工作流再次运行——这次 `.changeset/*.md` 为空，所以 `changeset publish` 运行并推送到 npm。

版本 PR 是你的发布批准门禁——在它们发布之前代码审查变更日志和版本升级。

### CI 中的预发布模式

对于长期运行的 beta 线，设置一个单独的分支：

```yaml
# .github/workflows/release-beta.yml
on:
  push:
    branches:
      - "release/2.x"   # 或你的 beta 分支叫什么
```

确保 `.changeset/pre.json` 在**该分支上被提交**，以便工作流看到它。

### Snapshot 发布（每个 PR 可安装的预览）

这是 vercel/ai 用于 `0.0.0-{sha}-{timestamp}` 版本的模式。

```yaml
# .github/workflows/snapshot.yml
name: Snapshot Release

on:
  pull_request:
    types: [labeled]   # 仅当有人添加 "snapshot" 标签时

jobs:
  snapshot:
    if: github.event.label.name == 'snapshot'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Snapshot version + publish
        run: |
          pnpm changeset version --snapshot pr-${{ github.event.number }}
          pnpm changeset publish --tag pr-${{ github.event.number }} --no-git-checks
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `Snapshot published! \n\`\`\`\nnpm install my-sdk@pr-${{ github.event.number }}\n\`\`\``
            })
```

输出版本看起来像 `0.0.0-pr-123-20260513120000`。消费者通过 `npm install my-sdk@pr-123`（dist-tag）或固定到确切版本来安装它。

### 分支总结

| 分支          | 工作流         | 结果                                         |
| --------------- | ---------------- | ----------------------------------------------- |
| `main`          | release.yml      | 打开版本 PR 或发布稳定版 → `latest`    |
| `release/N.x`   | release-beta.yml | 发布预发布 → `beta` / `rc` / `next`    |
| 带标签的 PR   | snapshot.yml     | 发布 snapshot → `pr-{N}` dist-tag            |

---

## 11. npm Provenance

**一句话：** Provenance 是一个签名证明，证明这个确切的 tarball 是从这个确切的 git 提交，在指定的 GitHub Actions 工作流运行中构建的。

Provenance 将 npm 发布绑定到一个可验证的构建管道。消费者可以检查它；供应链审计员喜欢它。

### 在 `package.json` 中启用

```jsonc
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### 要求

1. 发布必须从支持 OIDC 的公共 CI 提供者进行（目前 npm 官方支持 GitHub Actions 和 GitLab CI）。
2. 仓库必须是**公开的**，或者你在 npm 付费计划上。
3. 工作流需要 `permissions: id-token: write`。
4. 必须使用 npm CLI 9.5+（`npm publish`）或 pnpm 8+（`pnpm publish`）。

### 什么被证明

- Git 仓库 URL
- 确切的提交 SHA
- 工作流文件路径和工作流运行 ID
- 构建环境（运行器 OS、Node 版本）
- tarball 内容的哈希

### 消费者端验证

```bash
# 显示包版本的 provenance 信息
npm view my-sdk@1.2.3

# 或使用审计签名命令
npm audit signatures
# 验证所有已安装包的 provenance 证明
```

npm 的网站还在每个版本页面上显示一个"Provenance"徽章，链接回产生它的 GitHub Actions 运行。

### 常见陷阱

忘记在工作流中使用 `permissions: id-token: write`。症状：`npm publish` 失败并显示 `Unable to authenticate, need: OIDC token, OIDC ID token request failed`。修复：添加权限块。

---

## 12. 撤回与弃用

你发布了一个有问题的版本。现在怎么办？

### `npm deprecate` — 正确的工具，99% 的情况下

```bash
npm deprecate my-sdk@1.2.3 "Critical regression in fetch wrapper; upgrade to 1.2.4"
# 在该版本的每次安装上添加弃用警告
# 不删除版本——旧的锁文件仍然工作
```

支持通配符：

```bash
npm deprecate my-sdk@"<1.2.4" "Multiple bugs fixed in 1.2.4"
```

取消弃用：

```bash
npm deprecate my-sdk@1.2.3 ""
# 空消息清除弃用
```

### `npm unpublish` — 最后的手段

```bash
npm unpublish my-sdk@1.2.3 --force
```

**限制：**

- 发布后 72 小时内允许，无需询问。
- 72 小时后，仅当：没有其他包依赖此版本且每周下载量少于 300 且只有一个维护者。
- 否则：向 npm 提交支持工单。
- 取消发布**会破坏**引用已删除版本的锁文件。这就是为什么弃用是首选。

### 为预发布选择撤回 vs 替代

- **有问题的稳定发布**：弃用有问题的版本，发布一个补丁替代它。永远不要取消发布。
- **有问题的预发布版本（beta.5 有致命 bug）**：弃用并且 `npm dist-tag rm`，以便 `@beta` 不解析到它，然后立即发布带有修复的 `beta.6`。
- **暴露了安全问题的预发布**：弃用，然后将修复发布到新的预发布。
- **带有易受攻击的传递依赖的 snapshot/canary 版本**：通常可以不管（snapshot 不会在生产锁文件中被固定），但如果在下游锁文件中幸存，则弃用。

---

## 13. 决策树：选择你的发布策略

```
Q1: 你的库是否 < 1.0？
   ├─ 是 → 停留在 `0.x.y`。破坏性变更升级 MINOR（changesets 处理这个）。
   │        在 1.0 之前单个 `latest` 标签就足够了。
   │        跳到 Q4。
   └─ 否 → 继续

Q2: 你在当前主版本上有付费/企业用户吗？
   ├─ 是 → 强制 rc + 浸泡期（在 stable 之前至少 1 周 rc.N）
   │        至少向后一个主版本维护 LTS 分支（`release/N.x`）。
   │        使用 4 个通道：`latest`、`next`、`rc`、`beta`。
   │        继续到 Q3。
   └─ 否 → 2 个通道就够了：`latest` + `beta`（或 `next`）。

Q3: 你在每次 PR 合并时都发布代码吗？
   ├─ 是 → 添加 `canary`（或 `next`）通道：在每次推送到 main 时发布。
   │        可选地添加 `snapshot` 用于每个 PR 的预览。
   └─ 否 → 每周或每两周发布节奏；不需要 canary。

Q4: 你的库有插件/扩展作者吗？
   ├─ 是 → 在每次发布的变更日志中，显式地在自己的标题下
   │        指出插件 API 的破坏性变更。
   │        考虑一个单独的插件兼容性标签（例如 `compat-v3`）。
   └─ 否 → 标准变更日志就好。

Q5: 你是否面向多个运行时（Node、Bun、Deno、浏览器）？
   ├─ 是 → 在 CI 中每个运行时 attw `--pack` 和一次冒烟测试。
   │        Bun：`bun add ./tarball.tgz && bun test`
   │        Deno：`deno run --allow-all npm:my-sdk@1.0.0`
   │        浏览器：构建一个最小复现到 StackBlitz / 使用 Playwright。
   └─ 否 → 在 `node16-cjs` + `node16-esm` 模式下的 attw 就够了。
```

---

## 14. 反模式

| 反模式                                                              | 为什么不好                                                              | 修复                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| 将预发布发布到 `latest`                                      | `npm install pkg` 现在给用户一个他们没要求的 beta 版本         | 始终 `--tag <pre>`。在 changeset 中为预分支设置 `publishConfig.tag`  |
| 在 PATCH 升级中进行破坏性变更                                           | 违反 semver；消费者的 `^x.y.z` 范围静默地中断           | 升级 MAJOR；如果你忘记了，弃用并以 MAJOR 重新发布                 |
| 作用域包的首次发布没有 `--access public`               | npm 拒绝发布（作用域默认是私有的 = 付费）           | `"publishConfig": { "access": "public" }` 在 package.json 中                    |
| 在 stable 之前忘记 `pnpm changeset pre exit`                        | 稳定发布变成另一个 beta 版本                          | 始终在 stable 版本 PR 之前将 `pre exit` 作为自己的提交             |
| CI 中没有 `attw --pack`                                                    | 一半的消费者收到类型错误                          | 将 `attw` 接入 `prepublishOnly` 和 CI；将警告视为错误           |
| 手动编辑 `.changeset/pre.json`                                     | 本地和远程之间状态漂移；未来升级行为异常         | 仅通过 `pre enter` / `pre exit` 管理                                     |
| `npm unpublish` 作为第一响应                                       | 破坏下游的锁文件；关系损害                     | `npm deprecate` + 发布一个替代有问题版本的补丁                   |
| 没有 `publint` 就发布                                               | `exports` 映射对 30% 的用户静默地是错误的                       | `publint --strict` 在 `prepublishOnly` 和 CI 中                                |
| 在没有版本 PR 的情况下每次提交到 main 都自动发布              | 没有人工批准门禁；变更日志错误发布                      | 使用 `changesets/action` 版本 PR 模式                                   |
| 在启用 provenance 的工作流中缺少 `permissions: id-token: write` | 发布以神秘的 OIDC 错误失败                                | 添加权限块；在发布步骤的任务上下文中仔细检查    |
| 未在 `packageManager` 字段中固定 `pnpm`/`npm` 版本                | CI 在本地使用一个版本，在 Actions 中使用另一个版本；锁文件变动 | 在根 package.json 中设置 `"packageManager": "pnpm@9.x.x"`                |
| 将 `0.x` 视为生产安全                                         | 消费者认为 `^0.5.0` 是稳定的；你发布了破坏性的 0.6.0          | 要么承诺 semver（切出 1.0），要么在 README 中明确说明 0.x 策略  |

---

## 15. 快速参考卡片

```bash
# === 发布前验证 ===
pnpm build
pnpm publint --strict
pnpm attw --pack
pnpm pack --dry-run                       # 将发布什么？

# === 树外冒烟测试 ===
pnpm pack
( cd /tmp && rm -rf st && mkdir st && cd st && npm init -y && \
  npm install $OLDPWD/*.tgz && \
  node --print "require('my-sdk').default" )

# === Changesets — 稳定版 ===
pnpm changeset                            # 编写一个 changeset
pnpm changeset version                    # 应用升级 + 写变更日志
pnpm changeset publish                    # 发布到 npm

# === Changesets — 预发布 ===
pnpm changeset pre enter beta             # 进入 beta 模式
pnpm changeset                            # 编写 changeset
pnpm changeset version                    # 升级到 X.Y.Z-beta.N
pnpm changeset publish                    # 发布 --tag beta
pnpm changeset pre exit                   # 退出预模式
pnpm changeset version                    # 下一次升级是稳定版

# === Snapshot 发布（每个 PR） ===
pnpm changeset version --snapshot pr-${PR}
pnpm changeset publish --tag pr-${PR} --no-git-checks

# === Dist-tag 管理 ===
npm dist-tag ls my-pkg
npm dist-tag add my-pkg@1.2.3 latest
npm dist-tag rm my-pkg beta
npm publish --tag beta
npm publish --tag canary --provenance

# === 撤回 / 修复 ===
npm deprecate my-pkg@1.2.3 "Use 1.2.4+"
npm dist-tag add my-pkg@1.2.4 latest      # 如果标签错误则重新指向
```

---

## 参考文献

- publint 规则：<https://publint.dev/rules>
- attw 问题目录：<https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/README.md>
- changesets 预发布：<https://github.com/changesets/changesets/blob/main/docs/prereleases.md>
- changesets dist-tags：<https://github.com/changesets/changesets/blob/main/docs/dist-tags.md>
- changesets snapshot 发布：<https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md>
- npm dist-tag CLI：<https://docs.npmjs.com/cli/v10/commands/npm-dist-tag>
- npm deprecate CLI：<https://docs.npmjs.com/cli/v10/commands/npm-deprecate>
- npm provenance：<https://docs.npmjs.com/generating-provenance-statements>
- changesets/action：<https://github.com/changesets/action>
- vercel/ai 发布工作流：<https://github.com/vercel/ai/tree/main/.github/workflows>
- tRPC changesets 配置：<https://github.com/trpc/trpc/blob/main/.changeset/config.json>
- Semver 规范：<https://semver.org/>
- ZeroVer：<https://0ver.org/>