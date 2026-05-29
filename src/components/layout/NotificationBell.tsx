"use client";

import { useState, useEffect } from "react";
import { CloseIcon } from "@/components/icons";
import { Spinner } from "@/components/ui/Spinner";

interface Notification {
  id: string;
  type: string;
  message: string;
  read: boolean;
  courseId: string | null;
  createdAt: string;
}

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = (await res.json()) as {
          notifications: Notification[];
          unreadCount: number;
        };
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    void fetchNotifications();
    // Poll every 60s
    const interval = setInterval(() => void fetchNotifications(), 60_000);
    return () => clearInterval(interval);
  }, []);

  const handleOpen = async () => {
    setOpen(!open);
    if (!open && unreadCount > 0) {
      setLoading(true);
      try {
        await fetch("/api/notifications", { method: "PATCH" });
        setUnreadCount(0);
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => void handleOpen()}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className="relative p-2.5 rounded-lg text-foreground-muted hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <svg
          className="w-5 h-5 text-foreground-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs font-bold text-danger-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute right-0 mt-1 z-50 w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-card shadow-elevated">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <p className="text-sm font-semibold text-foreground">
                Notifications
              </p>
              <div className="flex items-center gap-2">
                {loading && <Spinner size="sm" />}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 rounded-md hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-label="Close notifications"
                >
                  <CloseIcon className="w-4 h-4 text-foreground-subtle" />
                </button>
              </div>
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-sm text-foreground-subtle px-4 py-6 text-center">
                  No notifications yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((n) => (
                    <li
                      key={n.id}
                      className={`px-4 py-3 text-sm ${
                        !n.read
                          ? "bg-primary-subtle"
                          : ""
                      }`}
                    >
                      <p className="text-foreground">
                        {n.message}
                      </p>
                      {n.courseId && (
                        <a
                          href={`/courses/${n.courseId}`}
                          className="text-xs text-primary hover:underline mt-0.5 block"
                          onClick={() => setOpen(false)}
                        >
                          View course →
                        </a>
                      )}
                      <p className="text-xs text-foreground-subtle mt-1">
                        {new Date(n.createdAt).toLocaleDateString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
