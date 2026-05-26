"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PULSE_HOLD_MS = 1100;

/**
 * Track recently-mutated row ids and emit a transient `.surface-pulse` class.
 *
 * Pairs with the `surfacePulse` keyframe in `globals.css`. After a successful
 * mutation, call `pulse(id)` and apply `pulseClass(id)` to the row's className.
 * The class is removed automatically after `PULSE_HOLD_MS`.
 *
 * Reduced-motion users see the class applied but no animation (CSS kill-switch
 * in globals.css handles it). No JS short-circuit needed — the timing here
 * controls class lifetime, not motion frames.
 *
 * Usage (see design-system §9.10):
 *   const { pulse, pulseClass } = useMutationPulse();
 *   await updateUserRole(userId, role); pulse(userId);
 *   <tr className={cn(pulseClass(userId), "...")}>
 */
export function useMutationPulse() {
  const [pulsed, setPulsed] = useState<Set<string>>(() => new Set());
  const timersRef = useRef<Map<string, number>>(new Map());

  const pulse = useCallback((id: string | number) => {
    const key = String(id);
    const existing = timersRef.current.get(key);
    if (existing) window.clearTimeout(existing);

    setPulsed((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });

    const timer = window.setTimeout(() => {
      setPulsed((prev) => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      timersRef.current.delete(key);
    }, PULSE_HOLD_MS);

    timersRef.current.set(key, timer);
  }, []);

  const pulseClass = useCallback(
    (id: string | number) => (pulsed.has(String(id)) ? "surface-pulse" : ""),
    [pulsed],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
    };
  }, []);

  return { pulse, pulseClass };
}
