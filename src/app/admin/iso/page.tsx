import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { IsoAckLog } from "@/components/admin/IsoAckLog";
import { IsoCoverage } from "@/components/admin/IsoCoverage";
import { PublicIsoLibraryManager } from "@/components/admin/PublicIsoLibraryManager";
import { IsoTabs, IsoTabPanel } from "@/components/admin/IsoTabs";

export const dynamic = "force-dynamic";

/**
 * ISO compliance evidence surface. Two sub-tabs:
 *   - Acknowledgements — every individual ack with audit hash, ETag,
 *     dwell time, and the exact attestation wording the user ticked.
 *   - Coverage — per-policy roll-up of who is required vs. who has
 *     ack'd the current published version. Drives "outstanding"
 *     follow-ups before a Stage-2 audit.
 *
 * Notification email dispatch (the "ISO Ack Email") lives separately
 * under /admin/emails because it governs an outbound email behaviour,
 * not compliance evidence.
 */
export default async function AdminIsoPage() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    redirect("/admin");
  }

  return (
    <div>
      <IsoTabs />

      <IsoTabPanel tab="acks">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO acknowledgement log
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Every employee acknowledgement of an ISO policy-document lesson
          is recorded here with the document version, audit hash, the
          exact attestation wording the employee ticked, and the focused-
          tab dwell time observed before submit. Filter by date range and
          download a CSV to hand to your ISO auditor. Notification email
          dispatch is configured separately under{" "}
          <span className="font-medium">Emails → ISO Ack Email</span>.
        </p>
        <IsoAckLog />
      </IsoTabPanel>

      <IsoTabPanel tab="coverage">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          ISO policy coverage
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Per-policy view of who is required to acknowledge the{" "}
          <span className="font-medium">current</span> published version
          and who hasn&apos;t yet. Required = enrolled in the policy&apos;s
          parent course. A version bump invalidates prior acks, so users
          who ack&apos;d a previous version still appear here until they
          re-ack the new one.
        </p>
        <IsoCoverage />
      </IsoTabPanel>

      <IsoTabPanel tab="library">
        <h2 className="text-sm font-semibold text-foreground mb-1">
          Public ISO doc library
        </h2>
        <p className="text-sm text-foreground-muted mb-4">
          Documents listed here are visible to every logged-in LMS user at{" "}
          <span className="font-medium">/policies</span>, regardless of
          enrollment. Use this for org-wide reference material (ISO policies,
          handbooks, public notices) that doesn&apos;t require an
          acknowledgement audit trail.
        </p>
        <PublicIsoLibraryManager />
      </IsoTabPanel>
    </div>
  );
}
