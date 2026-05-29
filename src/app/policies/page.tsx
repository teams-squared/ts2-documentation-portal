import Link from "next/link";
import { redirect } from "next/navigation";
import type { ComponentType } from "react";
import {
  BookOpen,
  ClipboardList,
  FileBadge,
  FileSignature,
  Folder,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Public ISO doc library. Visible to every logged-in LMS user regardless
 * of enrollment, role, or course membership. Lists every PublicIsoDoc the
 * admin team has curated under /admin/iso → Public library.
 *
 * Hidden entries (admin withdrew them via the manager) drop out here but
 * stay in the DB so view history + sortOrder survive an unhide.
 *
 * Entries are bucketed by the third segment of their documentCode
 * (e.g. TSPL-ISMS-POL-002 → POL → "Policies"). Anything without a
 * recognisable code falls into "Other".
 */

interface CategoryMeta {
  key: string;
  label: string;
  description: string;
  Icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  order: number;
}

const CATEGORIES: Record<string, CategoryMeta> = {
  MANUAL: {
    key: "MANUAL",
    label: "Manuals",
    description: "Top-level ISMS manuals & scope statements",
    Icon: BookOpen,
    order: 0,
  },
  POL: {
    key: "POL",
    label: "Policies",
    description: "Approved organisational policies",
    Icon: ShieldCheck,
    order: 1,
  },
  PROC: {
    key: "PROC",
    label: "Procedures",
    description: "Operational procedures & standards",
    Icon: ClipboardList,
    order: 2,
  },
  FORMAT: {
    key: "FORMAT",
    label: "Forms & Templates",
    description: "Fillable forms, registers & report templates",
    Icon: FileSignature,
    order: 3,
  },
  REC: {
    key: "REC",
    label: "Records",
    description: "Evidence records & logs",
    Icon: FileBadge,
    order: 4,
  },
  OTHER: {
    key: "OTHER",
    label: "Other",
    description: "Uncategorised reference documents",
    Icon: Folder,
    order: 99,
  },
};

function categoryFor(code: string | null): CategoryMeta {
  if (!code) return CATEGORIES.OTHER;
  // Doc codes look like TSPL-ISMS-POL-002 — match the first segment that
  // we recognise. Defensive against short / nonstandard codes.
  const parts = code.toUpperCase().split("-").filter(Boolean);
  for (const part of parts) {
    if (CATEGORIES[part]) return CATEGORIES[part];
  }
  return CATEGORIES.OTHER;
}

export default async function PoliciesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const docs = await prisma.publicIsoDoc.findMany({
    where: { isHidden: false },
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

  const grouped = new Map<string, typeof docs>();
  for (const doc of docs) {
    const cat = categoryFor(doc.documentCode);
    const bucket = grouped.get(cat.key) ?? [];
    bucket.push(doc);
    grouped.set(cat.key, bucket);
  }

  const sections = Array.from(grouped.entries())
    .map(([key, items]) => ({ meta: CATEGORIES[key], items }))
    .sort((a, b) => a.meta.order - b.meta.order);

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
        <div className="space-y-8">
          {sections.map(({ meta, items }) => {
            const { Icon } = meta;
            return (
              <section key={meta.key}>
                <div className="mb-3 flex items-baseline gap-3 border-b border-border pb-2">
                  <Icon
                    className="h-4 w-4 flex-shrink-0 self-center text-primary"
                    aria-hidden={true}
                  />
                  <h2 className="text-base font-semibold text-foreground">
                    {meta.label}
                  </h2>
                  <span className="text-xs text-foreground-subtle">
                    {items.length} doc{items.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-auto hidden text-xs text-foreground-muted sm:inline">
                    {meta.description}
                  </span>
                </div>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {items.map((doc) => (
                    <li key={doc.id}>
                      <Link
                        href={`/policies/${doc.id}`}
                        className="block h-full rounded-lg border border-border bg-surface p-4 hover-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        <p className="line-clamp-2 text-sm font-medium text-foreground">
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
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
