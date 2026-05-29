import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

/**
 * Mobile rendering verification — captures key routes at a Samsung S24-ish
 * viewport (360x780) so the responsive pass can be eyeballed.
 *
 * NOT part of CI. Prerequisites (see helpers.ts for the security note):
 *   1. A NON-PROD Postgres (DATABASE_URL) seeded with the password-login
 *      USERS from helpers.ts. Never run this against the production DB.
 *   2. ALLOW_PASSWORD_LOGIN=true on the target server.
 *   3. `npx playwright install chromium` (once).
 *
 * Run:  npx playwright test e2e/mobile-screenshots.spec.ts
 * Out:  PNGs under e2e/screenshots/ (gitignored).
 */

const VIEWPORT = { width: 360, height: 780 };

const ROUTES: { path: string; name: string }[] = [
  { path: "/", name: "home" },
  { path: "/courses", name: "courses-catalog" },
  { path: "/policies", name: "policies" },
  { path: "/profile", name: "profile" },
  { path: "/admin/users", name: "admin-users" },
  { path: "/admin/analytics", name: "admin-analytics" },
];

test.use({ viewport: VIEWPORT });

test("capture key routes at 360px", async ({ page }) => {
  await login(page, USERS.admin.email, USERS.admin.password);

  for (const { path, name } of ROUTES) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `e2e/screenshots/${name}.png`, fullPage: true });
  }

  // The core Phase 1 change: tap the hamburger, capture the nav drawer open.
  await page.goto("/");
  await page.getByRole("button", { name: /open navigation menu/i }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.screenshot({ path: "e2e/screenshots/mobile-nav-drawer.png" });
});

test("capture a course detail + lesson at 360px", async ({ page }) => {
  await login(page, USERS.admin.email, USERS.admin.password);
  await page.goto("/courses");
  await page.waitForLoadState("networkidle");

  const firstCourse = page.locator('a[href^="/courses/"]').first();
  if ((await firstCourse.count()) === 0) test.skip(true, "no courses seeded");
  await firstCourse.click();
  await page.waitForLoadState("networkidle");
  await page.screenshot({ path: "e2e/screenshots/course-detail.png", fullPage: true });

  const firstLesson = page.locator('a[href*="/lessons/"]').first();
  if ((await firstLesson.count()) > 0) {
    await firstLesson.click();
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: "e2e/screenshots/lesson-player.png", fullPage: true });
  }
});
