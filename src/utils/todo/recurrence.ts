/**
 * Recurrence rules, stored as plain strings on `todo_tasks.recurrence`:
 *   - `daily`
 *   - `every:N:days`
 *   - `weekly:1,4`   (ISO weekdays, 1 = lunes ... 7 = domingo, comma-separated)
 *   - `monthly:15`   (day of month, clamped at month end)
 */

import { addDaysStr, dayOfMonth, daysInMonth, isoWeekday, parseDateStr } from './dateUtil';

const WEEKDAY_NAMES = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function nextOccurrence(rule: string, fromDate: string): string {
  const [kind, ...rest] = rule.split(':');

  if (kind === 'daily') return addDaysStr(fromDate, 1);

  if (kind === 'every' && rest[1] === 'days') {
    const n = Number(rest[0]);
    if (!Number.isInteger(n) || n < 1) throw new Error(`Regla de recurrencia inválida: ${rule}`);
    return addDaysStr(fromDate, n);
  }

  if (kind === 'weekly' && rest[0]) {
    const days = rest[0].split(',').map(Number);
    if (days.length === 0 || days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) {
      throw new Error(`Regla de recurrencia inválida: ${rule}`);
    }
    for (let i = 1; i <= 7; i++) {
      const candidate = addDaysStr(fromDate, i);
      if (days.includes(isoWeekday(candidate))) return candidate;
    }
    throw new Error(`Regla de recurrencia inválida: ${rule}`);
  }

  if (kind === 'monthly' && rest[0]) {
    const day = Number(rest[0]);
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error(`Regla de recurrencia inválida: ${rule}`);
    }
    const from = parseDateStr(fromDate);
    let month = from.getUTCMonth() + 1; // next month, 0-11
    let year = from.getUTCFullYear();
    if (month > 11) { month = 0; year += 1; }
    const clampedDay = Math.min(day, daysInMonth(year, month + 1));
    return `${String(year).padStart(4, '0')}-${String(month + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
  }

  throw new Error(`Regla de recurrencia inválida: ${rule}`);
}

export function describeRecurrence(rule: string): string {
  const [kind, ...rest] = rule.split(':');

  if (kind === 'daily') return 'cada día';

  if (kind === 'every' && rest[1] === 'days') {
    const n = Number(rest[0]);
    return n === 1 ? 'cada día' : `cada ${n} días`;
  }

  if (kind === 'weekly' && rest[0]) {
    const days = rest[0].split(',').map(Number).sort((a, b) => a - b);
    const names = days.map((d) => WEEKDAY_NAMES[d]);
    if (names.length === 1) return `cada ${names[0]}`;
    return `cada ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
  }

  if (kind === 'monthly' && rest[0]) {
    return `cada ${rest[0]} de cada mes`;
  }

  throw new Error(`Regla de recurrencia inválida: ${rule}`);
}

export { dayOfMonth };
