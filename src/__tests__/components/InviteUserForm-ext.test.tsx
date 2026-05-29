/**
 * Extended tests for InviteUserForm — pushes coverage from 20% toward 60%.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.unmock("@/components/ui/ToastProvider");

vi.mock("@/components/admin/CourseNodeTree", () => ({
  CourseNodeTree: () => <div data-testid="course-node-tree-stub" />,
}));

import { ToastProvider } from "@/components/ui/ToastProvider";
import { InviteUserForm } from "@/components/admin/InviteUserForm";

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // Default: the advisory directory lookup fired on email blur resolves to
  // "unknown" (no badge). Individual tests override for invite POSTs.
  fetchSpy.mockResolvedValue({
    ok: true,
    json: async () => ({ status: "unknown" }),
  });
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

function wrap(node: React.ReactNode) {
  return render(<ToastProvider>{node}</ToastProvider>);
}

const baseProps = {
  nodeTree: [],
  inviterRole: "admin" as const,
  onCancel: vi.fn(),
  onSuccess: vi.fn(),
};

describe("InviteUserForm — UI", () => {
  it("shows '1 row' label when there's one recipient initially", () => {
    wrap(<InviteUserForm {...baseProps} />);
    expect(screen.getByText(/\(1 row\)/)).toBeInTheDocument();
  });

  it("adds a new recipient row when the + Add row button is clicked", () => {
    wrap(<InviteUserForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Add another recipient/i }));
    expect(screen.getByText(/\(2 rows\)/)).toBeInTheDocument();
    expect(screen.getByLabelText("Email for recipient 2")).toBeInTheDocument();
  });

  it("removes a row when its remove button is clicked (when >1 row)", () => {
    wrap(<InviteUserForm {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /Add another recipient/i }));
    fireEvent.click(screen.getByLabelText("Remove recipient 2"));
    expect(screen.getByText(/\(1 row\)/)).toBeInTheDocument();
  });

  it("toggles the paste-list area on click", () => {
    wrap(<InviteUserForm {...baseProps} />);
    fireEvent.click(screen.getByText(/Paste a list/));
    expect(
      screen.getByPlaceholderText(/jordan@example\.com/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Hide paste/));
    expect(screen.queryByPlaceholderText(/jordan@example\.com/)).toBeNull();
  });

  it("imports pasted recipients into the row list", () => {
    wrap(<InviteUserForm {...baseProps} />);
    fireEvent.click(screen.getByText(/Paste a list/));
    fireEvent.change(screen.getByPlaceholderText(/jordan@example\.com/), {
      target: { value: "a@x.com, Alice\nb@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Import$/ }));
    // Two rows imported.
    expect(screen.getByText(/\(2 rows\)/)).toBeInTheDocument();
    expect(
      (screen.getByLabelText("Email for recipient 1") as HTMLInputElement).value,
    ).toBe("a@x.com");
    expect(
      (screen.getByLabelText("Name for recipient 1") as HTMLInputElement).value,
    ).toBe("Alice");
  });

  it("autofills the org domain on blur for a bare username", () => {
    wrap(<InviteUserForm {...baseProps} />);
    const input = screen.getByLabelText("Email for recipient 1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "akil" } });
    fireEvent.blur(input);
    expect(input.value).toBe("akil@teamsquared.io");
  });

  it("leaves a full address untouched on blur", () => {
    wrap(<InviteUserForm {...baseProps} />);
    const input = screen.getByLabelText("Email for recipient 1") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "akil@gmail.com" } });
    fireEvent.blur(input);
    expect(input.value).toBe("akil@gmail.com");
  });

  it("renders role picker options for an admin inviter", () => {
    wrap(<InviteUserForm {...baseProps} />);
    expect(screen.getByDisplayValue(/employee/i)).toBeInTheDocument();
  });

  it("calls onCancel when the Cancel button is clicked", () => {
    const onCancel = vi.fn();
    wrap(<InviteUserForm {...baseProps} onCancel={onCancel} />);
    fireEvent.click(screen.getAllByRole("button", { name: /Cancel/i })[0]);
    expect(onCancel).toHaveBeenCalled();
  });
});
