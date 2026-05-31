import { prisma } from "./prisma";
import { checkAndAwardAchievements } from "./achievements";

/**
 * Award XP to a user, update their streak, and check for new achievements.
 * Returns any newly unlocked achievements.
 */
export async function awardXp(userId: string, amount: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.userStats.findUnique({ where: { userId } });

  let newStreak = 1;
  if (existing?.lastActivityDate) {
    const last = new Date(existing.lastActivityDate);
    last.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) {
      newStreak = existing.streak; // same day — keep current streak
    } else if (diffDays === 1) {
      newStreak = existing.streak + 1; // consecutive day
    }
    // else diffDays > 1 → streak resets to 1
  }

  const stats = await prisma.userStats.upsert({
    where: { userId },
    create: { userId, xp: amount, streak: newStreak, lastActivityDate: today },
    update: {
      xp: { increment: amount },
      streak: newStreak,
      lastActivityDate: today,
    },
  });

  const newAchievements = await checkAndAwardAchievements(userId);

  return { stats, newAchievements };
}

/**
 * The displayable streak as of `now`.
 *
 * `UserStats.streak` is a stored counter that is only ever written by
 * `awardXp()` when a learner completes a lesson or quiz. Nothing decays it, so
 * a learner who earned a 4-day streak and then went quiet keeps reading "4-day
 * streak" forever. A streak is only alive if the last activity was today or
 * yesterday; otherwise the chain is broken and the effective streak is 0.
 *
 * Day boundaries use the same local-midnight convention as `awardXp()` so the
 * read path and write path agree.
 */
export function effectiveStreak(
  streak: number,
  lastActivityDate: Date | null | undefined,
  now: Date = new Date(),
): number {
  if (!lastActivityDate || streak <= 0) return 0;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const last = new Date(lastActivityDate);
  last.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  // 0 = active today, 1 = active yesterday (today still in reach) → alive.
  return diffDays <= 1 ? streak : 0;
}

// Re-export for server-side callers
export { calculateLevel } from "./levels";
