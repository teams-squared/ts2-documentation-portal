"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { CourseForm } from "./CourseForm";
import type { NodeTreeItem } from "./NodeTreeSelect";
import {
  PlusIcon,
  SearchIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { useMutationPulse } from "@/hooks/useMutationPulse";
import { useListMorph } from "@/hooks/useListMorph";
import { cn } from "@/lib/utils";
import type { CourseStatus } from "@/lib/types";

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail: string | null;
  status: CourseStatus;
  node: { id: string; name: string } | null;
  createdBy: { name: string | null; email: string };
  createdAt: string;
}

interface GroupedCourses {
  key: string;
  label: string;
  courses: Course[];
}

async function apiFetch<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Request failed (${res.status})`
    );
  }
  return res.json() as Promise<T>;
}

const PAGE_SIZE = 25;

export default function AdminCourseTable({ nodeTree = [] }: { nodeTree?: NodeTreeItem[] }) {
  const { pulse, pulseClass } = useMutationPulse();
  const morph = useListMorph();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CourseStatus | "all">("all");
  const [authorFilter, setAuthorFilter] = useState("all");
  const [nodeFilter, setNodeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<Course[]>("/api/admin/courses")
      .then((data) => {
        setCourses(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setFetchError(
          err instanceof Error ? err.message : "Failed to load courses"
        );
        setLoading(false);
      });
  }, []);

  // Unique authors for filter dropdown
  const authors = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      const key = c.createdBy.email;
      if (!map.has(key)) map.set(key, c.createdBy.name || c.createdBy.email);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [courses]);

  // Unique nodes for filter dropdown
  const nodes = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courses) {
      if (c.node) map.set(c.node.id, c.node.name);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [courses]);

  // Filtered courses
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return courses.filter((c) => {
      const matchesSearch =
        !q ||
        c.title.toLowerCase().includes(q) ||
        (c.description ?? "").toLowerCase().includes(q);
      const matchesStatus = statusFilter === "all" || c.status === statusFilter;
      const matchesAuthor = authorFilter === "all" || c.createdBy.email === authorFilter;
      const matchesNode =
        nodeFilter === "all" ||
        (nodeFilter === "unassigned" ? !c.node : c.node?.id === nodeFilter);
      return matchesSearch && matchesStatus && matchesAuthor && matchesNode;
    });
  }, [courses, search, statusFilter, authorFilter, nodeFilter]);

  // Group by node
  const grouped = useMemo((): GroupedCourses[] => {
    const map = new Map<string, GroupedCourses>();
    for (const c of filtered) {
      const key = c.node?.id ?? "__unassigned__";
      const label = c.node?.name ?? "Unassigned";
      if (!map.has(key)) map.set(key, { key, label, courses: [] });
      map.get(key)!.courses.push(c);
    }
    // Sort: named groups alphabetically, unassigned last
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === "__unassigned__") return 1;
      if (b.key === "__unassigned__") return -1;
      return a.label.localeCompare(b.label);
    });
  }, [filtered]);

  // Pagination across all filtered courses
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * PAGE_SIZE;
  const pageEnd = safePage * PAGE_SIZE;

  // Paginated groups: slice across the flat filtered list but preserve group structure
  const paginatedGroups = useMemo(() => {
    let idx = 0;
    const result: GroupedCourses[] = [];
    for (const group of grouped) {
      const groupEnd = idx + group.courses.length;
      if (groupEnd > pageStart && idx < pageEnd) {
        const sliceStart = Math.max(0, pageStart - idx);
        const sliceEnd = Math.min(group.courses.length, pageEnd - idx);
        result.push({
          ...group,
          courses: group.courses.slice(sliceStart, sliceEnd),
        });
      }
      idx = groupEnd;
    }
    return result;
  }, [grouped, pageStart, pageEnd]);

  const resetPage = useCallback(() => setPage(1), []);

  const toggleGroup = useCallback((key: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreate = async (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
    nodeId: string | null;
  }) => {
    const course = await apiFetch<Course>("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setCourses((prev) => [course, ...prev]);
    setShowForm(false);
  };

  const handleStatusChange = async (
    courseId: string,
    newStatus: CourseStatus
  ) => {
    setUpdatingStatus(courseId);
    setStatusError(null);
    try {
      const updated = await apiFetch<Course>(`/api/courses/${courseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setCourses((prev) =>
        prev.map((c) => (c.id === updated.id ? updated : c))
      );
      pulse(updated.id);
    } catch (err: unknown) {
      setStatusError(
        err instanceof Error ? err.message : "Failed to update status"
      );
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-muted text-left">
              {["Course", "Status", "Author", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-foreground-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="text-sm text-danger py-8 text-center">
        {fetchError}
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Create New Course
        </h3>
        <CourseForm onSubmit={handleCreate} onCancel={() => setShowForm(false)} nodeTree={nodeTree} />
      </div>
    );
  }

  const selectClass =
    "px-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer";

  return (
    <div>
      {statusError && (
        <div className="mb-3 px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {statusError}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <div className="relative w-full sm:flex-1">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground-subtle" />
          <input
            type="text"
            value={search}
            onChange={(e) => morph(() => { setSearch(e.target.value); resetPage(); })}
            placeholder="Search courses…"
            className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => morph(() => { setStatusFilter(e.target.value as CourseStatus | "all"); resetPage(); })}
          className={`${selectClass} w-full sm:w-auto`}
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={authorFilter}
          onChange={(e) => morph(() => { setAuthorFilter(e.target.value); resetPage(); })}
          className={`${selectClass} w-full sm:w-auto`}
        >
          <option value="all">All authors</option>
          {authors.map(([email, name]) => (
            <option key={email} value={email}>{name}</option>
          ))}
        </select>
        <select
          value={nodeFilter}
          onChange={(e) => morph(() => { setNodeFilter(e.target.value); resetPage(); })}
          className={`${selectClass} w-full sm:w-auto`}
        >
          <option value="all">All nodes</option>
          {nodes.map(([id, name]) => (
            <option key={id} value={id}>{name}</option>
          ))}
          <option value="unassigned">Unassigned</option>
        </select>
        <Button
          size="sm"
          onClick={() => setShowForm(true)}
          className="w-full sm:w-auto"
        >
          <PlusIcon className="w-4 h-4" />
          New Course
        </Button>
      </div>

      {/* Count */}
      <p className="text-xs text-foreground-muted mb-3">
        {filtered.length === courses.length
          ? `${courses.length} course${courses.length !== 1 ? "s" : ""}`
          : `${filtered.length} of ${courses.length} courses`}
      </p>

      {/* Grouped course table */}
      {paginatedGroups.length === 0 ? (
        courses.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm px-5 py-12 text-center">
            <h3 className="text-sm font-semibold text-foreground mb-1">
              No courses yet
            </h3>
            <p className="text-sm text-foreground-muted mb-4 max-w-sm mx-auto">
              Create your first course to start building learning content for your team.
            </p>
            <Button
              type="button"
              size="sm"
              onClick={() => setShowForm(true)}
            >
              <PlusIcon className="w-4 h-4" />
              Create your first course
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card shadow-sm px-5 py-10 text-center text-sm text-foreground-subtle">
            No courses match your filters. Try clearing filters or adjusting your search.
          </div>
        )
      ) : (
        <div className="space-y-4">
          {paginatedGroups.map((group) => {
            const isCollapsed = collapsedGroups.has(group.key);
            return (
              <div
                key={group.key}
                className="rounded-lg border border-border bg-card shadow-sm overflow-hidden"
              >
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className="w-full flex items-center gap-2 px-5 py-3 bg-surface-muted text-left hover:bg-border/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                >
                  {isCollapsed ? (
                    <ChevronRightIcon className="w-4 h-4 text-foreground-subtle" />
                  ) : (
                    <ChevronDownIcon className="w-4 h-4 text-foreground-subtle" />
                  )}
                  <span className="text-sm font-medium text-foreground">
                    {group.label}
                  </span>
                  <span className="text-xs text-foreground-subtle">
                    ({group.courses.length})
                  </span>
                </button>

                {/* Course rows */}
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-t border-border text-left">
                        <th className="px-5 py-2.5 font-medium text-foreground-muted text-xs">Course</th>
                        <th className="px-5 py-2.5 font-medium text-foreground-muted text-xs">Status</th>
                        <th className="px-5 py-2.5 font-medium text-foreground-muted text-xs">Author</th>
                        <th className="px-5 py-2.5 font-medium text-foreground-muted text-xs text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {group.courses.map((course) => (
                        <tr
                          key={course.id}
                          className={cn(
                            "hover:bg-surface-muted transition-colors",
                            pulseClass(course.id),
                          )}
                        >
                          <td className="px-5 py-3">
                            <p className="font-medium text-foreground">
                              {course.title}
                            </p>
                            {course.description && (
                              <p className="text-xs text-foreground-muted line-clamp-1 mt-0.5">
                                {course.description}
                              </p>
                            )}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <select
                                value={course.status}
                                onChange={(e) =>
                                  handleStatusChange(course.id, e.target.value as CourseStatus)
                                }
                                disabled={updatingStatus === course.id}
                                aria-label={`Status for ${course.title}`}
                                className="px-2 py-1 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 cursor-pointer"
                              >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                              </select>
                              {updatingStatus === course.id && <Spinner size="sm" />}
                            </div>
                          </td>
                          <td className="px-5 py-3 text-xs text-foreground-muted">
                            {course.createdBy.name || course.createdBy.email}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <Button asChild variant="secondary" size="xs">
                              <Link href={`/admin/courses/${course.id}/edit`}>Edit</Link>
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-xs text-foreground-muted">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
