"use client";

import { useMemo, useState } from "react";
import { FormButton } from "@/components/ui/FormButton";
import { useToast } from "@/components/ui/ToastProvider";
import { EmailListInput } from "@/components/admin/EmailListInput";

interface Props {
  initialSubject: string;
  initialBodyText: string;
  initialCc: string[];
  defaultBodyText: string;
  updatedAt: Date | null;
}

const PLACEHOLDERS: { key: string; description: string }[] = [
  { key: "name", description: "Invitee's display name (or email local-part)" },
  { key: "firstName", description: "First word of name" },
  { key: "inviterName", description: "Admin who sent the invite" },
  { key: "courses", description: "Bulleted list of pre-assigned courses" },
  { key: "joinLink", description: "URL to /login" },
];

const SAMPLE_VALUES = {
  name: "Jordan Lee",
  firstName: "Jordan",
  inviterName: "Akil Fernando",
  joinLink: "https://learn.teamsquared.io/login",
  sampleCourses: ["Cybersecurity Onboarding", "HR Onboarding"],
};

function renderPreview(template: string): string {
  const coursesBlock =
    SAMPLE_VALUES.sampleCourses.length > 0
      ? `You've been pre-assigned the following course${
          SAMPLE_VALUES.sampleCourses.length === 1 ? "" : "s"
        }:\n${SAMPLE_VALUES.sampleCourses.map((t) => `  • ${t}`).join("\n")}`
      : "";
  const map: Record<string, string> = {
    name: SAMPLE_VALUES.name,
    firstName: SAMPLE_VALUES.firstName,
    inviterName: SAMPLE_VALUES.inviterName,
    courses: coursesBlock,
    joinLink: SAMPLE_VALUES.joinLink,
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key] : `{{${key}}}`,
  );
}

export function InviteEmailTemplateForm({
  initialSubject,
  initialBodyText,
  initialCc,
  defaultBodyText,
  updatedAt: initialUpdatedAt,
}: Props) {
  const { toast } = useToast();
  const [subject, setSubject] = useState(initialSubject);
  const [bodyText, setBodyText] = useState(initialBodyText || defaultBodyText);
  const [ccEmails, setCcEmails] = useState<string[]>(initialCc);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );
  const [showPreview, setShowPreview] = useState(false);

  // When the body is blank the server falls back to the default at send
  // time — mirror that here so the preview reflects what recipients
  // actually receive, not an empty page.
  const effectiveBody = bodyText.trim() ? bodyText : defaultBodyText;
  const preview = useMemo(() => renderPreview(effectiveBody), [effectiveBody]);
  const usingDefault = !bodyText.trim();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/invite-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, bodyText, ccEmails }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Save failed (${res.status})`,
        );
      }
      const data = await res.json();
      setSubject(data.subject);
      setBodyText(data.bodyText || defaultBodyText);
      setCcEmails(data.ccEmails);
      setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : null);
      toast("Invite email saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    setBodyText(defaultBodyText);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Subject */}
      <div>
        <label
          htmlFor="invite-subject"
          className="block text-sm font-medium text-foreground mb-1"
        >
          Subject
        </label>
        <input
          id="invite-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          required
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
        />
      </div>

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="invite-body"
            className="block text-sm font-medium text-foreground"
          >
            Body
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPreview((v) => !v)}
              className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {showPreview ? "Hide preview" : "Show preview"}
            </button>
            <span className="text-foreground-subtle">·</span>
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-xs text-foreground-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              Reset to default
            </button>
          </div>
        </div>
        <p className="text-xs text-foreground-muted mb-2">
          Plain text. Paragraphs split on blank lines. Lines starting with{" "}
          <code className="rounded bg-surface-muted px-1">•</code> become
          bulleted lists. The Sign-in button and outer wrapper are added
          automatically. Don&apos;t paste a join link, use{" "}
          <code className="rounded bg-surface-muted px-1">{"{{joinLink}}"}</code>.
        </p>
        <textarea
          id="invite-body"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          rows={12}
          maxLength={10_000}
          className="w-full px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all font-mono"
        />

        {/* Placeholder reference */}
        <details className="mt-2 text-xs text-foreground-muted">
          <summary className="cursor-pointer hover:text-foreground">
            Available placeholders
          </summary>
          <table className="mt-2 w-full text-left">
            <tbody>
              {PLACEHOLDERS.map((p) => (
                <tr key={p.key} className="border-t border-border">
                  <td className="py-1 pr-3 align-top">
                    <code className="rounded bg-surface-muted px-1 text-foreground">{`{{${p.key}}}`}</code>
                  </td>
                  <td className="py-1">{p.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>

        {showPreview && (
          <div className="mt-3 rounded-lg border border-border bg-surface-muted p-4">
            <p className="text-xs font-semibold text-foreground-muted mb-2 uppercase tracking-wider">
              Preview · sample data
              {usingDefault && (
                <span className="ml-2 normal-case font-medium text-foreground-subtle">
                  · showing built-in default (body is blank)
                </span>
              )}
            </p>
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans">
              {preview}
            </pre>
          </div>
        )}
      </div>

      {/* CC */}
      <EmailListInput
        label="Cc"
        helper="Optional. These addresses are CC'd on every invite email (e.g. HR or onboarding inboxes)."
        value={ccEmails}
        onChange={setCcEmails}
      />

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <FormButton type="submit" loading={saving} pendingLabel="Saving…">
          Save invite email
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
