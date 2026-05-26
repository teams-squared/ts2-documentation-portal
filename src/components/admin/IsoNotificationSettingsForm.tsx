"use client";

import { useState } from "react";
import { FormButton } from "@/components/ui/FormButton";
import { useToast } from "@/components/ui/ToastProvider";
import { EmailListInput } from "@/components/admin/EmailListInput";

interface Props {
  initialEnabled: boolean;
  initialTo: string[];
  initialCc: string[];
  updatedAt: Date | null;
}

export function IsoNotificationSettingsForm({
  initialEnabled,
  initialTo,
  initialCc,
  updatedAt: initialUpdatedAt,
}: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState<boolean>(initialEnabled);
  const [toEmails, setToEmails] = useState<string[]>(initialTo);
  const [ccEmails, setCcEmails] = useState<string[]>(initialCc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/iso-notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, toEmails, ccEmails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Save failed (${res.status})`,
        );
      }
      const data = await res.json();
      setEnabled(data.enabled);
      setToEmails(data.toEmails);
      setCcEmails(data.ccEmails);
      setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : null);
      toast("Settings saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Master toggle. Recipients below stay editable when disabled so an
          admin can prepare the list before flipping the switch — and the
          values are preserved across enable/disable cycles. */}
      <label className="flex items-start gap-3 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        />
        <span className="space-y-0.5">
          <span className="block text-sm font-medium text-foreground">
            Send notification email when an employee acknowledges an ISO document
          </span>
          <span className="block text-xs text-foreground-muted">
            When off, acknowledgements still record to the database (visible
            under the ISO ack log tab) — only the email is suppressed.
          </span>
        </span>
      </label>

      <div className={enabled ? "space-y-6" : "space-y-6 opacity-60"}>
        <EmailListInput
          label="To"
          helper="Primary recipients (e.g. ISO Officer, ISO Owner)."
          value={toEmails}
          onChange={setToEmails}
          emptyHint="No recipients. Email will not send even if enabled."
        />
        <EmailListInput
          label="Cc"
          helper="Optional copy recipients."
          value={ccEmails}
          onChange={setCcEmails}
        />
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <FormButton type="submit" loading={saving} pendingLabel="Saving…">
          Save settings
        </FormButton>
        {updatedAt && (
          <span className="text-xs text-foreground-muted">
            Last updated {updatedAt.toLocaleString()}
          </span>
        )}
      </div>
    </form>
  );
}
