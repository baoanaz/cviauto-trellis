# 跨平台思维指南（Cross-Platform Thinking Guide）

> **用途**：在平台特定假设变成 bug 之前捕获它们。

---

## 为什么这很重要（Why This Matters）

**大多数跨平台 bug 来源于隐式假设**：

- 假设 shebang 有效 → 在 Windows 上失败
- 假设 `/` 路径分隔符 → 在 Windows 上失败
- 假设 `\n` 行尾 → 不一致的行为
- 假设命令可用 → `grep` vs `findstr`

---

## 平台差异检查清单

### 1. 脚本执行（Script Execution）

| 假设 | macOS/Linux | Windows |
|------------|-------------|---------|
| Shebang（`#!/usr/bin/env python3`） | ✅ 有效 | ❌ 忽略 |
| 直接执行（`./script.py`） | ✅ 有效 | ❌ 失败 |
| `python3` 命令 | ✅ 始终可用 | ⚠️ 可能需要 `python` |
| `python` 命令 | ⚠️ 可能是 Python 2 | ✅ 通常是 Python 3 |

**规则 1**：对于面向用户的文档、帮助文本和错误消息，要么：

- 显式说明平台规则（Windows 上使用 `python`，其他地方使用 `python3`），或者
- 通过代码使用的同一个平台感知辅助函数/占位符来渲染命令。

```python
# 坏——假设 shebang 有效
print("Usage: ./script.py <args>")
print("Run: script.py <args>")

# 好——平台感知的措辞
print("Usage: python on Windows, python3 elsewhere")
print("Run: {{PYTHON_CMD}} ./.trellis/scripts/task.py <args>")
```

**规则 2**：在 init 时生成配置文件时，使用占位符 + 平台检测：

```typescript
// 在模板文件中（settings.json）:
{ "command": "{{PYTHON_CMD}} .claude/hooks/script.py" }

// 在 configurator 中：
function getPythonCommand(): string {
  return process.platform === "win32" ? "python" : "python3";
}

function replacePlaceholders(content: string): string {
  return content.replace(/\{\{PYTHON_CMD\}\}/g, getPythonCommand());
}
```

**规则 3**：在运行时从 JavaScript 调用 Python 时，动态检测平台：

```javascript
import { platform } from "os"

const PYTHON_CMD = platform() === "win32" ? "python" : "python3"
execSync(`${PYTHON_CMD} "${scriptPath}"`, { ... })
```

**规则 4**：如果你需要验证 Python 是否确实已安装（而不仅仅是选择命令），探测与你稍后将渲染或执行的相同平台选择的别名：

```typescript
function getPythonCommand(platform = process.platform): string {
  return platform === "win32" ? "python" : "python3";
}

function warnIfPythonTooOld(): void {
  const cmd = getPythonCommand();
  try {
    execSync(`${cmd} --version`, { stdio: "pipe" });
  } catch {
    // 缺少 Python 是单独的错误路径；不要静默切换别名。
  }
}
```

**规则 5**：不要假设 AI CLI 使用的 Python 版本与你的 shell 中的 `python3` 匹配。用户的终端可能解析 `python3` → homebrew 3.11，但 AI CLI 主机（含企业分支版 Claude Code / Cursor 发行版）使用最小的 PATH 生成 hook 子进程，该 PATH 将 `python3` 解析为 `/usr/bin/python3` → macOS 系统 3.9。分布式模板必须针对最低合理版本，或对 PEP 604 语法使用 `from __future__ import annotations`。参见 `cli/backend/script-conventions.md` → **CRITICAL: PEP 604 Annotations Require `from __future__ import annotations`** 中的硬性规则和审计检查。

**规则 6**：从 Python 调用 Python 时，使用 `sys.executable`：

```python
import sys
import subprocess

# 坏——硬编码命令
subprocess.run(["python3", "other_script.py"])

# 好——使用当前解释器
subprocess.run([sys.executable, "other_script.py"])
```

### 2. 路径处理（Path Handling）

| 假设 | macOS/Linux | Windows |
|------------|-------------|---------|
| `/` 分隔符 | ✅ 有效 | ⚠️ 有时有效 |
| `\` 分隔符 | ❌ 转义字符 | ✅ 原生 |
| `pathlib.Path` | ✅ 有效 | ✅ 有效 |

**规则（Python）**：对所有路径操作使用 `pathlib.Path`。

```python
# 坏——字符串拼接
path = base + "/" + filename

# 好——pathlib
from pathlib import Path
path = Path(base) / filename
```

#### 逻辑键 vs 文件系统路径（TypeScript）

路径字符串有两个不同的角色。**区别对待它们。**

| 角色（Role） | OS 原生（Windows 上为 `\`） | 始终 POSIX（`/`） |
|------|---------------------------|--------------------|
| 用于文件系统调用的 `fs.readFileSync(p)` / `path.join(cwd, x)` | ✅ 必需 | ❌ 在 Windows 上可能失败 |
| `Map<relPath, content>` 键、JSON 字段、哈希字典键、任何跨 OS 持久化的内容 | ❌ 跨 OS 不匹配 | ✅ 必需 |

**规则**：任何路径字符串跨越 OS 或持久化（被另一个 OS 消费的 Map 键、JSON 字段、哈希字典键），规范化为 POSIX。任何直接传给 `fs.*` 的，保持 OS 原生。

**单一真实来源**：`packages/cli/src/utils/posix.ts` 导出 `toPosix(p)`。不要在每个 `path.join` 位置撒 `replaceAll('\\', '/')`——在边界应用一次 `toPosix`：收集器出口（Map 键进入哈希字典）或写入时（`saveHashes` 在 `JSON.stringify` 之前）。

```typescript
// 坏——逻辑键带有 OS 原生分隔符
function collectTemplates(): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of walk(dir)) {
    files.set(path.join(".opencode", entry), readFile(entry));  // Windows 上为 \
  }
  return files;
}

// 好——在边界标准化
import { toPosix } from "../utils/posix.js";

function collectTemplates(): Map<string, string> {
  const files = new Map<string, string>();
  for (const entry of walk(dir)) {
    files.set(toPosix(path.join(".opencode", entry)), readFile(entry));
  }
  return files;
}

// 也可接受——写入端防御（用于像 saveHashes 这样的存储辅助函数）
function saveHashes(cwd: string, hashes: Record<string, string>): void {
  const normalized = Object.fromEntries(
    Object.entries(hashes).map(([k, v]) => [toPosix(k), v])
  );
  fs.writeFileSync(getHashesPath(cwd), JSON.stringify(normalized, null, 2));
}
```

**常见违规者**：`path.relative(cwd, fullPath)` 在 Windows 上会产生 `\`。如果你随后将该字符串用作哈希字典查找键（`hashes[relPath]`），请先对其 `toPosix`，否则在 Windows 上查找会失败。

### 3. 行尾（Line Endings）

| 格式（Format） | macOS/Linux | Windows | Git |
|--------|-------------|---------|-----|
| `\n`（LF） | ✅ 原生 | ⚠️ 某些工具 | ✅ 已标准化 |
| `\r\n`（CRLF） | ⚠️ 额外字符 | ✅ 原生 | 已转换 |

**规则 1**：使用 `.gitattributes` 强制执行一致的行尾。

```gitattributes
* text=auto eol=lf
*.sh text eol=lf
*.py text eol=lf
```

**规则 2**：在跨平台对**内容**进行哈希或比较时，在计算哈希之前标准化行尾。`.gitattributes` 仅管理 git checkout——由用户、脚本或 `core.autocrlf=true` 写入的文件仍可能以 CRLF 到达，而对其他方面完全相同的内容来说 `sha256(LF)` ≠ `sha256(CRLF)`。

```typescript
// 坏——使用 autocrlf=true 的 Windows 用户得到不同的哈希
export function computeHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

// 好——哈希前标准化，使逻辑内容哈希一致
export function computeHash(content: string): string {
  const normalized = content.replace(/\r\n/g, "\n");
  return createHash("sha256").update(normalized, "utf-8").digest("hex");
}
```

将此规则应用于哈希跨越 OS 边界的任何地方（模板哈希字典、存储在 JSON 中的内容指纹、针对远程 registry 的完整性检查）。

### 4. 环境变量（Environment Variables）

| 变量（Variable） | macOS/Linux | Windows |
|----------|-------------|---------|
| `HOME` | ✅ 已设置 | ❌ 使用 `USERPROFILE` |
| `PATH` 分隔符 | `:` | `;` |
| 大小写敏感性 | ✅ 大小写敏感 | ❌ 大小写不敏感 |

**规则 1**：使用 `pathlib.Path.home()` 替代环境变量。

```python
# 坏
home = os.environ.get("HOME")

# 好
home = Path.home()
```

**规则 2**：当向 shell 命令注入环境变量时，为将要解析该命令的实际 shell 生成前缀。不要仅凭操作系统选择语法。Windows 上的 AI 工具 "Bash" 表面可能通过 PowerShell、Git Bash、MSYS2 或其他类 POSIX shell 执行。

```javascript
// 坏——当宿主 shell 是 PowerShell 时出错
command = `export TRELLIS_CONTEXT_ID=${shellQuote(contextKey)}; ${command}`;

// 好——shell 方言感知的命令前缀
const prefix = process.platform === "win32" && !isWindowsPosixShell(process.env)
  ? `$env:TRELLIS_CONTEXT_ID = ${powershellQuote(contextKey)}; `
  : `export TRELLIS_CONTEXT_ID=${shellQuote(contextKey)}; `;
command = `${prefix}${command}`;
```

在 Windows 上，将 `MSYSTEM`、`MINGW_PREFIX`、`OSTYPE=msys|mingw|cygwin`、`SHELL=...bash` 或平台特定的 Git Bash 设置视为 POSIX shell 信号。当没有 POSIX shell 信号时，保持 PowerShell 作为 Windows 默认。

同时使重复注入检测是 shell 感知的。仅匹配 `export VAR=` 的 guard 会遗漏 PowerShell 的 `$env:VAR = ...` 形式，并可能将已经正确的命令再次包装一次。

### 5. 命令可用性（Command Availability）

| 命令（Command） | macOS/Linux | Windows |
|---------|-------------|---------|
| `grep` | ✅ 内建 | ❌ 不可用 |
| `find` | ✅ 内建 | ⚠️ 语法不同 |
| `cat` | ✅ 内建 | ❌ 使用 `type` |
| `tail -f` | ✅ 内建 | ❌ 不可用 |

**规则**：尽可能使用 Python 标准库替代 shell 命令。

```python
# 坏——tail -f 在 Windows 上不可用
subprocess.run(["tail", "-f", log_file])

# 好——跨平台实现
def tail_follow(file_path: Path) -> None:
    """Follow a file like 'tail -f', cross-platform compatible."""
    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        f.seek(0, 2)  # Go to end
        while True:
            line = f.readline()
            if line:
                print(line, end="", flush=True)
            else:
                time.sleep(0.1)
```

### Agent 沙箱中的可选建议性检查

AI CLI 子进程可能在出站网络被禁用的情况下运行，即使用户的正常终端具有网络访问权限。当本地 CLI 已经暴露了所需信息时，优先使用本地 CLI 探针而非可选网络探针。

**规则 1**：不要让失败的可选建议性检查消耗每会话一次的标记。仅在脚本解析了可用值并能做出预期决策后才写入该标记。否则，瞬时沙箱/网络故障会在会话的剩余时间内隐藏该提示。

**规则 2**：如果本地命令可以提供所需的值，使用短超时和捕获的输出进行尝试。例如，`trellis --version` 已经运行了 CLI 的版本比较逻辑，可以支持可操作的更新提示，而无需重复 npm registry 解析。

**规则 3**：保持建议性检查在失败时静默。面向用户的上下文输出不得因建议性检查无法完成而失败或变得嘈杂。

### 6. 文件编码（File Encoding）

| 默认编码 | macOS/Linux | Windows |
|------------------|-------------|---------|
| 终端（Terminal） | UTF-8 | 通常为 CP1252 或 GBK |
| 文件 I/O | UTF-8 | 系统区域设置 |
| Git 输出 | UTF-8 | 可能不同 |

**规则**：始终显式指定 `encoding="utf-8"` 并使用 `errors="replace"`。

> **检查清单**：当编写打印非 ASCII 字符的脚本时，你是否配置了 stdout 编码？参见 `backend/script-conventions.md` 获取具体模式。

```python
# 坏——依赖系统默认
with open(file, "r") as f:
    content = f.read()

result = subprocess.run(cmd, capture_output=True, text=True)

# 好——带有错误处理的显式编码
with open(file, "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

result = subprocess.run(
    cmd,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace"
)
```

**Git 命令**：强制 UTF-8 输出编码：

```python
# 强制 git 输出 UTF-8
git_args = ["git", "-c", "i18n.logOutputEncoding=UTF-8"] + args
result = subprocess.run(
    git_args,
    capture_output=True,
    text=True,
    encoding="utf-8",
    errors="replace"
)
```

---

## 变更传播检查清单

在进行平台相关变更时，检查**所有这些位置**：

### Commands / Skills 同步
- [ ] 新 command/skill 添加到所有平台（claude、cursor、iflow、codex 以及任何新平台）
- [ ] 每个平台的测试文件在 `EXPECTED_COMMAND_NAMES` / `EXPECTED_SKILL_NAMES` 中更新了新条目
- [ ] 如果添加了新的必需 command，platform-integration spec 的必需 command 表格已更新
- [ ] Command 格式匹配平台约定（参见 `platform-integration.md` → Command Format by Platform）

### 文档与帮助文本
- [ ] Python 文件顶部的 Docstrings
- [ ] `--help` 输出 / argparse 描述
- [ ] README 中的用法示例
- [ ] 建议命令的错误消息
- [ ] Markdown 文档（`.md` 文件）

### 代码位置
- [ ] `src/templates/` - 用于新项目的模板文件
- [ ] `.trellis/scripts/` - 项目自己的脚本（如果是自托管）
- [ ] `dist/` - 构建输出（变更后重新构建）

### 搜索模式
```bash
# 查找所有可能需要更新的位置
grep -r "python [a-z]" --include="*.py" --include="*.md"
grep -r "{{PYTHON_CMD}}\\|python3\\|python " --include="*.py" --include="*.md"
```

---

## 提交前检查清单（Pre-Commit Checklist）

提交跨平台代码之前：

- [ ] 面向用户的 Python 调用是平台感知的（Windows 上 `python`，其他地方 `python3`）或使用 `{{PYTHON_CMD}}`
- [ ] 从 Python 调用的 Python 子进程使用 `sys.executable`
- [ ] 所有路径使用 `pathlib.Path`
- [ ] 没有硬编码路径分隔符（`/` 或 `\`）
- [ ] 用作逻辑/持久化键的路径字符串（Map 键、JSON 字段、哈希字典键）通过 `toPosix()` 标准化；`fs.*` 调用保持 OS 原生路径
- [ ] 跨 OS 计算的内容哈希在哈希前标准化行尾（`\r\n` → `\n`）
- [ ] 可能带有遗留污染的跨 OS JSON 携带 `__version` 标记，加载器丢弃未知/遗留版本
- [ ] 没有无回退方案的平台特定命令（例如 `tail -f`）
- [ ] 可选建议性检查不会在失败时消耗每会话一次的标记
- [ ] 所有文件 I/O 指定 `encoding="utf-8"` 和 `errors="replace"`
- [ ] 所有子进程调用指定 `encoding="utf-8"` 和 `errors="replace"`
- [ ] Git 命令使用 `-c i18n.logOutputEncoding=UTF-8`
- [ ] 外部工具 API 格式已从文档中验证
- [ ] 文档与代码行为匹配
- [ ] 运行搜索以查找所有受影响的位置

### 7. 外部工具 API 契约

当与外部工具（Claude Code、Cursor 等）集成时，它们的 API 契约是**隐式假设**。

**规则**：从官方文档验证 API 格式，不要猜测。

```python
# 坏——猜测的格式
output = {"continue": True, "message": "..."}

# 好——从文档验证的格式
output = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": "..."
    }
}
```

> **警告**：不同的 hook 类型可能有不同的输出格式。始终检查每个 hook 事件的具体文档。

---

## 跨平台持久化 JSON：Schema 迁移标记（Sentinel）

当一个 JSON 文件可能跨 OS 读写（提交到 git、通过云同步、在机器之间复制），**且用户磁盘上可能已经存在带有跨平台污染的旧格式**（Windows 风格键、CRLF 派生的哈希、区域编码字符串）时，添加 `__version` 标记，让加载器丢弃旧格式，以便写入器重新生成干净数据。

**为什么不就地迁移？** 路径键迁移（`\\` → `/`）加上哈希输入迁移（CRLF → LF 重新哈希）加上编码修复是相互关联的——尝试转换旧有效负载有产生错误值的风险。丢弃并重新生成是**安全**的：数据可从磁盘重新计算，且 `loadX` 返回 `{}` 会触发现有的 init/update 路径以重建规范条目。

```typescript
const SCHEMA_VERSION = 2;
type StoredV2 = { __version: number; hashes: Record<string, string> };

export function loadHashes(cwd: string): Record<string, string> {
  const file = getHashesPath(cwd);
  if (!fs.existsSync(file)) return {};

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8")) as unknown;

    // 拒绝遗留平面格式（无 __version）和未知版本。
    // 下一次 saveHashes / initializeHashes 将写入全新的 v2 文件。
    if (
      !parsed ||
      typeof parsed !== "object" ||
      (parsed as StoredV2).__version !== SCHEMA_VERSION ||
      typeof (parsed as StoredV2).hashes !== "object"
    ) {
      return {};
    }
    return (parsed as StoredV2).hashes;
  } catch {
    return {};
  }
}

export function saveHashes(cwd: string, hashes: Record<string, string>): void {
  const payload: StoredV2 = { __version: SCHEMA_VERSION, hashes };
  fs.writeFileSync(getHashesPath(cwd), JSON.stringify(payload, null, 2));
}
```

**何时应用**：
- 哈希字典 / 内容指纹（例如 `.template-hashes.json`）
- 过时条目可从权威来源重新计算的缓存文件
- 任何格式变化与跨平台修复相关的跨 OS 持久化文件

**何时不应用**——如果丢失数据会损害用户（任务状态、草稿、用户输入过的设置）。这种情况下使用真正的迁移。标记 + 丢弃仅当数据可重新计算时才是安全的。

**参考**：`packages/cli/src/utils/template-hash.ts` v2 信封。

---

## JSON/外部数据的防御性检查

在解析 JSON 或外部数据时，TypeScript 类型是**仅编译期**的。运行时数据可能不匹配。

**规则**：在使用必需字段之前始终添加防御性检查。

```typescript
// 坏——信任 TypeScript 类型定义
interface MigrationItem {
  from: string;  // TypeScript 说这是必需的
  to?: string;
}

function process(item: MigrationItem) {
  const path = item.from;  // 运行时：可能是 undefined！
}

// 好——使用前的防御性检查
function process(item: MigrationItem) {
  if (!item.from) return;  // 跳过无效数据
  const path = item.from;  // 现在保证存在
}
```

**何时应用**：
- 解析 JSON 文件（清单、配置）
- API 响应
- 用户输入
- 任何来自外部来源的数据

**模式**：检查存在性 → 然后使用

```typescript
// 过滤模式——跳过无效条目
const validItems = items.filter(item => item.from && item.to);

// 提前返回模式——对无效数据快速退出
if (!data.requiredField) {
  console.warn("Missing required field");
  return defaultValue;
}
```

---

## 常见错误（Common Mistakes）

### 1. "在我的 Mac 上可以运行"

```python
# 开发者的 Mac
subprocess.run(["./script.py"])  # 有效！

# 用户的 Windows
subprocess.run(["./script.py"])  # FileNotFoundError
```

### 2. "shebang 应该能处理"

```python
#!/usr/bin/env python3
# 这一行在 Windows 上被忽略
```

### 3. "我更新了模板"

```
src/templates/script.py  ← 已更新
.trellis/scripts/script.py  ← 忘记同步！
```

### 4. "Python 3 始终是 python3"

```bash
# 开发者的 Mac/Linux
python3 script.py  # 有效！

# 用户的 Windows（来自 python.org 的 Python）
python3 script.py  # 'python3' 不被识别
python script.py   # 有效！

# Trellis 文档/配置应该说明规则，而不是到处猜测一个别名
{{PYTHON_CMD}} script.py
```

### 5. "UTF-8 在任何地方都是默认的"

```python
# 开发者的 Mac（UTF-8 默认）
subprocess.run(cmd, capture_output=True, text=True)  # 有效！

# 用户的 Windows（GBK/CP1252 默认）
subprocess.run(cmd, capture_output=True, text=True)  # 中文/Unicode 乱码
```

> **注意**：stdout 编码也会受到影响。参见 `backend/script-conventions.md` 的修复方法。

---

## 恢复：当你发现平台 bug 时

1. **修复当前问题**
2. **搜索类似模式**（grep 代码库）
3. **使用新模式更新本指南**
4. **如果反复出现则添加到提交前检查清单**

---

**核心原则**：如果不是显式的，那就是假设。而假设会出问题。

---

## 发布检查清单：版本化文件（Release Checklist: Versioned Files）

当发布新版本时，确保**所有版本化文件**被创建/更新：

- [ ] `src/migrations/manifests/{version}.json` - 迁移清单存在
- [ ] 清单具有正确的 version、description、changelog
- [ ] `pnpm build` 将清单复制到 `dist/`
- [ ] 测试从较旧版本的升级路径（不仅仅是相邻版本）

**为什么这很重要**：缺失的清单会在用户从较旧版本升级时导致"path undefined"错误。

```bash
# 验证所有预期的清单都存在
ls src/migrations/manifests/

# 测试升级路径
node -e "
const { getMigrationsForVersion } = require('./dist/migrations/index.js');
console.log('From 0.2.12:', getMigrationsForVersion('0.2.12', 'CURRENT').length);
"
```

## 发布检查清单：内置资源（Bundled Assets）

当 release notes 或文档声称某项资源是内置的、自动安装的或随 Trellis 附带的时，验证整个分发路径：

- [ ] 源文件存在于被标记的分支中，而非仅存在于另一个分支、docs submodule 或 marketplace 目录树中。
- [ ] `pnpm build` 将资源复制到 `dist/templates/**`。
- [ ] `npm pack --dry-run --json` 包含预期的 `dist/**` 路径。
- [ ] 构建的二进制文件在全新的临时仓库中安装了该资源。
- [ ] `.trellis/.template-hashes.json` 追踪生成的资源路径。
- [ ] 在该临时仓库中 `trellis update --dry-run` 报告 `Already up to date!`。

**为什么这很重要**：docs/changelog 文本可以独立于拥有可分发模板的代码分支移动。某个功能可能在文档中被记录为内置的，而发布的 npm tarball 仍然缺少这些文件。

```bash
pnpm --filter @mindfoldhq/trellis build

cd packages/cli
npm pack --dry-run --json | grep 'dist/templates/common/bundled-skills/<skill>/SKILL.md'
cd ../..

tmpdir=$(mktemp -d /tmp/trellis-built-bin-smoke-XXXXXX)
printf '{"name":"trellis-smoke","version":"0.0.0"}\n' > "$tmpdir/package.json"
git -C "$tmpdir" init -q
(
  cd "$tmpdir"
  node /path/to/Trellis/packages/cli/bin/trellis.js init -u smoke --yes --claude --codex
  test -f .claude/skills/<skill>/SKILL.md
  test -f .agents/skills/<skill>/SKILL.md
  grep -q '<skill>' .trellis/.template-hashes.json
  node /path/to/Trellis/packages/cli/bin/trellis.js update --dry-run
)
```
