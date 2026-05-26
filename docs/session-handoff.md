# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-15
- **Branch:** `dev`
- **HEAD:** `7fc521c` — `test: coverage push to 74% statements, both threshold gates passing`
- **`main`:** `97ba9a9` — merge of PR #39 (motion system + coverage). Auto-deploys to learn.teamsquared.io via Render.
- **`dev` vs `main`:** identical content; main has extra merge commit only. No outstanding code delta.
- **Working tree:** clean. `.claire/` untracked, local-only.
- **Open PRs:** none.

## What just shipped

All on `main` via PR #39. Three logical commits preserved in history:

1. `ce5903d` `feat(design-system): motion tokens, surface utilities, shadow-card primitive` — `--duration-*` / `--ease-*` tokens, `.surface-interactive` utility, `--shadow-card-sm/-md` with inset highlight, upgraded `.hover-lift` (border-strength + z-promotion), button `motion-safe:active:scale-[0.98]` press dip, Card primitive → `shadow-card-sm`, Skeleton `animate-pulse` → `.skeleton-shimmer`, `.animate-progress-affirm` keyframe for lesson completion.
2. `ae7afd4` `feat(motion): journey primitives — RevealOnView, AnimatedNumber, scroll-tick, completion pulse` — new `<RevealOnView>` (IntersectionObserver one-shot entrance) + `<AnimatedNumber>` (rAF count-up). Dashboard sections wrapped with 0/60/120ms stagger. XP value tweens up in WelcomeBar. LessonFooter gains scroll-depth secondary fill + completion affirm pulse. CourseThumbnail inner image scales on `group-hover`. `next.config.ts` opts into `experimental.viewTransition` (no-op until React export stabilises).
3. `7fc521c` `test: coverage push to 74% statements, both threshold gates passing` — 40 new test files, 821 → 1214 tests. Coverage: 35% → 74% statements. CI bucket gates (`src/lib/**` ≥80%, `src/components/**` ≥70%) now passing — were both failing before this PR.

Prior `dev` work already on `main`:
- `5a93463` `fix(security): close SharePoint IDOR, harden cron auth, bump Next.js` — `src/lib/sharepoint/allowlist.ts` now gates the `/api/sharepoint/files/[driveId]/[itemId]` proxy.
- `9981656` `feat(auth): gate Credentials provider behind ALLOW_PASSWORD_LOGIN`.
- `260f7c1` `feat(policy-doc): persist dwell timer across same-tab navigation`.

## In-flight

_None._ Working tree clean. No `wip/*` branch open.

## Pending external actions

- [ ] **Smoke-test motion in prod after Render deploys PR #39.** Watch `https://learn.teamsquared.io`. Verify:
  - Dashboard: NextStepBanner → DeadlineAlerts → CourseProgressList stagger-fade-rise on load. WelcomeBar XP counts up.
  - Course catalog: card hover lifts with z-promotion (top edge never hides behind sibling). Inner thumbnail image scales 3%.
  - Lesson player: secondary fill on footer progress tracks scroll depth. `Mark complete` flashes the affirm pulse once.
  - Dark-mode parity on every above.
  - System reduce-motion (macOS System Preferences → Accessibility): all entrances/tweens skip cleanly.

- [ ] **Verify migration `20260512000000_add_manual_reminder_log` applied to prod.** Flagged by previous handoff as pending; status unconfirmed this session. Run:
  ```sh
  DATABASE_URL="<prod url>" npx tsx scripts/verify-prod-migrations.ts
  ```
  If missing, apply:
  ```sh
  npx prisma db execute --file prisma/migrations/20260512000000_add_manual_reminder_log/migration.sql
  ```

- [ ] **Triage Dependabot vulns.** Post-PR-#39 push to `dev` reports `15 vulnerabilities (6 high, 8 moderate, 1 low)` on default branch — Next.js bump in `5a93463` closed ~26 since the previous 41-count. Six high remain. Investigate at `https://github.com/teams-squared/ts2-lms/security/dependabot` before next prod release.

## Open questions / decisions

- **Wire React `<ViewTransition>` shared-element morph (course card → course detail).** `experimental.viewTransition: true` already set in `next.config.ts`. Gated on React 19.x exporting `ViewTransition` (currently `undefined` in 19.2.4 build).
- **Right-rail on lesson player (notes / transcript / resources).** `LessonPlayerShell` reserves the slot via `side` prop; no consumer wires it yet. Gated on product call.
- **Custom PDF toolbar (`react-pdf`).** Today's iframe with `#toolbar=0&navpanes=0&scrollbar=0&view=FitH` is the §8.12 acceptable-fallback. Gated on someone caring enough to swap.
- **Switch `render.yaml` from custom `prisma/migrate.ts` to `prisma migrate deploy`.** Auto-applies migrations folder. Gated on non-launch deploy window.
- **Resend subdomain (`lms.teamsquared.io`) for sender isolation.** Gated on paid plan or deliverability incident.
- **Server-side dwell enforcement for POLICY_DOC.** Client gate bypassable via DevTools. Gated on auditor pushback.
- **Email retry / dead-letter queue.** All sends fire-and-forget. Gated on first Resend outage.
- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog` no dedupe by design. Gated on user complaint.

## Pickup pointer

Watch Render deploy land for PR #39; smoke-test motion on prod per checklist above. After that, triage 20 high-severity Dependabot vulns — biggest delta since last session and the only thing blocking a clean security posture.

Coverage gates now pass — if a future change drops below `src/lib/**` 80% or `src/components/**` 70%, CI catches it. `vitest.config.ts` holds thresholds.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Design system | `docs/teams-squared-lms-design-system.mdx` |
| Motion tokens + utilities | `src/app/globals.css` (`--duration-*`, `--ease-*`, `.surface-interactive`, `.hover-lift`, `.skeleton-shimmer`, `.animate-progress-affirm`) |
| Motion primitives | `src/components/ui/RevealOnView.tsx`, `src/components/ui/AnimatedNumber.tsx` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Course access + CM scoping | `src/lib/courseAccess.ts` |
| Course progress helpers | `src/lib/courseProgress.ts` |
| Outbound email | `src/lib/email.ts` |
| Admin email surface | `src/app/admin/emails/page.tsx`, `src/components/admin/Email*Form.tsx` |
| ISO compliance (ack log + coverage) | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx`, `src/components/admin/IsoCoverage.tsx` |
| Admin progress view | `src/app/admin/progress/page.tsx`, `src/components/admin/CourseProgressTable.tsx` |
| Manual reminder API | `src/app/api/admin/courses/[id]/reminders/route.ts` |
| Course managers panel + API | `src/components/admin/CourseManagersPanel.tsx`, `src/app/api/admin/courses/[id]/managers/` |
| Invite UI + API | `src/components/admin/InviteUserForm.tsx`, `src/app/api/admin/users/invite/route.ts` |
| Lesson complete API (race-safe) | `src/app/api/courses/[id]/modules/[moduleId]/lessons/[lessonId]/complete/route.ts` |
| Lesson footer (scroll-tick + affirm) | `src/components/courses/LessonFooter.tsx` |
| Policy-doc viewer | `src/components/courses/PolicyDocViewer.tsx`, `src/lib/policy-doc/sync.ts` |
| SharePoint allowlist (IDOR gate) | `src/lib/sharepoint/allowlist.ts` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, `scripts/verify-prod-migrations.ts` |
| One-shot scripts | `scripts/backfill-course-managers.sql`, `scripts/delete-demo-users.{sql,ts}` |
| Render deploy config | `render.yaml` |
| GitHub Actions cron (deadline reminders) | `.github/workflows/deadline-reminders.yml` |
| Tests (vitest) | `src/__tests__/` — 138 files, 1214 tests, 74% statements |
| Coverage thresholds | `vitest.config.ts` (lib ≥80%, components ≥70%) |
| E2E (Playwright, not in CI) | `e2e/` |

## Reminders

- `canManageCourse(userId, role, courseId)` = single gate for course-edit authority. ADMIN bypasses m2m; CM must be in `Course.managers`. `listManagedCourseIds` returns `null` for ADMIN.
- `prisma/migrate.ts` = hand-rolled idempotent SQL. New migrations apply manually. Use `scripts/verify-prod-migrations.ts` for drift detection.
- Resend SDK v6 returns `{data, error}` — never throws. Always destructure + check `error`.
- No em-dashes in user-facing copy (design-system §8.13). Code comments exempt.
- `.hover-lift` is the canonical card-hover class — adds border-strength, shadow lift, and z-promotion. Don't roll bespoke hover patterns.
- Reduced-motion must short-circuit JS event handlers in addition to the CSS kill-switch (see RevealOnView + AnimatedNumber for the pattern).
