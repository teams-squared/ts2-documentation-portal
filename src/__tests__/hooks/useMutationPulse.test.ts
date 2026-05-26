import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useMutationPulse } from "@/hooks/useMutationPulse";

describe("useMutationPulse", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits the surface-pulse class for a pulsed id, empty string otherwise", () => {
    const { result } = renderHook(() => useMutationPulse());

    expect(result.current.pulseClass("u1")).toBe("");

    act(() => {
      result.current.pulse("u1");
    });

    expect(result.current.pulseClass("u1")).toBe("surface-pulse");
    expect(result.current.pulseClass("u2")).toBe("");
  });

  it("clears the class after the hold expires (1100ms)", () => {
    const { result } = renderHook(() => useMutationPulse());

    act(() => {
      result.current.pulse("row-7");
    });
    expect(result.current.pulseClass("row-7")).toBe("surface-pulse");

    act(() => {
      vi.advanceTimersByTime(1099);
    });
    expect(result.current.pulseClass("row-7")).toBe("surface-pulse");

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(result.current.pulseClass("row-7")).toBe("");
  });

  it("normalises numeric and string ids to the same key", () => {
    const { result } = renderHook(() => useMutationPulse());

    act(() => {
      result.current.pulse(42);
    });

    expect(result.current.pulseClass(42)).toBe("surface-pulse");
    expect(result.current.pulseClass("42")).toBe("surface-pulse");
  });

  it("re-pulsing the same id restarts the hold (cancels prior timer)", () => {
    const { result } = renderHook(() => useMutationPulse());

    act(() => {
      result.current.pulse("x");
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.pulseClass("x")).toBe("surface-pulse");

    // Re-pulse before the first timer fires.
    act(() => {
      result.current.pulse("x");
    });

    // 200ms after the re-pulse — first timer would have fired at 1100,
    // but the re-pulse cancelled it. The new timer fires at 1000+1100=2100.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current.pulseClass("x")).toBe("surface-pulse");

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.pulseClass("x")).toBe("");
  });

  it("clears outstanding timers on unmount", () => {
    const clearSpy = vi.spyOn(window, "clearTimeout");
    const { result, unmount } = renderHook(() => useMutationPulse());

    act(() => {
      result.current.pulse("a");
      result.current.pulse("b");
    });

    unmount();

    // Each pulse owns one timer; unmount must drain both.
    expect(clearSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    clearSpy.mockRestore();
  });
});
