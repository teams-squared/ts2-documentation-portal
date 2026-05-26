---
description: Orient fresh session to current project state. Read-only — never starts work.
---

Bring a cold Claude session up to speed on this repo. **Read-only.** Do not start work. End with a single recommended next step and wait for operator.

## Resolve repo path

Never use hardcoded paths. Run:

- `git rev-parse --show-toplevel` — repo root.
- `git remote get-url origin` — canonical remote.
- `git branch --show-current` — current branch.

If outside a git repo, stop and ask operator where the repo lives.

## Algorithm

1. **Fetch remote first.** Run `git fetch --all --prune`. Remote state is canon — never read handoff before fetch.

2. **Hard sync gate.** Compare local `HEAD` to `@{u}`:
   - Behind → fast-forward pull. If working tree dirty, `git stash push -u -m "pickup-autostash"` first, pull, then `git stash pop`. If pop conflicts → stop and surface to operator; do not auto-resolve.
   - Ahead or diverged → surface to operator; do not auto-rebase.
   - Up to date → proceed.

3. **Read in this order** (post-pull):
   - `CLAUDE.md` (+ any `@`-included files like `AGENTS.md`) at repo root.
   - `docs/session-handoff.md`.
   - Any `docs/plan-*.md` or active plan file referenced by the handoff.

4. **Drift check.** Flag any of:
   - HEAD short SHA ≠ handoff "Last sync" SHA.
   - Handoff "Last sync" date >3 days older than today (`date -I` POSIX or `Get-Date -Format yyyy-MM-dd` PowerShell).
   - Working tree dirty but handoff says clean.
   - Open PRs (`gh pr list --state open`) not named in handoff.
   - Remote branches (`git branch -r`) not named in handoff and not stale.

5. **Terse combined report.** Format:

   ```
   Repo: <name> @ <branch> · <short SHA> · <clean|dirty:N files>
   Last sync: <handoff date> (<drift summary or "fresh">)
   In-flight: <handoff in-flight line, or "none">
   Open PRs: <count> (<list #NN or "none">)
   Next step: <single recommended action from handoff pickup pointer>
   ```

   If drift detected, add a `Drift:` line above `Next step:` listing each divergence.

6. **Stop.** Do not edit, do not commit, do not start the work. Wait for operator confirmation or redirection.

## Caveman style

Report in caveman-compressed form: drop articles, fragments OK. Preserve SHAs, PR numbers, paths, commands verbatim.
