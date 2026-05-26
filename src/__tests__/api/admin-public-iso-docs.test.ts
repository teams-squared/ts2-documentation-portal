import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";
import { mockPrisma } from "../mocks/prisma";

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

const mockRequireRole = vi.fn();
vi.mock("@/lib/roles", () => ({
  requireRole: (...args: unknown[]) => mockRequireRole(...args),
}));

const mockSyncPublicIsoDoc = vi.fn();
vi.mock("@/lib/policy-doc/sync", () => ({
  syncPublicIsoDoc: (...args: unknown[]) => mockSyncPublicIsoDoc(...args),
}));

const { GET, POST } = await import("@/app/api/admin/public-iso-docs/route");
const { PATCH, DELETE } = await import(
  "@/app/api/admin/public-iso-docs/[id]/route"
);
const { GET: GET_FROM_LESSON, POST: POST_FROM_LESSON } = await import(
  "@/app/api/admin/public-iso-docs/from-lesson/route"
);

const makeReq = (body?: unknown) =>
  new Request("http://localhost/api/admin/public-iso-docs", {
    method: body ? "POST" : "GET",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });

beforeEach(() => vi.clearAllMocks());

describe("/api/admin/public-iso-docs", () => {
  it("GET → 403 for non-admin", async () => {
    mockRequireRole.mockResolvedValue(
      NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    );
    const res = await GET();
    expect(res.status).toBe(403);
    expect(mockRequireRole).toHaveBeenCalledWith("admin");
    expect(mockPrisma.publicIsoDoc.findMany).not.toHaveBeenCalled();
  });

  it("GET → returns docs with view counts, ordered by sortOrder", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.publicIsoDoc.findMany.mockResolvedValueOnce([
      { id: "d1", documentTitle: "First", sortOrder: 0, _count: { views: 7 } },
    ]);
    mockPrisma.isoLibraryView.groupBy.mockResolvedValueOnce([
      { publicIsoDocId: "d1", _count: { userId: 3 } },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs).toHaveLength(1);
    expect(body.docs[0].viewCount).toBe(7);
    expect(body.docs[0].distinctViewers).toBe(3);
    expect(mockPrisma.publicIsoDoc.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ sortOrder: "asc" }, { publishedAt: "asc" }],
      }),
    );
  });

  it("POST → 400 on invalid body", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const res = await POST(makeReq({ driveId: "" }));
    expect(res.status).toBe(400);
    expect(mockSyncPublicIsoDoc).not.toHaveBeenCalled();
  });

  it("POST → forwards to syncPublicIsoDoc with actor id", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockSyncPublicIsoDoc.mockResolvedValueOnce({
      status: "synced",
      created: true,
      versionChanged: false,
      doc: { id: "d1", sourceVersion: "1.0", sourceETag: "e", documentTitle: "T", documentCode: null },
      warnings: [],
    });
    const res = await POST(makeReq({ driveId: "drv-1", itemId: "itm-1" }));
    expect(res.status).toBe(201);
    expect(mockSyncPublicIsoDoc).toHaveBeenCalledWith({
      driveId: "drv-1",
      itemId: "itm-1",
      actorUserId: "a1",
    });
  });
});

describe("/api/admin/public-iso-docs/[id]", () => {
  const params = Promise.resolve({ id: "d1" });

  it("PATCH → updates sortOrder", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.publicIsoDoc.findUnique.mockResolvedValueOnce({ id: "d1" });
    mockPrisma.publicIsoDoc.update.mockResolvedValueOnce({ id: "d1", sortOrder: 5 });
    const req = new Request("http://localhost/api/admin/public-iso-docs/d1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(200);
    expect(mockPrisma.publicIsoDoc.update).toHaveBeenCalledWith({
      where: { id: "d1" },
      data: { sortOrder: 5 },
    });
  });

  it("PATCH → 404 when row missing", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.publicIsoDoc.findUnique.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/api/admin/public-iso-docs/d1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 1 }),
    });
    const res = await PATCH(req, { params });
    expect(res.status).toBe(404);
  });

  it("DELETE → removes row", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.publicIsoDoc.delete.mockResolvedValueOnce({ id: "d1" });
    const req = new Request("http://localhost/api/admin/public-iso-docs/d1", {
      method: "DELETE",
    });
    const res = await DELETE(req, { params });
    expect(res.status).toBe(200);
    expect(mockPrisma.publicIsoDoc.delete).toHaveBeenCalledWith({ where: { id: "d1" } });
  });
});

describe("/api/admin/public-iso-docs/from-lesson", () => {
  it("GET → lists POLICY_DOC lessons not already in the library", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.policyDocLesson.findMany.mockResolvedValueOnce([
      {
        id: "pdl-1",
        sharePointDriveId: "drv-1",
        sharePointItemId: "itm-1",
        documentTitle: "P1",
        documentCode: "P-001",
        sourceVersion: "1.0",
        lesson: { title: "L1", module: { course: { title: "C1" } } },
      },
      {
        id: "pdl-2",
        sharePointDriveId: "drv-1",
        sharePointItemId: "itm-already",
        documentTitle: "P2",
        documentCode: "P-002",
        sourceVersion: "1.0",
        lesson: { title: "L2", module: { course: { title: "C1" } } },
      },
    ]);
    mockPrisma.publicIsoDoc.findMany.mockResolvedValueOnce([
      { sharePointDriveId: "drv-1", sharePointItemId: "itm-already" },
    ]);

    const res = await GET_FROM_LESSON();
    const body = await res.json();
    expect(body.available).toHaveLength(1);
    expect(body.available[0].policyDocLessonId).toBe("pdl-1");
  });

  it("POST → copies the lesson's parsed snapshot into PublicIsoDoc", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    const sourceLastModified = new Date("2026-05-01T00:00:00Z");
    const lastSyncedAt = new Date("2026-05-10T00:00:00Z");
    mockPrisma.policyDocLesson.findUnique.mockResolvedValueOnce({
      id: "pdl-1",
      sharePointDriveId: "drv-1",
      sharePointItemId: "itm-1",
      sharePointWebUrl: "https://sp/x",
      documentTitle: "P1",
      documentCode: "P-001",
      sourceVersion: "1.0",
      sourceETag: "etag",
      sourceLastModified,
      approver: "A",
      approvedOn: null,
      lastReviewedOn: null,
      reviewHistory: [],
      revisionHistory: [],
      lastSyncedAt,
    });
    mockPrisma.publicIsoDoc.create.mockResolvedValueOnce({
      id: "pid-1",
      documentTitle: "P1",
    });

    const req = new Request(
      "http://localhost/api/admin/public-iso-docs/from-lesson",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyDocLessonId: "pdl-1" }),
      },
    );
    const res = await POST_FROM_LESSON(req);
    expect(res.status).toBe(201);
    expect(mockPrisma.publicIsoDoc.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sharePointDriveId: "drv-1",
          sharePointItemId: "itm-1",
          documentTitle: "P1",
          sourceVersion: "1.0",
          publishedById: "a1",
          lastSyncedById: "a1",
        }),
      }),
    );
  });

  it("POST → 409 on duplicate (already in library)", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.policyDocLesson.findUnique.mockResolvedValueOnce({
      id: "pdl-1",
      sharePointDriveId: "drv-1",
      sharePointItemId: "itm-1",
      sharePointWebUrl: "",
      documentTitle: "",
      documentCode: null,
      sourceVersion: "",
      sourceETag: "",
      sourceLastModified: new Date(),
      approver: null,
      approvedOn: null,
      lastReviewedOn: null,
      reviewHistory: [],
      revisionHistory: [],
      lastSyncedAt: new Date(),
    });
    mockPrisma.publicIsoDoc.create.mockRejectedValueOnce(
      Object.assign(new Error("unique"), { code: "P2002" }),
    );
    const req = new Request(
      "http://localhost/api/admin/public-iso-docs/from-lesson",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policyDocLessonId: "pdl-1" }),
      },
    );
    const res = await POST_FROM_LESSON(req);
    expect(res.status).toBe(409);
  });
});
