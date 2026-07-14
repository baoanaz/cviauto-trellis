# How To：修改验证命令

添加或修改 Ralph Loop 验证命令。

**平台**：仅 Claude Code（Ralph Loop）

---

## 需修改的文件

| 文件 | 操作 | 是否必需 |
|------|--------|----------|
| `.trellis/worktree.yaml` | 修改 | 是 |

---

## 步骤 1：编辑 worktree.yaml

打开 `.trellis/worktree.yaml`，修改 `verify` 部分：

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test          # 添加此行
```

---

## 常见场景

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

### 添加特定测试套件

```yaml
verify:
  - pnpm lint
  - pnpm typecheck
  - pnpm test:unit        # 仅快速单元测试
```

### 不同语言

**Go:**
```yaml
verify:
  - go fmt ./...
  - go vet ./...
  - golangci-lint run
  - go test ./...
```

**Python:**
```yaml
verify:
  - ruff check .
  - mypy .
  - pytest -x
```

**Rust:**
```yaml
verify:
  - cargo fmt --check
  - cargo clippy
  - cargo test
```

---

## 执行细节

### 执行顺序

命令按顺序执行。首个失败即停止执行。

**推荐顺序**：快 → 慢

```yaml
verify:
  - pnpm lint        # ~2 秒
  - pnpm typecheck   # ~10 秒
  - pnpm test:unit   # ~30 秒
  - pnpm build       # ~60 秒
```

### 超时

每个命令有 120 秒超时。

对于长时间运行的命令：
- 拆分为更小的块
- 为 Ralph Loop 使用更快的子集
- 手动运行完整套件

### 退出码

- 退出 0 = 通过
- 非零 = 失败，agent 继续执行

---

## 测试

### 手动测试

```bash
# 手动运行命令
pnpm lint && pnpm typecheck && pnpm test

# 应全部通过，Ralph Loop 才允许停止
```

### 集成测试

1. 制造一个会导致 lint 失败的变更
2. 运行 check agent
3. 验证 Ralph Loop 阻止并显示错误
4. 修复问题
5. 验证 Ralph Loop 允许停止

---

## 故障排查

### 命令未找到

确保命令可用：

```bash
which pnpm  # 或 npm、yarn 等
```

### 超时问题

在 `ralph-loop.py` 中增加超时：

```python
COMMAND_TIMEOUT = 180  # 默认值为 120
```

### 临时跳过验证

注释掉命令：

```yaml
verify:
  - pnpm lint
  # - pnpm typecheck  # 临时跳过
```

---

## 检查清单

- [ ] 命令已添加到 worktree.yaml
- [ ] 命令已手动测试
- [ ] 顺序为快 → 慢
- [ ] 无超时问题