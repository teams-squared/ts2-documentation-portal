---
description: Regenerate docs/session-handoff.md end-to-end so a future session picks up cleanly.
---

Regenerate `docs/session-handoff.md` from scratch and push to `dev`. **Write handoff in caveman style** — drop articles, filler, hedging. Preserve code blocks, paths, URLs, commands, SHAs, PR numbers EXACTLY.

## Resolve repo path

Never use hardcoded paths. Run:

- `git rev-parse --show-toplevel` — repo root.
- `git remote get-url origin` — confirm remote.
- `git branch --show-current` — current branch.

If outside a git repo, stop and ask operator.

## Algorithm

1. **Compute today's date from shell** — never infer from conversation context.
   - PowerShell: `Get-Date -Format yyyy-MM-dd`
   - POSIX: `date -I`

2. **Snapshot + fetch.** Run in parallel where possible:
   - `git fetch --all --prune`
   - `git log --oneline -10`
   - `git status --short`
   - `git rev-parse HEAD` (+ `git rev-parse --short HEAD`)
   - `git rev-list --count main..HEAD` (ahead-of-main)
   - `gh pr list --state open` (if `gh` available)

   If local behind `@{u}`, `git pull --ff-only` before continuing.

3. **Dirty-tree triage.** Three cases — pick one:

   - **Clean:** In-flight section is `Working tree clean.`
   - **Complete + intentional + scoped** (small diff, single concern, doc/config/one-line fix): commit directly to `dev` with a conventional-commit subject. Generate the message yourself; do not ask. Push.
   - **Ambiguous or in-progress** (multi-file, half-written code, mixed concerns): bundle to fresh `wip/<topic>` branch, push, then `git checkout dev`. **Default this case when unsure** — reversible is safer.

   Never commit WIP to `dev`. Skip local-only cruft (`.claude/settings.local.json`, untracked one-off scripts the operator owns).

4. **Rewrite `docs/session-handoff.md` end-to-end.** Last write wins, no merge. Six sections in this fixed order. Target <120 lines.

   1. **Last sync** — today's date (from step 1), branch, HEAD short SHA + subject, working-tree status, ahead-of-`main` count.
   2. **What just shipped** — last 3–8 commits, one fragment each. Cite `#NN` PR numbers when present.
   3. **In-flight** — `Working tree clean.` or one-paragraph wip-branch summary (done / left / next step).
   4. **Pending external actions** — checkbox list of operator obligations (migrations to apply, env vars to set, smoke tests, dashboard config). Inline the exact command when applicable. Use `(none known to this session)` if empty — never blank.
   5. **Open questions / decisions** — `[question]. Gated on: [thing].` per line. `(none open)` if empty.
   6. **Pickup pointer** — one fragment, zero cold-start ambiguity. The natural next step if you continued right now.

   End with **Where things live** — short table pointing at key files / conventions specific to this repo (auth, migrations, deploy platform, etc.). Populate from actual codebase, do not invent.

5. **Commit + push** to `dev`:

   ```
   docs(handoff): regenerate snapshot at <HEAD short SHA>
   ```

   Use the `caveman:caveman-commit` skill if commit message needs more than the subject. If a required status check blocks the push and the diff is docs-only, admin-bypass is acceptable; never `--no-verify`.

6. **Sanity re-read as cold session.** Read `CLAUDE.md` + new handoff with fresh eyes. If you cannot describe in-flight + next step from those two files alone, edit further before reporting done.

7. **Report to operator:** one line — `Pushed <short SHA> to dev. Handoff regenerated.`

## Inferring "Pending external actions"

Signals to scan for when populating section 4:

- Recent migration files in `prisma/migrations/` not confirmed applied to prod.
- Commit bodies mentioning manual ops (env var changes, DNS, SQL cleanup, dashboard config).
- Open `dev → main` PRs not merged.
- TODO/FIXME in files touched in last few commits.
- Scheduled tasks / cron secrets needing set on deploy platform (Render).

When you cannot infer definitively, say so explicitly (`(none known to this session)`) — never leave blank.

## Read order context (from CLAUDE.md)

Fresh sessions read in order: `CLAUDE.md` → `docs/session-handoff.md`. Non-overlapping jobs — don't restate `CLAUDE.md`'s evergreen conventions in handoff.
