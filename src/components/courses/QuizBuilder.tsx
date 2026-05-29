"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/Sortable";

interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  order: number;
}

interface QuizQuestion {
  id: string;
  text: string;
  order: number;
  options: QuizOption[];
}

interface QuizBuilderProps {
  initialQuestions: QuizQuestion[];
  passingScore: number;
  courseId: string;
  moduleId: string;
  lessonId: string;
}

interface NewOption {
  text: string;
  isCorrect: boolean;
}

const EMPTY_OPTIONS: NewOption[] = [
  { text: "", isCorrect: false },
  { text: "", isCorrect: false },
];

export function QuizBuilder({
  initialQuestions,
  passingScore,
  courseId,
  moduleId,
  lessonId,
}: QuizBuilderProps) {
  const router = useRouter();
  const [questions, setQuestions] = useState<QuizQuestion[]>(initialQuestions);

  // Passing score state
  const [currentPassingScore, setCurrentPassingScore] = useState(passingScore);
  const [editingPassingScore, setEditingPassingScore] = useState(false);
  const [passingScoreDraft, setPassingScoreDraft] = useState(passingScore);
  const [savingPassingScore, setSavingPassingScore] = useState(false);

  // Add question form state
  const [showForm, setShowForm] = useState(false);
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState<NewOption[]>(EMPTY_OPTIONS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete state
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<QuizQuestion | null>(null);

  // Inline edit state
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editQuestionText, setEditQuestionText] = useState("");
  // `id` is optional: existing options carry their DB id; newly added ones
  // omit it and the server treats them as creates on PATCH.
  const [editOptions, setEditOptions] = useState<{ id?: string; text: string; isCorrect: boolean }[]>([]);
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  // Reorder state
  const [reordering, setReordering] = useState(false);

  const lessonApiBase = `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`;
  const questionsApiBase = `${lessonApiBase}/quiz/questions`;

  // ── Passing score ─────────────────────────────────────────────────────────

  const handleSavePassingScore = async () => {
    const val = Math.max(1, Math.min(100, Math.round(passingScoreDraft)));
    setSavingPassingScore(true);
    try {
      const res = await fetch(lessonApiBase, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: JSON.stringify({ passingScore: val }) }),
      });
      if (res.ok) {
        setCurrentPassingScore(val);
        setEditingPassingScore(false);
        router.refresh();
      }
    } finally {
      setSavingPassingScore(false);
    }
  };

  // ── Add question form ─────────────────────────────────────────────────────

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, { text: "", isCorrect: false }]);
    }
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== idx));
    }
  };

  const handleOptionText = (idx: number, text: string) => {
    setOptions(options.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleCorrectChange = (idx: number) => {
    setOptions(options.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!questionText.trim()) {
      setError("Question text is required");
      return;
    }
    if (options.some((o) => !o.text.trim())) {
      setError("All options must have text");
      return;
    }
    if (!options.some((o) => o.isCorrect)) {
      setError("Mark one option as correct");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(questionsApiBase, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: questionText, options }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to add question");
        return;
      }

      const created = (await res.json()) as QuizQuestion;
      setQuestions([...questions, created]);
      setQuestionText("");
      setOptions(EMPTY_OPTIONS);
      setShowForm(false);
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!pendingDelete) return;
    const questionId = pendingDelete.id;
    setDeletingId(questionId);
    try {
      const res = await fetch(`${questionsApiBase}/${questionId}`, { method: "DELETE" });
      if (res.ok) {
        setQuestions(questions.filter((q) => q.id !== questionId));
        router.refresh();
      }
    } finally {
      setDeletingId(null);
      setPendingDelete(null);
    }
  };

  // ── Inline edit ───────────────────────────────────────────────────────────

  const startEdit = (question: QuizQuestion) => {
    setEditingQuestionId(question.id);
    setEditQuestionText(question.text);
    setEditOptions(question.options.map((o) => ({ id: o.id, text: o.text, isCorrect: o.isCorrect })));
    setEditError(null);
  };

  const cancelEdit = () => {
    setEditingQuestionId(null);
    setEditError(null);
  };

  const handleEditOptionText = (idx: number, text: string) => {
    setEditOptions(editOptions.map((o, i) => (i === idx ? { ...o, text } : o)));
  };

  const handleEditCorrect = (idx: number) => {
    setEditOptions(editOptions.map((o, i) => ({ ...o, isCorrect: i === idx })));
  };

  const handleEditAddOption = () => {
    if (editOptions.length < 6) {
      setEditOptions([...editOptions, { text: "", isCorrect: false }]);
    }
  };

  const handleEditRemoveOption = (idx: number) => {
    if (editOptions.length <= 2) return;
    const wasCorrect = editOptions[idx].isCorrect;
    const next = editOptions.filter((_, i) => i !== idx);
    // If we removed the correct option, default the first remaining to correct.
    if (wasCorrect && next.length > 0) {
      next[0] = { ...next[0], isCorrect: true };
    }
    setEditOptions(next);
  };

  const handleSaveEdit = async (questionId: string) => {
    setEditError(null);
    if (!editQuestionText.trim()) {
      setEditError("Question text cannot be empty");
      return;
    }
    if (editOptions.some((o) => !o.text.trim())) {
      setEditError("All options must have text");
      return;
    }
    if (!editOptions.some((o) => o.isCorrect)) {
      setEditError("Mark one option as correct");
      return;
    }

    setSavingEditId(questionId);
    try {
      const res = await fetch(`${questionsApiBase}/${questionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: editQuestionText.trim(),
          options: editOptions.map((o) => ({ id: o.id, text: o.text.trim(), isCorrect: o.isCorrect })),
        }),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setEditError(data.error ?? "Failed to save changes");
        return;
      }

      const updated = (await res.json()) as QuizQuestion;
      setQuestions(questions.map((q) => (q.id === questionId ? updated : q)));
      setEditingQuestionId(null);
      router.refresh();
    } catch {
      setEditError("An unexpected error occurred");
    } finally {
      setSavingEditId(null);
    }
  };

  // ── Reorder ───────────────────────────────────────────────────────────────

  const handleReorder = async (next: QuizQuestion[]) => {
    const previous = questions;
    setQuestions(next);
    setReordering(true);
    try {
      const res = await fetch(`${questionsApiBase}/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((q) => q.id) }),
      });
      if (res.ok) {
        const updated = (await res.json()) as QuizQuestion[];
        setQuestions(updated);
        router.refresh();
      } else {
        setQuestions(previous);
      }
    } catch {
      setQuestions(previous);
    } finally {
      setReordering(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="mt-8 border-t border-border pt-8">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-semibold text-foreground">
            Quiz Builder
          </h2>
          {editingPassingScore ? (
            <div className="mt-1 flex items-center gap-2">
              <label className="text-xs text-foreground-muted">Passing score:</label>
              <input
                type="number"
                min={1}
                max={100}
                value={passingScoreDraft}
                onChange={(e) => setPassingScoreDraft(Number(e.target.value))}
                aria-label="Passing score"
                className="w-16 rounded border border-border bg-surface px-2 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <span className="text-xs text-foreground-muted">% <span className="text-foreground-subtle">(1–100)</span></span>
              <button
                onClick={handleSavePassingScore}
                disabled={savingPassingScore}
                className="text-xs text-primary hover:underline disabled:opacity-50"
              >
                {savingPassingScore ? "Saving…" : "Save"}
              </button>
              <button
                onClick={() => {
                  setEditingPassingScore(false);
                  setPassingScoreDraft(currentPassingScore);
                }}
                className="text-xs text-foreground-muted hover:underline"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPassingScoreDraft(currentPassingScore);
                setEditingPassingScore(true);
              }}
              aria-label="Edit passing score"
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-foreground-muted transition-colors hover:text-primary"
            >
              <span>Passing score: {currentPassingScore}%</span>
              <Pencil className="w-3 h-3" aria-hidden="true" />
            </button>
          )}
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Add question
          </button>
        )}
      </div>

      {/* Existing questions */}
      {questions.length === 0 && !showForm && (
        <p className="text-sm italic text-foreground-subtle">
          No questions yet. Add one above.
        </p>
      )}

      <SortableList
        items={questions}
        onReorder={handleReorder}
        disabled={reordering}
        className="mb-4 space-y-3"
      >
        {(question, idx) => (
          <SortableItem key={question.id} id={question.id} disabled={reordering}>
            {({ setNodeRef, style, dragHandleProps }) => (
          <div
            ref={setNodeRef}
            style={style}
            className="rounded-lg border border-border bg-surface p-4"
          >
            {editingQuestionId === question.id ? (
              /* Inline edit form */
              <div className="space-y-3">
                <input
                  type="text"
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  aria-label="Edit question text"
                  className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <div className="space-y-2">
                  {editOptions.map((opt, oidx) => (
                    <div key={opt.id ?? `new-${oidx}`} className="flex items-center gap-2 flex-wrap">
                      <input
                        type="radio"
                        name={`edit-correct-${question.id}`}
                        checked={opt.isCorrect}
                        onChange={() => handleEditCorrect(oidx)}
                        title={`Mark option ${oidx + 1} as correct`}
                        className="shrink-0 text-primary focus:ring-ring"
                      />
                      <input
                        type="text"
                        value={opt.text}
                        onChange={(e) => handleEditOptionText(oidx, e.target.value)}
                        placeholder={`Option ${oidx + 1}`}
                        aria-label={`Option ${oidx + 1} text`}
                        className="flex-1 min-w-0 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                      {editOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleEditRemoveOption(oidx)}
                          aria-label={`Remove option ${oidx + 1}`}
                          className="shrink-0 text-xs text-danger hover:text-danger/80"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {editOptions.length < 6 && (
                  <button
                    type="button"
                    onClick={handleEditAddOption}
                    className="text-xs text-primary hover:underline"
                  >
                    + Add option
                  </button>
                )}
                {editError && (
                  <p className="text-xs text-danger">{editError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSaveEdit(question.id)}
                    disabled={savingEditId === question.id}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
                  >
                    {savingEditId === question.id ? "Saving…" : "Save"}
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              /* Read-only view */
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <DragHandle
                      dragHandleProps={dragHandleProps}
                      label={`Drag question ${idx + 1}`}
                      size="sm"
                      className="mt-0.5"
                    />
                    <p className="text-sm font-medium text-foreground">
                      {idx + 1}. {question.text}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => startEdit(question)}
                      aria-label={`Edit question ${idx + 1}`}
                      className="px-1 text-xs text-primary transition-colors hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete(question)}
                      disabled={deletingId === question.id}
                      aria-label={`Delete question ${idx + 1}`}
                      className="px-1 text-xs text-danger transition-colors hover:text-danger/80 disabled:opacity-50"
                    >
                      {deletingId === question.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
                <ul className="mt-2 space-y-1">
                  {question.options.map((opt) => (
                    <li key={opt.id} className="flex items-center gap-2 text-xs text-foreground-muted">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          opt.isCorrect ? "bg-success" : "bg-border"
                        }`}
                      />
                      {opt.text}
                      {opt.isCorrect && (
                        <span className="text-success">(correct)</span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
            )}
          </SortableItem>
        )}
      </SortableList>

      {/* Add question form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-lg border border-primary/20 bg-primary-subtle/30 p-5"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Question text
            </label>
            <input
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Enter your question…"
              className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium text-foreground">
              Options (mark one as correct)
            </label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="correct-option"
                    checked={opt.isCorrect}
                    onChange={() => handleCorrectChange(idx)}
                    title={`Mark option ${idx + 1} as correct`}
                    className="shrink-0 text-primary focus:ring-ring"
                  />
                  <input
                    type="text"
                    value={opt.text}
                    onChange={(e) => handleOptionText(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    className="flex-1 rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      aria-label={`Remove option ${idx + 1}`}
                      className="shrink-0 text-xs text-danger hover:text-danger/80"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 6 && (
              <button
                type="button"
                onClick={handleAddOption}
                className="mt-2 text-xs text-primary hover:underline"
              >
                + Add option
              </button>
            )}
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {submitting ? "Adding…" : "Add question"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setError(null);
                setQuestionText("");
                setOptions(EMPTY_OPTIONS);
              }}
              className="rounded-md border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete question?"
        description={
          pendingDelete ? (
            <>
              Delete this question and all of its options? Any learner attempts
              referencing it will lose this question from their results.
              <span className="mt-2 block font-medium text-foreground">
                &ldquo;{pendingDelete.text}&rdquo;
              </span>
            </>
          ) : null
        }
        confirmLabel="Delete question"
        onConfirm={handleDelete}
        loading={deletingId !== null}
      />
    </div>
  );
}
