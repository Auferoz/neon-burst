/**
 * Shared date helpers for the todo domain. Dates are plain calendar dates
 * (`YYYY-MM-DD`, no timezone) — everything here works in UTC internally just
 * to get correct calendar arithmetic, never to attach a timezone meaning.
 */

export function isValidDateString(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysStr(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setUTCDate(d.getUTCDate() + n);
  return formatDate(d);
}

/** ISO weekday: 1 = lunes ... 7 = domingo. */
export function isoWeekday(s: string): number {
  const d = parseDateStr(s);
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function dayOfMonth(s: string): number {
  return parseDateStr(s).getUTCDate();
}

/** DD/MM or DD/MM/YYYY, validated as a real calendar date. Returns null if invalid. */
export function parseSlashDate(day: number, month: number, year: number): string | null {
  if (month < 1 || month > 12) return null;
  const dim = daysInMonth(year, month);
  if (day < 1 || day > dim) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
