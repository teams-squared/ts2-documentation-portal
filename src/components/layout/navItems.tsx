import type * as React from "react";
import {
  Home,
  GraduationCap,
  Shield,
  ShieldCheck,
  BookOpenCheck,
} from "lucide-react";
import type { Role } from "@/lib/types";

/**
 * Shared primary-nav config. Consumed by both the desktop {@link Sidebar}
 * and the mobile {@link MobileNav} drawer so the two never drift.
 */

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** If true, require admin or course_manager role. */
  manage?: boolean;
}

export const BASE_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/courses", label: "Courses", icon: GraduationCap },
  { href: "/policies", label: "Policies", icon: ShieldCheck },
];

export const ADMIN_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Admin",
  icon: Shield,
  manage: true,
};

export const COURSE_MANAGER_NAV_ITEM: NavItem = {
  href: "/admin",
  label: "Course Management",
  icon: BookOpenCheck,
  manage: true,
};

/** Nav items visible to the given role (admins/CMs get a management entry). */
export function getVisibleNavItems(role?: Role): NavItem[] {
  return [
    ...BASE_NAV_ITEMS,
    ...(role === "admin"
      ? [ADMIN_NAV_ITEM]
      : role === "course_manager"
        ? [COURSE_MANAGER_NAV_ITEM]
        : []),
  ];
}

/** Active-state test shared by both nav surfaces. */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || (href !== "/" && pathname.startsWith(href));
}
