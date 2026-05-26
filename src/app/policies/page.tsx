import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Public ISO doc library. Visible to every logged-in LMS user regardless
 * of enrollment, role, or course membership. Lists every PublicIsoDoc the
 * admin team has curated under /admin/iso → Public library.
 *
 * Not anonymous — authenticated session required, just no role gate.
 */
export default async function PoliciesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const docs = await prisma.publicIsoDoc.findMany({
    orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }],
    select: {
      id: true,
      documentTitle: true,
      documentCode: true,
      sourceVersion: true,
      approver: true,
      lastReviewedOn: true,
    },
  });

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:py-12">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-primary">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Policies
        </div>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">
          ISO policy library
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-foreground-muted">
          Reference copies of the Teams Squared ISO-management documents.
          Open one to read the current approved version. These are reference
          copies; if a policy is part of a training course, you&apos;ll still
          need to acknowledge it inside that course.
        </p>
      </header>

      {docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-12 text-center text-sm text-foreground-muted">
          No policies have been published to the library yet.
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {docs.map((doc) => (
            <li key={doc.id}>
              <Link
                href={`/policies/${doc.id}`}
                className="block h-full rounded-lg border border-border bg-surface p-4 hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <p className="text-sm font-medium text-foreground">
                  {doc.documentTitle}
                </p>
                <p className="mt-1 text-xs text-foreground-muted">
                  {doc.documentCode ? (
                    <span className="font-mono">{doc.documentCode}</span>
                  ) : null}
                  {doc.documentCode ? " · " : null}
                  v{doc.sourceVersion}
                </p>
                {doc.approver ? (
                  <p className="mt-2 text-xs text-foreground-subtle">
                    Approved by {doc.approver}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
