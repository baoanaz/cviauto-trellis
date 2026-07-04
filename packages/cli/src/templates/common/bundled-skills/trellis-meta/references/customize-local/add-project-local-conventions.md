# Add Project-Local Conventions

Often the user does not need to change Cviauto mechanics; they need local AI to understand their team's conventions. In that case, prefer `.cviauto/spec/` or a project-local skill instead of editing `cviauto-meta`.

## Where To Put Things

| Content type | Location |
| --- | --- |
| Rules code must follow | `.cviauto/spec/<layer>/` |
| Cross-layer thinking methods | `.cviauto/spec/guides/` |
| AI capability for a project-specific flow | Platform-local skill |
| One-off task material | `.cviauto/tasks/<task>/` |
| Session summary | `.cviauto/workspace/<developer>/journal-N.md` |

## Create A Project-Local Skill

If the user wants AI to know "how this project customizes Cviauto," create a local skill:

```text
.claude/skills/cviauto-local/
└── SKILL.md
```

Example:

```md
---
name: trellis-local
description: "Project-local Cviauto customizations for this repository. Use when changing this project's Cviauto workflow, hooks, local agents, or team-specific conventions."
---

# Cviauto Local

## Local Scope

This skill documents this repository's Cviauto customizations only.

## Custom Workflow Rules

- ...

## Local Hook Changes

- ...

## Local Agent Changes

- ...
```

For multi-platform projects, place equivalent versions in other platform skill directories, or use `.agents/skills/` for platforms that support the shared layer.

## Write To `.cviauto/spec/`

If the content is a coding convention, write it to spec. Examples:

```text
.cviauto/spec/backend/error-handling.md
.cviauto/spec/frontend/components.md
.cviauto/spec/guides/cross-platform-thinking-guide.md
```

After writing it, update the corresponding `index.md` so AI can find the new rule from the entry point.

## Make The Current Task Use New Conventions

After writing a spec, add it to the current task context:

```bash
python3 ./.cviauto/scripts/task.py add-context <task> implement ".cviauto/spec/backend/error-handling.md" "Error handling conventions"
python3 ./.cviauto/scripts/task.py add-context <task> check ".cviauto/spec/backend/error-handling.md" "Review error handling"
```

## Do Not Store Project-Private Rules In `cviauto-meta`

`cviauto-meta` is a public skill for understanding Cviauto architecture and local customization entry points. Put project-private content in:

- `.cviauto/spec/`
- a project-local skill
- the current task
- workspace journal

This prevents future updates to Cviauto's built-in `cviauto-meta` from overwriting the team's own conventions.
