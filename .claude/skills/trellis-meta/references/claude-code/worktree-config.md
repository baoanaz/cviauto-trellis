# worktree.yaml 配置参考

`.trellis/worktree.yaml` 配置的完整指南。

---

## 概述

`worktree.yaml` 配置**同时**影响 Multi-Session（worktree 隔离）**和**部分 Multi-Agent 行为（如 Ralph Loop）。

```yaml
# .trellis/worktree.yaml

# 仅 Multi-Session
worktree_dir: ../worktrees    # 默认值
copy:
  - .trellis/.developer
  - .env
post_create:
  - npm install

# Multi-Session 和 Multi-Agent 共用
verify:
  - pnpm lint
  - pnpm typecheck
```

**注意**：Trellis 使用自定义 YAML 解析器（非 PyYAML）。支持基本的键值对和数组；复杂的嵌套结构可能无法正常工作。

---

## 配置节

### 哪些配置影响哪些模式？

| 配置 | Multi-Agent（当前目录） | Multi-Session（worktree） |
|--------|---------------------------|--------------------------|
| `worktree_dir` | ❌ 不使用 | ✅ Worktree 位置 |
| `copy` | ❌ 不使用 | ✅ 复制到 worktree 的文件 |
| `post_create` | ❌ 不使用 | ✅ Worktree 创建后执行的命令 |
| `verify` | ✅ Ralph Loop 使用 | ✅ Ralph Loop 使用 |

**关键点**：`verify` 配置对两种模式都生效！

---

## 完整配置

```yaml
# =============================================================================
# 仅 MULTI-SESSION - 仅在 worktree 模式下使用
# =============================================================================

# Worktree 创建位置（相对于项目根目录）
# 默认：../worktrees
worktree_dir: ../worktrees

# 要复制到每个 worktree 的文件
# 这些文件不在 git 中，需要手动复制
# 默认：[]（空数组）
copy:
  - .trellis/.developer      # 开发者身份
  - .env                      # 环境变量
  - .env.local                # 本地覆盖
  # - .npmrc                  # npm 配置
  # - credentials.json        # 凭证文件

# Worktree 创建后运行的命令
# 按顺序运行，遇到第一个失败即停止
# 默认：[]（空数组）
post_create:
  - npm install               # 或 pnpm install
  # - pnpm install --frozen-lockfile
  # - cp .env.example .env
  # - npm run db:migrate

# =============================================================================
# 两种模式共用 - 在 Multi-Agent 和 Multi-Session 中均使用
# =============================================================================

# 验证命令 - 由 Ralph Loop 使用
# 在 Check Agent 停止时运行
# 必须全部通过才允许停止
# 默认：[]（空数组）
verify:
  - pnpm lint
  - pnpm typecheck
  # - pnpm test
  # - pnpm build
```

### 默认值

| 配置 | 默认值 | 备注 |
|--------|---------|-------|
| `worktree_dir` | `../worktrees` | 相对于项目根目录 |
| `copy` | `[]` | 空数组，不复制文件 |
| `post_create` | `[]` | 空数组，不运行命令 |
| `verify` | `[]` | 空数组，Ralph Loop 使用完成标记 |

---

## 场景：当前目录下的 Multi-Agent

**需求**：在当前目录运行 dispatch → implement → check，不使用 worktree

**worktree.yaml 配置**：
```yaml
# 以下可以省略（当前目录模式下不使用）
# worktree_dir: ...
# copy: ...
# post_create: ...

# 这是必需的！Ralph Loop 会使用它
verify:
  - pnpm lint
  - pnpm typecheck
```

**工作流**：
1. 设置会话级活动任务
2. 调用 `Task(subagent_type="implement")`
3. 调用 `Task(subagent_type="check")`
4. 当 Check Agent 完成时，Ralph Loop 运行 `verify` 命令
5. 人工提交

---

## 场景：自定义工作流

### 添加测试验证

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test          # 添加测试
```

### 添加构建验证

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm build         # 添加构建检查
```

### Go 项目

```yaml
verify:
  - go fmt ./...
  - go vet ./...
  - go test ./...
```

### Python 项目

```yaml
verify:
  - ruff check .
  - mypy .
  - pytest
```

### Rust 项目

```yaml
verify:
  - cargo fmt --check
  - cargo clippy
  - cargo test
```

---

## 场景：自定义 Worktree 创建

### 不同的包管理器

```yaml
post_create:
  # npm
  - npm install

  # 或 pnpm
  # - pnpm install --frozen-lockfile

  # 或 yarn
  # - yarn install --frozen-lockfile

  # 或 bun
  # - bun install
```

### 需要数据库迁移

```yaml
post_create:
  - pnpm install
  - pnpm db:migrate
  - pnpm db:seed
```

### 需要代码生成

```yaml
post_create:
  - pnpm install
  - pnpm codegen
  - pnpm prisma generate
```

### 复制额外文件

```yaml
copy:
  - .trellis/.developer
  - .env
  - .env.local
  - .npmrc                    # npm 私有注册表配置
  - firebase-credentials.json # Firebase 凭证
  - google-cloud-key.json     # GCP 凭证
```

---

## 当 worktree.yaml 缺失时

如果 `worktree.yaml` 不存在：

| 功能 | 行为 |
|---------|----------|
| Multi-Session | ❌ 无法启动（start.py 需要配置） |
| Multi-Agent | ⚠️ 可工作，但 Ralph Loop 使用完成标记 |

**Ralph Loop 回退行为**：
- 没有 `verify` 配置时，使用完成标记
- 从 `check.jsonl` 的 reason 字段生成标记
- 示例：`{"reason": "typecheck"}` → 期望 `TYPECHECK_FINISH`

---

## 最小配置

### 仅 Multi-Agent（当前目录）

```yaml
# .trellis/worktree.yaml
verify:
  - pnpm lint
  - pnpm typecheck
```

### 仅 Multi-Session（worktree）

```yaml
# .trellis/worktree.yaml
worktree_dir: ../worktrees
copy:
  - .trellis/.developer
post_create:
  - npm install
verify:
  - pnpm lint
  - pnpm typecheck
```

---

## 完整示例

### Node.js/TypeScript 项目

```yaml
worktree_dir: ../worktrees

copy:
  - .trellis/.developer
  - .env
  - .env.local

post_create:
  - pnpm install --frozen-lockfile

verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test
```

### Python 项目

```yaml
worktree_dir: ../worktrees

copy:
  - .trellis/.developer
  - .env
  - venv/              # 或重新创建 venv

post_create:
  - python -m venv venv
  - ./venv/bin/pip install -r requirements.txt

verify:
  - ./venv/bin/ruff check .
  - ./venv/bin/mypy .
  - ./venv/bin/pytest
```

### Go 项目

```yaml
worktree_dir: ../worktrees

copy:
  - .trellis/.developer
  - .env

post_create:
  - go mod download

verify:
  - go fmt ./...
  - go vet ./...
  - golangci-lint run
  - go test ./...
```

### Monorepo 项目

```yaml
worktree_dir: ../worktrees

copy:
  - .trellis/.developer
  - .env
  - .npmrc

post_create:
  - pnpm install --frozen-lockfile
  - pnpm -r build  # 构建所有包

verify:
  - pnpm -r lint
  - pnpm -r typecheck
  - pnpm -r test
```

---

## 验证命令注意事项

### Ralph Loop 常量

| 常量 | 值 | 描述 |
|----------|-------|-------------|
| `MAX_ITERATIONS` | 5 | 最大循环迭代次数 |
| `STATE_TIMEOUT_MINUTES` | 30 | 状态超时时间（分钟） |
| Command timeout | 120s | 每个验证命令的超时 |

### 超时

每个验证命令有 **120 秒**（2 分钟）超时。长时间运行的测试可能需要：
- 拆分测试
- 仅运行快速测试
- 修改 `ralph-loop.py` 中的 `COMMAND_TIMEOUT` 常量

### 退出码

- 退出码 0 = 通过
- 非零 = 失败，阻止 Check Agent 停止

### 顺序

命令按配置顺序运行，遇到第一个失败即停止。

推荐顺序：快 → 慢
```yaml
verify:
  - pnpm lint        # 快（秒级）
  - pnpm typecheck   # 中等（秒到分钟级）
  - pnpm test        # 慢（分钟级）
```

---

## YAML 解析器注意事项

Trellis 使用自定义 YAML 解析器（非 PyYAML），有以下限制：

### 支持的语法

```yaml
# 简单键值对
worktree_dir: ../worktrees

# 数组（2 空格缩进，以 - 开头）
copy:
  - .trellis/.developer
  - .env

# 带引号的值
worktree_dir: "../worktrees with spaces"
```

### 不支持的语法

```yaml
# ❌ 内联数组
copy: [.env, .npmrc]

# ❌ 复杂嵌套
nested:
  key:
    subkey: value

# ❌ 多行字符串
description: |
  Multiple
  lines
```

---

## 调试配置

### 查看当前配置

```bash
cat .trellis/worktree.yaml
```

### 测试验证命令

```bash
# 手动运行
pnpm lint && pnpm typecheck

# 或查看 Ralph Loop 状态
cat .trellis/.ralph-state.json
```

### 查看 worktree 状态

```bash
git worktree list
```

### Ralph Loop 调试

```bash
# 查看状态文件
cat .trellis/.ralph-state.json

# 示例输出
# {
#   "task": ".trellis/tasks/01-31-add-login",
#   "iteration": 2,
#   "started_at": "2026-01-31T10:30:00"
# }

# Ralph Loop 在超过 MAX_ITERATIONS（5）或 STATE_TIMEOUT_MINUTES（30）时自动停止
```