# Ralph Loop

针对 Check Agent 的质量强制执行机制。

---

## 概述

Ralph Loop 阻止 Check Agent 停止，直到所有验证命令通过。

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           RALPH LOOP                                     │
│                                                                          │
│  Check Agent 完成                                                        │
│         │                                                                │
│         ▼                                                                │
│  SubagentStop hook 触发 ──► ralph-loop.py 运行                          │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  运行来自 worktree.yaml 的验证命令：                              │    │
│  │                                                                  │    │
│  │    pnpm lint        → 退出码 0 ✓                                 │    │
│  │    pnpm typecheck   → 退出码 0 ✓                                 │    │
│  │    pnpm test        → 退出码 1 ✗                                 │    │
│  │                                                                  │    │
│  │  结果：失败（test 失败）                                          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────────┐              ┌─────────────────┐                   │
│  │   全部通过？     │──── 是 ────►│  允许停止        │                   │
│  └────────┬────────┘              └─────────────────┘                   │
│           │ 否                                                           │
│           ▼                                                              │
│  ┌─────────────────┐                                                    │
│  │  阻止停止        │ ◄─── Agent 继续修复问题                            │
│  │  注入错误信息    │                                                    │
│  └─────────────────┘                                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 配置

### `worktree.yaml`

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  # - pnpm test
  # - pnpm build
```

---

## 常量

| 常量 | 值 | 描述 |
|----------|-------|-------------|
| `MAX_ITERATIONS` | 5 | 最大循环尝试次数 |
| `STATE_TIMEOUT_MINUTES` | 30 | 状态文件超时 |
| `COMMAND_TIMEOUT` | 120s | 每个命令的超时 |

---

## 状态文件

### `.trellis/.ralph-state.json`

跨迭代跟踪循环状态。

```json
{
  "task": ".trellis/tasks/01-31-add-login",
  "iteration": 2,
  "started_at": "2026-01-31T10:30:00"
}
```

---

## 流程

### 迭代 1

1. Check Agent 完成工作
2. SubagentStop hook 触发
3. `ralph-loop.py` 创建状态文件（iteration=1）
4. 运行验证命令
5. 如果失败：阻止停止，注入错误消息
6. Check Agent 继续修复

### 迭代 2-5

1. Check Agent 再次尝试停止
2. Hook 读取状态文件，递增迭代次数
3. 再次运行验证命令
4. 重复直到通过或达到最大迭代次数

### 达到最大迭代次数

1. 迭代 5 仍然失败
2. Hook 允许停止（防止无限循环）
3. 记录关于未解决问题的警告

### 超时

1. 状态文件超过 30 分钟
2. Hook 重置状态（全新开始）
3. 视为迭代 1

---

## 验证命令

### 执行顺序

命令按配置顺序运行。首次失败即停止执行。

```yaml
verify:
  - pnpm lint        # 首先运行（快速）
  - pnpm typecheck   # 其次运行
  - pnpm test        # 第三运行（较慢）
```

**建议**：按快 → 慢的顺序排列

### 退出码

- 退出码 0 = 通过
- 非零 = 失败

### 超时

每个命令有 120 秒超时。长时间运行的测试可能需要：
- 拆分为更小的测试套件
- 在 Ralph Loop 中仅运行快速测试
- 调整脚本中的 `COMMAND_TIMEOUT`

---

## 回退：完成标记

如果 `worktree.yaml` 没有 `verify` 配置，Ralph Loop 使用完成标记。

### 工作原理

1. 读取 `check.jsonl` 中的 reason 字段
2. 生成预期标记：`{REASON}_FINISH`
3. 检查 Agent 输出中是否包含所有标记
4. 缺少标记 = 阻止停止

### 示例

```jsonl
{"file": "...", "reason": "typecheck"}
{"file": "...", "reason": "lint"}
```

预期标记：
- `TYPECHECK_FINISH`
- `LINT_FINISH`

---

## 调试

### 检查状态

```bash
cat .trellis/.ralph-state.json
```

### 手动验证

```bash
# Run verify commands manually
pnpm lint && pnpm typecheck && pnpm test
```

### 重置状态

```bash
rm .trellis/.ralph-state.json
```

### 查看 Hook 输出

检查 Agent 输出中的 Ralph Loop 消息：
- "Verification passed" = 所有命令成功
- "Verification failed" = 阻止中，显示错误
- "Max iterations reached" = 放弃

---

## 自定义

### 添加测试验证

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
```

### 添加构建验证

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
```

### 不同语言

**Go：**
```yaml
verify:
  - go fmt ./...
  - go vet ./...
  - go test ./...
```

**Python：**
```yaml
verify:
  - ruff check .
  - mypy .
  - pytest
```

**Rust：**
```yaml
verify:
  - cargo fmt --check
  - cargo clippy
  - cargo test
```

---

## 禁用 Ralph Loop

在项目中禁用：

1. 从 `worktree.yaml` 中移除 `verify`
2. 或从 settings.json 中移除 SubagentStop hook

**警告**：没有 Ralph Loop，代码质量将不会自动强制执行。