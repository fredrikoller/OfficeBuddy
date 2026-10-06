import { describe, expect, it } from "vitest";

import {
  addWeeks,
  formatDay,
  formatWeek,
  isoWeekOf,
  mondayOf,
  todayInStockholm,
  weekdaysOf,
} from "./dates";

describe("isoWeekOf", () => {
  it.each([
    ["2026-10-01", 2026, 40],
    ["2024-12-30", 2025, 1], // Monday of week 1 lies in the previous year
    ["2025-12-28", 2025, 52],
    ["2025-12-29", 2026, 1],
    ["2026-12-31", 2026, 53], // 2026 has 53 weeks
    ["2027-01-03", 2026, 53], // Sunday still belongs to week 53
    ["2027-01-04", 2027, 1],
    ["2021-01-03", 2020, 53],
  ])("%s is week %i-%i", (date, year, week) => {
    expect(isoWeekOf(date)).toEqual({ year, week });
  });
});

describe("mondayOf / weekdaysOf", () => {
  it("returns Monday–Friday", () => {
    expect(weekdaysOf({ year: 2026, week: 40 })).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("handles week 1 that starts in the previous year", () => {
    expect(mondayOf({ year: 2026, week: 1 })).toBe("2025-12-29");
  });

  it("handles week 53", () => {
    expect(mondayOf({ year: 2026, week: 53 })).toBe("2026-12-28");
  });
});

describe("addWeeks", () => {
  it("steps across year boundaries", () => {
    expect(addWeeks({ year: 2025, week: 52 }, 1)).toEqual({ year: 2026, week: 1 });
    expect(addWeeks({ year: 2026, week: 1 }, -1)).toEqual({ year: 2025, week: 52 });
    expect(addWeeks({ year: 2026, week: 52 }, 1)).toEqual({ year: 2026, week: 53 });
    expect(addWeeks({ year: 2026, week: 53 }, 1)).toEqual({ year: 2027, week: 1 });
  });
});

describe("todayInStockholm", () => {
  it("uses Stockholm's date, not UTC's", () => {
    // 23:30 UTC is already the next day in Stockholm (UTC+1 in winter, UTC+2 in summer).
    expect(todayInStockholm(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(todayInStockholm(new Date("2026-07-15T22:30:00Z"))).toBe("2026-07-16");
    expect(todayInStockholm(new Date("2026-07-15T21:30:00Z"))).toBe("2026-07-15");
  });
});

describe("formatting", () => {
  it("formats a day in Swedish", () => {
    expect(formatDay("2026-10-01")).toBe("Torsdag 1 oktober");
  });

  it("formats a week in Swedish", () => {
    expect(formatWeek({ year: 2026, week: 40 })).toBe("Vecka 40 · 28 sep – 2 okt");
  });
});
