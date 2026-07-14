---
name: gitnexus-debugging
description: "Use when the user is debugging a bug, tracing an error, or asking why something fails. Examples: \"Why is X failing?\", \"Where does this error come from?\", \"Trace this bug\""
---

# 使用 GitNexus 进行调试

## 何时使用

- "这个函数为什么失败？"
- "追踪这个错误的来源"
- "谁调用了这个方法？"
- "这个端点返回 500"
- 调查 bug、错误或意外行为

## 工作流程

```
1. query({query: "<错误或症状>"})                   → 查找相关的执行流程
2. context({name: "<嫌疑符号>"})                    → 查看调用者/被调用者/流程
3. READ gitnexus://repo/{name}/process/{name}                 → 追踪执行流程
4. cypher({query: "MATCH path..."})                   → 按需自定义追踪
```

> 如果提示 "Index is stale" → 在终端执行 `node .gitnexus/run.cjs analyze`。

## 检查清单

```
- [ ] 理解症状（错误消息、意外行为）
- [ ] query 搜索错误文本或相关代码
- [ ] 从返回的流程中识别嫌疑函数
- [ ] context 查看调用者和被调用者
- [ ] 如适用，通过 process 资源追踪执行流程
- [ ] 如需自定义调用链追踪，使用 cypher
- [ ] 阅读源文件以确认根本原因
```

## 调试模式

| 症状                 | GitNexus 方法                                                |
| -------------------- | ------------------------------------------------------------ |
| 错误消息             | `query` 搜索错误文本 → `context` 检查抛出点                  |
| 返回值异常           | `context` 检查函数 → 追踪被调用者的数据流                    |
| 间歇性失败           | `context` → 查找外部调用、异步依赖                           |
| 性能问题             | `context` → 查找被大量调用者引用的符号（热点路径）           |
| 近期回归             | `detect_changes` 查看你的改动影响了什么                      |

## 工具

**query** —— 查找与错误相关的代码：

```
query({query: "payment validation error"})
→ 流程 (Processes): CheckoutFlow, ErrorHandling
→ 符号 (Symbols): validatePayment, handlePaymentError, PaymentException
```

**context** —— 获取嫌疑符号的完整上下文：

```
context({name: "validatePayment"})
→ 入向调用 (Incoming calls): processCheckout, webhookHandler
→ 出向调用 (Outgoing calls): verifyCard, fetchRates（外部 API！）
→ 流程 (Processes): CheckoutFlow（步骤 3/7）
```

**cypher** —— 自定义调用链追踪：

```cypher
MATCH path = (a)-[:CodeRelation {type: 'CALLS'}*1..2]->(b:Function {name: "validatePayment"})
RETURN [n IN nodes(path) | n.name] AS chain
```

## 示例："支付端点间歇性返回 500"

```
1. query({query: "payment error handling"})
   → 流程: CheckoutFlow, ErrorHandling
   → 符号: validatePayment, handlePaymentError

2. context({name: "validatePayment"})
   → 出向调用: verifyCard, fetchRates（外部 API！）

3. READ gitnexus://repo/my-app/process/CheckoutFlow
   → 步骤 3: validatePayment → 调用 fetchRates（外部）

4. 根本原因: fetchRates 调用外部 API 时未设置合适的超时时间
```
