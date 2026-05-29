import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { RoleBadge } from "@/components/ui/Badge";
import { prismaRoleToApp } from "@/lib/types";
import { EditNameForm } from "@/components/profile/EditNameForm";
import { ChangePasswordForm } from "@/components/profile/ChangePasswordForm";
import { XpProgressBar } from "@/components/gamification/XpProgressBar";
import { StreakBadge } from "@/components/gamification/StreakBadge";
import { AchievementCard } from "@/components/gamification/AchievementCard";

export default async function ProfilePage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) redirect("/login");

  const role = prismaRoleToApp(user.role);

  // Fetch enrollment and completion stats
  const enrollments = await prisma.enrollment.findMany({
    where: { userId: user.id },
    include: {
      course: {
        include: {
          modules: {
            include: { lessons: { select: { id: true } } },
          },
        },
      },
    },
  });

  const allLessonIds = enrollments.flatMap((e) =>
    e.course.modules.flatMap((m) => m.lessons.map((l) => l.id))
  );

  const completedProgress = await prisma.lessonProgress.findMany({
    where: {
      userId: user.id,
      lessonId: { in: allLessonIds },
      completedAt: { not: null },
    },
    select: { lessonId: true },
  });

  const completedLessonIds = new Set(completedProgress.map((p) => p.lessonId));

  // Fetch gamification data
  const [userStats, allAchievements, userAchievements] = await Promise.all([
    prisma.userStats.findUnique({ where: { userId: user.id } }),
    prisma.achievement.findMany({ orderBy: [{ category: "asc" }, { threshold: "asc" }] }),
    prisma.userAchievement.findMany({
      where: { userId: user.id },
      select: { achievementId: true, unlockedAt: true },
    }),
  ]);

  const xp = userStats?.xp ?? 0;
  const streak = userStats?.streak ?? 0;
  const unlockedMap = new Map(userAchievements.map((ua) => [ua.achievementId, ua.unlockedAt]));
  const recentAchievements = allAchievements
    .map((a) => ({ ...a, unlockedAt: unlockedMap.get(a.id) ?? null }))
    .filter((a) => a.unlockedAt)
    .sort((a, b) => (b.unlockedAt!.getTime() - a.unlockedAt!.getTime()))
    .slice(0, 6);

  // Count courses where all lessons are completed
  const completedCourses = enrollments.filter((e) => {
    const courseLessonIds = e.course.modules.flatMap((m) =>
      m.lessons.map((l) => l.id)
    );
    return (
      courseLessonIds.length > 0 &&
      courseLessonIds.every((id) => completedLessonIds.has(id))
    );
  });

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="mb-6 font-display text-2xl font-bold tracking-tight text-foreground">
        My Profile
      </h1>

      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 sm:gap-5 border-b border-border p-6 text-center sm:text-left">
          <UserAvatar name={user.name} image={user.avatar} size="lg" />
          <div className="flex-1">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {user.name || "Unnamed User"}
            </h2>
            <p className="text-sm text-foreground-muted">{user.email}</p>
            <div className="mt-2">
              <RoleBadge role={role} />
            </div>
            <EditNameForm currentName={user.name} />
            <ChangePasswordForm isSsoOnly={!user.passwordHash} />
          </div>
        </div>

        <div className="divide-y divide-border">
          <div className="flex justify-between px-6 py-4">
            <span className="text-sm font-medium text-foreground-muted">
              Member since
            </span>
            <span className="text-sm text-foreground">
              {user.createdAt.toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
          </div>
          <div className="flex justify-between px-6 py-4">
            <span className="text-sm font-medium text-foreground-muted">
              Enrolled courses
            </span>
            <span className="text-sm text-foreground">
              {enrollments.length}
            </span>
          </div>
          <div className="flex justify-between px-6 py-4">
            <span className="text-sm font-medium text-foreground-muted">
              Completed courses
            </span>
            <span className="text-sm text-foreground">
              {completedCourses.length}
            </span>
          </div>
        </div>
      </div>

      {/* Gamification section */}
      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-semibold text-foreground">
              Progress
            </h2>
            <StreakBadge streak={streak} />
          </div>
          <XpProgressBar xp={xp} />
        </div>

        {recentAchievements.length > 0 && (
          <div className="p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-foreground">
                Recent Achievements
              </h3>
              <Link
                href="/profile/achievements"
                className="text-xs text-primary hover:underline"
              >
                View all
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {recentAchievements.map((a) => (
                <AchievementCard
                  key={a.id}
                  icon={a.icon}
                  title={a.title}
                  description={a.description}
                  unlockedAt={a.unlockedAt?.toISOString()}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
