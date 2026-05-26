"use client";

import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";
import { FormButton } from "@/components/ui/FormButton";

interface ChangePasswordFormProps {
  /** True for SSO-only users who have no local password */
  isSsoOnly: boolean;
}

export function ChangePasswordForm({ isSsoOnly }: ChangePasswordFormProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const resetFields = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = (await res.json()) as { error?: string; success?: boolean };
      if (!res.ok) {
        setError(data.error ?? "Failed to update password");
        return;
      }
      resetFields();
      setSuccess(true);
      toast("Password updated");
      setOpen(false);
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (isSsoOnly) {
    return (
      <p className="mt-1 text-xs text-foreground-subtle">
        Password change is not available for SSO accounts.
      </p>
    );
  }

  if (!open) {
    return (
      <div className="mt-1 flex items-center gap-3">
        <button
          onClick={() => setOpen(true)}
          className="text-xs text-primary hover:underline"
          data-testid="change-password-trigger"
        >
          Change password
        </button>
        {success && (
          <span className="text-xs text-success">
            Password updated successfully.
          </span>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="mt-3 space-y-3 max-w-xs"
      data-testid="change-password-form"
    >
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground-muted">
          Current password
        </label>
        <input
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="current-password-input"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground-muted">
          New password
        </label>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="new-password-input"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-foreground-muted">
          Confirm new password
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          data-testid="confirm-password-input"
        />
      </div>
      {error && (
        <p className="text-xs text-danger" data-testid="password-error">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2">
        <FormButton
          type="submit"
          size="xs"
          loading={saving}
          success={success}
          pendingLabel="Saving…"
          successLabel="Saved"
          data-testid="save-password-button"
        >
          Save password
        </FormButton>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            resetFields();
            setSuccess(false);
          }}
          className="text-xs text-foreground-muted hover:text-foreground"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
