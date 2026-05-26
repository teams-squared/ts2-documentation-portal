"use client";

import { LockIcon } from "lucide-react";
import { resolveAchievementIcon } from "@/lib/achievement-icons";

interface AchievementCardProps {
  icon: string;
  title: string;
  description: string;
  unlockedAt?: string | null;
}

export function AchievementCard({ icon, title, description, unlockedAt }: AchievementCardProps) {
  const isLocked = !unlockedAt;
  // resolveAchievementIcon returns a stable, module-scoped lucide component
  // reference (Trophy, Flame, etc.) — never a freshly-created component.
  // The lint rule can't see across the function boundary so it flags this
  // as if it were a render-time component declaration; it isn't.
  const Icon = resolveAchievementIcon(icon);

  return (
    <div
      className={`relative p-4 rounded-lg border transition-shadow ${
        isLocked
          ? "border-border bg-surface-muted opacity-50"
          : "border-border bg-card shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[transform,box-shadow] duration-150 ease-out"
      }`}
    >
      <div className="mb-2" role="img" aria-label={title}>
        {/* eslint-disable-next-line react-hooks/static-components */}
        <Icon
          className={`w-8 h-8 text-primary ${
            isLocked ? "" : "motion-safe:animate-scale-in"
          }`}
          aria-hidden="true"
        />
      </div>
      <h3 className="text-base font-semibold text-foreground mb-0.5">
        {title}
      </h3>
      <p className="text-xs text-foreground-muted">{description}</p>
      {unlockedAt && (
        <p className="text-xs text-foreground-subtle mt-2">
          Unlocked {new Date(unlockedAt).toLocaleDateString()}
        </p>
      )}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
          <LockIcon className="h-6 w-6 text-foreground-subtle" />
        </div>
      )}
    </div>
  );
}
