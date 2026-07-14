# 触发模式

用户的确切表述，这些表述应使 AI 主动使用 `trellis mem`。根据这些模式校准直觉——如果用户消息匹配其中某个模式而你却没有使用 `mem`，那你很可能错过了一次明显的回忆检索。

模式按表述背后的**意图**分组，而非表面用词。同一意图会以不同语言和语域出现。

## 过往解决方案回忆

用户正在问"我们（或我）之前是怎么解决这个的"。过往对话中存有答案；代码库展示了结果而非推理过程。

- "How did we solve this last time?"
- "What did we end up doing about X?"
- "We dealt with this once already, didn't we?"
- "上次怎么解的?"
- "之前是怎么搞定 X 的?"
- "我记得以前修过类似的"

操作：`trellis mem search "<症状关键词>" --global --limit 10`，然后对看起来最匹配的命中结果执行 `context`。

## 决策检索

用户正在引用一个存在于旧对话中、而非任何已提交文件中的决策。请在头脑风暴窗口中查找。

- "What was the decision on X?"
- "Did we decide to use Postgres or SQLite?"
- "The rationale for choosing X over Y was…?"
- "我们当时为啥选了 X 而不是 Y?"
- "关于 X 我们之前是怎么定的?"
- "之前讨论过 X 的方案吗?"

操作：`trellis mem search "<决策关键词>"` 找到会话，然后 `extract <id> --phase brainstorm` 恢复讨论内容。

## 跨会话续接

用户在间隔一段时间后恢复工作，上下文是隐式的。

- "Where were we?"
- "Continue from last time."
- "Pick up where we left off."
- "继续上次的"
- "我们上次做到哪了"
- "接着昨天那个任务"

操作：`trellis mem list --task <current-task-dir>` 找到与当前任务关联的最近会话，然后 `extract` 最后一个。

## 熟悉 bug 排查

当前的 bug 感觉像是之前遇到过的。过往会话中很可能保存了解决路径。

- "I feel like I've hit this before."
- "Doesn't this look like that bug from last month?"
- "Same kind of timeout I had in X."
- "这个错好像之前见过"
- "这个 bug 是不是上次那个?"
- "怎么又是这个 error?"

操作：`trellis mem search "<错误信息片段>" --global`。从实际错误字符串中锚定一个短小、有辨识度的 token。

## 自我模式识别

用户正在问自己是否在反复犯同类错误或做同类决策。

- "Do I always make this mistake?"
- "How often have I run into X?"
- "Is this a recurring thing for me?"
- "我每次都踩这个坑吗?"
- "我老犯这个错?"
- "这类问题之前出现过几次?"

操作：`trellis mem search "<话题>" --global --limit 50` 并浏览列表中的日期/项目。可选地对两三个结果执行 `extract` 进行比较。

## 完成工作复盘（按需）

用户明确希望回顾本次任务——不是强制步骤，仅在用户要求时执行。

- "Summarize what we did in this task."
- "What were the key decisions / surprises?"
- "Write up the lessons from this round."
- "总结一下这次的经验"
- "记一下这次踩的坑"
- "复盘下这个任务"

操作：识别当前任务的会话 ID（从 `.trellis/.runtime/sessions/*.json` 或 `mem list --task <task-dir>`），然后 `extract <id> --phase brainstorm` 和 `--phase implement`。给出摘要——尽可能提供具体的文件:行号引用。是否将摘要写入某处（PRD、spec、笔记文件）由用户决定；主动提议，不要自动写入。

## 反模式：不要在以下场景使用 `mem`

- "这个函数是做什么的？" → 读取文件。
- "这个测试为什么失败？" → 读取测试输出和文件。
- "我们代码库中 X 的正确模式是什么？" → grep / 读取 spec 文件。
- "Y 的最新 npm 版本是什么？" → 调用 `npm view`。
- "修复这个 bug。" → 调试。只有在你怀疑存在先验上下文时才使用 `mem`；否则它只是噪音。

判断标准始终是：在回答之前，一个资深同事会问"我们之前不是讨论过这个吗？" 如果是，就使用 `mem`。如果不是，就不要用。