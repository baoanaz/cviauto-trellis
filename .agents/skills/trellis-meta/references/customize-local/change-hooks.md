# 修改本地 Hooks

Hooks（钩子）是将平台与 Trellis 连接起来的自动化层。当用户想更改「何时注入上下文」「shell 命令如何继承会话」「agent 启动前应读取哪些文件」时，通常需要编辑 hooks。

## 先阅读这些文件

1. 目标平台的 settings/config，如 `.claude/settings.json`、`.codex/hooks.json`、`.cursor/hooks.json`
2. 目标平台的 hooks 目录
3. `.trellis/scripts/common/active_task.py`
4. `.trellis/scripts/common/session_context.py`
5. `.trellis/workflow.md`

## 常见 Hook 类型

| Hook | 用途 |
| --- | --- |
| session-start | 在会话启动、清除或压缩时注入 Trellis 概览。 |
| workflow-state | 在每次用户输入时注入状态提示。 |
| sub-agent context | 在 agent 启动前注入 PRD/spec/research。 |
| shell session bridge | 让 shell 中的 `task.py` 命令能够看到相同的会话标识。 |

## 修改步骤

1. 在 settings/config 中找到 hook 注册项。
2. 确认注册的脚本路径存在。
3. 阅读 hook 脚本，识别输入、输出以及调用的 `.trellis/scripts/`。
4. 修改 hook 行为。
5. 如果 hook 依赖工作流内容，同步更新 `.trellis/workflow.md`。

## 示例：更改新会话注入内容

首先找到 session-start hook：

```text
.claude/settings.json
.claude/hooks/session-start.py
```

如果该 hook 最终调用了 `.trellis/scripts/get_context.py` 或 `session_context.py`，那么编辑本地脚本通常比在 hook 中硬编码内容更稳健。

## 示例：Agent 未读取 JSONL

首先确认：

```bash
python3 ./.trellis/scripts/task.py current --source
python3 ./.trellis/scripts/task.py validate <task>
```

如果 task 和 JSONL 正确，判断平台使用的是 hook push（推送）方式还是 agent pull（拉取）方式。对于 hook push，编辑 `inject-subagent-context`；对于 agent pull，编辑 agent 文件。

## 注意事项

- Settings 负责注册，hook 脚本负责行为；两者需一起检查。
- 不同平台支持不同的 hook 事件。不要直接复制其他平台的 settings。
- Hooks 应读取项目本地的 `.trellis/`；不应依赖 Trellis 上游源码路径。
- Hook 失败时应产生可见的错误，使 AI 不会静默丢失上下文。