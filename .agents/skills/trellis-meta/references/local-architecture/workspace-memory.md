# 本地工作区记忆系统（Local Workspace Memory System）

`.trellis/workspace/` 存储跨会话记忆。其目的是让 AI 和人类能够在不同窗口、不同日期之间了解之前发生过什么。

## 目录结构

```text
.trellis/workspace/
├── index.md
└── <developer>/
    ├── index.md
    ├── journal-1.md
    └── journal-2.md
```

| 文件 | 用途 |
| --- | --- |
| `.trellis/.developer` | 当前开发者身份。 |
| `.trellis/workspace/index.md` | 全局工作区概览。 |
| `.trellis/workspace/<developer>/index.md` | 某位开发者的会话索引。 |
| `.trellis/workspace/<developer>/journal-N.md` | 会话日志。 |

## 开发者身份（Developer Identity）

首次使用时运行：

```bash
python3 ./.trellis/scripts/init_developer.py <name>
```

此命令会创建 `.trellis/.developer` 和对应的工作区目录。AI 不应随意更改开发者身份；如果身份有误，请先确认当前项目的使用者是谁。

## 日志（Journal）

`journal-N.md` 记录每个会话中已完成或部分完成的工作。默认情况下，每个日志文件容纳约 2000 行；超出后自动轮转到下一个文件。

记录会话的常用命令：

```bash
python3 ./.trellis/scripts/add_session.py \
  --title "Session title" \
  --summary "What changed" \
  --commit "abc1234"
```

没有 commit 的计划或审查工作也可以通过 `--no-commit` 或空 commit 值来记录。

## 工作区记忆与任务的关系（Relationship Between Workspace Memory And Tasks）

| 系统 | 存储内容 |
| --- | --- |
| `.trellis/tasks/` | 特定任务的需求、设计、研究和状态。 |
| `.trellis/workspace/` | 跨任务、跨会话的工作记录。 |
| `.trellis/spec/` | 作为长期约定保存的工程知识。 |

如果信息仅对当前任务有用，请放入任务目录。  
如果信息描述了当前会话中发生的事，请放入工作区日志。  
如果信息应在未来每次编写代码时都遵循，请放入 spec。

## 本地自定义点（Local Customization Points）

| 需求 | 编辑位置 |
| --- | --- |
| 更改日志最大行数 | `.trellis/config.yaml` 中的 `max_journal_lines`。 |
| 更改会话自动 commit 消息 | `.trellis/config.yaml` 中的 `session_commit_message`。 |
| 更改会话内容格式 | `.trellis/scripts/add_session.py`。 |
| 更改工作区在上下文中的展示方式 | `.trellis/scripts/common/session_context.py`。 |

## AI 使用规则（AI Usage Rules）

AI 不应将工作区视为唯一的事实来源。恢复任务时，请先阅读当前任务，然后将工作区用作背景信息。任务完成后，在工作区中记录重要的过程笔记；如果产生了长期规则，请更新 spec。