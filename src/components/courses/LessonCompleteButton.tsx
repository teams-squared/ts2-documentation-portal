"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircleIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { useToast } from "@/components/ui/ToastProvider";

interface LessonCompleteButtonProps {
  courseId: string;
  moduleId: string;
  lessonId: string;
  initialCompleted: boolean;
}

export function LessonCompleteButton({
  courseId,
  moduleId,
  lessonId,
  initialCompleted,
}: LessonCompleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isCompleted, setIsCompleted] = useState(initialCompleted);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}/complete`;

  async function handleMarkComplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to mark complete");
      }
      setIsCompleted(true);
      toast("Lesson marked complete");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMarkIncomplete() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(endpoint, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to unmark complete");
      }
      setIsCompleted(false);
      toast("Lesson marked incomplete", "info");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  }

  if (isCompleted) {
    return (
      <div className="flex flex-col items-start gap-1" data-testid="lesson-completed-state">
        <div className="flex items-center gap-2 text-sm font-medium text-success">
          {/* scale-in on the check icon gives the moment of completion a
              little body — pairs with the existing progress-affirm pulse
              on the footer track (§9.4). */}
          <CheckCircleIcon className="h-5 w-5 motion-safe:animate-scale-in" />
          Lesson complete
        </div>
        <button
          onClick={handleMarkIncomplete}
          disabled={isLoading}
          className="text-xs text-foreground-subtle transition-colors hover:text-foreground disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm"
          data-testid="mark-incomplete-button"
        >
          {isLoading ? "Saving…" : "Mark as incomplete"}
        </button>
        {error && (
          <p className="text-xs text-danger" data-testid="complete-error">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        onClick={handleMarkComplete}
        disabled={isLoading}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        data-testid="mark-complete-button"
      >
        {isLoading ? <><Spinner size="sm" className="border-primary-foreground border-t-transparent" /> Saving…</> : "Mark complete"}
      </button>
      {error && (
        <p className="text-xs text-danger" data-testid="complete-error">
          {error}
        </p>
      )}
    </div>
  );
}
