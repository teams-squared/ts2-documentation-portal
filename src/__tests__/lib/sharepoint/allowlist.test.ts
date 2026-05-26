import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

// Extend the shared mock with the entry points used by allowlist.ts.
// We add them directly on mockPrisma so the import binding below picks
// them up (vi.mock factories must return the same object reference).
const mockQueryRaw = vi.fn();
(mockPrisma as unknown as { $queryRaw: typeof mockQueryRaw }).$queryRaw = mockQueryRaw;
const mockPolicyFindFirst = vi.fn();
mockPrisma.policyDocLesson.findFirst = mockPolicyFindFirst;
const mockPublicFindFirst = vi.fn();
mockPrisma.publicIsoDoc.findFirst = mockPublicFindFirst;

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

import { isAllowlistedSharePointItem } from "@/lib/sharepoint/allowlist";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("isAllowlistedSharePointItem", () => {
  it("returns false when driveId is empty (no DB call)", async () => {
    const result = await isAllowlistedSharePointItem("", "item-1");
    expect(result).toBe(false);
    expect(mockPolicyFindFirst).not.toHaveBeenCalled();
    expect(mockPublicFindFirst).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns false when itemId is empty (no DB call)", async () => {
    const result = await isAllowlistedSharePointItem("drive-1", "");
    expect(result).toBe(false);
    expect(mockPolicyFindFirst).not.toHaveBeenCalled();
    expect(mockPublicFindFirst).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns true on policy-doc match (fast path) and skips later checks", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce({ id: "pdl-1" });

    const result = await isAllowlistedSharePointItem("drive-1", "item-1");

    expect(result).toBe(true);
    expect(mockPolicyFindFirst).toHaveBeenCalledWith({
      where: { sharePointDriveId: "drive-1", sharePointItemId: "item-1" },
      select: { id: true },
    });
    expect(mockPublicFindFirst).not.toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("returns true on public-iso-doc match and skips the lesson scan", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce(null);
    mockPublicFindFirst.mockResolvedValueOnce({ id: "pid-1" });

    const result = await isAllowlistedSharePointItem("drive-1", "item-1");

    expect(result).toBe(true);
    expect(mockPublicFindFirst).toHaveBeenCalledWith({
      where: { sharePointDriveId: "drive-1", sharePointItemId: "item-1" },
      select: { id: true },
    });
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it("falls through to lesson scan when neither policy-doc nor public-iso match", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce(null);
    mockPublicFindFirst.mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValueOnce([{ id: "lesson-7" }]);

    const result = await isAllowlistedSharePointItem("drive-1", "item-1");

    expect(result).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns false when nothing references the item", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce(null);
    mockPublicFindFirst.mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValueOnce([]);

    const result = await isAllowlistedSharePointItem("drive-rogue", "item-rogue");

    expect(result).toBe(false);
  });

  it("escapes LIKE wildcards in driveId/itemId so attackers can't widen the match", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce(null);
    mockPublicFindFirst.mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValueOnce([]);

    // `_` and `%` are SQL LIKE wildcards. If unescaped, `_` matches any single
    // char and `%` matches anything — an attacker who controls the URL could
    // probe for partial matches. Confirm both are backslash-escaped before
    // being placed in the LIKE pattern that gets bound to the query.
    await isAllowlistedSharePointItem("drive_%", "item%_");

    // The tagged-template `$queryRaw` call signature is
    //   $queryRaw(strings, ...values).
    // The driveId pattern is the first interpolated value, itemId the second.
    const callArgs = mockQueryRaw.mock.calls[0];
    const drivePatternArg = callArgs[1] as string;
    const itemPatternArg = callArgs[2] as string;

    expect(drivePatternArg).toBe(`%"driveId":"drive\\_\\%"%`);
    expect(itemPatternArg).toBe(`%"itemId":"item\\%\\_"%`);
  });

  it("escapes literal backslash as well as _ and %", async () => {
    mockPolicyFindFirst.mockResolvedValueOnce(null);
    mockPublicFindFirst.mockResolvedValueOnce(null);
    mockQueryRaw.mockResolvedValueOnce([]);

    await isAllowlistedSharePointItem("d\\rive", "item");

    const drivePatternArg = mockQueryRaw.mock.calls[0][1] as string;
    expect(drivePatternArg).toBe(`%"driveId":"d\\\\rive"%`);
  });
});
