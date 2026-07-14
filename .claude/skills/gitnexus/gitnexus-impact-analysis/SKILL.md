---
name: gitnexus-impact-analysis
description: "Use when the user wants to know what will break if they change something, or needs safety analysis before editing code. Examples: \"Is it safe to change X?\", \"What depends on this?\", \"What will break?\""
---

# 使用 GitNexus 进行影响分析

## 何时使用

- "改动这个函数安全吗？"
- "如果我修改 X，什么会崩溃？"
- "显示爆炸半径"
- "谁在使用这段代码？"
- 在进行非平凡的代码变更之前
- 提交前 —— 了解你的改动会影响什么

## 工作流程

```
1. impact({target: "X", direction: "upstream"})   → 什么依赖于此
2. READ gitnexus://repo/{name}/processes                     → 检查受影响的执行流程
3. detect_changes()                                   → 将当前 git 变更映射到受影响的流程
4. 评估风险并报告给用户
```

> 如果提示 "Index is stale" → 在终端执行 `node .gitnexus/run.cjs analyze`。

## 检查清单

```
- [ ] impact({target, direction: "upstream"}) 查找依赖项
- [ ] 首先审查 d=1 的项目（这些必然崩溃）
- [ ] 检查高置信度（>0.8）的依赖项
- [ ] READ processes 检查受影响的执行流程
- [ ] detect_changes() 用于提交前检查
- [ ] 评估风险等级并报告给用户
```

## 理解输出

| 深度 | 风险等级           | 含义                     |
| ---- | ------------------ | ------------------------ |
| d=1  | **必然崩溃**       | 直接调用者/导入者         |
| d=2  | 可能受影响         | 间接依赖                 |
| d=3  | 可能需要测试       | 传递性影响               |

## 风险评估

| 受影响范围                             | 风险     |
| -------------------------------------- | -------- |
| <5 个符号，少量流程                    | 低 (LOW)  |
| 5-15 个符号，2-5 个流程                | 中 (MEDIUM) |
| >15 个符号或大量流程                   | 高 (HIGH) |
| 关键路径（认证、支付）                 | 严重 (CRITICAL) |

## 工具

**impact** —— 符号爆炸半径的主要工具：

```
impact({
  target: "validateUser",
  direction: "upstream",
  minConfidence: 0.8,
  maxDepth: 3
})

→ d=1（必然崩溃）:
  - loginHandler (src/auth/login.ts:42) [CALLS, 100%]
  - apiMiddleware (src/api/middleware.ts:15) [CALLS, 100%]

→ d=2（可能受影响）:
  - authRouter (src/routes/auth.ts:22) [CALLS, 95%]
```

**detect_changes** —— 基于 git-diff 的影响分析：

```
detect_changes({scope: "staged"})

→ 已变更: 3 个文件中的 5 个符号
→ 受影响: LoginFlow, TokenRefresh, APIMiddlewarePipeline
→ 风险: 中 (MEDIUM)
```

## 示例："改动 validateUser 会导致什么崩溃？"

```
1. impact({target: "validateUser", direction: "upstream"})
   → d=1: loginHandler, apiMiddleware（必然崩溃）
   → d=2: authRouter, sessionManager（可能受影响）

2. READ gitnexus://repo/my-app/processes
   → LoginFlow 和 TokenRefresh 涉及 validateUser

3. 风险: 2 个直接调用者，2 个流程 = 中 (MEDIUM)
```
