---
name: gitnexus-guide
description: "Use when the user asks about GitNexus itself — available tools, how to query the knowledge graph, MCP resources, graph schema, or workflow reference. Examples: \"What GitNexus tools are available?\", \"How do I use GitNexus?\""
---

# GitNexus 指南

GitNexus 所有 MCP 工具、资源及知识图谱 schema 的快速参考。

## 始终从这里开始

对于任何涉及代码理解、调试、影响分析或重构的任务：

1. **读取 `gitnexus://repo/{name}/context`** —— 代码库概览 + 检查索引新鲜度
2. **将你的任务与下方技能匹配**，并**阅读对应的技能文件**
3. **遵循该技能的工作流程和检查清单**

> 如果步骤 1 警告索引已过期，请先在终端执行 `node .gitnexus/run.cjs analyze`。

## 技能

| 任务                                           | 应阅读的技能         |
| ---------------------------------------------- | -------------------- |
| 理解架构 / "X 是怎么工作的？"                  | `gitnexus-exploring`         |
| 爆炸半径 / "改动 X 会导致什么崩溃？"           | `gitnexus-impact-analysis`   |
| 追踪 bug / "X 为什么失败？"                    | `gitnexus-debugging`         |
| 重命名 / 提取 / 拆分 / 重构                    | `gitnexus-refactoring`       |
| 工具、资源、schema 参考                        | `gitnexus-guide`（本文件）   |
| 索引、状态、清理、wiki 等 CLI 命令             | `gitnexus-cli`               |

## 工具参考

| 工具 (Tool)      | 用途                                                         |
| ---------------- | ------------------------------------------------------------ |
| `query`          | 按流程分组的代码智能 —— 与某个概念相关的执行流程             |
| `context`        | 符号 360 度视图 —— 分类的引用、参与的流程                    |
| `impact`         | 符号爆炸半径 —— 深度 1/2/3 级别有哪些会崩溃，附带置信度      |
| `detect_changes` | Git-diff 影响分析 —— 当前变更会影响什么                      |
| `rename`         | 多文件协调重命名，附带置信度标记的编辑                       |
| `cypher`         | 原始图谱查询（请先阅读 `gitnexus://repo/{name}/schema`）     |
| `list_repos`     | 发现已索引的仓库                                             |

## 资源参考

轻量级读取（约 100-500 tokens），用于导航：

| 资源 (Resource)                                 | 内容                                     |
| ----------------------------------------------- | ---------------------------------------- |
| `gitnexus://repo/{name}/context`                | 统计信息、过期检查                       |
| `gitnexus://repo/{name}/clusters`               | 所有功能区域及内聚度评分                 |
| `gitnexus://repo/{name}/cluster/{clusterName}`  | 区域成员                                 |
| `gitnexus://repo/{name}/processes`              | 所有执行流程                             |
| `gitnexus://repo/{name}/process/{processName}`  | 逐步追踪                                 |
| `gitnexus://repo/{name}/schema`                 | Cypher 查询用的图谱 schema               |

## 图谱 Schema

**节点 (Nodes):** File、Function、Class、Interface、Method、Community、Process
**边 (Edges，通过 CodeRelation.type):** CALLS、IMPORTS、EXTENDS、IMPLEMENTS、DEFINES、MEMBER_OF、STEP_IN_PROCESS

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "myFunc"})
RETURN caller.name, caller.filePath
```
