"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SharePointFilePicker } from "./SharePointFilePicker";
import { QuizBuilder } from "./QuizBuilder";
import { PolicyDocLessonEditor } from "./PolicyDocLessonEditor";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { DragHandle, SortableItem, SortableList } from "@/components/ui/Sortable";
import type { LessonType } from "@/lib/types";
import type { SharePointDocumentRef } from "@/lib/sharepoint/types";
import { parseLinkContent, serializeLinkContent } from "@/lib/lesson-link";

interface Lesson {
  id: string;
  title: string;
  type: LessonType;
  content: string | null;
  order: number;
  deadlineDays: number | null;
}

interface Module {
  id: string;
  title: string;
  order: number;
  lessons: Lesson[];
}

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

interface QuizLessonData {
  questions: QuizQuestion[];
  passingScore: number;
}

interface ModuleManagerProps {
  courseId: string;
  initialModules: Module[];
  quizDataByLessonId?: Record<string, QuizLessonData>;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

export function ModuleManager({
  courseId,
  initialModules,
  quizDataByLessonId = {},
}: ModuleManagerProps) {
  const router = useRouter();

  const [modules, setModules] = useState<Module[]>(initialModules);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  const [showAddModule, setShowAddModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState("");
  const [addingModule, setAddingModule] = useState(false);

  const [addLessonModuleId, setAddLessonModuleId] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [newLessonType, setNewLessonType] = useState<LessonType>("text");
  const [addingLesson, setAddingLesson] = useState(false);

  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingLessonModuleId, setEditingLessonModuleId] = useState<string | null>(null);
  // Tracks a lesson that was just created via "Add lesson" and immediately
  // opened in the edit dialog. If the admin cancels out without saving body
  // content, we discard the row so empty lessons don't pile up.
  const [justCreatedLessonId, setJustCreatedLessonId] = useState<string | null>(null);
  const [discardingLesson, setDiscardingLesson] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editType, setEditType] = useState<LessonType>("text");
  const [editDeadlineDays, setEditDeadlineDays] = useState<number | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<"edit" | null>(null);
  const [videoSource, setVideoSource] = useState<"sharepoint" | "url">("sharepoint");

  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingModuleTitle, setEditingModuleTitle] = useState("");
  const [savingModuleTitle, setSavingModuleTitle] = useState(false);

  const [deletingModuleId, setDeletingModuleId] = useState<string | null>(null);
  const [deletingLessonId, setDeletingLessonId] = useState<string | null>(null);
  const [pendingDeleteModule, setPendingDeleteModule] = useState<Module | null>(null);
  const [pendingDeleteLesson, setPendingDeleteLesson] = useState<{
    moduleId: string;
    lesson: Lesson;
  } | null>(null);

  const [expandedQuizLessons, setExpandedQuizLessons] = useState<Set<string>>(new Set());
  const [reordering, setReordering] = useState(false);

  const toggleModule = (moduleId: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(moduleId)) next.delete(moduleId);
      else next.add(moduleId);
      return next;
    });
  };

  const toggleQuizBuilder = (lessonId: string) => {
    setExpandedQuizLessons((prev) => {
      const next = new Set(prev);
      if (next.has(lessonId)) next.delete(lessonId);
      else next.add(lessonId);
      return next;
    });
  };

  // ─── Module CRUD ─────────────────────────────────────────────────────────────

  const handleAddModule = async () => {
    if (!newModuleTitle.trim()) return;
    setAddingModule(true);
    try {
      const created = await apiFetch<Module>(`/api/courses/${courseId}/modules`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newModuleTitle }),
      });
      setModules([...modules, { ...created, lessons: [] }]);
      setNewModuleTitle("");
      setShowAddModule(false);
      router.refresh();
    } catch {
      /* retry */
    } finally {
      setAddingModule(false);
    }
  };

  const startRenameModule = (mod: Module) => {
    setEditingModuleId(mod.id);
    setEditingModuleTitle(mod.title);
  };

  const cancelRenameModule = () => {
    setEditingModuleId(null);
    setEditingModuleTitle("");
  };

  const handleRenameModule = async () => {
    if (!editingModuleId) return;
    const title = editingModuleTitle.trim();
    if (!title) return;
    const target = modules.find((m) => m.id === editingModuleId);
    if (target && target.title === title) {
      cancelRenameModule();
      return;
    }
    setSavingModuleTitle(true);
    try {
      const updated = await apiFetch<Module>(
        `/api/courses/${courseId}/modules/${editingModuleId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title }),
        },
      );
      setModules(
        modules.map((m) =>
          m.id === editingModuleId ? { ...m, title: updated.title } : m,
        ),
      );
      cancelRenameModule();
      router.refresh();
    } catch {
      /* keep input open for retry */
    } finally {
      setSavingModuleTitle(false);
    }
  };

  const handleDeleteModule = async () => {
    if (!pendingDeleteModule) return;
    const moduleId = pendingDeleteModule.id;
    setDeletingModuleId(moduleId);
    try {
      await apiFetch(`/api/courses/${courseId}/modules/${moduleId}`, {
        method: "DELETE",
      });
      setModules(modules.filter((m) => m.id !== moduleId));
      router.refresh();
    } finally {
      setDeletingModuleId(null);
      setPendingDeleteModule(null);
    }
  };

  // ─── Module reorder ──────────────────────────────────────────────────────────

  const handleModulesReorder = async (next: Module[]) => {
    if (reordering) return;
    const previous = modules;
    setModules(next);
    setReordering(true);
    try {
      await apiFetch(`/api/courses/${courseId}/modules/reorder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: next.map((m) => m.id) }),
      });
      router.refresh();
    } catch {
      setModules(previous);
    } finally {
      setReordering(false);
    }
  };

  // ─── Lesson CRUD ─────────────────────────────────────────────────────────────

  const handleAddLesson = async (moduleId: string) => {
    if (!newLessonTitle.trim()) return;
    setAddingLesson(true);
    try {
      const created = await apiFetch<Lesson>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: newLessonTitle, type: newLessonType }),
        }
      );
      setModules(
        modules.map((m) =>
          m.id === moduleId ? { ...m, lessons: [...m.lessons, created] } : m
        )
      );
      setNewLessonTitle("");
      setNewLessonType("text");
      setAddLessonModuleId(null);
      // Drop the admin straight into the edit dialog so they can fill in the
      // body — avoids leaving an empty-content lesson stranded in the system
      // and saves the round-trip click. Tracking the id lets the dialog's
      // Cancel button become "Discard lesson" for this single session.
      setJustCreatedLessonId(created.id);
      startEditLesson(moduleId, created);
      router.refresh();
    } catch {
      /* retry */
    } finally {
      setAddingLesson(false);
    }
  };

  const handleDeleteLesson = async () => {
    if (!pendingDeleteLesson) return;
    const { moduleId, lesson } = pendingDeleteLesson;
    const lessonId = lesson.id;
    setDeletingLessonId(lessonId);
    try {
      await apiFetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        { method: "DELETE" }
      );
      setModules(
        modules.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m
        )
      );
      router.refresh();
    } finally {
      setDeletingLessonId(null);
      setPendingDeleteLesson(null);
    }
  };

  // ─── Lesson reorder ──────────────────────────────────────────────────────────

  const handleLessonsReorder = async (moduleId: string, nextLessons: Lesson[]) => {
    if (reordering) return;
    const previous = modules;
    const next = modules.map((m) =>
      m.id === moduleId ? { ...m, lessons: nextLessons } : m,
    );
    setModules(next);
    setReordering(true);

    try {
      await apiFetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderedIds: nextLessons.map((l) => l.id) }),
        },
      );
      router.refresh();
    } catch {
      setModules(previous);
    } finally {
      setReordering(false);
    }
  };

  // ─── Lesson edit modal ───────────────────────────────────────────────────────

  const startEditLesson = (moduleId: string, lesson: Lesson) => {
    setEditingLesson(lesson);
    setEditingLessonModuleId(moduleId);
    setEditTitle(lesson.title);
    setEditType(lesson.type);
    setEditContent(lesson.content ?? "");
    setEditDeadlineDays(lesson.deadlineDays);
    setEditError(null);

    if (lesson.type === "video" && lesson.content) {
      try {
        const parsed = JSON.parse(lesson.content);
        setVideoSource(parsed?.driveId && parsed?.itemId ? "sharepoint" : "url");
      } catch {
        setVideoSource("url");
      }
    } else {
      setVideoSource("sharepoint");
    }
  };

  const handleSaveLesson = async () => {
    if (!editingLesson || !editingLessonModuleId) return;
    if (!editTitle.trim()) {
      setEditError("Title is required");
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      const moduleId = editingLessonModuleId;
      const updated = await apiFetch<Lesson>(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${editingLesson.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: editTitle,
            type: editType,
            content: editContent || null,
            deadlineDays: editDeadlineDays,
          }),
        }
      );

      setModules(
        modules.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === editingLesson.id ? updated : l
                ),
              }
            : m
        )
      );
      setEditingLesson(null);
      setEditingLessonModuleId(null);
      setJustCreatedLessonId(null);
      router.refresh();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setEditSaving(false);
    }
  };

  /** Close the edit dialog without changes (works for both new & existing lessons). */
  const handleCancelEdit = () => {
    setEditingLesson(null);
    setEditingLessonModuleId(null);
    setJustCreatedLessonId(null);
  };

  /** Explicitly discard the lesson — only offered for just-created lessons. */
  const handleDiscardLesson = async () => {
    if (!editingLesson || !editingLessonModuleId) return;
    const moduleId = editingLessonModuleId;
    const lessonId = editingLesson.id;
    setDiscardingLesson(true);
    try {
      await apiFetch(
        `/api/courses/${courseId}/modules/${moduleId}/lessons/${lessonId}`,
        { method: "DELETE" },
      );
      setModules(
        modules.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m,
        ),
      );
      router.refresh();
    } catch {
      // On failure, leave the lesson and close the dialog rather than trap.
    } finally {
      setDiscardingLesson(false);
      setEditingLesson(null);
      setEditingLessonModuleId(null);
      setJustCreatedLessonId(null);
    }
  };

  const handlePickerSelect = (ref: SharePointDocumentRef) => {
    if (pickerTarget === "edit") {
      setEditContent(JSON.stringify(ref));
    }
    setPickerOpen(false);
    setPickerTarget(null);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div>
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Modules &amp; Lessons
          </h2>
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setShowAddModule(true)}
          >
            + Add module
          </Button>
        </div>

        {modules.length === 0 && !showAddModule && (
          <div className="rounded-lg border border-dashed border-border bg-surface/30 px-5 py-8 text-center">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No modules yet
            </h3>
            <p className="text-sm text-foreground-muted mb-4 max-w-md mx-auto">
              Modules group lessons together. You need to add at least one module before you can add lessons.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowAddModule(true)}
            >
              Add your first module
            </Button>
          </div>
        )}

        <SortableList
          items={modules}
          onReorder={handleModulesReorder}
          disabled={reordering}
          className="space-y-3"
        >
          {(module) => (
            <SortableItem key={module.id} id={module.id} disabled={reordering}>
              {({ setNodeRef, style, dragHandleProps: moduleDragHandleProps }) => (
              <div
                ref={setNodeRef}
                style={style}
                className="rounded-lg border border-border bg-card overflow-hidden"
              >
                {/* Module header */}
                <div
                  className="flex items-center gap-2 px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors"
                  onClick={() => {
                    if (editingModuleId === module.id) return;
                    toggleModule(module.id);
                  }}
                >
                  <DragHandle
                    dragHandleProps={moduleDragHandleProps}
                    label={`Drag module ${module.title}`}
                  />
                  <span className="text-foreground-subtle text-xs">
                    {expandedModules.has(module.id) ? "▼" : "▶"}
                  </span>
                  {editingModuleId === module.id ? (
                    <div
                      className="flex-1 flex items-center gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-sm font-medium text-foreground">
                        {module.order}.
                      </span>
                      <input
                        type="text"
                        value={editingModuleTitle}
                        onChange={(e) => setEditingModuleTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void handleRenameModule();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelRenameModule();
                          }
                        }}
                        autoFocus
                        disabled={savingModuleTitle}
                        className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        aria-label={`Module ${module.order} title`}
                      />
                      <Button
                        size="xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRenameModule();
                        }}
                        disabled={
                          savingModuleTitle || !editingModuleTitle.trim()
                        }
                      >
                        {savingModuleTitle ? "Saving…" : "Save"}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelRenameModule();
                        }}
                        disabled={savingModuleTitle}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-foreground flex-1">
                      {module.order}. {module.title}
                    </p>
                  )}
                  <span className="text-xs text-foreground-subtle">
                    {module.lessons.length} lesson{module.lessons.length !== 1 ? "s" : ""}
                  </span>

                  {editingModuleId !== module.id && (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        startRenameModule(module);
                      }}
                      className="ml-2"
                      aria-label={`Rename module ${module.title}`}
                    >
                      Rename
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteModule(module);
                    }}
                    disabled={
                      deletingModuleId === module.id ||
                      editingModuleId === module.id
                    }
                    className="ml-2"
                    aria-label={`Delete module ${module.title}`}
                  >
                    Delete
                  </Button>
                </div>

                {/* Module lessons */}
                {expandedModules.has(module.id) && (
                  <div className="border-t border-border px-4 py-3">
                    <SortableList
                      items={module.lessons}
                      onReorder={(next) => void handleLessonsReorder(module.id, next)}
                      disabled={reordering}
                      className="space-y-2"
                    >
                      {(lesson) => (
                        <SortableItem key={lesson.id} id={lesson.id} disabled={reordering}>
                          {({ setNodeRef: setLessonRef, style: lessonStyle, dragHandleProps: lessonDragHandleProps }) => (
                        <div ref={setLessonRef} style={lessonStyle}>
                          <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-muted">
                            <DragHandle
                              dragHandleProps={lessonDragHandleProps}
                              label={`Drag lesson ${lesson.title}`}
                              size="sm"
                            />
                            <span className="text-xs text-foreground-subtle capitalize w-16 shrink-0">
                              {lesson.type}
                            </span>
                            <p className="text-sm text-foreground flex-1 truncate">
                              {lesson.title}
                            </p>

                            {lesson.type === "quiz" && (quizDataByLessonId[lesson.id]?.questions.length ?? 0) === 0 && (
                              <span
                                className="inline-flex items-center rounded-md bg-warning-subtle text-warning border border-warning/40 text-[10px] font-medium px-1.5 py-0.5"
                                title="This quiz has no questions yet. Learners won't be able to complete it."
                              >
                                Empty
                              </span>
                            )}
                            <Button
                              variant="secondary"
                              size="xs"
                              onClick={() => startEditLesson(module.id, lesson)}
                            >
                              Edit
                            </Button>
                            {lesson.type === "quiz" && (
                              <Button
                                variant="secondary"
                                size="xs"
                                onClick={() => toggleQuizBuilder(lesson.id)}
                                data-testid={`toggle-quiz-builder-${lesson.id}`}
                              >
                                {expandedQuizLessons.has(lesson.id) ? "Quiz Builder ▲" : "Quiz Builder ▼"}
                              </Button>
                            )}
                            <Button
                              variant="destructive"
                              size="xs"
                              onClick={() => setPendingDeleteLesson({ moduleId: module.id, lesson })}
                              disabled={deletingLessonId === lesson.id}
                              aria-label={`Delete lesson ${lesson.title}`}
                            >
                              Delete
                            </Button>
                          </div>
                          {lesson.type === "quiz" && expandedQuizLessons.has(lesson.id) && (() => {
                            const qData = quizDataByLessonId[lesson.id];
                            if (!qData) return null;
                            return (
                              <div
                                className="mt-1 mb-1 rounded-lg border border-primary/60 bg-primary-subtle/30 px-4 pb-4"
                                data-testid={`quiz-builder-panel-${lesson.id}`}
                              >
                                <QuizBuilder
                                  initialQuestions={qData.questions}
                                  passingScore={qData.passingScore}
                                  courseId={courseId}
                                  moduleId={module.id}
                                  lessonId={lesson.id}
                                />
                              </div>
                            );
                          })()}
                        </div>
                          )}
                        </SortableItem>
                      )}
                    </SortableList>

                    {/* Add lesson */}
                    {addLessonModuleId === module.id ? (
                      <div className="mt-2 rounded-lg border border-border bg-surface/40 p-3">
                        <div className="flex flex-col md:flex-row md:flex-wrap md:items-end gap-3">
                          <div className="flex-1 min-w-0 md:min-w-[200px]">
                            <label
                              htmlFor={`new-lesson-title-${module.id}`}
                              className="block text-xs font-medium text-foreground-muted mb-1"
                            >
                              Lesson title <span className="text-danger">*</span>
                            </label>
                            <input
                              id={`new-lesson-title-${module.id}`}
                              type="text"
                              value={newLessonTitle}
                              onChange={(e) => setNewLessonTitle(e.target.value)}
                              placeholder="e.g. Phishing fundamentals"
                              className="w-full rounded-lg border border-border bg-background text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                          </div>
                          <div className="w-full md:w-auto">
                            <label
                              htmlFor={`new-lesson-type-${module.id}`}
                              className="block text-xs font-medium text-foreground-muted mb-1"
                            >
                              Type
                            </label>
                            <select
                              id={`new-lesson-type-${module.id}`}
                              value={newLessonType}
                              onChange={(e) => setNewLessonType(e.target.value as LessonType)}
                              className="w-full md:w-auto rounded-lg border border-border bg-background text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <option value="text">Text: written content</option>
                              <option value="video">Video: SharePoint clip or URL</option>
                              <option value="quiz">Quiz: graded questions</option>
                              <option value="document">Document: SharePoint file</option>
                              <option value="html">HTML: embedded page</option>
                              <option value="policy_doc">Policy doc: ISO Word doc + acknowledgement</option>
                              <option value="link">Link: external article</option>
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => void handleAddLesson(module.id)}
                              disabled={addingLesson}
                            >
                              {addingLesson ? "Adding…" : "Add lesson"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() => setAddLessonModuleId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-foreground-subtle mt-2">
                          You&apos;ll be able to add the lesson&apos;s content after creating it.
                        </p>
                      </div>
                    ) : (
                      <Button
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setAddLessonModuleId(module.id);
                          setNewLessonTitle("");
                          setNewLessonType("text");
                        }}
                        className="mt-1"
                      >
                        + Add lesson
                      </Button>
                    )}
                  </div>
                )}
              </div>
              )}
            </SortableItem>
          )}
        </SortableList>

        {/* Add module form */}
        {showAddModule && (
          <div className="mt-3">
            <label
              htmlFor="new-module-title"
              className="block text-xs font-medium text-foreground-muted mb-1"
            >
              Module title <span className="text-danger">*</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="new-module-title"
                type="text"
                value={newModuleTitle}
                onChange={(e) => setNewModuleTitle(e.target.value)}
                placeholder="e.g. Week 1: Security basics"
                className="flex-1 rounded-lg border border-border bg-card text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              <Button
                size="sm"
                onClick={() => void handleAddModule()}
                disabled={addingModule}
              >
                {addingModule ? "Adding…" : "Add module"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModule(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* Lesson edit modal */}
      {editingLesson && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-foreground/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90dvh] overflow-y-auto bg-background rounded-lg shadow-lg border border-border p-4 sm:p-6">
            <h3 className="text-base font-semibold text-foreground">
              Edit lesson
            </h3>
            <p className="text-xs text-foreground-muted mt-0.5 mb-4 truncate">
              {editingLesson.title}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Title *
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground-muted mb-1">
                  Type
                </label>
                <select
                  value={editType}
                  onChange={(e) => {
                    setEditType(e.target.value as LessonType);
                    setEditContent("");
                  }}
                  disabled={editingLesson.type === "quiz"}
                  className="w-full sm:w-auto rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Edit lesson type"
                >
                  <option value="text">Text</option>
                  <option value="video">Video</option>
                  <option value="quiz">Quiz</option>
                  <option value="document">Document</option>
                  <option value="html">HTML</option>
                  <option value="policy_doc">Policy doc</option>
                </select>
                {editingLesson.type === "quiz" && (
                  <p className="text-xs text-foreground-subtle mt-1">
                    Quiz type can&apos;t be changed. Converting would orphan
                    the questions. Delete and recreate if you need a different
                    lesson type.
                  </p>
                )}
              </div>

              {editType === "policy_doc" ? (
                <PolicyDocLessonEditor lessonId={editingLesson.id} />
              ) : editType === "link" ? (
                <LinkLessonFields
                  content={editContent}
                  onChange={setEditContent}
                />
              ) : editType === "document" || editType === "html" || (editType === "video" && videoSource === "sharepoint") ? (
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    {editType === "video"
                      ? "SharePoint video"
                      : editType === "html"
                        ? "HTML file"
                        : "Document"}
                  </label>
                  {editType === "video" && (
                    <div className="mb-2 flex flex-col sm:flex-row gap-1 sm:gap-0 sm:inline-flex rounded-lg border border-border p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setVideoSource("sharepoint")}
                        className={`px-3 py-1 rounded-md transition-colors ${videoSource === "sharepoint" ? "bg-primary text-white" : "text-foreground-muted"}`}
                      >
                        SharePoint
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSource("url");
                          setEditContent("");
                        }}
                        className={`px-3 py-1 rounded-md transition-colors ${(videoSource as string) === "url" ? "bg-primary text-white" : "text-foreground-muted"}`}
                      >
                        External URL
                      </button>
                    </div>
                  )}
                  {editContent ? (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground flex-1 truncate">
                        {(() => {
                          try {
                            return (JSON.parse(editContent) as { fileName?: string }).fileName ?? "Selected file";
                          } catch {
                            return "Selected file";
                          }
                        })()}
                      </span>
                      <Button
                        type="button"
                        variant="secondary"
                        size="xs"
                        onClick={() => {
                          setPickerTarget("edit");
                          setPickerOpen(true);
                        }}
                      >
                        Change
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setPickerTarget("edit");
                        setPickerOpen(true);
                      }}
                      className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-primary w-full text-center hover:bg-primary-subtle transition-colors"
                    >
                      Browse SharePoint…
                    </button>
                  )}
                </div>
              ) : editType !== "quiz" ? (
                <div>
                  <label className="block text-xs font-medium text-foreground-muted mb-1">
                    {editType === "video" ? "Video URL" : "Content (Markdown)"}
                  </label>
                  {editType === "video" && (
                    <div className="mb-2 inline-flex rounded-lg border border-border p-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoSource("sharepoint");
                          setEditContent("");
                        }}
                        className={`px-3 py-1 rounded-md transition-colors ${(videoSource as string) === "sharepoint" ? "bg-primary text-white" : "text-foreground-muted"}`}
                      >
                        SharePoint
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoSource("url")}
                        className={`px-3 py-1 rounded-md transition-colors ${videoSource === "url" ? "bg-primary text-white" : "text-foreground-muted"}`}
                      >
                        External URL
                      </button>
                    </div>
                  )}
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={editType === "text" ? 6 : 2}
                    className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder={editType === "video" ? "https://www.youtube.com/embed/..." : "Markdown content…"}
                  />
                </div>
              ) : null}

              {/* Deadline */}
              <div>
                <label
                  htmlFor="edit-lesson-deadline"
                  className="block text-xs font-medium text-foreground-muted mb-1"
                >
                  Deadline (days from enrollment)
                </label>
                <input
                  id="edit-lesson-deadline"
                  type="number"
                  min="1"
                  value={editDeadlineDays ?? ""}
                  onChange={(e) =>
                    setEditDeadlineDays(e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  placeholder="No deadline"
                  className="w-full rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <p className="text-xs text-foreground-subtle mt-1">
                  Days from the learner&apos;s enrollment date before this specific lesson must be completed. Leave empty for no deadline.
                </p>
              </div>

              {editError && (
                <p className="text-sm text-danger">{editError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => void handleSaveLesson()}
                  disabled={editSaving}
                >
                  {editSaving ? "Saving…" : "Save lesson"}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCancelEdit}
                  disabled={editSaving || discardingLesson}
                  title={
                    editingLesson.id === justCreatedLessonId
                      ? "Close without changes. The lesson will stay in the module so you can fill it in later."
                      : undefined
                  }
                >
                  {editingLesson.id === justCreatedLessonId ? "Leave blank" : "Cancel"}
                </Button>
                {editingLesson.id === justCreatedLessonId && (
                  <button
                    onClick={() => void handleDiscardLesson()}
                    disabled={editSaving || discardingLesson}
                    className="ml-auto rounded-lg border border-danger/40 text-sm text-danger px-4 py-2 hover:bg-danger/10 disabled:opacity-50"
                  >
                    {discardingLesson ? "Discarding…" : "Discard lesson"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SharePoint File Picker */}
      <SharePointFilePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickerSelect}
        mimeTypeFilter={
          editType === "video"
            ? (m) => m.startsWith("video/")
            : editType === "html"
              ? (m) => m === "text/html" || m.startsWith("text/html")
              : undefined
        }
        filterLabel={
          editType === "video"
            ? "video files"
            : editType === "html"
              ? "HTML files"
              : undefined
        }
      />

      <ConfirmDialog
        open={pendingDeleteModule !== null}
        onOpenChange={(open) => !open && setPendingDeleteModule(null)}
        title="Delete module?"
        description={
          pendingDeleteModule ? (
            <>
              Delete{" "}
              <span className="font-medium text-foreground">
                {pendingDeleteModule.title}
              </span>{" "}
              and all{" "}
              {pendingDeleteModule.lessons.length} lesson
              {pendingDeleteModule.lessons.length !== 1 ? "s" : ""} inside it? This
              cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete module"
        onConfirm={handleDeleteModule}
        loading={deletingModuleId !== null}
      />

      <ConfirmDialog
        open={pendingDeleteLesson !== null}
        onOpenChange={(open) => !open && setPendingDeleteLesson(null)}
        title="Delete lesson?"
        description={
          pendingDeleteLesson ? (
            <>
              Delete{" "}
              <span className="font-medium text-foreground">
                {pendingDeleteLesson.lesson.title}
              </span>
              ? Learner progress on this lesson will be removed. This cannot be
              undone.
            </>
          ) : null
        }
        confirmLabel="Delete lesson"
        onConfirm={handleDeleteLesson}
        loading={deletingLessonId !== null}
      />
    </div>
  );
}

/** Edit-form panel for `LessonType.LINK` lessons. URL is required and
 *  validated as `http(s)`; blurb is optional. Mirrors the shape of the
 *  video / document edit panels. Updates flow through to the parent's
 *  `editContent` state so the standard save handler picks them up. */
function LinkLessonFields({
  content,
  onChange,
}: {
  content: string;
  onChange: (next: string) => void;
}) {
  const parsed = parseLinkContent(content);
  // We accept a free-text URL during editing (parseLinkContent rejects
  // non-http(s) before render). Empty / partial values during typing are
  // tolerated; the final save still goes through whatever the textarea
  // reflects.
  const draftUrl = parsed?.url ?? safeRawUrl(content);
  const draftBlurb = parsed?.blurb ?? safeRawBlurb(content);

  function update(nextUrl: string, nextBlurb: string) {
    if (!nextUrl) {
      onChange("");
      return;
    }
    onChange(serializeLinkContent({ url: nextUrl, blurb: nextBlurb }));
  }

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="link-url"
          className="block text-xs font-medium text-foreground-muted mb-1"
        >
          Article URL <span className="text-danger">*</span>
        </label>
        <input
          id="link-url"
          type="url"
          inputMode="url"
          value={draftUrl}
          onChange={(e) => update(e.target.value.trim(), draftBlurb)}
          placeholder="https://example.com/article"
          className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div>
        <label
          htmlFor="link-blurb"
          className="block text-xs font-medium text-foreground-muted mb-1"
        >
          Blurb <span className="text-foreground-muted">(optional)</span>
        </label>
        <textarea
          id="link-blurb"
          value={draftBlurb}
          onChange={(e) => update(draftUrl, e.target.value)}
          rows={2}
          placeholder="One sentence describing why this is required reading."
          className="w-full rounded-lg border border-border bg-surface text-sm px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
        />
      </div>
    </div>
  );
}

/** Best-effort recovery of a partially-typed URL from `editContent`
 *  while the user is still editing (parseLinkContent only accepts a
 *  valid http(s) URL). */
function safeRawUrl(raw: string): string {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as { url?: unknown };
    return typeof obj.url === "string" ? obj.url : "";
  } catch {
    return "";
  }
}

function safeRawBlurb(raw: string): string {
  if (!raw) return "";
  try {
    const obj = JSON.parse(raw) as { blurb?: unknown };
    return typeof obj.blurb === "string" ? obj.blurb : "";
  } catch {
    return "";
  }
}
