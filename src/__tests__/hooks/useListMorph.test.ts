import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useListMorph } from "@/hooks/useListMorph";

type StartViewTransitionMock = ReturnType<typeof vi.fn>;

function installStartViewTransition(): StartViewTransitionMock {
  const mock = vi.fn((cb: () => void) => {
    cb();
    return {
      finished: Promise.resolve(),
      ready: Promise.resolve(),
      updateCallbackDone: Promise.resolve(),
      skipTransition: () => {},
    };
  });
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: mock,
  });
  return mock;
}

function uninstallStartViewTransition() {
  Object.defineProperty(document, "startViewTransition", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

describe("useListMorph", () => {
  afterEach(() => {
    uninstallStartViewTransition();
    vi.restoreAllMocks();
  });

  it("wraps the callback in startViewTransition when available", () => {
    const start = installStartViewTransition();
    const { result } = renderHook(() => useListMorph());
    const callback = vi.fn();

    result.current(callback);

    expect(start).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("invokes the callback directly when startViewTransition is not supported", () => {
    uninstallStartViewTransition();
    const { result } = renderHook(() => useListMorph());
    const callback = vi.fn();

    result.current(callback);

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("short-circuits to direct invocation when prefers-reduced-motion is set", () => {
    const start = installStartViewTransition();

    // Stub matchMedia to return reduced-motion=true for this test only.
    const originalMatchMedia = window.matchMedia;
    window.matchMedia = vi.fn((query: string) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;

    try {
      const { result } = renderHook(() => useListMorph());
      const callback = vi.fn();

      result.current(callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(start).not.toHaveBeenCalled();
    } finally {
      window.matchMedia = originalMatchMedia;
    }
  });

  it("returns a stable callback reference across renders", () => {
    const { result, rerender } = renderHook(() => useListMorph());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
