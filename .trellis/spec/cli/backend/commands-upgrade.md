# `cviauto upgrade` 命令

`cviauto upgrade` 如何升级全局安装的 Cviauto CLI 包。

此命令有意与 `cviauto update` 分离：

- `cviauto upgrade` 通过运行 npm 的全局安装来更新 **CLI 二进制文件**。
- `cviauto update` 更新 `.cviauto/` 和平台目录下的**项目捆绑 Cviauto 文件**。

---

## 面向用户的契约

```text
cviauto upgrade [--tag <tag-or-version>] [--dry-run]
```

行为：

- 构建并运行 `npm install -g @baoanaz/cviauto@<tag>`。
- POSIX 执行必须直接 spawn `npm`，不使用 shell 执行。
- Windows 执行必须通过 `cmd.exe /d /s /c npm install -g ...` 路由，而不是直接 spawn `npm.cmd`。
- 默认使用当前 CLI 通道：
  - 稳定版本安装 `@latest`
  - `-beta.*` 版本安装 `@beta`
  - `-rc.*` 版本安装 `@rc`
- `--tag <tag-or-version>` 覆盖推断的通道。接受简单的 npm dist-tags 或版本，如 `latest`、`beta`、`rc` 或 `0.6.0-beta.8`。
- `--dry-run` 打印确切的 npm 命令并退出而不进行任何更改。

实现不会检测或保留原始安装器。Cviauto 作为 npm 包发布，因此 npm 是升级后端，即使用户通过 pnpm、Homebrew、Volta、proto 或其他管理器安装了 Node。

---

## 失败行为

- 如果 npm 不可用，以手动 npm 命令失败。
- 如果 npm 以非零退出，展示退出代码。
- 如果 npm 被信号中断，报告信号。
- 为 npm 全局前缀 / PATH 不匹配、权限、现有二进制或锁定文件冲突以及手动命令追加故障排除指导。
- 不要自动运行 `sudo`、传递 `--force`、重写 npm 前缀、删除文件或检测包管理器。
- 在 spawn npm 之前拒绝 shell 形状的 `--tag` 输入。永远不要为 POSIX 执行构建 shell 命令字符串。

## 成功行为

在 npm 报告成功后，打印两者：

```text
cviauto --version
```

和一个平台特定的二进制解析检查：

```text
which cviauto   # POSIX
where cviauto   # Windows
```

这捕获了常见情况：npm 安装到一个全局前缀，而用户的 shell 仍在 PATH 上较早解析到更旧的 `cviauto` 二进制文件。

---

## 更新提示

任何之前说：

```text
npm install -g @baoanaz/cviauto@latest
```

的面向用户提示现在应改为：

```text
cviauto upgrade
```

这适用于 CLI 启动警告、`cviauto update` 降级指导以及会话开始更新提示。

---

## 测试要求

- 标签推断：stable → `latest`，beta → `beta`，RC → `rc`。
- 显式标签覆盖。
- 无效标签拒绝。
- POSIX 直接 npm 命令，使用 `shell: false`。
- Windows `cmd.exe /d /s /c npm ...` 命令计划，使用 `shell: false`。
- Dry-run 不 spawn npm。
- 非零 npm 退出变为带有故障排除指导的命令失败。
