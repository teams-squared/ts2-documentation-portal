import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { FormButton } from "@/components/ui/FormButton";

describe("FormButton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the idle label by default", () => {
    render(<FormButton>Save</FormButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Save");
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("shows the pending label + spinner when loading", () => {
    render(
      <FormButton loading pendingLabel="Saving…">
        Save
      </FormButton>,
    );
    const btn = screen.getByRole("button");
    expect(btn).toHaveTextContent("Saving…");
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("aria-busy", "true");
    // The Loader2 icon is rendered inside the button.
    expect(btn.querySelector("svg")).not.toBeNull();
  });

  it("falls back to children when no pendingLabel is provided", () => {
    render(<FormButton loading>Save</FormButton>);
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("flashes the success state for the configured hold then reverts", () => {
    const { rerender } = render(
      <FormButton successHoldMs={1000} successLabel="Saved">
        Save
      </FormButton>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Save");

    // Edge-trigger success.
    rerender(
      <FormButton success successHoldMs={1000} successLabel="Saved">
        Save
      </FormButton>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Saved");

    act(() => {
      vi.advanceTimersByTime(999);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Saved");

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("ignores a second success kick during the hold (latches on first edge)", () => {
    const { rerender } = render(
      <FormButton successHoldMs={500} successLabel="Saved">
        Save
      </FormButton>,
    );
    rerender(
      <FormButton success successHoldMs={500} successLabel="Saved">
        Save
      </FormButton>,
    );
    // Same truthy value, no false-then-true edge: no re-kick.
    rerender(
      <FormButton success successHoldMs={500} successLabel="Saved">
        Save
      </FormButton>,
    );
    act(() => {
      vi.advanceTimersByTime(501);
    });
    expect(screen.getByRole("button")).toHaveTextContent("Save");
  });

  it("disabled prop ORs with loading", () => {
    render(<FormButton disabled>Save</FormButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("forwards click events when idle", () => {
    const onClick = vi.fn();
    render(<FormButton onClick={onClick}>Save</FormButton>);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("blocks click events when loading via disabled attribute", () => {
    const onClick = vi.fn();
    render(
      <FormButton loading onClick={onClick}>
        Save
      </FormButton>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).not.toHaveBeenCalled();
  });
});
