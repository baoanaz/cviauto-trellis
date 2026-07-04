# Cviauto

Cviauto is an internal AI-assisted development workflow for Claude Code, Codex, OpenCode, and related coding agents.

It installs a project-local workflow directory, platform commands, hooks, agent definitions, task files, and spec guidance so AI coding sessions can follow project conventions without repeatedly rediscovering them.

## Quick Start

```bash
# Install from npm
npm install -g @baoanaz/cviauto@latest

# Initialize in your repo
cviauto init -u your-name

# Or initialize only the platforms you use
cviauto init --claude --codex -u your-name
```

After initialization, Cviauto writes runtime files under `.cviauto/` and platform integration files under directories such as `.claude/`, `.codex/`, `.agents/`, `.opencode/`, and `.zcode/`.

## Runtime Layout

| Path | Purpose |
| --- | --- |
| `.cviauto/workflow.md` | Development phases, task routing, and finish rules |
| `.cviauto/spec/` | Project-specific coding conventions and reusable engineering rules |
| `.cviauto/tasks/` | Active and archived task artifacts such as PRD, design notes, and context manifests |
| `.cviauto/workspace/{name}/` | Per-developer journals and local session notes |
| `.cviauto/.runtime/` | Local runtime state such as active session mappings |

## Workflow

1. Describe the work in normal conversation.
2. The AI classifies whether the turn needs a Cviauto task.
3. For larger work, it creates task artifacts, loads relevant specs, implements, and verifies.
4. When the task is complete, run `/cviauto:finish-work` or the equivalent platform command.
5. Spec promotion is optional and human-triggered. Ask for it explicitly, for example: `/cviauto:finish-work 沉淀当前对话中有关于某某功能为 spec`.

## Notes For Internal Use

- The runtime directory is `.cviauto/`.
- The public command is `cviauto`.
- The public npm packages are `@baoanaz/cviauto` and `@baoanaz/cviauto-core`.
- Generated user-facing commands use the `cviauto` namespace, such as `/cviauto:continue`, `/cviauto:finish-work`, and `/cviauto-start`.
- Personal workflow artifacts can stay local through the generated `.cviauto/.gitignore`; work commits should contain only the meaningful code changes.
