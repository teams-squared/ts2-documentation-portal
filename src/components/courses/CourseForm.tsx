"use client";

import { useState } from "react";
import { NodeTreeSelect } from "./NodeTreeSelect";
import { FormButton } from "@/components/ui/FormButton";
import type { NodeTreeItem } from "./NodeTreeSelect";
import type { CourseStatus } from "@/lib/types";

interface CourseFormProps {
  initialData?: {
    title: string;
    description: string | null;
    thumbnail: string | null;
    status: CourseStatus;
    nodeId?: string | null;
  };
  nodeTree?: NodeTreeItem[];
  onSubmit: (data: {
    title: string;
    description: string;
    thumbnail: string;
    status: CourseStatus;
    nodeId: string | null;
  }) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

export function CourseForm({
  initialData,
  nodeTree,
  onSubmit,
  onCancel,
  submitLabel = "Create Course",
}: CourseFormProps) {
  const [title, setTitle] = useState(initialData?.title || "");
  const [description, setDescription] = useState(
    initialData?.description || ""
  );
  const [thumbnail, setThumbnail] = useState(initialData?.thumbnail || "");
  const [status, setStatus] = useState<CourseStatus>(
    initialData?.status || "draft"
  );
  const [nodeId, setNodeId] = useState(initialData?.nodeId || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSubmit({ title, description, thumbnail, status, nodeId: nodeId || null });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="p-3 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="course-title"
          className="block text-xs font-medium text-foreground-muted mb-1.5"
        >
          Title *
        </label>
        <input
          id="course-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent transition-all"
          placeholder="Introduction to Cybersecurity"
        />
      </div>

      <div>
        <label
          htmlFor="course-description"
          className="block text-xs font-medium text-foreground-muted mb-1.5"
        >
          Description
        </label>
        <textarea
          id="course-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent transition-all resize-none"
          placeholder="A comprehensive introduction to..."
        />
      </div>

      <div>
        <label
          htmlFor="course-thumbnail"
          className="block text-xs font-medium text-foreground-muted mb-1.5"
        >
          Thumbnail URL
        </label>
        <input
          id="course-thumbnail"
          type="url"
          value={thumbnail}
          onChange={(e) => setThumbnail(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus:border-transparent transition-all"
          placeholder="https://example.com/image.jpg"
        />
      </div>

      <div>
        <label
          htmlFor="course-status"
          className="block text-xs font-medium text-foreground-muted mb-1.5"
        >
          Status
        </label>
        <select
          id="course-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as CourseStatus)}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </div>

      {nodeTree && nodeTree.length > 0 && (
        <div>
          <label
            className="block text-xs font-medium text-foreground-muted mb-1.5"
          >
            Category / Folder
          </label>
          <NodeTreeSelect
            nodes={nodeTree}
            value={nodeId || null}
            onChange={(id) => setNodeId(id ?? "")}
          />
          <p className="text-xs text-foreground-subtle mt-1">
            Optional. Groups this course in the catalog tree. Leave blank to publish without a category.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <FormButton
          type="submit"
          loading={loading}
          pendingLabel="Saving…"
          className="shadow-sm"
        >
          {submitLabel}
        </FormButton>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-surface-muted transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
