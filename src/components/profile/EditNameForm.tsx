"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { FormButton } from "@/components/ui/FormButton";

interface EditNameFormProps {
  currentName: string | null;
}

export function EditNameForm({ currentName }: EditNameFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName ?? "");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        setError(data.error ?? "Failed to update");
        return;
      }
      setJustSaved(true);
      toast("Name updated");
      router.refresh();
      window.setTimeout(() => {
        setEditing(false);
        setJustSaved(false);
      }, 900);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-primary hover:underline"
      >
        Edit name
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-2 flex items-center gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Your name"
        className="rounded-md border border-border bg-surface px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-ring sm:text-sm"
      />
      <FormButton
        type="submit"
        size="sm"
        loading={saving}
        success={justSaved}
        pendingLabel="Saving…"
        successLabel="Saved"
      >
        Save
      </FormButton>
      <button
        type="button"
        onClick={() => {
          setEditing(false);
          setName(currentName ?? "");
          setError(null);
        }}
        className="text-xs text-foreground-muted hover:text-foreground"
      >
        Cancel
      </button>
      {error && (
        <span className="text-xs text-danger">{error}</span>
      )}
    </form>
  );
}
