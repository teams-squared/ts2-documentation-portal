"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", exact: true, adminOnly: false },
  { href: "/admin/users", label: "Users", exact: false, adminOnly: true },
  { href: "/admin/courses", label: "Courses", exact: false, adminOnly: false },
  { href: "/admin/nodes", label: "Nodes", exact: false, adminOnly: false },
  { href: "/admin/assignments", label: "Enrollments", exact: false, adminOnly: false },
  { href: "/admin/progress", label: "Progress", exact: false, adminOnly: false },
  { href: "/admin/analytics", label: "Analytics", exact: false, adminOnly: false },
  { href: "/admin/iso", label: "ISO", exact: false, adminOnly: true },
  { href: "/admin/emails", label: "Emails", exact: false, adminOnly: true },
];

export function AdminTabs() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const visibleTabs = TABS.filter((t) => isAdmin || !t.adminOnly);

  return (
    <nav className="flex gap-1 mb-6 border-b border-border overflow-x-auto overflow-y-hidden">
      {visibleTabs.map((tab) => {
        const isActive = tab.exact
          ? pathname === tab.href
          : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-sm shrink-0 whitespace-nowrap",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-foreground-muted hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
