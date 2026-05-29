# Session handoff

> Read after `CLAUDE.md`. Regenerate via `/prep` slash command (or
> "prep for other sessions" in chat). Last write wins — never edit
> by hand for substantive updates. Caveman style: drop articles +
> filler. Code blocks, paths, URLs preserved exactly.

## Last sync

- **When:** 2026-05-27
- **Branch:** `dev`
- **HEAD:** `514623d` — `ci: fix lint blockers for PR #40`
- **`main`:** `4dc3d81` — merge of PR #40. Auto-deployed to learn.teamsquared.io via Render.
- **`dev` vs `main`:** 0 commits ahead. Just-merged release.
- **Working tree:** clean. `.agents/`, `.claire/` untracked, local-only.
- **Open PRs:** none.

## What just shipped

PR #40 on `main`. Headline: **public ISO doc library at `/policies`** plus motion-C polish + workflow docs.

- `514623d` `ci: fix lint blockers for PR #40` — `FormButton` setState-in-effect disable + `PolicyDocViewer` exhaustive-deps fix.
- `b1a42ba` `Merge bf9ac2e (/iso-docs) into /policies; keep IsoLibraryView audit log` — reconciled parallel implementation. Kept `/policies` design, cherry-picked `IsoLibraryView` audit log + "from existing lesson" admin path. Dropped `/iso-docs`, `IsoLibraryEntry`, `IsoLibraryManager`/`Picker`/`DocViewer`, `/api/iso-library/*`, `/api/admin/iso-library/*`.
- `861b35f` `feat(policies): public ISO doc library at /policies` — new `PublicIsoDoc` table, `acknowledgementMode` prop on `PolicyDocViewer`, "Public library" tab under `/admin/iso`, sidebar nav.
- `bf9ac2e` `feat(iso-docs): add curated reference library at /iso-docs` — parallel attempt, mostly superseded by `b1a42ba`.
- `95f1ec3` `docs(commands): add /pickup, harden /prep for device-agnostic use`.
- `69ec73d` … `7e49bd2` — motion-C hover-ring + admin-card-height polish (5 commits).

Migrations applied to prod DB (verified via Render MCP):
- `20260526000000_add_public_iso_doc` — `PublicIsoDoc` table.
- `20260526010000_rewire_iso_library_view` — dropped abandoned `IsoLibraryEntry` + old `IsoLibraryView`, recreated `IsoLibraryView` keyed to `PublicIsoDoc`.

## In-flight

_None._ Working tree clean. No `wip/*` branch open.

## Pending external actions

- [ ] **Grant `User.Read.All` (Application) to LMS app registration.** Invite form now does advisory Entra directory check (warn-not-block) on email blur via Graph app-only token. Dormant until consent lands — every lookup returns `unknown` (no badge) without it. Reuses existing `AZURE_AD_CLIENT_ID/_SECRET/_TENANT_ID`, no new env/redeploy. Steps: Entra admin center → App registrations → LMS app → API permissions → Add → Microsoft Graph → **Application** permissions → `User.Read.All` → **Grant admin consent** (row must show green check). Code: `src/lib/entra/graph.ts`, `src/app/api/admin/users/lookup/route.ts`.
- [ ] **Curate first docs into `/policies` library.** Library exists + serves but `PublicIsoDoc` row count = 0. Sign in as ADMIN → `/admin/iso` → **Public library** tab → add via paste-link, browse SP picker, or **From lesson…**.
- [ ] **Clean stale `_prisma_migrations` row.** `20260512000000_add_manual_reminder_log` stuck "failed" from 2026-05-11 (table actually exists). Cosmetic, hand-rolled `prisma/migrate.ts` ignores it. Fix:
  ```sh
  DATABASE_URL="<prod url>" npx prisma migrate resolve --applied 20260512000000_add_manual_reminder_log
  ```
- [ ] **Triage Dependabot vulns.** Push of PR #40 reported `16 vulnerabilities (6 high, 9 moderate, 1 low)` on default branch. Check `https://github.com/teams-squared/ts2-lms/security/dependabot`.

## Open questions / decisions

- **More entry points to `/policies`?** Today only sidebar. Gated on: product call. Dashboard tile / topbar link possible.
- **Wire React `<ViewTransition>` shared-element morph (course card → course detail).** `experimental.viewTransition: true` set in `next.config.ts`. Gated on: React 19.x exporting `ViewTransition` (currently `undefined` in 19.2.4).
- **Right-rail on lesson player (notes / transcript / resources).** `LessonPlayerShell` reserves slot via `side` prop; no consumer wires it. Gated on: product call.
- **Custom PDF toolbar (`react-pdf`).** Today iframe with `#toolbar=0&navpanes=0&scrollbar=0&view=FitH` is §8.12 acceptable fallback. Gated on: someone caring enough to swap.
- **Switch `render.yaml` from custom `prisma/migrate.ts` to `prisma migrate deploy`.** Auto-applies migrations folder. Gated on: non-launch deploy window. Would also fix the stale-row issue above.
- **Resend subdomain (`lms.teamsquared.io`) for sender isolation.** Gated on: paid plan or deliverability incident.
- **Server-side dwell enforcement for POLICY_DOC.** Client gate bypassable via DevTools. Gated on: auditor pushback.
- **Email retry / dead-letter queue.** All sends fire-and-forget. Gated on: first Resend outage.
- **Manual-reminder cooldown / abuse guard.** `ManualReminderLog` no dedupe by design. Gated on: user complaint.

## Pickup pointer

Add first doc to `/policies` library via `/admin/iso` → **Public library**. Verify per-doc view-count widget lights up after a couple opens. Then triage 6 high-severity Dependabot vulns — biggest open security delta.

---

## Where things live

| Area | File / dir |
|---|---|
| Project conventions | `CLAUDE.md`, `AGENTS.md` |
| Design system | `docs/teams-squared-lms-design-system.mdx` |
| Motion tokens + utilities | `src/app/globals.css` (`--duration-*`, `--ease-*`, `.surface-interactive`, `.hover-lift`, `.skeleton-shimmer`, `.animate-progress-affirm`) |
| Motion primitives | `src/components/ui/RevealOnView.tsx`, `src/components/ui/AnimatedNumber.tsx`, `src/components/ui/FormButton.tsx` |
| Auth (NextAuth + Entra ID) | `src/lib/auth.ts`, `src/lib/auth.config.ts` |
| Course access + CM scoping | `src/lib/courseAccess.ts` |
| Outbound email | `src/lib/email.ts` |
| Admin ISO surface | `src/app/admin/iso/page.tsx`, `src/components/admin/IsoAckLog.tsx`, `IsoCoverage.tsx`, `PublicIsoLibraryManager.tsx` |
| Public policies library | `src/app/policies/page.tsx`, `src/app/policies/[id]/page.tsx` |
| Public-library APIs | `src/app/api/admin/public-iso-docs/{route.ts,[id]/route.ts,[id]/sync/route.ts,from-lesson/route.ts}` |
| Policy-doc viewer (lesson + public) | `src/components/courses/PolicyDocViewer.tsx` — `acknowledgementMode` prop switches dwell/ack on/off |
| Policy-doc sync helpers | `src/lib/policy-doc/sync.ts` (`syncPolicyDoc` + `syncPublicIsoDoc`) |
| SharePoint allowlist (IDOR gate) | `src/lib/sharepoint/allowlist.ts` — gates `/api/sharepoint/files/[driveId]/[itemId]` |
| Sidebar nav | `src/components/layout/Sidebar.tsx` — `BASE_NAV_ITEMS` |
| Schema | `prisma/schema.prisma` |
| **Migrations** (NOT auto-applied) | `prisma/migrations/`, `scripts/verify-prod-migrations.ts` |
| Render deploy config | `render.yaml`. Services: `ts2-lms` (`main` → prod), `ts2-lms-staging` (`dev` → staging, shared DB) |
| LMS prod DB | `dpg-d7eb259f9bms738jscig-a` (`ts2-lms-db`) — Render MCP, Teams Squared workspace |
| GitHub Actions CI | `.github/workflows/` — Lint+Type-check+Test+Build + Dependency Review |
| Tests (vitest) | `src/__tests__/` — 143 files, 1249 tests, 74% statements |
| Coverage thresholds | `vitest.config.ts` (lib ≥80%, components ≥70%) |

## Reminders

- `canManageCourse(userId, role, courseId)` = single gate for course-edit authority. ADMIN bypasses m2m; CM must be in `Course.managers`.
- `prisma/migrate.ts` = hand-rolled idempotent SQL bootstrap. New `prisma/migrations/*` folders apply manually via `npx prisma db execute --file <path>`. Use `scripts/verify-prod-migrations.ts` for drift detection.
- `PolicyDocViewer` `acknowledgementMode`: `"required"` (default, lesson flow with dwell + ack) vs `"none"` (public library, just metadata + iframe).
- Resend SDK v6 returns `{data, error}` — never throws. Always destructure + check `error`.
- No em-dashes in user-facing copy (design-system §8.13). Code comments exempt.
- `.hover-lift` is the canonical card-hover class. Don't roll bespoke hover patterns.
- Reduced-motion must short-circuit JS event handlers in addition to the CSS kill-switch (RevealOnView + AnimatedNumber show the pattern).
- `git fetch --all` before any "check remote" question — local refs go stale, parallel agents may have pushed.
