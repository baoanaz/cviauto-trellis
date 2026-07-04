# Local Files Generated After Init

`cviauto init` writes the Cviauto runtime into the user project. Later, `cviauto update` tries to update Cviauto-managed template files, but it uses `.cviauto/.template-hashes.json` to determine which files have already been modified by the user.

This page only describes files that are visible and editable inside the user project.

## `.cviauto/`

```text
.cviauto/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| Path | Usually editable? | Notes |
| --- | --- | --- |
| `.cviauto/workflow.md` | Yes | Local workflow documentation and AI routing rules. |
| `.cviauto/config.yaml` | Yes | Project configuration, hooks, packages, journal line limits, and related settings. |
| `.cviauto/spec/` | Yes | Project specs, intended to be updated regularly by users and AI. |
| `.cviauto/tasks/` | Yes | Task material and research artifacts, maintained by the task workflow. Local-only by default via `.cviauto/.gitignore`; publish only when the project explicitly wants Cviauto bookkeeping in git. |
| `.cviauto/workspace/` | Yes | Session records, usually written by `add_session.py`. Local-only by default via `.cviauto/.gitignore`; publish only when the project explicitly wants Cviauto bookkeeping in git. |
| `.cviauto/scripts/` | Carefully | Local runtime. It can be customized, but only after understanding the call chain. |
| `.cviauto/.runtime/` | No | Runtime state, usually written automatically by hooks/scripts. |
| `.cviauto/.developer` | Carefully | Current developer identity. |
| `.cviauto/.version` | No | Cviauto version record used by update/migration logic. |
| `.cviauto/.template-hashes.json` | No | Template hash record. Do not hand-write business rules here. |

## Platform Directories

Different platforms generate different directories. Common categories:

| Category | Example paths | Purpose |
| --- | --- | --- |
| hooks | `.claude/hooks/`, `.codex/hooks/`, `.cursor/hooks/` | Inject session context, workflow-state, and sub-agent context. |
| settings | `.claude/settings.json`, `.codex/hooks.json`, `.qoder/settings.json`, `.trae/hooks.json` | Tell the platform when to run hooks or plugins. |
| agents | `.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, `.zcode/cli/agents/` | Define agents such as `cviauto-research`, `cviauto-implement`, and `cviauto-check`. |
| skills | `.claude/skills/`, `.agents/skills/`, `.qoder/skills/` | Skills that auto-trigger or can be read by AI. |
| commands/prompts/workflows | `.cursor/commands/`, `.github/prompts/`, `.devin/workflows/`, `.zcode/commands/` | Explicit user-invoked command or workflow entry points. |

When modifying a platform directory, also confirm whether `.cviauto/workflow.md` still describes the same flow.

## Meaning Of Template Hashes

`.cviauto/.template-hashes.json` records the content hash from the last time Cviauto wrote a template file. `cviauto update` uses it to distinguish three cases:

| Case | Update behavior |
| --- | --- |
| File was not modified by the user | It can be updated automatically. |
| File was modified by the user | Prompt the user to overwrite, keep, or generate `.new`. |
| File is no longer a current template | It may be deleted, renamed, or preserved according to migration rules. |

When an AI customizes local Cviauto files, it does not need to maintain hashes manually. It is normal for Cviauto update to recognize the result as "modified by the user."

## Local Customization Boundaries

Editable by default:

- `.cviauto/workflow.md`
- `.cviauto/config.yaml`
- `.cviauto/spec/**`
- `.cviauto/scripts/**`
- Platform hooks, settings, agents, skills, commands, prompts, and workflows

Do not edit by default:

- Global npm install directory
- `node_modules/@mindfoldhq/trellis`
- Cviauto GitHub repository source code
- Concrete state files under `.cviauto/.runtime/**`
- Hash contents inside `.cviauto/.template-hashes.json`

Switch to the Cviauto CLI source-code perspective only when the user explicitly wants to contribute upstream.
