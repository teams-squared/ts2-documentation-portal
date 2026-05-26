"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Spinner } from "@/components/ui/Spinner";
import { SkeletonTableRow } from "@/components/ui/Skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/ToastProvider";
import { useMutationPulse } from "@/hooks/useMutationPulse";
import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  createdAt: string;
}

export default function UserTable() {
  const { toast } = useToast();
  const { pulse, pulseClass } = useMutationPulse();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/users")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            (body as { error?: string }).error ?? `Failed to load users (${res.status})`
          );
        }
        return res.json() as Promise<User[]>;
      })
      .then((data) => {
        setUsers(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load users");
        setLoading(false);
      });
  }, []);

  const handleRoleChange = async (userId: string, newRole: Role) => {
    setUpdating(userId);
    setUpdateError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
      }
      const updated: User = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === updated.id ? { ...u, role: updated.role } : u))
      );
      pulse(updated.id);
      toast(`Role updated to ${newRole}`);
    } catch (err: unknown) {
      setUpdateError(err instanceof Error ? err.message : "Failed to update role");
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-hidden">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-surface-muted text-left">
              {["User", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} className="px-5 py-3 font-medium text-foreground-muted">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonTableRow key={i} cols={4} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-danger py-8 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {updateError && (
        <div className="px-4 py-2.5 rounded-lg bg-danger-subtle border border-danger/20 text-danger text-sm">
          {updateError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-card shadow-sm overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="bg-surface-muted text-left">
              <th className="px-5 py-3 font-medium text-foreground-muted">
                User
              </th>
              <th className="px-5 py-3 font-medium text-foreground-muted">
                Role
              </th>
              <th className="px-5 py-3 font-medium text-foreground-muted">
                Joined
              </th>
              <th className="px-5 py-3 font-medium text-foreground-muted text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                className={cn(
                  "hover:bg-surface-muted transition-colors",
                  pulseClass(user.id),
                )}
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <UserAvatar name={user.name} image={user.avatar} size="sm" />
                    <div>
                      <p className="font-medium text-foreground">
                        {user.name || "Unnamed"}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={user.role}
                      onChange={(e) =>
                        handleRoleChange(user.id, e.target.value as Role)
                      }
                      disabled={updating === user.id}
                      aria-label={`Role for ${user.name || user.email}`}
                      className="px-3 py-2 rounded-lg border border-border bg-surface text-base sm:text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 cursor-pointer"
                    >
                      <option value="admin">Admin</option>
                      <option value="course_manager">Course Manager</option>
                      <option value="employee">Employee</option>
                    </select>
                    {updating === user.id && <Spinner size="sm" />}
                  </div>
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
