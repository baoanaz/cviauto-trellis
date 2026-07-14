---
name: gitnexus-exploring
description: "Use when the user asks how code works, wants to understand architecture, trace execution flows, or explore unfamiliar parts of the codebase. Examples: \"How does X work?\", \"What calls this function?\", \"Show me the auth flow\""
---

# 使用 GitNexus 探索代码库

## 何时使用

- "认证机制是怎么工作的？"
- "项目结构是怎样的？"
- "展示主要组件"
- "数据库逻辑在哪里？"
- 理解未曾接触过的代码

## 工作流程

```
1. READ gitnexus://repos                              → 发现已索引的仓库
2. READ gitnexus://repo/{name}/context                 → 代码库概览、检查索引新鲜度
3. query({query: "<你想理解的概念>"})                   → 查找相关执行流程
4. context({name: "<符号>"})                            → 深入了解特定符号
5. READ gitnexus://repo/{name}/process/{name}           → 追踪完整执行流程
```

> 如果步骤 2 提示 "Index is stale" → 在终端执行 `node .gitnexus/run.cjs analyze`。

## 检查清单

```
- [ ] READ gitnexus://repo/{name}/context
- [ ] query 搜索你想理解的概念
- [ ] 查看返回的流程（执行流程）
- [ ] context 查看关键符号的调用者/被调用者
- [ ] READ process 资源获取完整执行追踪
- [ ] 阅读源文件了解实现细节
```

## 资源

| 资源 (Resource)                         | 获取内容                                                  |
| --------------------------------------- | --------------------------------------------------------- |
| `gitnexus://repo/{name}/context`        | 统计信息、过期警告（约 150 tokens）                       |
| `gitnexus://repo/{name}/clusters`       | 所有功能区域及其内聚度评分（约 300 tokens）               |
| `gitnexus://repo/{name}/cluster/{name}` | 区域成员及文件路径（约 500 tokens）                       |
| `gitnexus://repo/{name}/process/{name}` | 逐步执行追踪（约 200 tokens）                             |

## 工具

**query** —— 查找与某个概念相关的执行流程：

```
query({query: "payment processing"})
→ 流程 (Processes): CheckoutFlow, RefundFlow, WebhookHandler
→ 按流程分组的符号及文件位置
```

**context** —— 符号的 360 度视图：

```
context({name: "validateUser"})
→ 入向调用 (Incoming calls): loginHandler, apiMiddleware
→ 出向调用 (Outgoing calls): checkToken, getUserById
→ 流程 (Processes): LoginFlow（步骤 2/5）、TokenRefresh（步骤 1/3）
```

## 示例："支付处理是怎么工作的？"

```
1. READ gitnexus://repo/my-app/context       → 918 个符号，45 个流程
2. query({query: "payment processing"})
   → CheckoutFlow: processPayment → validateCard → chargeStripe
   → RefundFlow: initiateRefund → calculateRefund → processRefund
3. context({name: "processPayment"})
   → 入向调用: checkoutHandler, webhookHandler
   → 出向调用: validateCard, chargeStripe, saveTransaction
4. 阅读 src/payments/processor.ts 了解实现细节
```
