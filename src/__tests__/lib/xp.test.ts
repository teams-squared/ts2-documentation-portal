import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockPrisma } from "@/__tests__/mocks/prisma";

vi.mock("@/lib/prisma", () => ({ default: mockPrisma, prisma: mockPrisma }));

vi.mock("@/lib/achievements", () => ({
  checkAndAwardAchievements: vi.fn().mockResolvedValue([]),
}));

import { awardXp, effectiveStreak } from "@/lib/xp";
import { checkAndAwardAchievements } from "@/lib/achievements";
const mockCheckAndAwardAchievements = vi.mocked(checkAndAwardAchievements);

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckAndAwardAchievements.mockResolvedValue([]);
});

function midnight(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("awardXp", () => {
  it("starts streak at 1 for a brand-new user", async () => {
    mockPrisma.userStats.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 10,
      streak: 1,
      lastActivityDate: midnight(new Date()),
    });

    const result = await awardXp("user-1", 10);

    expect(mockPrisma.userStats.upsert).toHaveBeenCalledTimes(1);
    const call = mockPrisma.userStats.upsert.mock.calls[0][0];
    expect(call.create.streak).toBe(1);
    expect(call.create.xp).toBe(10);
    expect(call.update.streak).toBe(1);
    expect(result.stats.streak).toBe(1);
    expect(result.newAchievements).toEqual([]);
  });

  it("keeps streak unchanged when last activity was earlier today", async () => {
    const today = midnight(new Date());
    mockPrisma.userStats.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      xp: 50,
      streak: 7,
      lastActivityDate: today,
    });
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 60,
      streak: 7,
      lastActivityDate: today,
    });

    await awardXp("user-1", 10);

    expect(mockPrisma.userStats.upsert.mock.calls[0][0].update.streak).toBe(7);
  });

  it("increments streak when last activity was exactly yesterday", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    mockPrisma.userStats.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      xp: 50,
      streak: 4,
      lastActivityDate: yesterday,
    });
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 60,
      streak: 5,
      lastActivityDate: today,
    });

    await awardXp("user-1", 10);

    expect(mockPrisma.userStats.upsert.mock.calls[0][0].update.streak).toBe(5);
  });

  it("resets streak to 1 when there is a gap of 2+ days", async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const threeDaysAgo = new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000);
    mockPrisma.userStats.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      xp: 200,
      streak: 12,
      lastActivityDate: threeDaysAgo,
    });
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 210,
      streak: 1,
      lastActivityDate: today,
    });

    await awardXp("user-1", 10);

    expect(mockPrisma.userStats.upsert.mock.calls[0][0].update.streak).toBe(1);
  });

  it("increments xp by the requested amount on upsert update", async () => {
    mockPrisma.userStats.findUnique.mockResolvedValueOnce({
      userId: "user-1",
      xp: 100,
      streak: 1,
      lastActivityDate: midnight(new Date()),
    });
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 125,
      streak: 1,
      lastActivityDate: midnight(new Date()),
    });

    await awardXp("user-1", 25);

    expect(mockPrisma.userStats.upsert.mock.calls[0][0].update.xp).toEqual({
      increment: 25,
    });
  });

  it("returns achievements unlocked by the awarded XP", async () => {
    mockPrisma.userStats.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 100,
      streak: 1,
      lastActivityDate: midnight(new Date()),
    });
    mockCheckAndAwardAchievements.mockResolvedValueOnce([
      { id: "ach-1", name: "First lesson", iconKey: "trophy" },
    ]);

    const result = await awardXp("user-1", 100);

    expect(result.newAchievements).toHaveLength(1);
    expect(result.newAchievements[0].id).toBe("ach-1");
  });

  it("uses today's midnight as lastActivityDate regardless of awarded amount", async () => {
    mockPrisma.userStats.findUnique.mockResolvedValueOnce(null);
    mockPrisma.userStats.upsert.mockResolvedValueOnce({
      xp: 5,
      streak: 1,
      lastActivityDate: midnight(new Date()),
    });

    await awardXp("user-1", 5);

    const created = mockPrisma.userStats.upsert.mock.calls[0][0].create
      .lastActivityDate as Date;
    expect(created.getHours()).toBe(0);
    expect(created.getMinutes()).toBe(0);
    expect(created.getSeconds()).toBe(0);
    expect(created.getMilliseconds()).toBe(0);
  });
});

describe("effectiveStreak", () => {
  const now = new Date("2026-05-31T10:00:00");

  function daysAgo(n: number) {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    return d;
  }

  it("returns 0 when there is no activity date", () => {
    expect(effectiveStreak(4, null, now)).toBe(0);
    expect(effectiveStreak(4, undefined, now)).toBe(0);
  });

  it("returns 0 for a non-positive stored streak", () => {
    expect(effectiveStreak(0, daysAgo(0), now)).toBe(0);
  });

  it("keeps the streak when last activity was today", () => {
    expect(effectiveStreak(4, daysAgo(0), now)).toBe(4);
  });

  it("keeps the streak when last activity was yesterday (still in reach)", () => {
    expect(effectiveStreak(4, daysAgo(1), now)).toBe(4);
  });

  it("breaks the streak when last activity was 2+ days ago", () => {
    expect(effectiveStreak(4, daysAgo(2), now)).toBe(0);
    expect(effectiveStreak(4, daysAgo(30), now)).toBe(0);
  });

  it("ignores time-of-day, comparing calendar days only", () => {
    // last activity late yesterday, now early today → still alive
    const lateYesterday = new Date("2026-05-30T23:30:00");
    expect(effectiveStreak(7, lateYesterday, now)).toBe(7);
  });
});
