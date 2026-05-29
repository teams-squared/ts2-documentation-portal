"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Spinner } from "@/components/ui/Spinner";
import { ChevronRightIcon, AlertTriangleIcon, CheckCircleIcon } from "@/components/icons";
import { CourseCompletionModal } from "@/components/courses/CourseCompletionModal";

interface QuizOption {
  id: string;
  text: string;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  order: number;
  options: QuizOption[];
}

interface BestAttempt {
  id: string;
  score: number;
  totalQuestions: number;
  passed: boolean;
  createdAt: string;
}

interface CourseStats {
  totalLessons: number;
  completedLessons: number;
  xpEarned: number;
  daysTaken: number;
}

interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  passed: boolean;
  passingScore: number;
  courseComplete?: boolean;
  courseStats?: CourseStats | null;
  /**
   * Server sets this to true when the enrollment is locked at completed.
   * The attempt is scored for review but no QuizAttempt / QuizAnswer /
   * lessonProgress / XP are persisted. UI shows a "Review mode" banner.
   */
  locked?: boolean;
}

interface QuizViewerProps {
  questions: QuizQuestion[];
  passingScore: number;
  initialBestAttempt: BestAttempt | null;
  courseId: string;
  moduleId: string;
  lessonId: string;
  /** Title of the course — passed to the completion modal. */
  courseTitle: string;
  /** URL of the next lesson — shows a "Continue" CTA after passing. */
  nextLessonUrl?: string | null;
  /**
   * When true, the course is locked at completed. Quiz can still be taken for
   * review/practice, but the server won't persist the attempt and the UI
   * shows a "Review mode — your answers aren't recorded" banner.
   */
  courseLocked?: boolean;
}

type State = "idle" | "taking" | "submitted";

export function QuizViewer({
  questions,
  passingScore,
  initialBestAttempt,
  courseId,
  moduleId,
  lessonId,
  courseTitle,
  nextLessonUrl,
  courseLocked = false,
}: QuizViewerProps) {
  const router = useRouter();
  const [state, setState] = useState<State>("idle");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [courseStats, setCourseStats] = useState<CourseStats | null>(null);

  const bestAttempt = result
    ? {
        id: "current",
        score: result.score,
        totalQuestions: result.totalQuestions,
        passed: result.passed,
        createdAt: new Date().toISOString(),
      }
    : initialBestAttempt;

  const handleStart = () => {
    setSelectedAnswers({});
    setResult(null);
    setError(null);
    setState("taking");
  };

  const handleRetry = () => {
    setSelectedAnswers({});
    setResult(null);
    setError(null);
    setState("taking");
  };

  const handleSelect = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const allAnswered =
    questions.length > 0 &&
    questions.every((q) => selectedAnswers[q.id] !== undefined);

  const handleSubmit = async () => {
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);

    try {
      const answers = Object.entries(selectedAnswers).map(
        ([questionId, selectedOptionId]) => ({ questionId, selectedOptionId }),
      );

      const res = await fetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/quiz/attempt`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        },
      );

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to submit quiz");
        return;
      }

      const data = (await res.json()) as QuizResult;
      setResult(data);
      setState("submitted");
      router.refresh();

      if (data.courseComplete && data.courseStats) {
        setCourseStats(data.courseStats);
        setModalOpen(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-warning/60 bg-warning-subtle p-8 text-center">
        <p className="text-sm text-warning">
          No questions have been added to this quiz yet.
        </p>
      </div>
    );
  }

  // Idle state — show best attempt summary (if any) and start button
  if (state === "idle") {
    return (
      <div className="space-y-6">
        {courseStats && (
          <CourseCompletionModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            courseId={courseId}
            courseTitle={courseTitle}
            stats={courseStats}
          />
        )}
        {bestAttempt?.passed && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-success/60 bg-success-subtle px-5 py-3">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-5 w-5 text-success" aria-hidden="true" />
              <p className="text-sm font-semibold text-success">
                You passed this quiz.
              </p>
            </div>
            {nextLessonUrl && (
              <Link
                href={nextLessonUrl}
                className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                Next lesson
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        )}
        <div className="rounded-lg border border-border bg-surface-muted p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground-muted">
                {questions.length} question{questions.length !== 1 ? "s" : ""}
              </p>
              <p className="text-sm text-foreground-muted">
                Passing score: {passingScore}%
              </p>
            </div>
            {bestAttempt && (
              <div className="text-right">
                <p className="text-xs text-foreground-subtle">Best attempt</p>
                <p
                  className={`text-sm font-semibold ${
                    bestAttempt.passed
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {bestAttempt.score}/{bestAttempt.totalQuestions} (
                  {Math.round((bestAttempt.score / bestAttempt.totalQuestions) * 100)}%)
                </p>
              </div>
            )}
          </div>
          <button
            onClick={handleStart}
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {courseLocked ? "Review Quiz" : bestAttempt ? "Retake Quiz" : "Start Quiz"}
          </button>
          {courseLocked && (
            <p className="mt-2 text-center text-xs text-foreground-muted">
              Course is completed. Quiz attempts here are for review only and
              won&apos;t be recorded.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Taking state — show questions with radio buttons
  if (state === "taking") {
    return (
      <div className="space-y-6">
        {courseStats && (
          <CourseCompletionModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            courseId={courseId}
            courseTitle={courseTitle}
            stats={courseStats}
          />
        )}
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground-muted">
            {questions.length} question{questions.length !== 1 ? "s" : ""} · Passing: {passingScore}%
          </p>
          <p className="text-sm text-foreground-muted">
            {Object.keys(selectedAnswers).length}/{questions.length} answered
          </p>
        </div>

        {questions.map((question, idx) => (
          <div
            key={question.id}
            className="rounded-lg border border-border p-5"
          >
            <p className="mb-3 text-sm font-medium text-foreground">
              {idx + 1}. {question.text}
            </p>
            <div className="space-y-2">
              {question.options.map((option) => (
                <label
                  key={option.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-md border px-4 py-3 transition-colors ${
                    selectedAnswers[question.id] === option.id
                      ? "border-primary bg-primary-subtle"
                      : "border-border hover:bg-surface-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name={`question-${question.id}`}
                    value={option.id}
                    checked={selectedAnswers[question.id] === option.id}
                    onChange={() => handleSelect(question.id, option.id)}
                    className="text-primary focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  <span className="flex-1 text-sm text-foreground">
                    {option.text}
                  </span>
                </label>
              ))}
            </div>
          </div>
        ))}

        {error && (
          <p className="flex items-center gap-1.5 text-sm text-danger">
            <AlertTriangleIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!allAnswered || submitting}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {submitting ? <span className="inline-flex items-center gap-2"><Spinner size="sm" className="border-primary-foreground border-t-transparent" /> Submitting…</span> : "Submit Quiz"}
        </button>
      </div>
    );
  }

  // Submitted state — show results
  const currentResult = result;
  if (!currentResult) return null;

  return (
    <div className="space-y-6">
      {courseStats && (
        <CourseCompletionModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          courseId={courseId}
          courseTitle={courseTitle}
          stats={courseStats}
        />
      )}

      {/* Review-mode banner — shown when the server returned locked:true.
          Course is already completed; this attempt was scored but not saved. */}
      {currentResult.locked && (
        <div className="rounded-lg border border-info/60 bg-info-subtle px-5 py-3 text-sm text-info">
          Review mode: your answers aren&apos;t recorded. The course is already
          marked complete.
        </div>
      )}

      {/* Score banner */}
      <div
        className={`rounded-lg border p-6 text-center ${
          currentResult.passed
            ? "border-success/60 bg-success-subtle"
            : "border-danger/60 bg-danger-subtle"
        }`}
      >
        <p
          className={`mb-1 text-2xl font-bold ${
            currentResult.passed ? "text-success" : "text-danger"
          }`}
        >
          {currentResult.percentage}%
        </p>
        <p
          className={`text-sm font-medium ${
            currentResult.passed ? "text-success" : "text-danger"
          }`}
        >
          {currentResult.passed ? "Passed!" : "Not passed"}: {currentResult.score}/
          {currentResult.totalQuestions} correct
        </p>
        <p className="mt-1 text-xs text-foreground-muted">
          Passing score: {currentResult.passingScore}%
        </p>
        {currentResult.passed && nextLessonUrl && (
          <Link
            href={nextLessonUrl}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Continue to Next Lesson
            <ChevronRightIcon className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Per-question review intentionally omitted: revealing the correct
          answers makes the retry flow trivially gameable. Learners see only
          the score summary above and must study the material to improve. */}
      <div className="rounded-lg border border-border bg-surface-muted p-5 text-center">
        <p className="text-sm text-foreground-muted">
          Individual answers are not shown. Review the lesson content and
          try again to improve your score.
        </p>
      </div>

      {!currentResult.passed && (
        <button
          onClick={handleRetry}
          className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
