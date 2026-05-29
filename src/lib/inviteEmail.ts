/** Org domain auto-appended to bare usernames in the invite flow. */
export const DEFAULT_INVITE_DOMAIN = "teamsquared.io";

/**
 * Normalize an invite-email input. Trims + lowercases, then:
 *  - bare username (no "@") → append the org domain
 *    (`akil` → `akil@teamsquared.io`)
 *  - fully-qualified address → pass through unchanged
 *    (`akil@gmail.com` stays `akil@gmail.com`)
 *
 * Empty input stays empty. Anything malformed (e.g. `akil@`) is returned
 * as-is so the caller's EMAIL_RE check can reject it.
 */
export function normalizeInviteEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.includes("@")) return trimmed;
  return `${trimmed}@${DEFAULT_INVITE_DOMAIN}`;
}
