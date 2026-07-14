# `trellis mem` CLI 参考

五个子命令的完整标志参考。将此作为权威来源——`trellis mem help` 在运行时会打印相同内容，因此此处任何与运行时不一致的内容都属于 bug。

## 子命令

| 命令                    | 用途                                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `list`                 | 列出会话。未指定子命令时的默认行为。                                                                  |
| `search <keyword>`     | 查找内容匹配关键词的会话。                                                                          |
| `context <session-id>` | 深入查看某个会话：Top-N 命中轮次 + 周围上下文。配合 `--grep` 进行关键词锚定。               |
| `extract <session-id>` | 导出清洗后的对话记录。结合 `--phase` / `--grep` 进行切片。                                                     |
| `projects`             | 列出活跃项目的 `cwd` 值及其会话计数。用于发现应传递给其他子命令的 `--cwd`。 |

## 标志（酌情适用）

| 标志                                           | 子命令               | 含义                                                                                                                                                    |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--platform claude\|codex\|opencode\|pi\|all` | 全部               | 默认 `all`。OpenCode 适配器在 `0.6.0-beta.*` 上目前为桩实现——见下方"注意事项"。                                                               |
| `--since YYYY-MM-DD`                          | list / search     | 包含下界日期。                                                                                                                                |
| `--until YYYY-MM-DD`                          | list / search     | 包含上界日期。                                                                                                                                |
| `--global`                                    | list / search     | 包含本机上所有项目的会话。默认仅当前项目 `cwd`。                                                                 |
| `--cwd <path>`                                | list / search     | 强制使用指定项目 cwd，而非根据当前位置推断。                                                                                      |
| `--limit N`                                   | list / search     | 输出行数上限。默认 `50`。                                                                                                                             |
| `--grep KW`                                   | extract / context | 按关键词筛选轮次。空格分隔表示多词 AND。                                                                                        |
| `--phase brainstorm\|implement\|all`          | extract           | 按 Trellis 任务边界切片会话。`brainstorm` = `[task.py create, task.py start)`。`implement` = 头脑风暴窗口之外的轮次。默认 `all`。 |
| `--turns N`                                   | context           | 返回的命中轮次数量。默认 `3`。                                                                                                                |
| `--around N`                                  | context           | 每个命中轮次包含的周围轮次数。默认 `1`。                                                                                                         |
| `--max-chars N`                               | context           | 总字符预算。默认 `6000`（约 1500 tokens）。                                                                                                     |
| `--include-children`                          | search / context  | 将 OpenCode 子 agent 会话合并到其父会话中。                                                                                               |
| `--json`                                      | 全部               | 输出机器可解析的 JSON，而非人类可读输出。                                                                                              |

## 常用一行命令

```bash
# 本机上哪些过往会话讨论过 "deadlock"？
trellis mem search "deadlock" --global --limit 20

# 在特定会话中，找出提及 "lock contention" 的前 5 轮，
# 并附带每轮前后各 2 轮的上下文。
trellis mem context 5842592d --grep "lock contention" --turns 5 --around 2

# 恢复某个会话的头脑风暴窗口——当需要继续用户一周前开始的任务时很有用。
trellis mem extract 5842592d --phase brainstorm

# 列出本机所有有 Trellis 会话的项目及其会话计数。
trellis mem projects
```

## 输出形态

- **默认人类可读输出**（无 `--json`）：适配终端宽度，会话 ID 高亮显示，轮次标记可见。适合内联阅读，但不适合粘贴到 markdown 文件中。
- **`--json`**：稳定 schema，可安全解析和处理。当将 `mem` 输出通过管道传递给后续步骤（例如为经验教训章节做摘要）时，优先使用 `--json`。

## 注意事项

- **OpenCode 适配器在 `0.6.0-beta.*` 上为桩实现。** 当 `--platform` 解析为 OpenCode（或 `all` 且包含 OpenCode）时，`mem` 会打印一行"reader unavailable"通知并继续处理其他平台。在适配器正式发布之前，不要在回复中承诺 OpenCode 覆盖。
- **`--phase` 切片依赖于会话记录的命令行调用中出现 `task.py create` / `task.py start`。** 如果用户在 AI 循环之外的其他终端中运行了 `task.py`，则这些会话不会有阶段边界。`--phase all` 是安全的回退方案。
- **`mem` 直接索引平台的 JSONL 文件。** 如果用户清除了 Claude / Codex / Pi 的会话存储，`mem` 无法恢复磁盘上已不存在的数据。
- **`mem` 是只读的。** 没有远程同步，不会编辑平台 JSONL。你基于 `mem` 发现所做的任何写入操作，都是你自己对可用编辑工具的后续调用。

## 当需要超出本参考的内容时

在用户的 shell 中运行 `trellis mem help`。运行时帮助是权威的，在快速迭代的 beta 版本中会领先于本参考文档。