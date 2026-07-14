# 工作流（Workflows）

按意图选择使用模式。多轮工作优先使用持久化频道（durable channel），一次性问题使用
`channel run`。

## 模式 A：多轮头脑风暴（Multi-round Brainstorm）

当用户说"和 codex/claude 讨论一下"、"brainstorm"或"拉一个 agent 进来一起看"时使用。

```bash
trellis channel create brainstorm-storage-layer --by main \
  --task .trellis/tasks/05-XX-storage-adapter

trellis channel spawn brainstorm-storage-layer \
  --agent architect --provider codex \
  --file .trellis/tasks/05-XX-storage-adapter/prd.md \
  --file .trellis/tasks/05-XX-storage-adapter/design.md \
  --as cx-arch --timeout 30m

trellis channel send brainstorm-storage-layer \
  --as main --to cx-arch --text-file /tmp/brainstorm-r1.md

trellis channel wait brainstorm-storage-layer \
  --as main --kind done --from cx-arch --timeout 10m
```

不要一轮回答就停止。阅读回答，找出模糊之处，发起新的追问，反复迭代直到结果可执行。

最低轮次结构：

1. 方向拆分（Direction split）：该功能应放在现有机制中还是新建机制？
2. MVP 边界（MVP boundary）：v1、v2 范围，以及什么情况下需要将 v2 内容提前纳入 v1。
3. 数据契约（Data contract）：事件（events）、schema、元数据（metadata）、状态真实来源（state source of truth）、兼容性。
4. CLI / UX 契约（CLI / UX contract）：命令名称、flags、错误、默认值、歧义处理。
5. 跨层风险与测试（Cross-layer risk and tests）：共享辅助模块、偏移点（drift points）、阻止发版的测试项。

可选轮次：

- 运维（Operations）：日志、调试、卡住的 worker、kill/restart、恢复。
- 迁移/发布（Migration/release）：breaking 状态、manifest、changelog、文档站点。
- 反向审查（Opposition review）：让对端 agent 对当前方案提出反对意见。

每次追问应要求给出具体的文件路径、命令、schema、被否决的替代方案以及阻止发版的问题。当需要决策时，拒绝含糊其辞。

## 模式 B：实现 / 审查 Agent（Implement / Check Agent）

当用户要求派发实现或审查工作时使用。

```bash
TASK=.trellis/tasks/05-12-foo
trellis channel create cr-foo --task "$TASK" --by main

trellis channel spawn cr-foo \
  --agent check \
  --jsonl "$TASK/check.jsonl" \
  --file "$TASK/prd.md" \
  --file "$TASK/design.md" \
  --file "$TASK/implement.md" \
  --cwd "$PWD" --timeout 15m

trellis channel send cr-foo --as main --to check --text-file /tmp/cr-brief.md
trellis channel wait cr-foo --as main --kind done --from check --timeout 15m
trellis channel messages cr-foo --kind message --from check --tag final_answer
```

实现工作使用 `--agent implement` 并发送实现简报（implementation brief）。审查工作需包含确切的 diff 范围、相关规格说明以及已运行的验证。

## 模式 C：并行审查者（Parallel Reviewers）

使用一个频道和不同的 worker 名称。

```bash
trellis channel create cr-feature --by main --ephemeral

trellis channel spawn cr-feature --agent check \
  --jsonl "$TASK/check.jsonl" --file "$TASK/prd.md" --file "$TASK/design.md" \
  --timeout 15m

trellis channel spawn cr-feature --agent check --provider codex --as check-cx \
  --jsonl "$TASK/check.jsonl" --file "$TASK/prd.md" --file "$TASK/design.md" \
  --timeout 15m

trellis channel send cr-feature --as main --to check --text-file /tmp/cr-brief.md
trellis channel send cr-feature --as main --to check-cx --text-file /tmp/cr-brief.md
trellis channel wait cr-feature --as main --kind done --from check,check-cx --all --timeout 15m
```

`--all` 表示每个列出的 worker 都必须发出匹配的事件。

## 模式 D：一次性 Worker（One-shot Worker）

```bash
trellis channel run --provider codex --message "say hi in 3 words" --timeout 1m
trellis channel run --agent plan --message-file /tmp/plan-question.md --timeout 10m
```

成功时，`run` 会删除临时频道。出错/超时/被 kill 时，会保留频道并打印路径以供检查。

## 模式 E：论坛频道（Forum Channel）

用于问题论坛、主题式反馈、发布待办、agent 发现和内部 changelog。完整模型请阅读 `forum.md`。

## 模式 F：接管已有线程（Take Over Existing Thread）

如果用户给出了论坛/线程名称，自行恢复上下文：

```bash
trellis channel forum <board> --scope global
trellis channel thread <board> <thread> --scope global --raw
trellis channel context list <board> --scope global --thread <thread>
trellis channel messages <board> --scope global --raw --thread <thread>
```

输出约束摘要，而非原文转储：

- 用户层面的问题
- 影响此仓库的上下文文件
- 当前版本 vs 未来版本的需求
- 当前代码/设计是否满足
- 下一步操作或待追加的评论