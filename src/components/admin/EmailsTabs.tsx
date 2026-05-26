"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useListMorph } from "@/hooks/useListMorph";

export type EmailsTabKey = "invite" | "signature" | "iso-ack";

const TABS: { key: EmailsTabKey; label: string }[] = [
  { key: "invite", label: "Invite email" },
  { key: "signature", label: "Signature" },
  { key: "iso-ack", label: "ISO Ack Email" },
];

/** Returns the active tab from the URL (?tab=...) with safe fallback. */
export function useActiveEmailsTab(): EmailsTabKey {
  const params = useSearchParams();
  const raw = params.get("tab");
  return TABS.some((t) => t.key === raw) ? (raw as EmailsTabKey) : "invite";
}

/**
 * Sub-tab navigation for /admin/emails. URL-driven so the choice
 * survives refresh and deep-linking works (e.g. share an "ISO ack
 * settings" link directly).
 */
export function EmailsTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useActiveEmailsTab();
  const morph = useListMorph();

  const switchTo = useCallback(
    (next: EmailsTabKey) => {
      const search = next === "invite" ? "" : `?tab=${next}`;
      morph(() => router.replace(`${pathname}${search}`, { scroll: false }));
    },
    [pathname, router, morph],
  );

  return (
    <nav
      className="flex gap-1 mb-6 border-b border-border"
      aria-label="Email categories"
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => switchTo(tab.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-foreground-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Wraps the panel for one tab so it only renders when active. The
 *  inner forms are still mounted lazily — switching tabs unmounts the
 *  previous form, which means in-flight unsaved edits in one tab are
 *  not preserved when you switch tabs and back. That's the expected
 *  behaviour for this kind of admin panel. */
export function EmailsTabPanel({
  tab,
  children,
}: {
  tab: EmailsTabKey;
  children: React.ReactNode;
}) {
  const active = useActiveEmailsTab();
  if (active !== tab) return null;
  return <div role="tabpanel">{children}</div>;
}
