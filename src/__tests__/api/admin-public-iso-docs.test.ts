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

  it("GET → returns docs ordered by sortOrder", async () => {
    mockRequireRole.mockResolvedValue({ userId: "a1", role: "admin" });
    mockPrisma.publicIsoDoc.findMany.mockResolvedValueOnce([
      { id: "d1", documentTitle: "First", sortOrder: 0 },
    ]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs).toHaveLength(1);
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
