"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import Logo from "@/components/Logo";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { getVisibleNavItems, isNavItemActive } from "./navItems";

/**
 * MobileNav — hamburger + slide-in drawer for primary navigation below `md`.
 *
 * The desktop {@link Sidebar} is a hover-to-expand rail, which is unusable on
 * touch (no hover). This renders a tap-friendly drawer instead. The trigger is
 * `md:hidden`; the desktop sidebar takes over from `md` up. Shares its item
 * list with the sidebar via {@link getVisibleNavItems}.
 */
export function MobileNav() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = React.useState(false);

  const items = getVisibleNavItems(session?.user?.role);

  // Close the drawer whenever the route changes (tapping a link navigates).
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          className={cn(
            "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md md:hidden",
            "text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>

      <SheetContent side="left" className="w-[280px] gap-0 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>

        {/* Brand row — mirrors the sidebar's 64px header. */}
        <div className="flex h-16 shrink-0 items-center border-b border-border px-4">
          <Link
            href="/"
            aria-label="Teams Squared home"
            className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
          >
            <Logo size={28} showText />
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <ul className="flex flex-col gap-0.5">
            {items.map(({ href, label, icon: Icon }) => {
              const active = isNavItemActive(pathname ?? "", href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex h-11 w-full items-center gap-3 rounded-md px-3 text-sm transition-colors",
                      "text-foreground-muted hover:bg-surface-muted hover:text-foreground",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      active &&
                        "bg-primary-subtle text-primary-subtle-foreground font-medium before:absolute before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2 before:rounded-r before:bg-primary",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
