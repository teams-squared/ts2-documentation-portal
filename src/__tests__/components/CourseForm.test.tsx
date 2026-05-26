import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CourseForm } from "@/components/courses/CourseForm";

describe("CourseForm", () => {
  const mockSubmit = vi.fn();
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all form fields", () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/thumbnail/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/status/i)).toBeInTheDocument();
  });

  it("shows 'Create Course' as default submit label", () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    expect(screen.getByText("Create Course")).toBeInTheDocument();
  });

  it("uses custom submitLabel when provided", () => {
    render(
      <CourseForm
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        submitLabel="Save Changes"
      />,
    );
    expect(screen.getByText("Save Changes")).toBeInTheDocument();
  });

  it("pre-fills fields with initialData when provided", () => {
    render(
      <CourseForm
        initialData={{
          title: "My Course",
          description: "A great course",
          thumbnail: "https://example.com/img.jpg",
          status: "published",
        }}
        onSubmit={mockSubmit}
        onCancel={mockCancel}
      />,
    );
    expect(screen.getByLabelText(/title/i)).toHaveValue("My Course");
    expect(screen.getByLabelText(/description/i)).toHaveValue("A great course");
    expect(screen.getByLabelText(/thumbnail/i)).toHaveValue(
      "https://example.com/img.jpg",
    );
    expect(screen.getByLabelText(/status/i)).toHaveValue("published");
  });

  it("defaults status to 'draft' when no initialData", () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    expect(screen.getByLabelText(/status/i)).toHaveValue("draft");
  });

  it("shows validation error when submitting with empty title", () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    // Use fireEvent.submit to bypass native HTML5 required-field constraint validation
    const titleInput = screen.getByLabelText(/title/i);
    fireEvent.submit(titleInput.closest("form")!);
    expect(screen.getByText("Title is required")).toBeInTheDocument();
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it("shows validation error when title is only whitespace", async () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "   " },
    });
    fireEvent.click(screen.getByText("Create Course"));
    expect(await screen.findByText("Title is required")).toBeInTheDocument();
  });

  it("calls onSubmit with form data when valid", async () => {
    mockSubmit.mockResolvedValue(undefined);
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);

    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "New Course" },
    });
    fireEvent.change(screen.getByLabelText(/description/i), {
      target: { value: "Description here" },
    });
    fireEvent.click(screen.getByText("Create Course"));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New Course",
          description: "Description here",
          status: "draft",
        }),
      );
    });
  });

  it("shows error from thrown onSubmit", async () => {
    mockSubmit.mockRejectedValue(new Error("Server error"));
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "New Course" },
    });
    fireEvent.click(screen.getByText("Create Course"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  it("shows generic error when onSubmit throws non-Error", async () => {
    mockSubmit.mockRejectedValue("unexpected");
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "New Course" },
    });
    fireEvent.click(screen.getByText("Create Course"));

    await waitFor(() => {
      expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    });
  });

  it("disables submit button while loading", async () => {
    let resolveSubmit!: () => void;
    mockSubmit.mockReturnValue(
      new Promise<void>((res) => {
        resolveSubmit = res;
      }),
    );
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "New Course" },
    });
    fireEvent.click(screen.getByText("Create Course"));

    expect(screen.getByText("Saving…")).toBeDisabled();

    resolveSubmit();
  });

  it("calls onCancel when Cancel is clicked", () => {
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(mockCancel).toHaveBeenCalled();
  });

  it("renders node tree selector when nodeTree is provided", () => {
    const nodeTree = [
      { id: "n1", name: "Law Courses", children: [
        { id: "n2", name: "Property Law", children: [] },
      ] },
      { id: "n3", name: "IT Courses", children: [] },
    ];
    render(
      <CourseForm
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        nodeTree={nodeTree}
      />,
    );
    // The NodeTreeSelect renders a button with "No node" as default
    expect(screen.getByText("No node")).toBeInTheDocument();
  });

  it("does not render node selector when nodeTree is empty", () => {
    render(
      <CourseForm
        onSubmit={mockSubmit}
        onCancel={mockCancel}
        nodeTree={[]}
      />,
    );
    expect(screen.queryByText("No node")).not.toBeInTheDocument();
  });

  it("includes nodeId in submit data", async () => {
    mockSubmit.mockResolvedValue(undefined);
    render(<CourseForm onSubmit={mockSubmit} onCancel={mockCancel} />);
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Test" },
    });
    fireEvent.click(screen.getByText("Create Course"));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: null }),
      );
    });
  });
});
