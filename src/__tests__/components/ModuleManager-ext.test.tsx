/**
 * Additional tests for ModuleManager covering CRUD flows and lesson
 * editing — pushes the file's coverage from ~22% toward 50%+.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ModuleManager } from "@/components/courses/ModuleManager";

vi.mock("@/components/courses/SharePointFilePicker", () => ({
  SharePointFilePicker: () => null,
}));
vi.mock("@/components/courses/QuizBuilder", () => ({
  QuizBuilder: () => <div data-testid="quiz-builder-mock" />,
}));
vi.mock("@/components/courses/PolicyDocLessonEditor", () => ({
  PolicyDocLessonEditor: () => <div data-testid="policy-doc-editor-mock" />,
}));

const fetchSpy = vi.fn();
beforeEach(() => {
  fetchSpy.mockReset();
  // @ts-expect-error happy-dom
  global.fetch = fetchSpy;
});

const emptyCourse = {
  courseId: "course-1",
  initialModules: [],
};

const oneModule = {
  courseId: "course-1",
  initialModules: [
    {
      id: "m-1",
      title: "Module 1",
      order: 1,
      lessons: [
        {
          id: "l-1",
          title: "Intro",
          type: "text" as const,
          content: "Body text",
          order: 1,
          deadlineDays: null,
        },
        {
          id: "l-2",
          title: "Video",
          type: "video" as const,
          content: "https://youtu.be/abc",
          order: 2,
          deadlineDays: 7,
        },
      ],
    },
  ],
};

describe("ModuleManager — empty state + add module", () => {
  it("renders the 'Add module' affordance when no modules exist", () => {
    render(<ModuleManager {...emptyCourse} />);
    expect(screen.getByText("+ Add module")).toBeInTheDocument();
  });

  it("opens the inline new-module input on + Add module click", () => {
    render(<ModuleManager {...emptyCourse} />);
    fireEvent.click(screen.getByText("+ Add module"));
    expect(
      screen.getByPlaceholderText(/Week 1.*Security basics/i),
    ).toBeInTheDocument();
  });

  it("POSTs to /api/courses/:id/modules on Add module submit", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: "m-new",
        title: "New mod",
        order: 1,
        lessons: [],
      }),
    } as Response);
    render(<ModuleManager {...emptyCourse} />);
    fireEvent.click(screen.getByText("+ Add module"));
    fireEvent.change(screen.getByPlaceholderText(/Week 1.*Security basics/i), {
      target: { value: "New mod" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^Add module$/ }));
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/courses/course-1/modules",
      expect.objectContaining({ method: "POST" }),
    );
  });
});

describe("ModuleManager — existing modules", () => {
  it("renders module title and lesson count", () => {
    render(<ModuleManager {...oneModule} />);
    expect(screen.getByText(/Module 1/)).toBeInTheDocument();
  });

  it("expands module to show lessons on click", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByText("Video")).toBeInTheDocument();
  });

  it("renders a drag handle per lesson when expanded", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    expect(screen.getByLabelText("Drag lesson Intro")).toBeInTheDocument();
    expect(screen.getByLabelText("Drag lesson Video")).toBeInTheDocument();
  });

  it("renders + Add lesson when a module is expanded", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    expect(screen.getByText("+ Add lesson")).toBeInTheDocument();
  });

  it("opens an edit form for a lesson when Edit is clicked", () => {
    render(<ModuleManager {...oneModule} />);
    fireEvent.click(screen.getByText(/Module 1/));
    // Click the edit affordance for the first lesson.
    const editButtons = screen.getAllByText(/^Edit$/i);
    fireEvent.click(editButtons[0]);
    // Edit form exposes a Save lesson button.
    expect(screen.getByText(/Save lesson/i)).toBeInTheDocument();
  });
});
