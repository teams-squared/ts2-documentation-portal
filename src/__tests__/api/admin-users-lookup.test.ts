import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const mockLookup = vi.fn();
vi.mock("@/lib/entra/graph", () => ({
  lookupTenantUser: (...args: unknown[]) => mockLookup(...args),
}));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const { GET } = await import("@/app/api/admin/users/lookup/route");

const makeReq = (email: string) =>
  new Request(
    `http://localhost/api/admin/users/lookup?email=${encodeURIComponent(email)}`,
  );

describe("GET /api/admin/users/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 403 for unauthorized", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET(makeReq("akil@teamsquared.io"));
    expect(res.status).toBe(403);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid email", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    const res = await GET(makeReq("not@an@email"));
    expect(res.status).toBe(400);
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("normalizes a bare username before lookup", async () => {
    mockRequireRole.mockResolvedValue({ userId: "admin-1", role: "admin" });
    mockLookup.mockResolvedValue({ status: "not_found" });
    const res = await GET(makeReq("akil"));
    expect(res.status).toBe(200);
    expect(mockLookup).toHaveBeenCalledWith("akil@teamsquared.io");
  });

  it("passes through the directory result", async () => {
    mockRequireRole.mockResolvedValue({ userId: "cm-1", role: "course_manager" });
    mockLookup.mockResolvedValue({
      status: "found",
      accountEnabled: true,
      displayName: "Akil Fernando",
    });
    const res = await GET(makeReq("akil@teamsquared.io"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "found",
      accountEnabled: true,
      displayName: "Akil Fernando",
    });
  });
});
