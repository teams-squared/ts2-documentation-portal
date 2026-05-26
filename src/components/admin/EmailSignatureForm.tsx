"use client";

import { useMemo, useState } from "react";
import { FormButton } from "@/components/ui/FormButton";
import { useToast } from "@/components/ui/ToastProvider";

interface SignatureValues {
  enabled: boolean;
  signOff: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  websiteUrl: string;
  websiteLabel: string;
  addressLine: string;
  logoUrl: string;
  disclaimer: string;
}

interface Props extends SignatureValues {
  defaultDisclaimer: string;
  updatedAt: Date | null;
}

/** Lightweight HTML escaper for the in-form preview only — keeps the
 *  preview faithful without bringing in a full HTML renderer. The actual
 *  email rendering uses the server-side renderer in src/lib/email.ts. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Mirrors the server-side default in src/lib/email.ts. The bundled
 *  wordmark lives in /public so it's served at this absolute path. */
const BUNDLED_LOGO_URL = "/logo_w_text.png";

function renderPreview(v: SignatureValues): string {
  if (!v.enabled) return "<em>Signature disabled. Nothing will be appended.</em>";
  const hasIdentity =
    v.name.trim() ||
    v.title.trim() ||
    v.email.trim() ||
    v.phone.trim() ||
    v.websiteUrl.trim() ||
    v.addressLine.trim() ||
    v.logoUrl.trim();
  const hasDisclaimer = v.disclaimer.trim();
  // The logo always renders when the signature has any identity content;
  // default is the bundled wordmark when logoUrl is blank.
  const effectiveLogoUrl = v.logoUrl.trim() || BUNDLED_LOGO_URL;
  const lines: string[] = [];
  if (hasIdentity && v.signOff.trim())
    lines.push(`<p style="margin:0 0 8px;color:#4a4a5a;font-size:14px;">${esc(v.signOff)}</p>`);
  if (v.name.trim())
    lines.push(`<p style="margin:0;color:#1a1a2e;font-size:15px;font-weight:700;">${esc(v.name)}</p>`);
  if (v.title.trim())
    lines.push(`<p style="margin:0 0 12px;color:#6a6a7a;font-size:13px;">${esc(v.title)}</p>`);
  if (hasIdentity)
    lines.push(`<p style="margin:12px 0;"><img src="${esc(effectiveLogoUrl)}" alt="logo" height="40" style="display:block;height:40px;max-width:200px;" /></p>`);
  if (v.email.trim())
    lines.push(`<p style="margin:0;font-size:13px;"><a href="mailto:${esc(v.email)}" style="color:#4f46e5;text-decoration:underline;">${esc(v.email)}</a></p>`);
  if (v.phone.trim())
    lines.push(`<p style="margin:0;color:#4a4a5a;font-size:13px;">${esc(v.phone)}</p>`);
  if (v.websiteUrl.trim())
    lines.push(
      `<p style="margin:0;font-size:13px;"><a href="${esc(v.websiteUrl)}" style="color:#4f46e5;text-decoration:underline;">${esc(v.websiteLabel.trim() || v.websiteUrl)}</a></p>`,
    );
  if (v.addressLine.trim())
    lines.push(`<p style="margin:0;color:#4a4a5a;font-size:13px;">${esc(v.addressLine)}</p>`);
  if (hasDisclaimer)
    lines.push(`<p style="margin:24px 0 0;color:#8e8e93;font-size:11px;line-height:1.5;">${esc(v.disclaimer)}</p>`);
  if (!hasIdentity && !hasDisclaimer)
    return "<em>No fields filled. Nothing will be appended.</em>";
  return lines.join("");
}

export function EmailSignatureForm({
  enabled: initialEnabled,
  signOff: initialSignOff,
  name: initialName,
  title: initialTitle,
  email: initialEmail,
  phone: initialPhone,
  websiteUrl: initialWebsiteUrl,
  websiteLabel: initialWebsiteLabel,
  addressLine: initialAddressLine,
  logoUrl: initialLogoUrl,
  disclaimer: initialDisclaimer,
  defaultDisclaimer,
  updatedAt: initialUpdatedAt,
}: Props) {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [signOff, setSignOff] = useState(initialSignOff);
  const [name, setName] = useState(initialName);
  const [title, setTitle] = useState(initialTitle);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl);
  const [websiteLabel, setWebsiteLabel] = useState(initialWebsiteLabel);
  const [addressLine, setAddressLine] = useState(initialAddressLine);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [disclaimer, setDisclaimer] = useState(initialDisclaimer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(
    initialUpdatedAt ? new Date(initialUpdatedAt) : null,
  );

  const previewHtml = useMemo(
    () =>
      renderPreview({
        enabled,
        signOff,
        name,
        title,
        email,
        phone,
        websiteUrl,
        websiteLabel,
        addressLine,
        logoUrl,
        disclaimer,
      }),
    [
      enabled,
      signOff,
      name,
      title,
      email,
      phone,
      websiteUrl,
      websiteLabel,
      addressLine,
      logoUrl,
      disclaimer,
    ],
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/email-signature", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          signOff,
          name,
          title,
          email,
          phone,
          websiteUrl,
          websiteLabel,
          addressLine,
          logoUrl,
          disclaimer,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `Save failed (${res.status})`,
        );
      }
      const data = await res.json();
      setEnabled(data.enabled);
      setSignOff(data.signOff);
      setName(data.name);
      setTitle(data.title);
      setEmail(data.email);
      setPhone(data.phone);
      setWebsiteUrl(data.websiteUrl);
      setWebsiteLabel(data.websiteLabel);
      setAddressLine(data.addressLine);
      setLogoUrl(data.logoUrl);
      setDisclaimer(data.disclaimer);
      setUpdatedAt(data.updatedAt ? new Date(data.updatedAt) : null);
      toast("Signature saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Enabled toggle */}
      <label className="inline-flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="text-sm font-medium text-foreground">
          Append signature to outbound LMS emails
        </span>
      </label>

      {/* Two-column field grid on sm+, stacked on mobile */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          label="Sign-off"
          value={signOff}
          onChange={setSignOff}
          placeholder="Best regards,"
          maxLength={80}
        />
        <Field
          label="Name"
          value={name}
          onChange={setName}
          placeholder="Akil Fernando"
          maxLength={120}
        />
        <Field
          label="Title"
          value={title}
          onChange={setTitle}
          placeholder="IT Systems & Cybersecurity Lead"
          maxLength={160}
          className="sm:col-span-2"
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="akil@teamsquared.io"
          maxLength={120}
        />
        <Field
          label="Phone"
          value={phone}
          onChange={setPhone}
          placeholder="(+94) 702253435"
          maxLength={40}
        />
        <Field
          label="Website URL"
          type="url"
          value={websiteUrl}
          onChange={setWebsiteUrl}
          placeholder="https://www.teamsquared.io"
          maxLength={300}
        />
        <Field
          label="Website label"
          value={websiteLabel}
          onChange={setWebsiteLabel}
          placeholder="www.teamsquared.io"
          helper="Optional. Defaults to the URL itself."
          maxLength={120}
        />
        <Field
          label="Address line"
          value={addressLine}
          onChange={setAddressLine}
          placeholder="Colombo, Sri Lanka"
          maxLength={200}
          className="sm:col-span-2"
        />
        <Field
          label="Logo URL (optional)"
          type="url"
          value={logoUrl}
          onChange={setLogoUrl}
          placeholder="(leave blank to use the bundled Teams Squared wordmark)"
          helper="Defaults to /logo_w_text.png from the LMS itself. No need to host a logo separately. Override only if you want a different image."
          maxLength={500}
          className="sm:col-span-2"
        />
      </div>

      {/* Confidentiality / legal fine print */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label
            htmlFor="signature-disclaimer"
            className="block text-xs font-medium text-foreground-muted"
          >
            Confidentiality disclaimer (optional)
          </label>
          <button
            type="button"
            onClick={() => setDisclaimer(defaultDisclaimer)}
            className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
          >
            Use standard disclaimer
          </button>
        </div>
        <p className="text-xs text-foreground-muted mb-2">
          Appended below the signature in small muted text. Leave blank to
          omit. Click <em>Use standard disclaimer</em> to load Teams
          Squared&apos;s default confidentiality notice.
        </p>
        <textarea
          id="signature-disclaimer"
          value={disclaimer}
          onChange={(e) => setDisclaimer(e.target.value)}
          rows={5}
          maxLength={2000}
          placeholder="(leave blank to omit the fine-print block)"
          className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
        />
        <p className="mt-1 text-xs text-foreground-subtle">
          {disclaimer.length} / 2000 characters
        </p>
      </div>

      {/* Live preview */}
      <div>
        <p className="text-xs font-semibold text-foreground-muted mb-2 uppercase tracking-wider">
          Preview
        </p>
        <div
          className="rounded-lg border border-border bg-surface p-4"
          // Rendered HTML is built locally from the form values; no
          // user-supplied HTML reaches this surface.
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </div>

      {error && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/60 text-danger text-sm">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <FormButton type="submit" loading={saving} pendingLabel="Saving…">
          Save signature
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

interface FieldProps {
  label: string;
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  type?: string;
  helper?: string;
  maxLength?: number;
  className?: string;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  helper,
  maxLength,
  className = "",
}: FieldProps) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-foreground-muted mb-1">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-3 py-2 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
      />
      {helper && (
        <p className="mt-1 text-xs text-foreground-subtle">{helper}</p>
      )}
    </div>
  );
}
