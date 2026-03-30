/**
 * NZ public holidays and working day utilities for 2025-2028.
 *
 * Mondayisation: if Waitangi Day (6 Feb) or ANZAC Day (25 Apr) falls on a
 * Saturday, the following Monday is observed. If on a Sunday, the following
 * Monday is observed.
 *
 * Christmas Day and Boxing Day have their own Mondayisation:
 * - If Christmas (25 Dec) is Sunday, Monday 27th is observed for Christmas.
 * - If Boxing Day (26 Dec) is Saturday, Monday 28th is observed for Boxing Day.
 * - Both can shift, so we enumerate them per year.
 */

type HolidayEntry = { month: number; day: number; name: string };

function makeDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Returns the nth occurrence of a given weekday in a month.
 * weekday: 0 = Sunday, 1 = Monday, ...
 */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
  n: number
): number {
  const firstDay = new Date(year, month - 1, 1).getDay();
  let firstOccurrence = 1 + ((weekday - firstDay + 7) % 7);
  return firstOccurrence + (n - 1) * 7;
}

/**
 * Apply Mondayisation: if the date falls on Saturday, observed on Monday (+2).
 * If Sunday, observed on Monday (+1).
 */
function mondayise(year: number, month: number, day: number): { month: number; day: number } {
  const date = new Date(year, month - 1, day);
  const dow = date.getDay();
  if (dow === 6) {
    // Saturday -> Monday
    const shifted = new Date(year, month - 1, day + 2);
    return { month: shifted.getMonth() + 1, day: shifted.getDate() };
  }
  if (dow === 0) {
    // Sunday -> Monday
    const shifted = new Date(year, month - 1, day + 1);
    return { month: shifted.getMonth() + 1, day: shifted.getDate() };
  }
  return { month, day };
}

// Easter dates (Good Friday / Easter Monday) — pre-computed
const easterDates: Record<number, { goodFriday: HolidayEntry; easterMonday: HolidayEntry }> = {
  2025: {
    goodFriday: { month: 4, day: 18, name: "Good Friday" },
    easterMonday: { month: 4, day: 21, name: "Easter Monday" },
  },
  2026: {
    goodFriday: { month: 4, day: 3, name: "Good Friday" },
    easterMonday: { month: 4, day: 6, name: "Easter Monday" },
  },
  2027: {
    goodFriday: { month: 3, day: 26, name: "Good Friday" },
    easterMonday: { month: 3, day: 29, name: "Easter Monday" },
  },
  2028: {
    goodFriday: { month: 4, day: 14, name: "Good Friday" },
    easterMonday: { month: 4, day: 17, name: "Easter Monday" },
  },
};

// Matariki dates — pre-computed
const matarikiDates: Record<number, HolidayEntry> = {
  2025: { month: 6, day: 20, name: "Matariki" },
  2026: { month: 7, day: 10, name: "Matariki" },
  2027: { month: 6, day: 25, name: "Matariki" },
  2028: { month: 7, day: 14, name: "Matariki" },
};

/**
 * Get all NZ public holidays for a given year.
 */
function getHolidaysForYear(year: number): Set<string> {
  const holidays = new Set<string>();

  // New Year's Day (1 Jan) — Mondayised
  const ny1 = mondayise(year, 1, 1);
  holidays.add(makeDate(year, ny1.month, ny1.day));
  // Also add the actual date if different (both days can be holidays)
  holidays.add(makeDate(year, 1, 1));

  // Day after New Year's (2 Jan) — Mondayised
  const ny2 = mondayise(year, 1, 2);
  holidays.add(makeDate(year, ny2.month, ny2.day));
  holidays.add(makeDate(year, 1, 2));

  // Handle NY Mondayisation properly: if 1 Jan is Saturday and 2 Jan is Sunday,
  // then Monday 3rd and Tuesday 4th are both observed
  const jan1Dow = new Date(year, 0, 1).getDay();
  if (jan1Dow === 6) {
    // Sat: 1 Jan observed Mon 3rd, 2 Jan (Sun) observed Tue 4th
    holidays.add(makeDate(year, 1, 3));
    holidays.add(makeDate(year, 1, 4));
  } else if (jan1Dow === 0) {
    // Sun: 1 Jan observed Mon 2nd (but 2nd is already a holiday),
    // 2 Jan (Mon) is itself, 1 Jan observed on Tue 3rd
    holidays.add(makeDate(year, 1, 3));
  }

  // Waitangi Day (6 Feb) — Mondayised
  const waitangi = mondayise(year, 2, 6);
  holidays.add(makeDate(year, waitangi.month, waitangi.day));
  holidays.add(makeDate(year, 2, 6));

  // Good Friday & Easter Monday
  const easter = easterDates[year];
  if (easter) {
    holidays.add(makeDate(year, easter.goodFriday.month, easter.goodFriday.day));
    holidays.add(makeDate(year, easter.easterMonday.month, easter.easterMonday.day));
  }

  // ANZAC Day (25 Apr) — Mondayised
  const anzac = mondayise(year, 4, 25);
  holidays.add(makeDate(year, anzac.month, anzac.day));
  holidays.add(makeDate(year, 4, 25));

  // King's Birthday — first Monday in June
  const kingsBday = nthWeekdayOfMonth(year, 6, 1, 1);
  holidays.add(makeDate(year, 6, kingsBday));

  // Matariki
  const matariki = matarikiDates[year];
  if (matariki) {
    holidays.add(makeDate(year, matariki.month, matariki.day));
  }

  // Labour Day — fourth Monday in October
  const labourDay = nthWeekdayOfMonth(year, 10, 1, 4);
  holidays.add(makeDate(year, 10, labourDay));

  // Christmas Day (25 Dec) — Mondayised
  const xmas = mondayise(year, 12, 25);
  holidays.add(makeDate(year, xmas.month, xmas.day));
  holidays.add(makeDate(year, 12, 25));

  // Boxing Day (26 Dec) — Mondayised, but if Christmas was on Saturday
  // (observed Monday 27th), Boxing Day (Sunday) is observed Tuesday 28th
  const dec25Dow = new Date(year, 11, 25).getDay();
  if (dec25Dow === 6) {
    // Christmas Sat -> observed Mon 27, Boxing Sun -> observed Tue 28
    holidays.add(makeDate(year, 12, 27));
    holidays.add(makeDate(year, 12, 28));
  } else if (dec25Dow === 0) {
    // Christmas Sun -> observed Mon 27, Boxing Mon 26 is itself
    holidays.add(makeDate(year, 12, 27));
    holidays.add(makeDate(year, 12, 26));
  } else if (dec25Dow === 5) {
    // Christmas Fri, Boxing Sat -> observed Mon 28
    holidays.add(makeDate(year, 12, 28));
  } else {
    const boxing = mondayise(year, 12, 26);
    holidays.add(makeDate(year, boxing.month, boxing.day));
  }
  holidays.add(makeDate(year, 12, 25));
  holidays.add(makeDate(year, 12, 26));

  return holidays;
}

// Cache holidays per year
const holidayCache = new Map<number, Set<string>>();

function getHolidays(year: number): Set<string> {
  if (!holidayCache.has(year)) {
    holidayCache.set(year, getHolidaysForYear(year));
  }
  return holidayCache.get(year)!;
}

function formatDate(date: Date): string {
  return makeDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/**
 * Returns true if the given date is a NZ public holiday.
 */
export function isNzPublicHoliday(date: Date): boolean {
  const holidays = getHolidays(date.getFullYear());
  return holidays.has(formatDate(date));
}

/**
 * Returns true if the given date falls on a Saturday or Sunday.
 */
export function isWeekend(date: Date): boolean {
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

/**
 * If the date falls on a weekend or NZ public holiday, advance to the next
 * working day. Returns a new Date (or the same date if already a working day).
 */
export function nextWorkingDay(date: Date): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  while (isWeekend(result) || isNzPublicHoliday(result)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}
