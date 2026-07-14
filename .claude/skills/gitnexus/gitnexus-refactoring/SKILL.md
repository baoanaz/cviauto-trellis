---
name: gitnexus-refactoring
description: "Use when the user wants to rename, extract, split, move, or restructure code safely. Examples: \"Rename this function\", \"Extract this into a module\", \"Refactor this class\", \"Move this to a separate file\""
---

# 使用 GitNexus 进行重构

## 何时使用

- "安全地重命名这个函数"
- "把这个提取成一个模块"
- "拆分这个服务"
- "把这个移到新文件"
- 任何涉及重命名、提取、拆分或重组代码的任务

## 工作流程

```
1. impact({target: "X", direction: "upstream"})   → 映射所有依赖项
2. query({query: "X"})                              → 查找涉及 X 的执行流程
3. context({name: "X"})                             → 查看所有入向/出向引用
4. 规划更新顺序: 接口 → 实现 → 调用者 → 测试
```

> 如果提示 "Index is stale" → 在终端执行 `node .gitnexus/run.cjs analyze`。

## 检查清单

### 重命名符号

```
- [ ] rename({symbol_name: "oldName", new_name: "newName", dry_run: true}) —— 预览所有编辑
- [ ] 审查图谱编辑（高置信度）和 ast_search 编辑（仔细审查）
- [ ] 如满意: rename({..., dry_run: false}) —— 应用编辑
- [ ] detect_changes() —— 验证只有预期的文件被修改
- [ ] 对受影响的流程运行测试
```

### 提取模块

```
- [ ] context({name: target}) —— 查看所有入向/出向引用
- [ ] impact({target, direction: "upstream"}) —— 查找所有外部调用者
- [ ] 定义新模块接口
- [ ] 提取代码，更新导入
- [ ] detect_changes() —— 验证受影响的 scope
- [ ] 对受影响的流程运行测试
```

### 拆分函数/服务

```
- [ ] context({name: target}) —— 理解所有被调用者
- [ ] 按职责将被调用者分组
- [ ] impact({target, direction: "upstream"}) —— 映射需要更新的调用者
- [ ] 创建新的函数/服务
- [ ] 更新调用者
- [ ] detect_changes() —— 验证受影响的 scope
- [ ] 对受影响的流程运行测试
```

## 工具

**rename** —— 自动化多文件重命名：

```
rename({symbol_name: "validateUser", new_name: "authenticateUser", dry_run: true})
→ 12 处编辑，涉及 8 个文件
→ 10 处图谱编辑（高置信度），2 处 ast_search 编辑（需审查）
→ 变更: [{file_path, edits: [{line, old_text, new_text, confidence}]}]
```

**impact** —— 首先映射所有依赖项：

```
impact({target: "validateUser", direction: "upstream"})
→ d=1: loginHandler, apiMiddleware, testUtils
→ 受影响的流程: LoginFlow, TokenRefresh
```

**detect_changes** —— 重构后验证你的变更：

```
detect_changes({scope: "all"})
→ 已变更: 8 个文件，12 个符号
→ 受影响的流程: LoginFlow, TokenRefresh
→ 风险: 中 (MEDIUM)
```

**cypher** —— 自定义引用查询：

```cypher
MATCH (caller)-[:CodeRelation {type: 'CALLS'}]->(f:Function {name: "validateUser"})
RETURN caller.name, caller.filePath ORDER BY caller.filePath
```

## 风险规则

| 风险因素             | 缓解措施                                    |
| -------------------- | ------------------------------------------- |
| 调用者数量多（>5）   | 使用 rename 进行自动化更新                  |
| 跨区域引用           | 之后使用 detect_changes 验证 scope          |
| 字符串/动态引用      | 使用 query 来查找                           |
| 外部/公共 API        | 正确进行版本控制和弃用标记                  |

## 示例：将 `validateUser` 重命名为 `authenticateUser`

```
1. rename({symbol_name: "validateUser", new_name: "authenticateUser", dry_run: true})
   → 12 处编辑: 10 处图谱（安全），2 处 ast_search（需审查）
   → 文件: validator.ts, login.ts, middleware.ts, config.json...

2. 审查 ast_search 编辑（config.json: 动态引用！）

3. rename({symbol_name: "validateUser", new_name: "authenticateUser", dry_run: false})
   → 已应用 12 处编辑，涉及 8 个文件

4. detect_changes({scope: "all"})
   → 受影响: LoginFlow, TokenRefresh
   → 风险: 中 (MEDIUM) —— 对这些流程运行测试
```
