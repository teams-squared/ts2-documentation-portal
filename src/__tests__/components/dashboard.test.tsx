import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { NextStepBanner } from "@/components/dashboard/NextStepBanner";
import { DeadlineAlerts } from "@/components/dashboard/DeadlineAlerts";
import { CourseProgressList } from "@/components/dashboard/CourseProgressList";

describe("NextStepBanner", () => {
  const base = {
    courseTitle: "Auth Basics",
    lessonTitle: "Intro to OAuth",
    completedLessons: 2,
    totalLessons: 10,
    percentComplete: 20,
    continueUrl: "/courses/c/lessons/l3",
    isOverdue: false,
  };

  it("renders course title, lesson title, and the Continue CTA pointing at continueUrl", () => {
    render(<NextStepBanner {...base} />);
    expect(screen.getByText("Auth Basics")).toBeInTheDocument();
    expect(screen.getByText("Intro to OAuth")).toBeInTheDocument();
    const link = screen.getByText("Auth Basics").closest("a");
    expect(link?.getAttribute("href")).toBe("/courses/c/lessons/l3");
  });

  it("computes the next lesson number as completed+1", () => {
    render(<NextStepBanner {...base} />);
    expect(screen.getByText("Lesson 3/10")).toBeInTheDocument();
  });

  it("renders an AlertTriangle and danger styling when isOverdue", () => {
    const { container } = render(
      <NextStepBanner {...base} isOverdue />,
    );
    expect(container.innerHTML).toContain("border-l-danger");
    expect(
      screen.getByText(/overdue/i),
    ).toBeInTheDocument();
  });

  it("renders the 0%-nudge when percentComplete is 0", () => {
    render(<NextStepBanner {...base} percentComplete={0} />);
    expect(screen.getByText(/first XP/i)).toBeInTheDocument();
  });

  it("renders the 50%+ nudge with the percent interpolated", () => {
    render(<NextStepBanner {...base} percentComplete={60} />);
    expect(screen.getByText(/60% of the way/)).toBeInTheDocument();
  });

  it("renders the almost-there nudge when percent in [75, 100)", () => {
    render(<NextStepBanner {...base} percentComplete={92} />);
    expect(screen.getByText(/Almost there/i)).toBeInTheDocument();
  });

  it("renders the complete nudge at 100%", () => {
    render(<NextStepBanner {...base} percentComplete={100} />);
    expect(screen.getByText(/Course complete/i)).toBeInTheDocument();
  });

  it("renders the 25-50 nudge when percent in [25, 50)", () => {
    render(<NextStepBanner {...base} percentComplete={30} />);
    expect(screen.getByText(/one step at a time/i)).toBeInTheDocument();
  });

  it("renders the 1-24 nudge when percent in (0, 25)", () => {
    render(<NextStepBanner {...base} percentComplete={10} />);
    expect(screen.getByText(/momentum going/i)).toBeInTheDocument();
  });
});

describe("DeadlineAlerts", () => {
  const overdue = {
    lessonId: "l-1",
    lessonTitle: "Late",
    courseId: "c-1",
    courseTitle: "Course A",
    status: "overdue" as const,
    relativeText: "2 days overdue",
  };
  const dueSoon = {
    lessonId: "l-2",
    lessonTitle: "Soon",
    courseId: "c-1",
    courseTitle: "Course A",
    status: "due-soon" as const,
    relativeText: "due in 2 days",
  };
  const upcoming = {
    lessonId: "l-3",
    lessonTitle: "Later",
    courseId: "c-1",
    courseTitle: "Course A",
    status: "upcoming" as const,
    relativeText: "due in 2 weeks",
  };

  it("renders nothing when there are no deadlines at all", () => {
    const { container } = render(<DeadlineAlerts deadlines={[]} />);
    expect(container.textContent).toBe("");
  });

  it("shows an on-track confirmation when only upcoming (non-urgent) items exist", () => {
    render(<DeadlineAlerts deadlines={[upcoming]} />);
    expect(screen.getByText(/on track/i)).toBeInTheDocument();
    // Upcoming item is tucked behind the expander.
    expect(screen.queryByText("Later")).toBeNull();
    fireEvent.click(screen.getByText("1 upcoming"));
    expect(screen.getByText("Later")).toBeInTheDocument();
  });

  it("renders overdue items with danger styling", () => {
    const { container } = render(<DeadlineAlerts deadlines={[overdue]} />);
    expect(screen.getByText("Late")).toBeInTheDocument();
    expect(container.innerHTML).toContain("border-l-danger");
    expect(screen.getByText("2 days overdue")).toBeInTheDocument();
  });

  it("renders due-soon items with warning styling", () => {
    const { container } = render(<DeadlineAlerts deadlines={[dueSoon]} />);
    expect(screen.getByText("Soon")).toBeInTheDocument();
    expect(container.innerHTML).toContain("border-l-warning");
  });

  it("hides upcoming items by default and toggles them on", () => {
    render(<DeadlineAlerts deadlines={[overdue, upcoming]} />);
    expect(screen.queryByText("Later")).toBeNull();
    fireEvent.click(screen.getByText("1 more upcoming"));
    expect(screen.getByText("Later")).toBeInTheDocument();
    expect(screen.getByText("Hide upcoming")).toBeInTheDocument();
  });

  it("links each row at /courses/<courseId>/lessons/<lessonId>", () => {
    const { container } = render(<DeadlineAlerts deadlines={[overdue]} />);
    const link = container.querySelector("a");
    expect(link?.getAttribute("href")).toBe("/courses/c-1/lessons/l-1");
  });
});

describe("CourseProgressList", () => {
  const c = (over: Partial<Parameters<typeof CourseProgressList>[0]["courses"][0]>) => ({
    courseId: "c-1",
    courseTitle: "Course",
    category: null,
    completedLessons: 1,
    totalLessons: 4,
    percentComplete: 25,
    continueUrl: "/courses/c-1",
    isComplete: false,
    ...over,
  });

  it("renders empty state for non-admin with no enrollments", () => {
    render(
      <CourseProgressList
        courses={[]}
        completedCount={0}
        hasEnrollments={false}
        userRole="employee"
      />,
    );
    expect(screen.getByText(/No courses yet/)).toBeInTheDocument();
    expect(
      screen.getByText(/Reach out to your administrator/),
    ).toBeInTheDocument();
    // Non-admin sees no "Browse the catalog" button.
    expect(screen.queryByText("Browse the catalog")).toBeNull();
  });

  it("admin empty state includes a Browse the catalog button", () => {
    render(
      <CourseProgressList
        courses={[]}
        completedCount={0}
        hasEnrollments={false}
        userRole="admin"
      />,
    );
    expect(screen.getByText("Browse the catalog")).toBeInTheDocument();
  });

  it("shows the all-caught-up state when courses=[] but hasEnrollments=true", () => {
    render(
      <CourseProgressList
        courses={[]}
        completedCount={3}
        hasEnrollments={true}
        userRole="employee"
      />,
    );
    expect(screen.getByText(/all caught up/i)).toBeInTheDocument();
    expect(screen.getByText("3 completed")).toBeInTheDocument();
  });

  it("renders a card per in-progress course with the right percent", () => {
    render(
      <CourseProgressList
        courses={[
          c({ courseId: "c-1", courseTitle: "First", percentComplete: 25 }),
          c({ courseId: "c-2", courseTitle: "Second", percentComplete: 80 }),
        ]}
        completedCount={0}
        hasEnrollments={true}
        userRole="employee"
      />,
    );
    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Second")).toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
  });

  it("renders the Completed badge on isComplete courses and Almost on 75-99%", () => {
    render(
      <CourseProgressList
        courses={[
          c({ courseId: "c-1", courseTitle: "Done", percentComplete: 100, isComplete: true }),
          c({ courseId: "c-2", courseTitle: "Close", percentComplete: 80 }),
        ]}
        completedCount={1}
        hasEnrollments={true}
        userRole="employee"
      />,
    );
    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.getByText("Almost")).toBeInTheDocument();
  });

  it("shows the next lesson on in-progress cards but not completed ones", () => {
    render(
      <CourseProgressList
        courses={[
          c({ courseId: "c-1", courseTitle: "Active", nextLessonTitle: "OAuth Basics" }),
          c({
            courseId: "c-2",
            courseTitle: "Finished",
            isComplete: true,
            nextLessonTitle: "Should Not Show",
          }),
        ]}
        completedCount={1}
        hasEnrollments={true}
        userRole="employee"
      />,
    );
    expect(screen.getByText("OAuth Basics")).toBeInTheDocument();
    expect(screen.queryByText("Should Not Show")).toBeNull();
  });

  it("pluralizes lesson(s) correctly", () => {
    render(
      <CourseProgressList
        courses={[
          c({ courseId: "c-1", courseTitle: "Single", totalLessons: 1 }),
          c({ courseId: "c-2", courseTitle: "Multi", totalLessons: 5 }),
        ]}
        completedCount={0}
        hasEnrollments={true}
        userRole="employee"
      />,
    );
    expect(screen.getByText(/1 of 1 lesson$/)).toBeInTheDocument();
    expect(screen.getByText(/1 of 5 lessons$/)).toBeInTheDocument();
  });
});
