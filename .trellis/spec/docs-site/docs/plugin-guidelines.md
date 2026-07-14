# 插件指南（Plugin Guidelines）

> Claude Code 插件清单（plugin manifest）模式和规范。

---

## 文件位置（File Location）

插件配置目录：`.claude-plugin/`（项目根目录）

```
.claude-plugin/
├── marketplace.json   # 市场清单（必需）
├── plugin.json        # 插件定义（必需）
└── README.md          # 安装文档（推荐）
```

---

## marketplace.json Schema

此文件定义了市场并列出了可用的插件。

### 必需字段（Required Fields）

| 字段（Field） | 类型（Type） | 描述（Description） |
| ---------- | ------ | ------------------------------- |
| `name`     | string | 市场标识符 |
| `owner`    | object | 所有者信息，包含 `name`、`email` |
| `metadata` | object | 包含 `description` |
| `plugins`  | array  | 插件定义列表 |

### 插件条目字段（Plugin Entry Fields）

| 字段（Field） | 类型（Type） | 是否必需 | 描述（Description） |
| ------------- | ------ | -------- | ------------------------- |
| `name`        | string | 是       | 插件标识符 |
| `source`      | string | 是       | 插件路径（相对路径）|
| `description` | string | 否       | 插件的功能描述 |
| `author`      | object | 否       | 包含 `name` 字段的对象 |
| `homepage`    | string | 否       | 插件主页 URL |
| `repository`  | string | 否       | 源码仓库 URL |
| `license`     | string | 否       | 许可证标识符 |
| `keywords`    | array  | 否       | 搜索关键词 |
| `category`    | string | 否       | 插件分类 |
| `tags`        | array  | 否       | 描述性标签 |

### 示例（Example）

```json
{
  "name": "my-marketplace",
  "owner": {
    "name": "Your Name",
    "email": "you@example.com"
  },
  "metadata": {
    "description": "Description of your marketplace"
  },
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./path/to/plugin",
      "description": "What this plugin does",
      "author": {
        "name": "Your Name"
      },
      "category": "workflow",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

---

## plugin.json Schema

此文件定义了插件本身。

### 必需字段（Required Fields）

| 字段（Field） | 类型（Type） | 描述（Description） |
| ------------- | ------ | -------------------- |
| `name`        | string | 插件标识符 |
| `version`     | string | 语义化版本号（Semantic version） |
| `description` | string | 插件的功能描述 |

### 可选字段（Optional Fields）

| 字段（Field） | 类型（Type） | 描述（Description） |
| ------------ | ------ | ---------------------------- |
| `author`     | object | 包含 `name` 和 `url` 的对象 |
| `homepage`   | string | 插件主页 URL |
| `repository` | string | 源码仓库 URL |
| `license`    | string | 许可证标识符 |
| `keywords`   | array  | 搜索关键词 |
| `skills`     | array  | skill 文件路径 |
| `agents`     | array  | agent 文件路径 |
| `commands`   | array  | command 文件路径 |

### 示例（Example）

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "What this plugin does",
  "author": {
    "name": "Your Name",
    "url": "https://github.com/you"
  },
  "homepage": "https://example.com",
  "repository": "https://github.com/you/repo",
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"],
  "skills": ["./skills/my-skill"]
}
```

---

## 常见错误（Common Mistakes）

### 错误：author 为字符串

**症状**：`plugins.0.author: Invalid input: expected object, received string`

```json
// ❌ 错误
{
  "author": "Your Name"
}

// ✅ 正确
{
  "author": {
    "name": "Your Name"
  }
}
```

### 错误：缺少 source 字段

**症状**：`plugins.0.source: Invalid input`

```json
// ❌ 错误——没有 source
{
  "plugins": [
    {
      "name": "my-plugin",
      "description": "..."
    }
  ]
}

// ✅ 正确——包含 source
{
  "plugins": [
    {
      "name": "my-plugin",
      "source": "./path/to/plugin",
      "description": "..."
    }
  ]
}
```

### 错误：缺少根级字段

**症状**：`name: expected string, received undefined` 或 `owner: expected object, received undefined`

```json
// ❌ 错误——缺少 name 和 owner
{
  "plugins": [...]
}

// ✅ 正确——包含所有根级字段
{
  "name": "marketplace-name",
  "owner": {
    "name": "Owner Name",
    "email": "email@example.com"
  },
  "metadata": {
    "description": "..."
  },
  "plugins": [...]
}
```

### 错误：plugin.json 中缺少 version

**症状**：验证静默失败或市场安装时失败

```json
// ❌ 错误——没有 version
{
  "name": "my-plugin",
  "description": "..."
}

// ✅ 正确——包含 version
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "..."
}
```

### 错误：组件字段为字符串而非数组

**症状**：`agents: Invalid input` 或类似提示

```json
// ❌ 错误——字符串值
{
  "skills": "./skills"
}

// ✅ 正确——数组值
{
  "skills": ["./skills/my-skill"]
}
```

### 错误：agents 使用目录路径

**症状**：agents 验证失败

```json
// ❌ 错误——目录路径
{
  "agents": ["./agents/"]
}

// ✅ 正确——显式文件路径
{
  "agents": [
    "./agents/planner.md",
    "./agents/reviewer.md"
  ]
}
```

> **注意**：`skills` 和 `commands` 可以使用目录路径，但 `agents` 必须使用显式文件路径。

### 错误：添加 hooks 字段

**症状**：`Duplicate hooks file detected`

```json
// ❌ 错误——显式声明 hooks
{
  "hooks": ["./hooks/hooks.json"]
}

// ✅ 正确——没有 hooks 字段
{
  // hooks/hooks.json 按约定自动加载
}
```

> **警告**：Claude Code v2.1+ 按约定自动加载 `hooks/hooks.json`。显式添加会导致重复错误。

---

## 验证（Validation）

发布前验证你的插件：

```bash
claude plugin validate .claude-plugin/plugin.json
```

或从 Claude Code 内部：

```
/plugin validate .
```

---

## 最佳实践（Best Practices）

### DO

- 在 plugin.json 中包含 `version`
- 使用对象格式表示 `author`（而非字符串）
- 始终在插件条目中包含 `source`
- 对组件字段使用数组（`skills`、`agents`、`commands`）
- 对 `agents` 使用显式文件路径
- 添加带有安装说明的 README.md

### DON'T

- 对 `author` 使用字符串值
- 省略必需的根级字段（`name`、`owner`）
- 对 `agents` 使用目录路径
- 添加显式的 `hooks` 字段（按约定自动加载）
- 忘记在发布前进行验证

---

## 参考（Reference）

- [Claude Code Plugin Docs](https://code.claude.com/docs/en/plugin-marketplaces)
- [everything-claude-code example](https://github.com/affaan-m/everything-claude-code/tree/main/.claude-plugin)
