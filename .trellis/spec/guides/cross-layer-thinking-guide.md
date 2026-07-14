# 跨层思维指南（Cross-Layer Thinking Guide）

> **用途**：在实现之前考虑数据在各层之间的流动。

---

## 问题所在（The Problem）

**大多数 bug 发生在层的边界，而非层内。**

常见的跨层 bug：

- API 返回格式 A，前端期望格式 B
- 数据库存储 X，服务转换为 Y，但丢失了数据
- 多个层以不同方式实现相同的逻辑

---

## 在实现跨层功能之前

### 第 1 步：绘制数据流

画出数据如何移动：

```
Source → Transform → Store → Retrieve → Transform → Display
```

对于每个箭头，问：

- 数据是什么格式？
- 什么可能出错？
- 谁负责验证？

### 第 2 步：识别边界

| 边界（Boundary） | 常见问题 |
| --------------------- | --------------------------------- |
| API ↔ Service | 类型不匹配、缺少字段 |
| Service ↔ Database | 格式转换、null 处理 |
| Backend ↔ Frontend | 序列化、日期格式 |
| Component ↔ Component | Props 形态变化 |

### 第 3 步：定义契约

对于每个边界：

- 确切的输入格式是什么？
- 确切的输出格式是什么？
- 可能发生哪些错误？

---

## 常见跨层错误

### 错误 1：隐式格式假设

**坏做法**：不检查就假设日期格式

**好做法**：在边界进行显式格式转换

### 错误 2：分散的验证

**坏做法**：在多个层中验证相同的内容

**好做法**：在入口点验证一次

### 错误 3：泄露的抽象

**坏做法**：组件知道数据库 schema

**好做法**：每一层只知道其邻居

### 错误 4：每个消费者都解析相同的有效负载

**坏做法**：一个命令读取 JSONL 事件并在内联中转换字段：

```typescript
const thread = (ev as { thread?: string }).thread;
const labels = (ev as { labels?: string[] }).labels;
```

这看起来是本地的，但这意味着每个消费者都拥有事件契约的私有版本。下一次字段变更将更新一个命令而遗漏另一个。

**好做法**：在事件边界解码一次，然后导出类型化投影：

```typescript
if (!isThreadEvent(ev)) return false;
return ev.thread === filter.thread;
```

**规则**：对于追加日志（append-only logs）、JSON 流、RPC 有效负载或配置文件，为以下内容创建一个所有者：

- 事件/有效负载类型定义
- 从 `unknown` 进行的类型守卫和标准化
- UI 命令使用的元数据投影
- 从真实来源重放状态的 reducer

渲染代码可以格式化字段，但不得重新定义有效负载契约。

---

## 跨层功能的检查清单

实现之前：

- [ ] 绘制了完整的数据流
- [ ] 识别了所有层边界
- [ ] 定义了每个边界的格式
- [ ] 决定了验证发生的位置

实现之后：

- [ ] 使用边界情况测试（null、空、无效）
- [ ] 验证了每个边界的错误处理
- [ ] 检查了数据在往返后的完整性
- [ ] 检查了消费者导入共享的解码器/投影，而非在本地转换有效负载字段
- [ ] 检查了派生状态指回源事件标识符（`seq`、`id`、`version`），而非发明第二个游标

---

## 跨平台模板一致性

在 Trellis 中，命令模板（例如 `record-session.md`）存在于**多个平台**中，内容相同或几乎相同。这是一个跨层边界。

### 检查清单：修改任何命令模板之后

- [ ] 查找具有相同命令的所有平台：`find src/templates/*/commands/trellis/ -name "<command>.*"`
- [ ] 更新所有平台的副本（Markdown `.md` 和 TOML `.toml`）
- [ ] 对于 Gemini TOML：适配行续（`\\` vs `\`）和三引号字符串
- [ ] 运行 `/trellis:check-cross-layer` 验证没有遗漏

**真实示例**：在 Claude 中更新了 `record-session.md` 以使用 `--mode record`，但忘记了 iFlow、Kilo、OpenCode 和 Gemini——被跨层检查捕获。

---

## 生成式运行时模板升级一致性

一些生成的文件既是文档又是运行时输入。在 Trellis 中，`.trellis/workflow.md` 被 `get_context.py`、`workflow_phase.py`、SessionStart 过滤器和每轮 hook 解析。模板变更必须同时对全新 init 和升级路径进行验证。

### 检查清单：修改运行时解析的模板之后

- [ ] 识别每一个读取该模板的运行时解析器，而不仅仅是安装它的文件写入器
- [ ] 检查相关语法是否存在于明显的托管区域（如标记块）之外
- [ ] 验证全新的 `init` 输出以及一个写入较旧 `.trellis/.version` 的版本化 `update` 场景
- [ ] 添加一个使用较旧原始模板 fixture 的升级回归测试，然后断言安装后的文件达到了当前打包的形状
- [ ] 更新拥有该运行时契约的后端 spec

---

## 版本化文档边界

版本化文档是一个跨层边界：源路径、`docs.json` 版本路由和渲染的版本选择器都必须描述相同的发布线。

### 检查清单：编辑版本化文档之前

- [ ] 确定目标发布线：stable、beta 或 RC
- [ ] 验证编辑的 MDX 路径与该线匹配：
  - stable: `docs-site/{start,advanced,...}` 和 `docs-site/zh/{start,advanced,...}`
  - beta: `docs-site/beta/**` 和 `docs-site/zh/beta/**`
  - RC: `docs-site/rc/**` 和 `docs-site/zh/rc/**`
- [ ] 验证 `docs.json` 导航将版本标签指向相同的路径
- [ ] 在提交前对另一目录树中不应有的发布线特定术语进行 grep
- [ ] 将出现在 root release 路径下的 beta 内容视为源路径 bug，而非渲染 bug

**真实示例**：一个 beta 专用任务工作流变更在 root `start/` 和 `advanced/` 路径下记录了 `prd.md` + `design.md` + `implement.md`、task-creation consent 和 Codex mode banner。然后文档站在 Release 选择器下提供了 0.6 beta 行为。修复方法是恢复 root release 文档，将 0.6 内容移至 `beta/` 和 `zh/beta/`，并添加对 root release 目录树的 beta 标记 grep 审计。

**真实示例**：Codex inline 模式将工作流平台标记从 `[Codex]` / `[Kilo, Antigravity, Windsurf]` 改为 `[codex-sub-agent]` / `[codex-inline, Kilo, Antigravity, Windsurf]`。全新 init 是正确的，但 `trellis update` 仅合并了 `[workflow-state:*]` 块，并保留了这些块之外的过时标记。结果：升级后的项目获得了新的 hook 脚本，但仍使用旧的工作流路由，因此 `get_context.py --mode phase --platform codex` 可能返回空的 Phase 2.1 详情。

---

## 模式检测探针检查清单

当 CLI 通过探测远程资源自动检测模式时（例如，检查 `index.json` 是否存在来决定 marketplace vs 直接下载）：

### 实现之前：

- [ ] 探针在所有使用该结果的代码路径中运行（交互式、`-y`、`--flag` 组合）
- [ ] 404 与瞬时错误被区分——不要将两者都视为"未找到"
- [ ] 瞬时错误应**中止或重试**，永不静默切换模式
- [ ] 当上下文变化时（例如用户切换来源），共享状态（缓存、预取数据）被**重置**
- [ ] **快捷路径**（例如 `--template` 跳过选择器）必须具有与探测路径相同质量的错误处理——检查下游函数是否调用了包罗万象的包装器

### 实现之后：

- [ ] 跟踪从探针结果到模式决策分支的每条路径——不能有 fallthrough
- [ ] 外部格式契约（giget URI、原始 URL）经过测试或至少以注释形式记录
- [ ] 元数据读取消费完整响应或使用流解析器——永不将固定大小的前缀解析为完整 JSON
- [ ] 当从解析的片段重建复合标识符时，验证**所有**字段都已包含且位于**正确位置**（例如 `provider:repo/path#ref` 而非 `provider:repo#ref/path`）
- [ ] 验证在快捷方式后调用的**动作函数**不会在内部使用旧的包罗万象的 fetch——当错误区分很重要时，它们必须使用探针质量的变体

**真实示例**：自定义 registry 流程在 3 轮审查中出现了 8 个 bug：(1) 探针仅在交互模式中运行，(2) 瞬时错误回退到错误模式，(3) giget URI 的 `#ref` 位置错误，(4) 预取的模板跨源切换泄漏，(5) `--template` 快捷方式绕过了探针但 `downloadTemplateById` 内部使用了包罗万象的 `fetchTemplateIndex`，将超时转换为"Template not found"。

**真实示例**：Agent session update hints 使用 `response.read(4096)` 抓取 npm `latest` 元数据，然后将其作为完整 JSON 解析。`@mindfoldhq/trellis` 包的元数据超过 4 KB，因此 JSON 被截断，解析静默失败，第一次会话注入没有显示更新提示。修复：在解析之前读取完整响应，并添加一个回归测试，其中 `version` 后跟 8 KB 元数据尾部。

---

## 何时创建流程文档

创建详细的流程文档当：

- 功能跨越 3 个以上层
- 涉及多个团队
- 数据格式复杂
- 功能之前曾导致 bug

---

## 事件日志 / 投影边界

追加日志是跨层契约。单个事件穿过：

```
CLI input → event writer → events.jsonl → reader → filter → reducer → display
```

### 检查清单：添加新的事件类型或字段之后

- [ ] 将事件类型添加到中央事件分类中
- [ ] 在事件层添加类型化的事件变体或类型守卫
- [ ] 为来自用户输入或 JSON 的数组/对象字段添加标准化辅助函数
- [ ] 仅在事件写入器中保持 `seq` / `id` 赋值
- [ ] 使过滤器和 reducer 消费类型化的事件守卫，而非本地转换
- [ ] 使显示代码消费 reducer 输出或类型化事件，而非原始 JSON
- [ ] 添加至少一个回归测试，证明历史重放和实时过滤使用相同的过滤模型

**真实示例**：Thread channels 添加了 `kind: "thread"`、`description`、`context`、labels 和 `lastSeq`。首次实现正确地重放了 thread 状态，但几个命令仍然使用本地转换重新解析事件有效负载字段。修复方法是让核心事件层拥有 `ThreadChannelEvent` 和 `isThreadEvent`，让 `reduceChannelMetadata` 成为唯一的 channel metadata 投影，并让 `reduceThreads` 成为唯一的 thread replay reducer。
