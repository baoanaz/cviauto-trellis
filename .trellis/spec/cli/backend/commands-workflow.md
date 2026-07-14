# `trellis workflow` 命令

`trellis workflow` 列出和切换项目活跃的 `.trellis/workflow.md` 模板。它是唯一在 init 后有意识原地替换现有 workflow 变体的命令。

## 场景：workflow marketplace 模板和切换器

### 1. 范围 / 触发器

触发器：添加一个面向用户的命令和 init 标志，用于更改运行时解析的模板、marketplace 查找行为和 `.trellis/.template-hashes.json` 所有权。

本规范适用于编辑以下内容时：

- `packages/cli/src/commands/workflow.ts`
- `packages/cli/src/utils/workflow-resolver.ts`
- `packages/cli/src/commands/init.ts` 的 workflow 选择代码
- `packages/cli/src/configurators/workflow.ts`
- `marketplace/workflows/**`
- workflow 相关测试

### 2. 签名

CLI 签名：

```text
trellis workflow
trellis workflow --list
trellis workflow --template <id>
trellis workflow --marketplace <source> --template <id>
trellis workflow --template <id> --force
trellis workflow --template <id> --create-new

trellis init --workflow <id>
trellis init --workflow-source <source> --workflow <id>
```

解析器签名：

```typescript
export const NATIVE_WORKFLOW_ID = "native";

export interface ResolvedWorkflowTemplate {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  content: string;
  source: "bundled" | "marketplace";
}

export interface WorkflowTemplateListing {
  id: string;
  type: "workflow";
  name: string;
  description?: string;
  path: string;
  source: "bundled" | "marketplace";
}

export function listWorkflowTemplates(options?: {
  source?: string;
}): Promise<{ templates: WorkflowTemplateListing[]; errorMessage?: string }>;

export function resolveWorkflowTemplate(
  id: string,
  options?: { source?: string },
): Promise<ResolvedWorkflowTemplate>;
```

配置器签名：

```typescript
export interface WorkflowOptions {
  projectType: ProjectType;
  skipSpecTemplates?: boolean;
  packages?: DetectedPackage[];
  remoteSpecPackages?: Set<string>;
  workflowMdOverride?: string;
}
```

### 3. 契约

Marketplace 条目使用 `type: "workflow"` 并指向一个 markdown 文件：

```json
{
  "id": "tdd",
  "type": "workflow",
  "name": "TDD Workflow",
  "description": "Trellis workflow variant that drives Phase 2 with one red / green / refactor behavior slice at a time",
  "path": "workflows/tdd/workflow.md",
  "tags": ["workflow", "tdd", "testing"]
}
```

必需的内置：

- `native`
- `tdd`
- `channel-driven-subagent-dispatch`

所有权契约：

- `native` 由 Trellis 管理。写入后，用 `updateHashes` 刷新 `.trellis/workflow.md` 哈希。
- 每个非原生 workflow 是用户管理的本地内容。写入后，用 `removeHash` 从 `.trellis/.template-hashes.json` 中移除 `.trellis/workflow.md`。
- 不要添加 `workflow.variant` 或任何其他长期存在的配置字段来使 `trellis update` 追踪所选变体。切换是显式的项目操作。

运行时解析器契约：

- 每个 workflow 模板必须保留 `## Phase Index`、`## Phase 1: Plan`、`#### X.Y` 步骤标题、平台标记语法和所有必需的 `[workflow-state:*]` 块。
- SessionStart、每回合 workflow-state hooks、`trellis-start` 和 `get_context.py --mode phase` 读取当前的 `.trellis/workflow.md`；不要在 hook 脚本或 skills 中复制变体特定行为。

原生权威来源契约：

- `packages/cli/src/templates/trellis/workflow.md` 是原生 workflow 的权威来源。
- 如果 `marketplace/workflows/native/workflow.md` 存在，测试必须强制它与捆绑的原生模板字节相同。

### 4. 验证与错误矩阵

| 条件 | 行为 |
|---|---|
| `trellis workflow --template <id>` 且当前 workflow 已修改 | Exit 1，指导使用 `--force` 或 `--create-new`；不提示，即使在 TTY 上 |
| 交互式 `trellis workflow` 选择器且当前 workflow 已修改 | 提示覆盖、create-new 或 skip |
| `--create-new` | 在 `.trellis/workflow.md` 旁边写入生成的 `workflow.md.new` 文件；不更改活跃 workflow 或哈希文件 |
| `--force` | 覆盖活跃 workflow 并应用原生/非原生哈希契约 |
| 缺少 workflow id | 抛出 `WorkflowResolveError` / 命令错误；CLI 以非零退出 |
| Marketplace 索引获取失败 | 列表仍可显示捆绑原生，带警告；resolve 失败并显示 workflow 特定错误 |
| Workflow 条目路径缺失、不是 `.md`、是绝对路径或包含 `..` | 失败并显示 workflow 特定错误 |
| `init --workflow missing-id` | 拒绝；不打印并返回成功 |
| `init --workflow tdd` | 写入 marketplace 内容并移除 `.trellis/workflow.md` 哈希 |
| 切换到非原生后 `trellis update` | 将 workflow 视为已修改/用户管理；永不静默恢复原生 |

### 5. Good/Base/Bad 案例

- Good：`trellis workflow --template tdd` 替换原始的原生 workflow，移除 workflow 哈希，之后 `trellis update --skip-all` 保留 TDD 内容。
- Base：`trellis init --workflow native` 写入捆绑的原生 workflow 并保持 `.trellis/workflow.md` 哈希跟踪。
- Bad：`trellis workflow --template tdd` 写入 TDD 内容并记录 TDD 哈希。下一次 `trellis update` 看到原始文件并用原生 workflow 覆盖它。

### 6. 所需测试

单元测试：

- `resolveWorkflowTemplate("native")` 返回捆绑内容，不 fetch。
- Marketplace workflow 解析 fetch `index.json` 和一个 markdown 文件。
- 缺失 id 错误提及 workflow 模板，而非 spec 模板。
- 无效/转义的 workflow 路径在 fetch 或文件读取之前失败。

集成测试：

- `init --workflow native` 保持 `.trellis/workflow.md` 哈希跟踪。
- `init --workflow tdd` 写入 marketplace 内容并移除哈希。
- `init --workflow-source <source> --workflow custom-id` 写入自定义内容。
- `init --workflow missing-id` 拒绝。
- `trellis workflow --template tdd` 写入 marketplace 内容并移除哈希。
- 显式 `--template` 在 workflow 已修改时失败，即使 `stdin.isTTY` 为 true。
- `--create-new` 在 `.trellis/workflow.md` 旁边写入生成的 `workflow.md.new` 文件，不触碰活跃 workflow 或哈希。
- 切换到非原生后 `trellis update` 不恢复原生。
- Marketplace 原生镜像（当镜像文件存在时）匹配捆绑的原生 workflow。
- 真实的 `marketplace/workflows/tdd/workflow.md` 计划面包屑包含 TDD 门控：可观测行为切片、被测公共接口和 mock 边界。

运行时解析验证：

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.2 --platform codex
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform codex-sub-agent
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform claude
```

### 7. Wrong vs Correct

#### Wrong

```typescript
// 将非原生内容记录为原始模板哈希。
fs.writeFileSync(".trellis/workflow.md", tddContent);
updateHashes(cwd, new Map([[PATHS.WORKFLOW_GUIDE_FILE, tddContent]]));
```

这使 `trellis update` 之后用捆绑的原生 workflow 自动替换 TDD。

#### Correct

```typescript
fs.writeFileSync(".trellis/workflow.md", tddContent);
removeHash(cwd, PATHS.WORKFLOW_GUIDE_FILE);
```

缺失哈希意味着 update 保守地将 workflow 视为用户管理的，并将其路由通过正常的已修改文件决策路径。

#### Wrong

```typescript
if (isInteractive()) {
  await promptForOverwrite();
}
```

显式 `trellis workflow --template tdd` 即使在它是可脚本化命令路径时也可能在 TTY 中挂起。

#### Correct

```typescript
const explicitTemplate = Boolean(options.template);
if (explicitTemplate || !isInteractive()) {
  throw new WorkflowCommandError("... use --force or --create-new ...");
}
```

仅无参数交互式选择器可以提示冲突解决。
