"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Home,
  GraduationCap,
  Shield,
  ShieldCheck,
  BookOpenCheck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";

/**
 * Sidebar — design-system Section 8.6 (primary navigation).
 *
 * Two layout modes:
 *
 * 1. **Unpinned (default)** — the sidebar sits at 64px in the layout flow but
 *    is rendered as a `position: fixed` overlay. On hover or keyboard focus
 *    it expands to 264px, floating over the page content without reflowing
 *    it. This keeps the maximum content width available for lessons and
 *    reading flows while leaving navigation a single mouse-over away.
 *
 * 2. **Pinned** — the sidebar behaves like a classic fixed-width rail:
 *    264px wide, in the layout flow (no overlay). Use this when you want
 *    labels always visible and don't mind the content-width cost.
 *
 * Pin state is persisted to localStorage (key: "sidebar-pinned"). A legacy
 * "sidebar-collapsed" key from the old manual-collapse implementation is
 * migrated on first read — users who previously kept the sidebar expanded
 * (collapsed=false) are promoted to pinned=true so their preference is
 * preserved.
 */

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true, require admin or course_manager role. */
  manage?: boolean;
}

const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/policies", label: "Policies", icon: ShieldCheck },
];

const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
  manage: true,
};

const COURSE_MANAGER_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Course Management",
  icon: BookOpenCheck,
  manage: true,
};

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [pinned, setPinned] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Load persisted pref, with a one-time migration from the legacy key.
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("sidebar-pinned");
      if (stored !== null) {
        setPinned(stored === "true");
      } else {
        const legacy = localStorage.getItem("sidebar-collapsed");
        if (legacy === "false") setPinned(true);
        if (legacy !== null) localStorage.removeItem("sidebar-collapsed");
      }
    } catch {
      /* ignore */
    }
    setMounted(true);
  }, []);

  React.useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("sidebar-pinned", String(pinned));
    } catch {
      /* ignore */
    }
  }, [pinned, mounted]);

  const role = session?.user?.role;
  const isAdmin = role === "admin";
  const isCourseManager = role === "course_manager";

  const visibleItems: NavItem[] = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin
      ? [ADMIN_NAV_ITEM]
      : isCourseManager
        ? [COURSE_MANAGER_NAV_ITEM]
        : []),
  ];

  // When `collapsible` is true (unpinned mode), labels and brand text are
  // hidden at the 64px rail and fade in only when the parent `aside.group`
  // is hovered or receives keyboard focus. When pinned, labels are always
  // visible. Rows use w-full so nothing overflows the narrow rail.
  const collapsible = !pinned;
  // Tailwind class for "hidden at rail, visible when aside is expanded".
  // Kept as a string so we can reuse it for the brand text and button label.
  const labelCls = collapsible
    ? "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    : "";

  const navContent = (
    <>
      {/* Logo / brand row — 64px to align with top bar. */}
      <div className="flex h-16 w-full shrink-0 items-center border-b border-border px-4">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          aria-label="Teams Squared home"
        >
          {collapsible ? (
            // Stack icon-only and with-text variants; cross-fade on expand
            // so the narrow rail always shows just the icon cleanly.
            <div className="relative flex h-7 w-[84px] items-center">
              <div className="absolute inset-y-0 left-0 flex items-center transition-opacity duration-150 group-hover:opacity-0 group-focus-within:opacity-0">
                <Logo size={28} showText={false} />
              </div>
              <div className={cn("absolute inset-y-0 left-0 flex items-center", labelCls)}>
                <Logo size={28} showText={true} />
              </div>
            </div>
          ) : (
            <Logo size={28} showText={true} />
          )}
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  title={label}
                  className={cn(
                    "relative flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                    active &&
                      "bg-primary-subtle text-primary-subtle-foreground font-medium before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span className={cn("truncate whitespace-nowrap", labelCls)}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Pin toggle — bottom breathing room per §8.6 */}
      <div className="w-full shrink-0 border-t border-border px-2 pt-2 pb-3">
        <button
          type="button"
          onClick={() => setPinned((v) => !v)}
          aria-label={pinned ? "Unpin sidebar" : "Pin sidebar"}
          aria-pressed={pinned}
          title={pinned ? "Unpin sidebar" : "Pin sidebar"}
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-foreground-muted transition-colors",
            "hover:bg-surface-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
          )}
        >
          {pinned ? (
            <PanelLeftClose className="h-5 w-5 shrink-0" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="h-5 w-5 shrink-0" aria-hidden="true" />
          )}
          <span className={cn("truncate whitespace-nowrap", labelCls)}>
            {pinned ? "Unpin" : "Pin sidebar"}
          </span>
        </button>
      </div>
    </>
  );

  // --- Pinned: classic in-flow 264px rail ---
  if (pinned) {
    return (
      <aside
        aria-label="Primary"
        className={cn(
          // z-40 keeps the app shell sidebar above any in-page overlay
          // sidebars (e.g. the course sidebar at z-30 inside lesson pages),
          // so its expansion doesn't get occluded by them.
          "sticky top-0 z-40 flex h-screen w-[264px] shrink-0 flex-col overflow-hidden border-r border-border bg-surface",
          className,
        )}
      >
        {navContent}
      </aside>
    );
  }

  // --- Unpinned: 64px spacer in flow + fixed overlay sidebar ---
  return (
    <>
      {/* Spacer reserves the 64px rail in the flex flow so main content
         starts 64px from the left, regardless of overlay state. */}
      <div aria-hidden="true" className="w-16 shrink-0" />
      <aside
        aria-label="Primary"
        className={cn(
          // z-40 — see pinned variant above. Must be higher than any
          // in-page overlay sidebar (course sidebar uses z-30) so the
          // app sidebar's hover-expand cleanly covers them rather than
          // getting clipped behind them.
          "group fixed left-0 top-0 z-40 flex h-screen w-16 flex-col overflow-hidden border-r border-border bg-surface",
          "transition-[width,box-shadow] duration-200 ease-out",
          "hover:w-[264px] hover:shadow-lg",
          "focus-within:w-[264px] focus-within:shadow-lg",
          className,
        )}
      >
        {navContent}
      </aside>
    </>
  );
}
