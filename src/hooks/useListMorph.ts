"use client";

import { useCallback } from "react";

type ViewTransition = {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
  skipTransition: () => void;
};

type StartViewTransition = (
  callback: () => void | Promise<void>,
) => ViewTransition;

/**
 * Wrap a state update in a native CSS View Transition.
 *
 * The browser captures pre-state, runs the callback, captures post-state, and
 * cross-fades / morphs the difference. Used for filter/sort reorder, tab
 * underline swap, and any list rearrangement that should not snap.
 *
 * Falls through to the callback directly when:
 *   - SSR (no document)
 *   - Browser lacks `document.startViewTransition` (Firefox today)
 *   - User has `prefers-reduced-motion: reduce`
 *
 * Usage (see design-system §9.11):
 *   const morph = useListMorph();
 *   morph(() => setSortKey(next));
 */
export function useListMorph() {
  return useCallback((callback: () => void) => {
    if (typeof document === "undefined") {
      callback();
      return;
    }

    const start = (
      document as Document & { startViewTransition?: StartViewTransition }
    ).startViewTransition;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    if (reduced || typeof start !== "function") {
      callback();
      return;
    }

    start.call(document, callback);
  }, []);
}
