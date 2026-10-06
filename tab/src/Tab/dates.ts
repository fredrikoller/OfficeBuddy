// Date helpers. Dates are ISO strings ("2026-10-01") and all arithmetic is done in UTC,
// so nothing depends on the browser's time zone.

export interface IsoWeek {
  year: number;
  week: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

const toUtc = (date: string) => new Date(`${date}T00:00:00Z`);
const toIso = (date: Date) => date.toISOString().slice(0, 10);

// "Today" as people at the offices see it, regardless of where the browser (or server) runs.
export function todayInStockholm(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Stockholm",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function isoWeekOf(date: string): IsoWeek {
  // The ISO week belongs to the year of its Thursday.
  const thursday = toUtc(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  const week = Math.ceil(
    ((thursday.getTime() - Date.UTC(year, 0, 1)) / DAY_MS + 1) / 7,
  );
  return { year, week };
}

export function mondayOf({ year, week }: IsoWeek): string {
  // January 4th is always in week 1.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const mondayOfWeek1 = jan4.getTime() - ((jan4.getUTCDay() || 7) - 1) * DAY_MS;
  return toIso(new Date(mondayOfWeek1 + (week - 1) * 7 * DAY_MS));
}

export function addDays(date: string, days: number): string {
  return toIso(new Date(toUtc(date).getTime() + days * DAY_MS));
}

// Monday–Friday of the week.
export function weekdaysOf(week: IsoWeek): string[] {
  const monday = mondayOf(week);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

export function addWeeks(week: IsoWeek, weeks: number): IsoWeek {
  return isoWeekOf(addDays(mondayOf(week), weeks * 7));
}

export const isSameWeek = (a: IsoWeek, b: IsoWeek) =>
  a.year === b.year && a.week === b.week;

const format = (date: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("sv-SE", { ...options, timeZone: "UTC" }).format(
    toUtc(date),
  );

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// "Torsdag 1 oktober"
export const formatDay = (date: string) =>
  capitalize(format(date, { weekday: "long", day: "numeric", month: "long" }));

// "28 sep" (some environments add a trailing dot to the short month)
const formatShort = (date: string) =>
  format(date, { day: "numeric", month: "short" }).replace(".", "");

// "Vecka 40 · 28 sep – 2 okt"
export function formatWeek(week: IsoWeek): string {
  const days = weekdaysOf(week);
  return `Vecka ${week.week} · ${formatShort(days[0])} – ${formatShort(days[4])}`;
}
