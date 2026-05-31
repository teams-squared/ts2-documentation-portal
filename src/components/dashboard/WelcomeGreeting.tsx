"use client";

import { useSyncExternalStore } from "react";

/**
 * Greeting + rotating subline, computed from the *browser's* local clock.
 *
 * This lived in the server-rendered WelcomeBar, where `new Date().getHours()`
 * read the Render server's UTC hour — so a learner in UTC+5:30 opening the app
 * at 10am (04:30 UTC) was told they were "Burning the midnight oil". Time-of-day
 * copy must reflect the viewer's local time, which only the client knows.
 *
 * SSR renders the server's best guess (passed as initial*); once mounted, the
 * client recomputes from the local clock and corrects if they differ.
 * useSyncExternalStore gives a stable server snapshot (false) that matches the
 * first client render, so hydration is clean; suppressHydrationWarning covers
 * the post-mount text swap.
 */

const emptySubscribe = () => () => {};

function timeBasedGreeting(hour: number): string {
  if (hour < 5) return "Burning the midnight oil";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Rotate between motivational sublines. Stable within the local hour. */
function subline(firstName: string, now: Date): string {
  const options = [
    `Keep it up, ${firstName}!`,
    `Back at it, ${firstName}.`,
    `Let's go, ${firstName}.`,
    `Ready to learn, ${firstName}?`,
    `Welcome back, ${firstName}.`,
    `Make today count, ${firstName}.`,
  ];
  const hourOfYear = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours()) -
      Date.UTC(now.getFullYear(), 0, 0)) /
      3_600_000,
  );
  return options[hourOfYear % options.length];
}

interface WelcomeGreetingProps {
  firstName: string;
  /** Server-computed fallbacks rendered during SSR / before mount. */
  initialGreeting: string;
  initialSubline: string;
}

export function WelcomeGreeting({
  firstName,
  initialGreeting,
  initialSubline,
}: WelcomeGreetingProps) {
  // false during SSR and the first client render, true after mount.
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  let greeting = initialGreeting;
  let sub = initialSubline;
  if (mounted) {
    const now = new Date();
    greeting = timeBasedGreeting(now.getHours());
    sub = subline(firstName, now);
  }

  return (
    <>
      <p
        suppressHydrationWarning
        className="text-xs font-medium uppercase tracking-wider text-foreground-muted"
      >
        {greeting}
      </p>
      <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight truncate">
        {/* Personality signature (§9.13) — gradient-clipped welcome wordmark
            drifts over --duration-ambient-drift. Anchored to the hero, paired
            with the surface-breathe overlay so the two ambient signals share
            one breathing place. */}
        <span
          suppressHydrationWarning
          className="motion-safe:animate-gradient-drift bg-clip-text text-transparent"
          style={{
            backgroundImage:
              "linear-gradient(90deg, oklch(0.42 0.28 285) 0%, oklch(0.55 0.24 295) 50%, oklch(0.42 0.28 285) 100%)",
            backgroundSize: "200% 100%",
          }}
        >
          {sub}
        </span>
      </h1>
    </>
  );
}
