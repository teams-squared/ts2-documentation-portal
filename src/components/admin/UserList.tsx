"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import type { Role } from "@/lib/types";
import type { NodeWithChildren } from "@/lib/courseNodes";
import { InviteUserForm } from "@/components/admin/InviteUserForm";
import { Button } from "@/components/ui/button";
import { useListMorph } from "@/hooks/useListMorph";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  createdAt: string;
}

const ROLE_COLORS: Record<Role, string> = {
  admin: "bg-danger-subtle text-danger",
  course_manager: "bg-info-subtle text-info",
  employee: "bg-surface-muted text-foreground-muted ring-1 ring-border",
};

const ROLE_LABELS: Record<Role, string> = {
  admin: "admin",
  course_manager: "course manager",
  employee: "employee",
};

const PAGE_SIZE = 25;

interface UserListProps {
  users: User[];
  nodeTree: NodeWithChildren[];
  inviterRole: Role;
}

export function UserList({ users, nodeTree, inviterRole }: UserListProps) {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<Role | "all">("all");
  const [page, setPage] = useState(1);
  const [showInvite, setShowInvite] = useState(false);
  const morph = useListMorph();

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter((u) => {
      const matchesSearch =
        !q ||
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleSearch = (value: string) => {
    // Filter result-set reorder is the canonical useListMorph use case
    // (design-system §9.11). Direct setState would snap; this cross-fades.
    morph(() => {
      setSearch(value);
      setPage(1);
    });
  };

  const handleRoleFilter = (value: Role | "all") => {
    morph(() => {
      setRoleFilter(value);
      setPage(1);
    });
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="flex-1 px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground placeholder-foreground-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all"
        />
        <select
          value={roleFilter}
          onChange={(e) => handleRoleFilter(e.target.value as Role | "all")}
          className="px-3.5 py-2.5 rounded-lg border border-border bg-surface text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
        >
          <option value="all">All roles</option>
          <option value="admin">Admin</option>
          <option value="course_manager">Course Manager</option>
          <option value="employee">Employee</option>
        </select>
        <Button
          type="button"
          onClick={() => setShowInvite((v) => !v)}
          aria-expanded={showInvite}
        >
          {showInvite ? "Close" : "Invite user"}
        </Button>
      </div>

      {showInvite && (
        <InviteUserForm
          nodeTree={nodeTree}
          inviterRole={inviterRole}
          onCancel={() => setShowInvite(false)}
          // Don't auto-close on success — admin needs to see per-recipient
          // status (some may need a re-send). They click Done/Cancel
          // themselves once they're satisfied.
          onSuccess={() => {}}
        />
      )}

      {/* Count */}
      <p className="text-xs text-foreground-muted mb-3">
        {filtered.length === users.length
          ? `${users.length} users`
          : `${filtered.length} of ${users.length} users`}
      </p>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[560px]">
          <thead>
            <tr className="bg-surface-muted text-left">
              <th className="px-5 py-3 font-medium text-foreground-muted">User</th>
              <th className="px-5 py-3 font-medium text-foreground-muted">Role</th>
              <th className="px-5 py-3 font-medium text-foreground-muted">Joined</th>
              <th className="px-5 py-3 font-medium text-foreground-muted text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pageUsers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-sm text-foreground-subtle">
                  No users match your search.
                </td>
              </tr>
            ) : (
              pageUsers.map((user) => (
                <tr key={user.id} className="hover:bg-surface-muted transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} image={user.avatar} size="sm" />
                      <div>
                        <p className="font-medium text-foreground">
                          {user.name || "Unnamed"}
                        </p>
                        <p className="text-xs text-foreground-muted">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[user.role]}`}>
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-xs text-foreground-muted">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button asChild variant="secondary" size="xs">
                      <Link href={`/admin/users/${user.id}`}>Manage</Link>
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-xs text-foreground-muted">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
