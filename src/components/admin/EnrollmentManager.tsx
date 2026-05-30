"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import { ADMIN_LIST_SCROLL, ADMIN_LIST_THEAD } from "@/components/admin/listScroll";
import type { NodeWithChildren } from "@/lib/courseNodes";

interface Course {
  id: string;
  title: string;
}

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface Enrollment {
  id: string;
  course: Course;
  user: User;
  enrolledBy: User | null;
  enrolledAt: string;
}

interface EnrollmentManagerProps {
  nodeTree: NodeWithChildren[];
  users: User[];
  initialEnrollments: Enrollment[];
}

export function EnrollmentManager({
  nodeTree,
  users,
  initialEnrollments,
}: EnrollmentManagerProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<Enrollment[]>(initialEnrollments);
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [selectedUser, setSelectedUser] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [unenrollingId, setUnenrollingId] = useState<string | null>(null);
  const [pendingUnenroll, setPendingUnenroll] = useState<Enrollment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleEnroll = async () => {
    if (selectedCourseIds.size === 0 || !selectedUser) {
      setError("Please select at least one course and a user");
      return;
    }
    setEnrolling(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/enrollments/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser,
          courseIds: Array.from(selectedCourseIds),
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to enroll user");
        return;
      }
      const result = (await res.json()) as {
        created: Enrollment[];
        skipped: string[];
        xpAwarded?: number;
      };
      if (result.created.length > 0) {
        setEnrollments([...result.created, ...enrollments]);
        toast(`Enrolled in ${result.created.length} course${result.created.length !== 1 ? "s" : ""}`);
      }
      if (result.skipped.length > 0) {
        toast(`${result.skipped.length} already enrolled (skipped)`);
      }
      setSelectedCourseIds(new Set());
      setSelectedUser("");
      router.refresh();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setEnrolling(false);
    }
  };

  const handleUnenroll = async () => {
    if (!pendingUnenroll) return;
    const id = pendingUnenroll.id;
    setUnenrollingId(id);
    try {
      const res = await fetch(`/api/admin/enrollments/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setEnrollments(enrollments.filter((e) => e.id !== id));
        toast("Enrollment removed");
        router.refresh();
      }
    } finally {
      setUnenrollingId(null);
      setPendingUnenroll(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Enroll form */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Enroll a user</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Pick one or more courses from the tree, choose a user, then click Enroll.
          </p>
        </div>

        {/* Course tree */}
        <div>
          <label className="block text-xs font-medium text-foreground-muted mb-1.5">
            Courses <span className="text-foreground-subtle font-normal">({selectedCourseIds.size} selected)</span>
          </label>
          {nodeTree.length === 0 ? (
            <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border">
              No published courses available. Publish a course first, then return here to enroll users.
            </p>
          ) : (
            <CourseNodeTree
              nodes={nodeTree}
              selectedCourseIds={selectedCourseIds}
              onSelectionChange={setSelectedCourseIds}
            />
          )}
        </div>

        {/* User select + enroll button */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground-muted mb-1">
              User
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="rounded-lg border border-border bg-surface text-sm text-foreground px-3 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Select user to enroll"
            >
              <option value="">Select user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name ?? u.email} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => void handleEnroll()}
            disabled={enrolling || selectedCourseIds.size === 0 || !selectedUser}
            className="rounded-lg bg-primary hover:bg-primary-hover disabled:opacity-50 text-primary-foreground text-sm font-medium px-4 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {enrolling ? "Enrolling…" : `Enroll in ${selectedCourseIds.size} course${selectedCourseIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>

        {error && (
          <p className="text-sm text-danger">{error}</p>
        )}
      </div>

      {/* Enrollment list */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-sm font-medium text-foreground">
            {enrollments.length} enrollment{enrollments.length !== 1 ? "s" : ""}
          </p>
        </div>
        {enrollments.length === 0 ? (
          <p className="text-sm text-foreground-subtle px-5 py-8 text-center">
            No enrollments yet.
          </p>
        ) : (
          // Scroll the list internally so the page itself stays put.
          <div className={ADMIN_LIST_SCROLL}>
          <table className="w-full text-sm">
            <thead className={ADMIN_LIST_THEAD}>
              <tr className="bg-surface-muted text-left">
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  User
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Course
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Enrolled by
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted">
                  Date
                </th>
                <th className="px-5 py-3 font-medium text-foreground-muted text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {enrollments.map((e) => (
                <tr
                  key={e.id}
                  className="hover:bg-surface-muted transition-colors"
                >
                  <td className="px-5 py-3">
                    <p className="font-medium text-foreground">
                      {e.user.name ?? e.user.email}
                    </p>
                    <p className="text-xs text-foreground-subtle">{e.user.email}</p>
                  </td>
                  <td className="px-5 py-3 text-foreground">
                    {e.course.title}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {e.enrolledBy ? (e.enrolledBy.name ?? e.enrolledBy.email) : "—"}
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {new Date(e.enrolledAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setPendingUnenroll(e)}
                      disabled={unenrollingId === e.id}
                      className="text-xs text-danger hover:text-danger disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded"
                      aria-label={`Unenroll ${e.user.name ?? e.user.email}`}
                    >
                      {unenrollingId === e.id ? "Unenrolling…" : "Unenroll"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={pendingUnenroll !== null}
        onOpenChange={(open) => !open && setPendingUnenroll(null)}
        title="Unenroll user?"
        description={
          pendingUnenroll ? (
            <>
              Remove{" "}
              <span className="font-medium text-foreground">
                {pendingUnenroll.user.name ?? pendingUnenroll.user.email}
              </span>{" "}
              from{" "}
              <span className="font-medium text-foreground">
                {pendingUnenroll.course.title}
              </span>
              ? Their progress on this course will be deleted.
            </>
          ) : null
        }
        confirmLabel="Unenroll"
        onConfirm={handleUnenroll}
        loading={unenrollingId !== null}
      />
    </div>
  );
}
