# 仓库分析

目标是在编写规则之前发现项目的真实架构。不要从通用 spec 模板开始填空，而应从代码出发，让 spec 结构跟随代码。

## 分析顺序

1. 阅读现有的 `.cviauto/spec/` 目录树，注意哪些文件是模板、哪些已过时、哪些已针对项目定制。
2. 检查包清单、构建脚本、工作区配置和顶层文档，以识别包和运行时分层。
3. 使用 GitNexus 获取执行流程、模块集群、依赖枢纽和影响敏感区域。
4. 使用 ABCoder 或语言原生工具获取精确的签名、类型、类边界和实现示例。
5. 在将任何发现转化为 spec 规则之前，直接阅读有代表性的源文件和测试文件。

## 需要捕获的内容

| 领域 | 要回答的问题 |
|------|-----------|
| 包边界 | 每个包拥有什么？哪些导入跨越了边界？ |
| 运行时分层 | 哪些代码是 CLI、后端、前端、worker、共享库、仅测试代码或工具？ |
| 核心抽象 | 哪些类型、服务、存储、命令、路由或适配器定义了系统形态？ |
| 数据流 | 用户输入从哪里进入，如何验证，状态在哪里持久化？ |
| 错误处理 | 失败如何表示、记录、暴露和测试？ |
| 配置 | 默认值、环境配置、生成文件和模板分别存放在哪里？ |
| 测试 | 哪些测试风格可以作为新工作的可信范例？ |

## GitNexus 用法

从宽泛入手，然后检查具体符号：

```text
gitnexus_query({query: "CLI command execution flow"})
gitnexus_query({query: "template generation and migration"})
gitnexus_context({name: "SymbolName"})
gitnexus_cypher({query: "MATCH (n)-[r]->(m) RETURN n.name, type(r), m.name LIMIT 30"})
```

使用 GitNexus 结果来查找重要文件和流程。在检查相关源文件之前，不要将图输出作为最终权威。

## ABCoder 用法

当 spec 需要精确的代码形态时使用 ABCoder：

```text
list_repos()
get_repo_structure({repo_name: "package-name"})
get_file_structure({repo_name: "package-name", file_path: "src/example.ts"})
get_ast_node({repo_name: "package-name", node_ids: [{mod_path: "...", pkg_path: "...", name: "SymbolName"}]})
```

ABCoder 在记录构造器模式、函数签名、类型契约和引用链时最有价值。

## 分析笔记

分析时保持简短记录。笔记应包含：

- 包或层名称。
- 定义了本地模式的文件。
- spec 应教授的规则。
- 在旧代码、注释、测试或迁移路径中发现的的反模式（anti-pattern）。
- 应创建、删除、重命名或合并的 spec 文件。