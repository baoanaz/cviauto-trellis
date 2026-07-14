# MCP 设置

GitNexus 和 ABCoder 是在引导 Trellis 规格（spec）时推荐使用的工具，因为它们能向 agent 暴露架构和 AST 上下文。它们是工具选择，而非平台要求。请通过你的 agent 宿主提供的任何 MCP 机制来配置它们。

## GitNexus

GitNexus 从仓库构建代码知识图谱。用于模块边界、执行流程、依赖关系、影响范围（blast radius）和图查询。

### 安装与索引

```bash
# 从仓库根目录运行。
npx gitnexus analyze

# 检查索引状态。
npx gitnexus status

# 代码变更后，当分析结果过时时重新索引。
npx gitnexus analyze
```

索引写入 `.gitnexus/` 目录。仅在项目已使用嵌入（embeddings）时才保留它们；否则，普通索引就足以支持 spec 引导。

### MCP 服务器命令

在宿主 MCP 配置中使用以下服务器命令：

```bash
npx -y gitnexus mcp
```

### 常用工具

| 工具 | 用途 |
|------|---------|
| `gitnexus_query` | 按概念查找执行流程和功能区域 |
| `gitnexus_context` | 检查某个符号的调用者、被调用者、引用以及参与的执行流程 |
| `gitnexus_impact` | 在修改某个符号之前了解其影响范围 |
| `gitnexus_detect_changes` | 在完成前检查变更的符号和受影响的功能流程 |
| `gitnexus_cypher` | 运行直接图查询 |
| `gitnexus_list_repos` | 列出已索引的仓库 |

## ABCoder

ABCoder 将代码解析为 UniAST，并提供精确的包、文件和节点级结构。用于签名、类型形态、实现、依赖关系和反向引用。

### 安装

```bash
go install github.com/cloudwego/abcoder@latest
abcoder --help
```

### 解析仓库

```bash
abcoder parse /absolute/path/to/package \
  --lang typescript \
  --name package-name \
  --output ~/abcoder-asts
```

对于 monorepo，使用稳定的 `--name` 解析每个包，以便任务笔记可以引用相同的仓库名称。

### MCP 服务器命令

在宿主 MCP 配置中使用以下服务器命令：

```bash
abcoder mcp ~/abcoder-asts
```

### 常用工具

| 工具 | 层级 | 用途 |
|------|-------|---------|
| `list_repos` | 1 | 列出已解析的仓库 |
| `get_repo_structure` | 2 | 检查包和文件 |
| `get_package_structure` | 3 | 检查包内的节点 |
| `get_file_structure` | 3 | 检查文件中的函数、类、类型和签名 |
| `get_ast_node` | 4 | 检索代码、依赖关系、引用和实现 |

## 验证

配置完成后，从 agent 宿主验证两个 MCP 服务器均可见。然后在开始 spec 编写之前，对每个服务器运行一个简单查询。

```bash
ls .gitnexus/meta.json
ls ~/abcoder-asts/*.json
```