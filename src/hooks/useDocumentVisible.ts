"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current Page Visibility state (true when the tab is visible,
 * false when hidden / minimized / behind another tab).
 *
 * Used by the ambient-motion gating in `<RootLayout>` to pause `gradient-drift`
 * and `surface-breathe` animations when the user can't see them — saves CPU
 * and battery on background tabs. See design-system §9.12.
 *
 * SSR-safe: returns `true` on the server so initial paint matches the
 * common case (visible). The effect corrects on mount if the tab opened
 * in the background.
 */
export function useDocumentVisible(): boolean {
  const [visible, setVisible] = useState<boolean>(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}
