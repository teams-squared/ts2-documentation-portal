"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Search, LogOut } from "lucide-react";

import { useSignOut } from "@/hooks/useSignOut";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { MobileNav } from "@/components/layout/MobileNav";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { UserAvatar } from "@/components/ui/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * TopBar — design-system Section 8.6.
 *
 * 64px tall, bg-background, border-b border-border, sticky on scroll.
 * Contents: search (center, max-w-[480px]), notifications bell, profile menu.
 * The logo lives in the sidebar; no logo here per spec.
 */

interface TopBarProps {
  className?: string;
  /** Provided on the lesson-player shell where we want slim padding. */
  compact?: boolean;
  /**
   * Slim mode for the lesson player: hides the search input so the lesson
   * content dominates. Profile menu + notifications + theme toggle remain.
   */
  slim?: boolean;
}

export function TopBar({ className, compact = false, slim = false }: TopBarProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const signOut = useSignOut();
  const [query, setQuery] = React.useState("");

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/courses?q=${encodeURIComponent(q)}`);
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-20 flex h-16 shrink-0 items-center gap-4 border-b border-border bg-background",
        compact ? "px-4" : "px-4 sm:px-6",
        className,
      )}
    >
      {/* Mobile nav trigger — hidden from md up (desktop uses the sidebar). */}
      <MobileNav />

      {/* Search — centered flex grow; suppressed in slim mode */}
      {slim ? (
        <div className="flex-1" aria-hidden="true" />
      ) : (
      <form
        role="search"
        onSubmit={handleSearchSubmit}
        className="flex flex-1 justify-center"
      >
        <label className="relative w-full max-w-[480px]">
          <span className="sr-only">Search courses</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses"
            className={cn(
              "h-10 w-full rounded-md border border-border-strong bg-surface pl-9 pr-3 text-sm",
              "text-foreground placeholder:text-foreground-subtle",
              "transition-colors focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
            )}
          />
        </label>
      </form>
      )}

      {/* Right cluster */}
      <div className="flex items-center gap-1">
        <NotificationBell />
        <ThemeToggle />

        {session?.user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open user menu"
                className={cn(
                  "flex items-center gap-2 rounded-md p-1.5 transition-colors",
                  "hover:bg-surface-muted",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                )}
              >
                <UserAvatar
                  name={session.user.name}
                  image={session.user.image}
                  size="sm"
                />
                <span className="hidden max-w-[120px] truncate text-sm font-medium text-foreground sm:inline">
                  {session.user.name?.split(" ")[0]}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="flex flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {session.user.name}
                </span>
                <span className="truncate text-xs font-normal text-foreground-muted">
                  {session.user.email}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">Profile</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => signOut({ callbackUrl: "/login" })}
                className="text-danger focus-visible:text-danger"
              >
                <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
