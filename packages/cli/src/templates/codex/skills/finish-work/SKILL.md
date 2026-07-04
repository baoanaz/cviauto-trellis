---
name: finish-work
description: "Wrap up an active Cviauto task: archive it (and any other completed-but-unarchived tasks the user wants to clean up) and record a local session journal. Refuses to run if the working tree has uncommitted code changes (those belong in workflow Phase 3.4 first). Use when the user asks to finish / wrap up / call it a day, or invokes $finish-work. If the user explicitly asks to promote a lesson into spec, propose and confirm that spec update before archiving."
---

# Finish Work

Wrap up the current session: archive the active task (and any other completed-but-unarchived tasks the user wants to clean up) and record the session journal as local Cviauto records. Code commits are NOT done here — those happen in workflow Phase 3.4 before you invoke this skill.

If the user explicitly asks to promote current-session knowledge into spec (for example, "finish-work and write the rule about X into spec"), complete the optional spec-promotion flow before archiving:

1. Load `cviauto-update-spec`.
2. Propose the target `.cviauto/spec/` file and exact reusable rule.
3. Write the spec update only after user confirmation.
4. Then continue with the normal archive + journal steps below.

## Step 1: Survey current state

```bash
python3 ./.cviauto/scripts/get_context.py --mode record
```

This prints:

- **My active tasks** — review whether any besides the current one are actually done (code merged, AC met) and should be archived this round.
- **Git status** — quick visual on what's dirty.
- **Recent commits** — you'll need their hashes in Step 4 for `--commit`.

If `--mode record` surfaces other completed tasks not tied to the current session, surface them to the user with a one-shot confirmation: "These N tasks look done — archive them too in this round? [y/N]". Default is no; the current active task is always archived in Step 3 regardless.

## Step 2: Sanity check — classify dirty paths

Run:

```bash
git status --porcelain
```

Filter out paths under `.cviauto/workspace/` and `.cviauto/tasks/` — those are local Cviauto task/session records and should not block finish-work unless they contain changes the user explicitly wants to publish.

For each remaining dirty path, decide whether it belongs to **the current task** or to **other parallel work** (e.g., another terminal window editing the same repo). Heuristics:

- Paths referenced in the current task's `prd.md` / `implement.jsonl` / `check.jsonl` → current task
- Paths in code areas matching the task's stated scope, or that you remember editing this session → current task
- Paths in unrelated areas you have no recollection of touching this session → other parallel work

Then route:

- **Any remaining path looks like current-task work** — bail out with:
  > "Working tree has uncommitted code changes from this task: `<list>`. Return to workflow Phase 3.4 to commit them before running `$finish-work`."

  Do NOT run `git commit` here. Do NOT prompt the user to commit. The user goes back to Phase 3.4 and the AI drives the batched commit there.
- **All remaining paths look unrelated** (other parallel-window work) — report them once and continue to Step 3:
  > "FYI, dirty files outside this task's scope — leaving them for the other window: `<list>`."
- **Genuinely unsure** — ask the user once: "Are `<list>` this task's work I forgot to commit, or another window's? (commit / ignore)" — then route per their answer.

## Step 3: Archive task(s)

```bash
python3 ./.cviauto/scripts/task.py archive <task-name> --no-commit
```

At minimum: the current active task (if any). Plus any extra tasks the user confirmed in Step 1. Archives are local Cviauto records by default; do not create a `chore(task): archive ...` commit unless the user explicitly asks to publish Cviauto bookkeeping.

If there is no active task and the user did not confirm any cleanup archives, skip this step.

## Step 4: Record session journal

```bash
python3 ./.cviauto/scripts/add_session.py \
  --title "Session Title" \
  --commit "hash1,hash2" \
  --summary "Brief summary" \
  --no-commit
```

Use the work-commit hashes produced in Phase 3.4 (visible in Step 1's `Recent commits` list, or via `git log --oneline`) for `--commit`. This records the session locally and does not create a `chore: record journal` commit.

Final git history by default: work commits only. Archive and journal files stay local unless the user explicitly asks to publish Cviauto bookkeeping.

---

## Relationship to Other Skills

```
Development Flow:
  Phase 3.4 (workflow.md) -> AI drafts batched commits -> user confirms -> git commit
                                                                              |
                                                                              v
                                                                    $finish-work
                                                                    (survey + local archive + journal)

Debug Flow:
  Hit bug -> Fix -> $break-loop -> Knowledge capture
```

- `$finish-work` — this skill, survey + local archive + record session
- `$break-loop` — deep analysis after debugging
