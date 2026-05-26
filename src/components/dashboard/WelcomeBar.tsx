import { calculateLevel } from "@/lib/levels";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

interface WelcomeBarProps {
  firstName: string;
  xp: number;
  streak: number;
}

function getTimeBasedGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5)  return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Rotate between motivational sublines. Stable within the hour. */
function getSubline(firstName: string): string {
  const options = [
    `Keep it up, ${firstName}!`,
    `Back at it, ${firstName}.`,
    `Let's go, ${firstName}.`,
    `Ready to learn, ${firstName}?`,
    `Welcome back, ${firstName}.`,
    `Make today count, ${firstName}.`,
  ];
  const now = new Date();
  const hourOfYear =
    Math.floor(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()) -
        Date.UTC(now.getFullYear(), 0, 0)) / 3_600_000,
    );
  return options[hourOfYear % options.length];
}

/**
 * Level avatar — solid brand-primary circle with white "Lv N" text.
 * Hero background is neutral, so the avatar reads as the focal accent
 * per design-system Section 8.11 ("brand as signal, not wallpaper").
 */
function LevelAvatar({ level }: { level: number }) {
  return (
    <div
      className="flex h-14 w-14 flex-shrink-0 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
      aria-label={`Level ${level}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider leading-none opacity-80">
        Lv
      </span>
      <span className="text-base font-bold leading-tight">{level}</span>
    </div>
  );
}

export function WelcomeBar({ firstName, xp, streak }: WelcomeBarProps) {
  const { level, currentXp, nextLevelXp } = calculateLevel(xp);
  const percent = Math.round((currentXp / nextLevelXp) * 100);
  const greeting = getTimeBasedGreeting();
  const subline = getSubline(firstName);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 pb-2">
      <div className="relative rounded-lg border border-border bg-surface-muted p-6 sm:p-8 overflow-hidden">
        {/* Ambient breathe overlay (§9.12) — single soft accent-tinted wash
            that gently breathes over --duration-ambient-breathe. Paused by
            html.ambient-paused when the tab is hidden. */}
        <div
          aria-hidden="true"
          className="surface-breathe absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(60% 90% at 0% 50%, oklch(0.42 0.28 285 / 0.08), transparent 70%)",
          }}
        />
        <div className="relative flex items-center gap-4 sm:gap-5">
          <LevelAvatar level={level} />

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {greeting}
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
              {/* Personality signature (§9.13) — gradient-clipped welcome
                  wordmark drifts over --duration-ambient-drift. Anchored to
                  the hero, paired with the surface-breathe overlay above so
                  the two ambient signals share one breathing place. */}
              <span
                className="motion-safe:animate-gradient-drift bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(90deg, oklch(0.42 0.28 285) 0%, oklch(0.55 0.24 295) 50%, oklch(0.42 0.28 285) 100%)",
                  backgroundSize: "200% 100%",
                }}
              >
                {subline}
              </span>
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground-muted">
              <span className="inline-flex items-center gap-1.5">
                <AnimatedNumber value={currentXp} className="font-semibold text-foreground" />
                <span className="text-foreground-subtle">/</span>
                <span className="tabular-nums">{nextLevelXp} XP</span>
              </span>
              {streak > 0 && (
                <>
                  <span className="text-foreground-subtle">·</span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="w-1.5 h-1.5 rounded-full bg-warning"
                    />
                    <span className="tabular-nums">
                      {streak}-day streak
                    </span>
                  </span>
                </>
              )}
            </div>
            {/* XP progress bar — solid brand fill on neutral track, 8px tall */}
            <div
              className="mt-3 h-2 w-full max-w-xs overflow-hidden rounded-full bg-border"
              role="progressbar"
              aria-label={`Level ${level} progress`}
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-[400ms] ease-out"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
