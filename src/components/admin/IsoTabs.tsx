"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { useListMorph } from "@/hooks/useListMorph";

export type IsoTabKey = "acks" | "coverage" | "library";

const TABS: { key: IsoTabKey; label: string }[] = [
  { key: "acks", label: "Acknowledgements" },
  { key: "coverage", label: "Coverage" },
  { key: "library", label: "Public library" },
];

/** Returns the active tab from the URL (?tab=...) with safe fallback. */
export function useActiveIsoTab(): IsoTabKey {
  const params = useSearchParams();
  const raw = params.get("tab");
  return TABS.some((t) => t.key === raw) ? (raw as IsoTabKey) : "acks";
}

/**
 * Sub-tab navigation for /admin/iso. URL-driven so the choice survives
 * refresh and deep-linking works (e.g. share a "Coverage" link directly).
 */
export function IsoTabs() {
  const router = useRouter();
  const pathname = usePathname();
  const active = useActiveIsoTab();
  const morph = useListMorph();

  const switchTo = useCallback(
    (next: IsoTabKey) => {
      const search = next === "acks" ? "" : `?tab=${next}`;
      morph(() => router.replace(`${pathname}${search}`, { scroll: false }));
    },
    [pathname, router, morph],
  );

  return (
    <nav
      className="flex gap-1 mb-6 border-b border-border"
      aria-label="ISO surfaces"
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

/** Renders its children only when the matching tab is active. Same shape
 *  as EmailsTabPanel — switching tabs unmounts the previous panel. */
export function IsoTabPanel({
  tab,
  children,
}: {
  tab: IsoTabKey;
  children: React.ReactNode;
}) {
  const active = useActiveIsoTab();
  if (active !== tab) return null;
  return <div role="tabpanel">{children}</div>;
}
