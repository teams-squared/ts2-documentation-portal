"use client";

import { useEffect } from "react";
import { useDocumentVisible } from "@/hooks/useDocumentVisible";

/**
 * Toggles `html.ambient-paused` based on Page Visibility, pausing every
 * ambient animation (gradient drift, surface breathe) when the tab is
 * hidden. Saves CPU and battery on background tabs.
 *
 * Renders nothing. Mounted once at the layout root. See design-system §9.12.
 */
export function AmbientMotionGate() {
  const visible = useDocumentVisible();

  useEffect(() => {
    const html = document.documentElement;
    if (visible) {
      html.classList.remove("ambient-paused");
    } else {
      html.classList.add("ambient-paused");
    }
  }, [visible]);

  return null;
}
