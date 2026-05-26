import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { CourseStatusBadge } from "@/components/courses/CourseStatusBadge";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { RevealOnView } from "@/components/ui/RevealOnView";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [
    totalUsers,
    adminCount,
    courseManagerCount,
    employeeCount,
    totalCourses,
    recentUsers,
    recentCourses,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "COURSE_MANAGER" } }),
    prisma.user.count({ where: { role: "EMPLOYEE" } }),
    prisma.course.count(),
    prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, avatar: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    prisma.course.findMany({
      select: { id: true, title: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const stats = [
    { value: totalUsers, label: "Total Users" },
    { value: adminCount, label: "Admins" },
    { value: courseManagerCount, label: "Course Managers" },
    { value: employeeCount, label: "Employees" },
    { value: totalCourses, label: "Courses" },
  ];

  return (
    <div>
      {/* Stats — RevealOnView stagger lets cards arrive in cascade, AnimatedNumber tweens the count-up.
          Cards stretch to a uniform row height (h-full on both wrapper and card) and labels reserve
          two lines of space (min-h-[2lh]) so a wrapping label (e.g. "Course Managers") doesn't
          make one card taller than its row siblings. */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {stats.map(({ value, label }, i) => (
          <RevealOnView key={label} delay={i * 40} className="h-full">
            <div className="h-full flex flex-col rounded-lg border border-border-strong bg-surface shadow-sm hover-lift overflow-hidden">
              <div className="h-1 bg-primary" />
              <div className="p-5 flex-1 flex flex-col">
                <div className="text-2xl font-bold text-primary mb-1">
                  <AnimatedNumber value={value} />
                </div>
                <div className="text-sm text-foreground-muted font-medium min-h-[2lh] leading-tight">
                  {label}
                </div>
              </div>
            </div>
          </RevealOnView>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent signups */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Signups</h2>
            <Button asChild variant="ghost" size="xs">
              <Link href="/admin/users">View all →</Link>
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-sm divide-y divide-border">
            {recentUsers.map((user) => (
              <div key={user.id} className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <UserAvatar name={user.name} image={user.avatar} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {user.name || "Unnamed"}
                    </p>
                    <p className="text-xs text-foreground-muted truncate">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <span className="text-xs text-foreground-subtle">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </span>
                  <Button asChild variant="secondary" size="xs">
                    <Link href={`/admin/users/${user.id}`}>Manage</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent courses */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-foreground">Recent Courses</h2>
            <Button asChild variant="ghost" size="xs">
              <Link href="/admin/courses">View all →</Link>
            </Button>
          </div>
          <div className="rounded-lg border border-border bg-surface shadow-sm divide-y divide-border">
            {recentCourses.map((course) => (
              <div key={course.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {course.title}
                  </p>
                  <p className="text-xs text-foreground-subtle mt-0.5">
                    {new Date(course.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                  <CourseStatusBadge status={course.status.toLowerCase() as "draft" | "published" | "archived"} />
                  <Button asChild variant="secondary" size="xs">
                    <Link href={`/admin/courses/${course.id}/edit`}>Edit</Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
