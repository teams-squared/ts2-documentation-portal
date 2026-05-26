import { auth } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { prismaLessonTypeToApp } from "@/lib/types";
import type { Role } from "@/lib/types";
import { canViewCourse } from "@/lib/courseAccess";

import { LessonViewer } from "@/components/courses/LessonViewer";
import { QuizViewer } from "@/components/courses/QuizViewer";
import { QuizBuilder } from "@/components/courses/QuizBuilder";
import { CourseSidebar } from "@/components/courses/CourseSidebar";
import { LessonFooter } from "@/components/courses/LessonFooter";
import { LessonTitleHeader } from "@/components/courses/LessonTitleHeader";
import { PolicyDocViewer } from "@/components/courses/PolicyDocViewer";
import type { ReviewHistoryEntry, RevisionHistoryEntry } from "@/lib/policy-doc/types";
import { CheckCircleIcon, ClockIcon, AlertTriangleIcon } from "@/components/icons";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { RevealOnView } from "@/components/ui/RevealOnView";
import { computeDeadline, getDeadlineStatus, formatDeadlineRelative } from "@/lib/deadlines";
import type { DeadlineInfo } from "@/lib/deadlines";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id: courseId, lessonId } = await params;
  const userId = session.user!.id!;

  // Fetch lesson with its module + course info
  const lesson = await prisma.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: {
        include: {
          course: {
            select: { id: true, title: true, status: true, createdById: true },
          },
        },
      },
    },
  });

  if (!lesson) notFound();

  const course = lesson.module.course;

  // Check if user has privileged access (admin, manager-creator, assigned instructor)
  const role = session.user?.role as Role;
  const isPrivilegedUser = await canViewCourse(userId, role, courseId);

  // Non-privileged users can only view published course lessons
  if (course.status !== "PUBLISHED" && !isPrivilegedUser) {
    notFound();
  }

  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (!enrollment && !isPrivilegedUser) {
    redirect("/courses");
  }

  // Fetch all modules + lessons for the sidebar (and progress computation)
  const modules = await prisma.module.findMany({
    where: { courseId },
    include: {
      lessons: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, type: true, order: true, deadlineDays: true },
      },
    },
    orderBy: { order: "asc" },
  });

  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));

  // Fetch progress records for this user across all course lessons
  const progressRecords = await prisma.lessonProgress.findMany({
    where: { userId, lessonId: { in: allLessonIds } },
  });

  const completedIds = new Set(
    progressRecords
      .filter((p) => p.completedAt !== null)
      .map((p) => p.lessonId),
  );

  const totalLessons = allLessonIds.length;
  const actualCompletedCount = completedIds.size;
  // courseLocked: enrollment.completedAt has been stamped (sticky). While
  // locked the learner can review everything but their actions don't change
  // progress; UI shows 100% regardless of new lessons added later.
  const courseLocked = enrollment?.completedAt != null;
  const percentComplete = courseLocked
    ? 100
    : totalLessons === 0
      ? 0
      : Math.round((actualCompletedCount / totalLessons) * 100);

  const isCurrentLessonCompleted = courseLocked || completedIds.has(lessonId);
  const isCourseComplete = courseLocked || (totalLessons > 0 && actualCompletedCount === totalLessons);

  // Compute deadline info for all lessons (for sidebar indicators)
  const allLessonsFlat2 = modules.flatMap((m) => m.lessons);
  const deadlineInfoMap: Record<string, DeadlineInfo> = {};
  if (enrollment) {
    for (const l of allLessonsFlat2) {
      if (l.deadlineDays != null) {
        const completedAt = completedIds.has(l.id) ? new Date() : null;
        deadlineInfoMap[l.id] = {
          deadlineDays: l.deadlineDays,
          absoluteDeadline: computeDeadline(enrollment.enrolledAt, l.deadlineDays).toISOString(),
          status: getDeadlineStatus(enrollment.enrolledAt, l.deadlineDays, completedAt),
        };
      }
    }
  }

  // Current lesson deadline info for the banner
  const currentDeadlineInfo = deadlineInfoMap[lessonId] ?? null;
  const showDeadlineBanner =
    currentDeadlineInfo &&
    !isCurrentLessonCompleted &&
    (currentDeadlineInfo.status === "due-soon" || currentDeadlineInfo.status === "overdue");

  const sidebarModules = modules.map((m) => ({
    id: m.id,
    title: m.title,
    order: m.order,
    lessons: m.lessons.map((l) => ({
      ...l,
      type: prismaLessonTypeToApp(l.type),
    })),
  }));

  const lessonType = prismaLessonTypeToApp(lesson.type);
  const isQuiz = lessonType === "quiz";
  const isPolicyDoc = lessonType === "policy_doc";
  const isLink = lessonType === "link";
  const isPrivileged = isPrivilegedUser;

  // ── Policy doc fetch ──────────────────────────────────────────────────────
  // Pull the snapshot + the learner's prior acknowledgement (for stale-banner
  // detection). The document body itself is rendered by streaming the
  // SharePoint .docx through our proxy with ?format=pdf — no HTML snapshot
  // needs to cross the wire.
  let policyDocViewProps: React.ComponentProps<typeof PolicyDocViewer> | null = null;
  if (isPolicyDoc) {
    const [policyDoc, lastProgress] = await Promise.all([
      prisma.policyDocLesson.findUnique({ where: { lessonId } }),
      prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId } },
        select: { acknowledgedVersion: true, acknowledgedAt: true },
      }),
    ]);

    if (policyDoc) {
      policyDocViewProps = {
        lessonId,
        lessonTitle: lesson.title,
        documentTitle: policyDoc.documentTitle,
        documentCode: policyDoc.documentCode,
        sourceVersion: policyDoc.sourceVersion,
        approver: policyDoc.approver,
        approvedOn: policyDoc.approvedOn?.toISOString() ?? null,
        lastReviewedOn: policyDoc.lastReviewedOn?.toISOString() ?? null,
        sharePointDriveId: policyDoc.sharePointDriveId,
        sharePointItemId: policyDoc.sharePointItemId,
        revisionHistory: (policyDoc.revisionHistory as unknown as RevisionHistoryEntry[]) ?? [],
        reviewHistory: (policyDoc.reviewHistory as unknown as ReviewHistoryEntry[]) ?? [],
        sharePointWebUrl: policyDoc.sharePointWebUrl,
        lastAcknowledgement: lastProgress
          ? {
              version: lastProgress.acknowledgedVersion ?? null,
              acknowledgedAt: lastProgress.acknowledgedAt?.toISOString() ?? null,
            }
          : null,
        alreadyCompleted: completedIds.has(lessonId),
      };
    }
  }

  // Compute prev/next lesson URLs for quiz "Continue" CTA and lesson footer nav
  const allLessonsFlat = sidebarModules.flatMap((m) => m.lessons);
  const currentLessonIdx = allLessonsFlat.findIndex((l) => l.id === lessonId);
  const nextLesson =
    currentLessonIdx >= 0 && currentLessonIdx < allLessonsFlat.length - 1
      ? allLessonsFlat[currentLessonIdx + 1]
      : null;
  const nextLessonUrl = nextLesson ? `/courses/${courseId}/lessons/${nextLesson.id}` : null;
  const prevLesson =
    currentLessonIdx > 0 ? allLessonsFlat[currentLessonIdx - 1] : null;
  const prevLessonUrl = prevLesson ? `/courses/${courseId}/lessons/${prevLesson.id}` : null;

  // Fetch quiz data for quiz-type lessons
  let quizQuestions: {
    id: string;
    text: string;
    order: number;
    options: { id: string; text: string; isCorrect: boolean; order: number }[];
  }[] = [];
  let quizPassingScore = 70;
  let quizBestAttempt: {
    id: string;
    score: number;
    totalQuestions: number;
    passed: boolean;
    createdAt: string;
  } | null = null;

  if (isQuiz) {
    if (lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content) as { passingScore?: number };
        if (typeof parsed.passingScore === "number") {
          quizPassingScore = parsed.passingScore;
        }
      } catch {
        // use default
      }
    }

    quizQuestions = await prisma.quizQuestion.findMany({
      where: { lessonId },
      include: { options: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    });

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: "desc" },
    });

    if (attempts.length > 0) {
      const best = attempts.reduce((b, a) => (a.score > b.score ? a : b), attempts[0]);
      quizBestAttempt = {
        id: best.id,
        score: best.score,
        totalQuestions: best.totalQuestions,
        passed: best.passed,
        createdAt: best.createdAt.toISOString(),
      };
    }

    // For employees: omit isCorrect
    if (!isPrivileged) {
      quizQuestions = quizQuestions.map((q) => ({
        ...q,
        options: q.options.map((o) => ({ ...o, isCorrect: false })),
      }));
    }
  }

  return (
    <div className="relative flex h-[calc(100dvh-4rem)] overflow-hidden">
      <CourseSidebar
        modules={sidebarModules}
        courseId={courseId}
        currentLessonId={lessonId}
        courseTitle={course.title}
        completedLessonIds={completedIds}
        percentComplete={percentComplete}
        deadlineInfoMap={deadlineInfoMap}
      />

      <main className="flex flex-1 flex-col overflow-hidden min-w-0">
        <div className="flex-1 overflow-y-auto">
        {/* Width scale per design-system §8.7: text/markdown/quiz stays at
            max-w-3xl for comfortable line length; media gets a wider column;
            policy_doc gets the full available width because the embedded PDF
            is the focus and benefits from every available pixel. */}
        <div className="overflow-x-auto">
        {/* RevealOnView keyed on lessonId re-mounts on lesson nav so the new
            body fades in fresh rather than snapping. See design-system §9.3. */}
        <RevealOnView
          key={lessonId}
          className={`${
            lessonType === "policy_doc"
              ? "w-full"
              : lessonType === "document" || lessonType === "video" || lessonType === "html"
                ? "max-w-5xl"
                : "max-w-3xl"
          } mx-auto px-4 sm:px-6 py-8`}
        >
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Courses", href: "/courses" },
              { label: course.title, href: `/courses/${courseId}` },
              { label: lesson.title },
            ]}
          />

          {/* Deadline warning banner */}
          {showDeadlineBanner && currentDeadlineInfo && (
            <div className={`mb-6 flex items-center gap-3 rounded-lg border px-5 py-4 ${
              currentDeadlineInfo.status === "overdue"
                ? "border-danger/60 bg-danger-subtle"
                : "border-warning/60 bg-warning-subtle"
            }`}>
              {currentDeadlineInfo.status === "overdue" ? (
                <AlertTriangleIcon className="h-5 w-5 flex-shrink-0 text-danger" />
              ) : (
                <ClockIcon className="h-5 w-5 flex-shrink-0 text-warning" />
              )}
              <p className={`text-sm font-medium ${
                currentDeadlineInfo.status === "overdue"
                  ? "text-danger"
                  : "text-warning"
              }`}>
                {formatDeadlineRelative(new Date(currentDeadlineInfo.absoluteDeadline!))}
              </p>
            </div>
          )}

          {/* Course complete banner */}
          {isCourseComplete && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-success/60 bg-success-subtle px-5 py-4">
              <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-success" />
              <div>
                <p className="text-sm font-semibold text-success">
                  Course complete!
                </p>
                <p className="mt-0.5 text-xs text-foreground-muted">
                  You&apos;ve finished all {totalLessons} lesson{totalLessons !== 1 ? "s" : ""} in this course.
                </p>
              </div>
            </div>
          )}

          {isQuiz ? (
            <>
              <LessonTitleHeader
                title={lesson.title}
                type="quiz"
                estimate={
                  quizQuestions.length > 0
                    ? `${quizQuestions.length} question${quizQuestions.length === 1 ? "" : "s"}`
                    : null
                }
              />
              <QuizViewer
                questions={quizQuestions}
                passingScore={quizPassingScore}
                initialBestAttempt={quizBestAttempt}
                courseId={courseId}
                moduleId={lesson.moduleId}
                lessonId={lessonId}
                courseTitle={course.title}
                nextLessonUrl={nextLessonUrl}
                courseLocked={courseLocked}
              />
              {isCurrentLessonCompleted && (
                <div className="mt-6 flex items-center gap-3 rounded-lg border border-success/60 bg-success-subtle px-5 py-4">
                  <CheckCircleIcon className="h-5 w-5 flex-shrink-0 text-success" />
                  <p className="text-sm font-semibold text-success">
                    Lesson complete. You passed this quiz.
                  </p>
                </div>
              )}
              {isPrivileged && (
                <QuizBuilder
                  initialQuestions={quizQuestions}
                  passingScore={quizPassingScore}
                  courseId={courseId}
                  moduleId={lesson.moduleId}
                  lessonId={lessonId}
                />
              )}
            </>
          ) : isPolicyDoc ? (
            policyDocViewProps ? (
              <PolicyDocViewer {...policyDocViewProps} />
            ) : (
              <div>
                <LessonTitleHeader title={lesson.title} type="policy_doc" />
                <p className="text-sm text-foreground-muted">
                  This policy document hasn&apos;t been synced from SharePoint yet.
                  Ask an admin to bind it before reading.
                </p>
              </div>
            )
          ) : (
            <LessonViewer
              title={lesson.title}
              type={lessonType}
              content={lesson.content}
              lessonId={lesson.id}
              alreadyCompleted={isCurrentLessonCompleted}
            />
          )}
        </RevealOnView>
        </div>
        </div>
        <LessonFooter
          courseId={courseId}
          moduleId={lesson.moduleId}
          lessonId={lessonId}
          currentIndex={currentLessonIdx >= 0 ? currentLessonIdx + 1 : 1}
          totalLessons={totalLessons}
          percentComplete={percentComplete}
          prevLessonUrl={prevLessonUrl}
          nextLessonUrl={nextLessonUrl}
          initialCompleted={isCurrentLessonCompleted}
          courseTitle={course.title}
          hideMarkComplete={isQuiz}
          courseLocked={courseLocked}
          requireScrollToComplete={
            (isPolicyDoc && policyDocViewProps != null) || isLink
          }
          completeLabel={isPolicyDoc ? "Acknowledge" : undefined}
        />
      </main>
    </div>
  );
}
