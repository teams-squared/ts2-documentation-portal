"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { CourseNodeTree } from "@/components/admin/CourseNodeTree";
import { Button } from "@/components/ui/button";
import { FormButton } from "@/components/ui/FormButton";
import type { NodeWithChildren } from "@/lib/courseNodes";
import type { Role } from "@/lib/types";
import { DEFAULT_INVITE_DOMAIN, normalizeInviteEmail } from "@/lib/inviteEmail";
import type { DirectoryLookup } from "@/lib/entra/graph";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface InviteUserFormProps {
  nodeTree: NodeWithChildren[];
  /** Role of the admin currently viewing — controls role-picker options. */
  inviterRole: Role;
  onCancel: () => void;
  /** Called after at least one recipient is invited; parent should refresh
   *  the user list. Receives the array of successfully invited users. */
  onSuccess: (
    users: { id: string; email: string; name: string | null; role: Role }[],
  ) => void;
}

interface Recipient {
  id: string;
  email: string;
  name: string;
}

type RecipientStatus =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; resent?: boolean; enrollmentCount: number; emailSent: boolean; emailError: string | null }
  | { kind: "already_invited" }
  | { kind: "error"; message: string };

let recipientCounter = 0;
function makeRecipientId(): string {
  recipientCounter += 1;
  return `r${recipientCounter}`;
}

/** Parse a pasted block of `email, name` lines into recipients. Accepts
 *  comma, semicolon, or tab as the field separator. Lines with just an
 *  email (no comma) become recipients with an empty name. Blank lines
 *  are skipped. Invalid emails are still added so the admin can see and
 *  fix them — validation happens at submit time. */
function parsePaste(input: string): Recipient[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const [emailPart, ...nameParts] = line.split(/[,;\t]/);
      return {
        id: makeRecipientId(),
        email: (emailPart ?? "").trim(),
        name: nameParts.join(" ").trim(),
      };
    });
}

export function InviteUserForm({
  nodeTree,
  inviterRole,
  onCancel,
  onSuccess,
}: InviteUserFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [recipients, setRecipients] = useState<Recipient[]>(() => [
    { id: makeRecipientId(), email: "", name: "" },
  ]);
  const [statuses, setStatuses] = useState<Record<string, RecipientStatus>>({});
  const [role, setRole] = useState<Role>("employee");
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Paste-import expand/collapse state.
  const [showPaste, setShowPaste] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  const canPickElevatedRole = inviterRole === "admin";

  const updateRecipient = (id: string, patch: Partial<Recipient>) => {
    setRecipients((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    // Editing a recipient clears its prior status — admin's signal that
    // they're trying again with new content.
    setStatuses((prev) => {
      if (!prev[id]) return prev;
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const addRecipient = () => {
    setRecipients((prev) => [
      ...prev,
      { id: makeRecipientId(), email: "", name: "" },
    ]);
  };

  const removeRecipient = (id: string) => {
    setRecipients((prev) =>
      prev.length === 1 ? prev : prev.filter((r) => r.id !== id),
    );
    setStatuses((prev) => {
      const { [id]: _omit, ...rest } = prev;
      return rest;
    });
  };

  const importPaste = () => {
    const parsed = parsePaste(pasteValue);
    if (parsed.length === 0) {
      setShowPaste(false);
      setPasteValue("");
      return;
    }
    // If every existing row is blank, replace; otherwise append.
    setRecipients((prev) => {
      const allBlank = prev.every((p) => !p.email.trim() && !p.name.trim());
      return allBlank ? parsed : [...prev, ...parsed];
    });
    setPasteValue("");
    setShowPaste(false);
  };

  /** Submit one recipient. Returns the resulting status (idempotent —
   *  caller writes it into the statuses map). */
  const submitOne = async (
    recipient: Recipient,
    resend: boolean,
  ): Promise<RecipientStatus> => {
    const trimmedEmail = normalizeInviteEmail(recipient.email);
    if (!trimmedEmail || !EMAIL_RE.test(trimmedEmail)) {
      return { kind: "error", message: "Invalid email" };
    }

    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          name: recipient.name.trim() || null,
          role,
          courseIds: Array.from(selectedCourseIds),
          ...(resend ? { resend: true } : {}),
        }),
      });

      if (res.status === 409) {
        const data = (await res.json().catch(() => ({}))) as { code?: string; error?: string };
        if (data.code === "already_invited") {
          return { kind: "already_invited" };
        }
        return { kind: "error", message: data.error ?? "User already exists" };
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        return { kind: "error", message: data.error ?? `Failed (${res.status})` };
      }

      const data = (await res.json()) as {
        user: { id: string; email: string; name: string | null; role: Role };
        enrollmentCount: number;
        emailSent: boolean;
        emailError: string | null;
        resent?: boolean;
      };
      return {
        kind: "sent",
        resent: data.resent ?? resend,
        enrollmentCount: data.enrollmentCount,
        emailSent: data.emailSent,
        emailError: data.emailError,
      };
    } catch {
      return { kind: "error", message: "Network error" };
    }
  };

  /** Submit recipients in parallel, write per-row status back into state,
   *  surface a summary toast, and call onSuccess with the successes. */
  const handleSubmitAll = async () => {
    // Determine which rows to send: those without a "sent" status (so a
    // partial-success retry only re-sends pending/failed rows).
    const pending = recipients.filter(
      (r) => statuses[r.id]?.kind !== "sent",
    );
    const validPending = pending.filter((r) =>
      EMAIL_RE.test(normalizeInviteEmail(r.email)),
    );
    if (validPending.length === 0) {
      setError("Add at least one valid email address.");
      return;
    }

    setError(null);
    setSubmitting(true);

    // Mark the rows we're about to hit as sending so per-row spinners
    // appear immediately.
    setStatuses((prev) => {
      const next = { ...prev };
      for (const r of validPending) next[r.id] = { kind: "sending" };
      // Anything pending-but-invalid gets flagged inline.
      for (const r of pending) {
        if (!EMAIL_RE.test(normalizeInviteEmail(r.email))) {
          next[r.id] = { kind: "error", message: "Invalid email" };
        }
      }
      return next;
    });

    // Send sequentially with a 600 ms gap to stay under Resend's 2 req/s limit.
    // Per-row status is written immediately after each send so the admin can
    // watch progress tick along rather than waiting for the whole batch.
    const results: { recipient: Recipient; status: RecipientStatus }[] = [];
    for (let i = 0; i < validPending.length; i++) {
      const r = validPending[i];
      const status = await submitOne(r, false);
      results.push({ recipient: r, status });
      setStatuses((prev) => ({ ...prev, [r.id]: status }));
      if (i < validPending.length - 1) {
        await new Promise<void>((resolve) => setTimeout(resolve, 600));
      }
    }

    const sent = results.filter((r) => r.status.kind === "sent");
    const already = results.filter((r) => r.status.kind === "already_invited");
    const failed = results.filter((r) => r.status.kind === "error");

    const parts: string[] = [];
    if (sent.length) parts.push(`${sent.length} invited`);
    if (already.length)
      parts.push(`${already.length} already invited (use Re-send below)`);
    if (failed.length) parts.push(`${failed.length} failed`);
    if (parts.length) toast(parts.join(" · "));

    if (sent.length > 0) {
      const sentUsers = results
        .filter(
          (r): r is { recipient: Recipient; status: Extract<RecipientStatus, { kind: "sent" }> } =>
            r.status.kind === "sent",
        )
        // We don't carry the User row in the sent status payload because
        // we don't need its id here — onSuccess just triggers a refetch.
        .map((r) => ({
          id: r.recipient.id,
          email: normalizeInviteEmail(r.recipient.email),
          name: r.recipient.name.trim() || null,
          role,
        }));
      onSuccess(sentUsers);
      router.refresh();
    }

    setSubmitting(false);
  };

  /** Re-send one already-invited recipient. Used by the per-row button. */
  const handleResendOne = async (recipient: Recipient) => {
    setStatuses((prev) => ({ ...prev, [recipient.id]: { kind: "sending" } }));
    const status = await submitOne(recipient, true);
    setStatuses((prev) => ({ ...prev, [recipient.id]: status }));
    if (status.kind === "sent") {
      toast(`Re-sent invite to ${normalizeInviteEmail(recipient.email)}`);
      router.refresh();
    } else if (status.kind === "error") {
      toast(`Re-send failed: ${status.message}`, "error");
    }
  };

  // Pending-row count drives the submit-button label.
  const pendingCount = useMemo(
    () => recipients.filter((r) => statuses[r.id]?.kind !== "sent").length,
    [recipients, statuses],
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmitAll();
      }}
      className="rounded-lg border border-border bg-card p-5 space-y-4 mb-5"
      aria-label="Invite users form"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Invite users</h3>
          <p className="text-xs text-foreground-muted mt-0.5">
            Add one or more recipients. A username with no domain becomes{" "}
            <code className="rounded bg-surface-muted px-1">
              @{DEFAULT_INVITE_DOMAIN}
            </code>{" "}
            automatically; type a full address for any other domain. Role and
            courses are applied to all recipients, making it easy to onboard a
            cohort.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs text-foreground-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Recipients list */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-medium text-foreground-muted">
            Recipients <span className="text-danger">*</span>{" "}
            <span className="text-foreground-subtle font-normal">
              ({recipients.length} {recipients.length === 1 ? "row" : "rows"})
            </span>
          </label>
          <button
            type="button"
            onClick={() => setShowPaste((v) => !v)}
            className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            {showPaste ? "Hide paste" : "Paste a list"}
          </button>
        </div>

        {showPaste && (
          <div className="mb-2 rounded-lg border border-border bg-surface-muted p-3">
            <p className="text-xs text-foreground-muted mb-1.5">
              One recipient per line. Format:{" "}
              <code className="rounded bg-surface px-1">
                email@host.com, Full Name
              </code>{" "}
              (name optional). Tab- and semicolon-separated also work.
            </p>
            <textarea
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value)}
              rows={4}
              placeholder={"jordan@example.com, Jordan Lee\nsam@example.com"}
              className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all font-mono"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                type="button"
                size="xs"
                onClick={importPaste}
                disabled={!pasteValue.trim()}
              >
                Import
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="xs"
                onClick={() => {
                  setPasteValue("");
                  setShowPaste(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          {recipients.map((r, idx) => {
            const status = statuses[r.id];
            return (
              <RecipientRow
                key={r.id}
                index={idx}
                recipient={r}
                status={status}
                canRemove={recipients.length > 1}
                disabled={submitting}
                onChange={(patch) => updateRecipient(r.id, patch)}
                onRemove={() => removeRecipient(r.id)}
                onResend={() => void handleResendOne(r)}
              />
            );
          })}
        </div>

        <button
          type="button"
          onClick={addRecipient}
          disabled={submitting}
          className="mt-2 text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          + Add another recipient
        </button>
      </div>

      {/* Role */}
      <div>
        <label
          htmlFor="invite-role"
          className="block text-xs font-medium text-foreground-muted mb-1"
        >
          Role <span className="text-foreground-subtle font-normal">(applied to all recipients)</span>
        </label>
        <select
          id="invite-role"
          value={role}
          onChange={(e) => setRole(e.target.value as Role)}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
          disabled={submitting}
        >
          <option value="employee">Employee</option>
          {canPickElevatedRole && <option value="course_manager">Course manager</option>}
          {canPickElevatedRole && <option value="admin">Admin</option>}
        </select>
      </div>

      {/* Courses */}
      <div>
        <label className="block text-xs font-medium text-foreground-muted mb-1.5">
          Enroll in courses{" "}
          <span className="text-foreground-subtle font-normal">
            (optional · {selectedCourseIds.size} selected · applied to all recipients)
          </span>
        </label>
        <p className="text-xs text-foreground-subtle mb-1.5">
          Each user will be enrolled immediately when their invite is sent. You
          can adjust enrollments later from the Assignments page.
        </p>
        {nodeTree.length === 0 ? (
          <p className="text-xs text-foreground-subtle px-3 py-2 rounded-lg border border-dashed border-border">
            No published courses yet. You can invite without courses; assign
            later from the Assignments page.
          </p>
        ) : (
          <CourseNodeTree
            nodes={nodeTree}
            selectedCourseIds={selectedCourseIds}
            onSelectionChange={setSelectedCourseIds}
          />
        )}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex items-center gap-2">
        <FormButton
          type="submit"
          size="sm"
          loading={submitting}
          disabled={pendingCount === 0}
          pendingLabel="Sending…"
        >
          {pendingCount === 1 ? "Send invite" : `Send ${pendingCount} invites`}
        </FormButton>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          {Object.values(statuses).some((s) => s.kind === "sent") ? "Done" : "Cancel"}
        </Button>
      </div>
    </form>
  );
}

interface RecipientRowProps {
  index: number;
  recipient: Recipient;
  status?: RecipientStatus;
  canRemove: boolean;
  disabled: boolean;
  onChange: (patch: Partial<Recipient>) => void;
  onRemove: () => void;
  onResend: () => void;
}

function RecipientRow({
  index,
  recipient,
  status,
  canRemove,
  disabled,
  onChange,
  onRemove,
  onResend,
}: RecipientRowProps) {
  const isSent = status?.kind === "sent";

  // Advisory Entra-directory check. `null` = nothing to show (idle, invalid,
  // or Graph couldn't tell us). Never blocks the send.
  const [directory, setDirectory] = useState<DirectoryLookup | "checking" | null>(
    null,
  );

  const checkDirectory = async (email: string) => {
    if (!EMAIL_RE.test(email)) {
      setDirectory(null);
      return;
    }
    setDirectory("checking");
    try {
      const res = await fetch(
        `/api/admin/users/lookup?email=${encodeURIComponent(email)}`,
      );
      if (!res.ok) {
        setDirectory(null);
        return;
      }
      setDirectory((await res.json()) as DirectoryLookup);
    } catch {
      // Network error — stay silent, this is advisory only.
      setDirectory(null);
    }
  };

  return (
    <div className="flex items-start gap-2">
      <div className="grid sm:grid-cols-[1fr_1fr] gap-2 flex-1">
        <div>
          <input
            type="email"
            value={recipient.email}
            onChange={(e) => {
              onChange({ email: e.target.value });
              // Editing invalidates any prior directory result.
              setDirectory(null);
            }}
            // On blur: fill in the org domain for a bare username (`akil` ->
            // `akil@teamsquared.io`; full addresses left alone), then run the
            // advisory directory check against the resolved address.
            onBlur={(e) => {
              const resolved = normalizeInviteEmail(e.target.value);
              if (resolved !== recipient.email) onChange({ email: resolved });
              void checkDirectory(resolved);
            }}
            placeholder={index === 0 ? "newhire or newhire@teamsquared.io" : "name or name@teamsquared.io"}
            aria-label={`Email for recipient ${index + 1}`}
            className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all disabled:opacity-50"
            disabled={disabled || isSent}
            required={index === 0}
          />
          <DirectoryHint directory={directory} />
        </div>
        <input
          type="text"
          value={recipient.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Name (optional)"
          aria-label={`Name for recipient ${index + 1}`}
          className="px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all disabled:opacity-50"
          disabled={disabled || isSent}
        />
      </div>

      {/* Status / actions column */}
      <div className="flex items-center gap-1.5 min-w-[7rem] pt-2">
        <RecipientStatusBadge status={status} />
        {status?.kind === "already_invited" && (
          <button
            type="button"
            onClick={onResend}
            disabled={disabled}
            className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:opacity-50"
          >
            Re-send
          </button>
        )}
        {canRemove && !isSent && (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={`Remove recipient ${index + 1}`}
            className="text-foreground-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm disabled:opacity-50 px-1"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

/** Inline advisory note under the email field about Entra-directory presence.
 *  Renders nothing when we can't tell (unconfigured / no permission / error) —
 *  the directory check never blocks a send. */
function DirectoryHint({
  directory,
}: {
  directory: DirectoryLookup | "checking" | null;
}) {
  if (directory === null) return null;
  if (directory === "checking")
    return (
      <p className="mt-1 text-xs text-foreground-subtle">Checking directory…</p>
    );
  if (directory.status === "unknown") return null;
  if (directory.status === "not_found")
    return (
      <p className="mt-1 text-xs text-warning">
        Not found in directory — you can still send.
      </p>
    );
  // found
  if (!directory.accountEnabled)
    return (
      <p className="mt-1 text-xs text-warning">
        In directory, but the account is disabled.
      </p>
    );
  return (
    <p className="mt-1 text-xs text-success">
      In directory{directory.displayName ? ` · ${directory.displayName}` : ""}.
    </p>
  );
}

function RecipientStatusBadge({ status }: { status?: RecipientStatus }) {
  if (!status || status.kind === "idle") return null;
  if (status.kind === "sending")
    return <span className="text-xs text-foreground-muted">Sending…</span>;
  if (status.kind === "sent") {
    if (!status.emailSent) {
      return (
        <span className="text-xs text-warning" title={status.emailError ?? undefined}>
          User created · email skipped
        </span>
      );
    }
    return (
      <span className="text-xs text-success">
        {status.resent ? "Re-sent" : "Sent"}
        {status.enrollmentCount > 0 && ` · ${status.enrollmentCount}c`}
      </span>
    );
  }
  if (status.kind === "already_invited")
    return <span className="text-xs text-warning">Already invited</span>;
  return (
    <span className="text-xs text-danger" title={status.message}>
      {status.message}
    </span>
  );
}
