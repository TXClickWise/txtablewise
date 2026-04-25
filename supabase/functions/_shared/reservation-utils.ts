// Shared helpers for reservation engine
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function getWeekdayKey(date: Date, timezone: string): string {
  // Use Intl to get weekday in restaurant timezone
  const fmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: timezone });
  const wd = fmt.format(date).toLowerCase();
  const map: Record<string, string> = {
    sun: "sun", mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat",
  };
  return map[wd];
}

// Build a UTC ISO timestamp for a given date (YYYY-MM-DD) + time (HH:MM) in the given IANA timezone.
// Approach: compute the offset of that wall-clock moment in the target tz, then subtract.
export function zonedDateTimeToUtcIso(dateStr: string, timeStr: string, timeZone: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  // Initial guess as if it were UTC
  const utcGuess = Date.UTC(y, m - 1, d, hh, mm, 0);
  // What does that instant look like in the target tz?
  const tzParts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(utcGuess));
  const get = (t: string) => Number(tzParts.find((p) => p.type === t)?.value);
  const asTzUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  const offset = asTzUtc - utcGuess;
  return new Date(utcGuess - offset).toISOString();
}

export function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

// Two intervals [aStart,aEnd) and [bStart,bEnd) overlap if aStart < bEnd && bStart < aEnd
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export const ACTIVE_STATUSES = ["hold", "pending", "confirmed", "seated"] as const;
