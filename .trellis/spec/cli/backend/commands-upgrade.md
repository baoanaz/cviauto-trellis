# `cviauto upgrade` Command

How `cviauto upgrade` upgrades the globally installed Cviauto CLI package.

This command is intentionally separate from `cviauto update`:

- `cviauto upgrade` updates the **CLI binary** by running npm's global install.
- `cviauto update` updates a **project's bundled Cviauto files** under `.cviauto/`
  and platform directories.

---

## User-facing contract

```text
cviauto upgrade [--tag <tag-or-version>] [--dry-run]
```

Behavior:

- Builds and runs `npm install -g @baoanaz/cviauto@<tag>`.
- POSIX execution must spawn `npm` directly without shell execution.
- Windows execution must route through `cmd.exe /d /s /c npm install -g ...`
  instead of directly spawning `npm.cmd`.
- Uses the current CLI channel by default:
  - stable versions install `@latest`
  - `-beta.*` versions install `@beta`
  - `-rc.*` versions install `@rc`
- `--tag <tag-or-version>` overrides the inferred channel. Accept simple npm
  dist-tags or versions such as `latest`, `beta`, `rc`, or `0.6.0-beta.8`.
- `--dry-run` prints the exact npm command and exits without changing anything.

The implementation does not detect or preserve the original installer. Cviauto
is published as an npm package, so npm is the upgrade backend even when the user
installed Node through pnpm, Homebrew, Volta, proto, or another manager.

---

## Failure behavior

- If npm is unavailable, fail with the manual npm command.
- If npm exits non-zero, surface the exit code.
- If npm is interrupted by a signal, report the signal.
- Append troubleshooting guidance for npm global prefix / PATH mismatches,
  permissions, existing-bin or locked-file conflicts, and the manual command.
- Do not automatically run `sudo`, pass `--force`, rewrite npm prefix, delete
  files, or detect package managers.
- Reject shell-shaped `--tag` input before spawning npm. Never build a shell
  command string for POSIX execution.

## Success behavior

After npm reports success, print both:

```text
cviauto --version
```

and a platform-specific binary-resolution check:

```text
which cviauto   # POSIX
where cviauto   # Windows
```

This catches the common case where npm installed into one global prefix while
the user's shell still resolves an older `cviauto` binary earlier on PATH.

---

## Update hints

Any user-facing hint that previously said:

```text
npm install -g @baoanaz/cviauto@latest
```

should now prefer:

```text
cviauto upgrade
```

This applies to CLI startup warnings, `cviauto update` downgrade guidance, and
session-start update hints.

---

## Test requirements

- Tag inference: stable → `latest`, beta → `beta`, RC → `rc`.
- Explicit tag override.
- Invalid tag rejection.
- POSIX direct npm command with `shell: false`.
- Windows `cmd.exe /d /s /c npm ...` command plan with `shell: false`.
- Dry-run does not spawn npm.
- Non-zero npm exit becomes a command failure with troubleshooting guidance.
