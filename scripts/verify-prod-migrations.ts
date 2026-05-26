/**
 * Verifies that all migrations in prisma/migrations/ have been applied
 * to the database pointed at by $DATABASE_URL.
 *
 * Usage (PowerShell):
 *   $env:DATABASE_URL = "<external db url from Render>"
 *   npx tsx scripts/verify-prod-migrations.ts
 *   Remove-Item Env:DATABASE_URL
 *
 * The custom prisma/migrate.ts deploy script does NOT auto-apply files
 * in prisma/migrations/. This script tests for the presence of the
 * tables / columns / enum values each migration is expected to create.
 *
 * Exit code 0 if everything checks out, 1 if any check fails.
 */
import { prisma } from "../src/lib/prisma";

type CheckResult = { name: string; ok: boolean; detail: string };

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT to_regclass($1) IS NOT NULL AS exists`,
    `"${name}"`,
  );
  return rows[0]?.exists === true;
}

async function columnExists(table: string, column: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
     ) AS exists`,
    table,
    column,
  );
  return rows[0]?.exists === true;
}

async function enumHasValue(enumName: string, value: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
       SELECT 1
         FROM pg_enum e
         JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1 AND e.enumlabel = $2
     ) AS exists`,
    enumName,
    value,
  );
  return rows[0]?.exists === true;
}

async function check(
  name: string,
  fn: () => Promise<boolean>,
  detail: string,
): Promise<CheckResult> {
  try {
    const ok = await fn();
    return { name, ok, detail };
  } catch (err) {
    return {
      name,
      ok: false,
      detail: `${detail} — query error: ${(err as Error).message}`,
    };
  }
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set. Aborting.");
    process.exit(2);
  }
  // Mask password in echo so we don't leak secrets in shared screens.
  const masked = url.replace(/:[^:@/]+@/, ":***@");
  console.log(`Verifying against: ${masked}\n`);

  const results: CheckResult[] = [];

  // Migrations listed in docs/session-handoff.md (handoff-known)
  results.push(
    await check(
      "20260428000000_add_invite_email_template",
      () => tableExists("InviteEmailTemplate"),
      'Table "InviteEmailTemplate" should exist',
    ),
  );
  results.push(
    await check(
      "20260428100000_add_email_signature",
      () => tableExists("EmailSignature"),
      'Table "EmailSignature" should exist',
    ),
  );
  results.push(
    await check(
      "20260430000000_add_signature_disclaimer",
      () => columnExists("EmailSignature", "disclaimer"),
      'Column "EmailSignature.disclaimer" should exist',
    ),
  );

  // Newer migrations (post-handoff snapshot — also need to be live in prod)
  results.push(
    await check(
      "20260504000000_add_iso_settings_enabled",
      () => columnExists("IsoNotificationSettings", "enabled"),
      'Column "IsoNotificationSettings.enabled" should exist',
    ),
  );
  results.push(
    await check(
      "20260506000000_add_iso_audit_evidence (attestationText)",
      () => columnExists("LessonProgress", "acknowledgedAttestationText"),
      'Column "LessonProgress.acknowledgedAttestationText" should exist',
    ),
  );
  results.push(
    await check(
      "20260506000000_add_iso_audit_evidence (dwellSeconds)",
      () => columnExists("LessonProgress", "acknowledgedDwellSeconds"),
      'Column "LessonProgress.acknowledgedDwellSeconds" should exist',
    ),
  );
  results.push(
    await check(
      "20260506000000_add_iso_audit_evidence (sharePointItemId)",
      () => columnExists("LessonProgress", "acknowledgedSharePointItemId"),
      'Column "LessonProgress.acknowledgedSharePointItemId" should exist',
    ),
  );
  results.push(
    await check(
      "20260507000000_add_lesson_type_link",
      () => enumHasValue("LessonType", "LINK"),
      'Enum "LessonType" should include value "LINK"',
    ),
  );
  results.push(
    await check(
      "20260508000000_add_course_managers",
      () => tableExists("_CourseManagers"),
      'Join table "_CourseManagers" should exist',
    ),
  );
  results.push(
    await check(
      "20260512000000_add_manual_reminder_log",
      () => tableExists("ManualReminderLog"),
      'Table "ManualReminderLog" should exist',
    ),
  );
  results.push(
    await check(
      "20260526000000_add_public_iso_doc",
      () => tableExists("PublicIsoDoc"),
      'Table "PublicIsoDoc" should exist',
    ),
  );

  // Print
  let pad = 0;
  for (const r of results) pad = Math.max(pad, r.name.length);
  console.log("Result  Migration".padEnd(pad + 12) + "Detail");
  console.log("-".repeat(pad + 60));
  let failed = 0;
  for (const r of results) {
    const status = r.ok ? "  PASS" : "  FAIL";
    if (!r.ok) failed += 1;
    console.log(
      `${status}  ${r.name.padEnd(pad + 4)}${r.ok ? "applied" : r.detail}`,
    );
  }
  console.log("-".repeat(pad + 60));
  console.log(`${results.length - failed}/${results.length} checks passed`);
  if (failed > 0) {
    console.log(
      `\n${failed} migration(s) appear unapplied. To apply manually:\n` +
        `  psql $env:DATABASE_URL -f prisma/migrations/<name>/migration.sql\n` +
        `(Or run each missing migration's SQL via prisma db execute.)`,
    );
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().finally(() => prisma.$disconnect());
