import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocumentVisible } from "@/hooks/useDocumentVisible";

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useDocumentVisible", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it("returns true initially (mirrors SSR default)", () => {
    setVisibility("visible");
    const { result } = renderHook(() => useDocumentVisible());
    expect(result.current).toBe(true);
  });

  it("flips to false when the tab becomes hidden", () => {
    const { result } = renderHook(() => useDocumentVisible());
    act(() => setVisibility("hidden"));
    expect(result.current).toBe(false);
  });

  it("flips back to true on revisit", () => {
    const { result } = renderHook(() => useDocumentVisible());
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    expect(result.current).toBe(true);
  });

  it("detaches the listener on unmount", () => {
    const removeSpy = vi.spyOn(document, "removeEventListener");
    const { unmount } = renderHook(() => useDocumentVisible());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith("visibilitychange", expect.any(Function));
    removeSpy.mockRestore();
  });
});
