# 本地多代理通道运行时（Local Multi-Agent Channel Runtime）

`trellis channel` 是 Trellis CLI 随附的本地多代理协作运行时。它让主 AI 会话可以派生出对等的工作者（peer workers）——Claude Code、Codex 或 `.trellis/agents/` 下的任何代理定义——通过事件日志交换持久化消息，并协调审查或头脑风暴循环，无需手动拼接 shell 管道。

本文档涵盖通道如何在用户项目中接入，以便自定义项目的 AI 知道该编辑什么。关于运行时用法（命令、论坛/帖子模式、工作者派生标志），请参考随附的 `trellis-channel` 能力技能（capability skill）。

## 本地系统模型（Local System Model）

通道运行时横跨三个本地层面：

1. **存储层**位于用户主目录：持久化事件日志和工作者状态文件。
2. **代理定义**位于项目内的 `.trellis/agents/`：平台无关的角色卡，由 `trellis channel spawn --agent <name>` 消费。
3. **项目配置**位于 `.trellis/config.yaml`：工作者守护阈值和其他通道参数。

## 核心路径（Core Paths）

| 路径 | 用途 |
| --- | --- |
| `~/.trellis/channels/<project>/<channel>/events.jsonl` | 每个通道的只追加事件日志。序列锁定，可安全重放。 |
| `~/.trellis/channels/<project>/<channel>/<channel>.lock` | 通道级写锁。 |
| `~/.trellis/channels/<project>/<channel>/<worker>.spawnlock` | 每个工作者的派生锁，供 OOM 守护使用。 |
| `~/.trellis/channels/<project>/<channel>/.seq` | 序列辅助文件，用于有序事件分配。 |
| `~/.trellis/channels/_global/<channel>/...` | 通过 `--scope global` 创建的通道。项目桶（project bucket）被共享键替换。 |
| `.trellis/agents/check.md` | 默认 Check Agent 角色定义，由 `--agent check` 消费。 |
| `.trellis/agents/implement.md` | 默认 Implement Agent 角色定义，由 `--agent implement` 消费。 |
| `.trellis/config.yaml`（`channel.*` 块） | 工作者守护阈值和通道默认值。 |

项目桶名称由绝对项目路径派生（斜杠展平，非字母数字字符替换为 `-`），与 Claude Code 的 `~/.claude/projects/<sanitized-cwd>/` 约定一致。可通过 `TRELLIS_CHANNEL_ROOT`（根目录）或 `TRELLIS_CHANNEL_PROJECT`（桶名称）覆盖，用于测试或沙箱环境。

## 何时使用通道运行时（When To Reach For The Channel Runtime）

通道比单次 Bash 调用或一次性子代理派发更重。仅在满足以下至少一个条件时使用：

- 工作需要**两个或以上代理进行多轮对话**（跨 AI 头脑风暴、同行审查、调度器 + 工作者）。
- 工作者应作为**对等进程**运行，主会话可以中断、观察进度或异步等待。
- 对话必须是**持久化且事后可检查的**（论坛/帖子通道、问题看板、决策记录）。
- 多个工作者必须**共享一个事件日志**，以便每个工作者都能看到其他工作者的报告。

在以下情况优先使用更轻量的原语：

- 单次 Bash 命令或单次 Agent 工具调用就够用 -> 直接执行即可。
- 用户只需要对文件进行静态审查 -> 读取文件并直接回复。
- 需求是「记住我们上周讨论的内容」-> 使用 `trellis mem` 而非通道。

## 自定义点（Customization Points）

| 需求 | 编辑位置 |
| --- | --- |
| 更改默认通道工作者空闲超时 | `.trellis/config.yaml` 中的 `channel.worker_guard.idle_timeout`。支持 `5m`、`30s` 等格式。设为 `0` 可禁用空闲清理。 |
| 更改活跃工作者预算 | `.trellis/config.yaml` 中的 `channel.worker_guard.max_live_workers`。设为 `0` 可禁用派生时的预算检查。 |
| 单次派生时覆盖工作者守护参数 | 在 `trellis channel spawn` 时传入 `--idle-timeout` / `--max-live-workers`，或设置环境变量 `TRELLIS_CHANNEL_WORKER_IDLE_TIMEOUT` / `TRELLIS_CHANNEL_MAX_LIVE_WORKERS`。 |
| 更改默认 Check 或 Implement 工作者的行为 | 编辑 `.trellis/agents/check.md` 或 `.trellis/agents/implement.md`。这些是平台无关的角色卡；通道运行时在传入 `--agent check|implement` 时将其注入。 |
| 添加新的角色卡 | 将 `<name>.md` 放入 `.trellis/agents/`。`trellis channel spawn --agent <name>` 会自动识别。 |
| 迁移通道存储位置（CI 沙箱、临时运行） | 设置 `TRELLIS_CHANNEL_ROOT=/path/to/dir`。通道事件随之迁移；现有通道保留在原位置。 |
| 切换存储作用域 | 在每个通道子命令中传入 `--scope project`（默认）或 `--scope global`。仅桶目录变化，其余不变。 |

工作者守护参数的优先级为：CLI 标志 > 环境变量 > `.trellis/config.yaml` > 内置默认值。内置默认值为 `idle_timeout: 5m` 和 `max_live_workers: 6`。

## 与其他本地层的关系（Relationship To Other Local Layers）

- **工作流层（Workflow layer）**：使用通道派发的工作流（如 `channel-driven-subagent-dispatch`）指示主代理调用 `trellis channel spawn --agent check` 或 `--agent implement`，而非使用平台子代理。如果 `.trellis/agents/check.md` 或 `implement.md` 缺失，`trellis workflow --template <id>` 会在安装时打印非阻塞警告。如果意外删除，可通过 `trellis update` 恢复。
- **任务层（Task layer）**：通道工作者不拥有任务状态。监督主会话通过工作者收件箱传递活跃任务路径；工作者从磁盘解析任务产物。
- **规范层（Spec layer）**：工作者与主会话以相同方式读取 `.trellis/spec/`。通道运行时不绕过 spec 上下文加载。
- **平台集成层（Platform integration layer）**：通道运行时是平台中立的。它不依赖 `.claude/`、`.codex/` 或任何其他平台目录。标准化不同提供商输出（Claude `stream-json`、Codex `app-server`）的适配器位于 Trellis CLI 二进制文件内部，不在项目中。
- **平台子代理文件 vs. 通道工作者**：编辑 `.claude/agents/trellis-implement.md`（以及其他平台 `.X/agents/` 目录中的对应文件）**不会**改变通道运行时工作者的行为——通道工作者加载 `.trellis/agents/<name>.md`。平台特定的代理文件用于主 AI 会话的直接子代理派发，而非通道派生的工作者。请参阅 `platform-files/agents.md` 了解各平台的代理表面，以及 `trellis-meta/SKILL.md` 中编码此分离的规则。

## 运行时用法（Runtime Usage）

关于命令语法、论坛/帖子模式、工作者句柄、进度检查以及 `--kind done` / `--kind turn_finished` 调度器等待模式，请加载随附的 `trellis-channel` 技能（在 `trellis init` / `trellis update` 后自动安装到各平台的技能目录下）。本文档仅涵盖本地文件布局和自定义参数；不重复可能在不同版本间变化的命令语法。