import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { PolicyDocViewer, POLICY_ACK_EVENT } from "@/components/courses/PolicyDocViewer";

const DWELL_MS = 6 * 60 * 1000;
const STORAGE_KEY = (lessonId: string) => `policy-doc-dwell:${lessonId}`;

const baseProps = {
  lessonId: "lesson-1",
  lessonTitle: "Test Lesson",
  documentTitle: "Policy XYZ",
  documentCode: "POL-001",
  sourceVersion: "1.0",
  approver: "Akil",
  approvedOn: null,
  lastReviewedOn: null,
  sharePointDriveId: "drive-1",
  sharePointItemId: "item-1",
  revisionHistory: [],
  reviewHistory: [],
  sharePointWebUrl: "https://sp.example.com/doc",
  lastAcknowledgement: null,
};

beforeEach(() => {
  window.sessionStorage.clear();
  // Ensure document is visible so the interval ticks.
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
});

describe("PolicyDocViewer — dwell persistence", () => {
  it("starts at 0 dwellMs with empty sessionStorage", () => {
    render(<PolicyDocViewer {...baseProps} />);
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-1"))).toBeNull();
  });

  it("writes accumulated dwell to sessionStorage as the interval ticks", () => {
    render(<PolicyDocViewer {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    const raw = window.sessionStorage.getItem(STORAGE_KEY("lesson-1"));
    expect(raw).not.toBeNull();
    const ms = Number.parseInt(raw!, 10);
    expect(ms).toBeGreaterThanOrEqual(1900);
    expect(ms).toBeLessThanOrEqual(2100);
  });

  it("hydrates dwellMs from sessionStorage on remount (same-tab nav-away/back)", () => {
    // Pre-seed sessionStorage as if a prior mount had accrued 2 minutes.
    const PRIOR = 2 * 60 * 1000;
    window.sessionStorage.setItem(STORAGE_KEY("lesson-1"), String(PRIOR));

    const { container } = render(<PolicyDocViewer {...baseProps} />);

    // After mount + one tick the persisted value should be at-or-above prior.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const raw = window.sessionStorage.getItem(STORAGE_KEY("lesson-1"));
    expect(raw).not.toBeNull();
    expect(Number.parseInt(raw!, 10)).toBeGreaterThanOrEqual(PRIOR);

    // The mm:ss remaining label should show roughly 4 minutes left, not 6.
    expect(container.textContent).toContain("4:00");
    expect(container.textContent).not.toContain("6:00");
  });

  it("clears sessionStorage once the full dwell window is reached", () => {
    render(<PolicyDocViewer {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(DWELL_MS + 1000);
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-1"))).toBeNull();
  });

  it("ignores corrupt sessionStorage values (returns 0)", () => {
    window.sessionStorage.setItem(STORAGE_KEY("lesson-1"), "not-a-number");
    render(<PolicyDocViewer {...baseProps} />);
    // Sanity: after one tick, value should be small (started fresh), not preserved as the corrupt string.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    const raw = window.sessionStorage.getItem(STORAGE_KEY("lesson-1"));
    expect(raw).not.toBe("not-a-number");
    expect(Number.parseInt(raw!, 10)).toBeLessThan(1000);
  });

  it("scopes the key by lessonId so two lessons do not collide", () => {
    const { unmount } = render(<PolicyDocViewer {...baseProps} />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    unmount();

    render(<PolicyDocViewer {...baseProps} lessonId="lesson-2" />);
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-1"))).not.toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-2"))).not.toBeNull();
  });

  it("does not write sessionStorage when alreadyCompleted is true", () => {
    render(<PolicyDocViewer {...baseProps} alreadyCompleted />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-1"))).toBeNull();
  });

  it("dispatches POLICY_ACK_EVENT immediately when alreadyCompleted", () => {
    const listener = vi.fn();
    window.addEventListener(POLICY_ACK_EVENT, listener);
    render(<PolicyDocViewer {...baseProps} alreadyCompleted />);
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener(POLICY_ACK_EVENT, listener);
  });
});

describe('PolicyDocViewer — acknowledgementMode="none" (public library)', () => {
  it("hides the dwell countdown and the attestation block", () => {
    const { container, queryByLabelText } = render(
      <PolicyDocViewer {...baseProps} acknowledgementMode="none" />,
    );
    // No "Acknowledge unlocks in M:SS" framing
    expect(container.textContent).not.toContain("Acknowledge unlocks in");
    // No attestation section / checkbox
    expect(queryByLabelText("Acknowledgement")).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
  });

  it("does not touch sessionStorage and does not dispatch POLICY_ACK_EVENT", () => {
    const listener = vi.fn();
    window.addEventListener(POLICY_ACK_EVENT, listener);
    render(<PolicyDocViewer {...baseProps} acknowledgementMode="none" />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(window.sessionStorage.getItem(STORAGE_KEY("lesson-1"))).toBeNull();
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener(POLICY_ACK_EVENT, listener);
  });

  it("suppresses the stale-ack banner even when lastAcknowledgement.version differs", () => {
    const { container } = render(
      <PolicyDocViewer
        {...baseProps}
        acknowledgementMode="none"
        lastAcknowledgement={{ version: "0.9", acknowledgedAt: null }}
      />,
    );
    expect(container.textContent).not.toContain(
      "Policy updated since your last acknowledgement",
    );
  });
});
