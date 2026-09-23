/**
 * Parser for the quick-add syntax (Spanish). Extracts recognized tokens and
 * strips them from the free-text title, in this order: recurrence phrases,
 * then dates, then times, then priority, project and labels. Recurrence is
 * parsed before dates because phrases like "cada lunes" contain a weekday
 * word that must not also be read as a due date.
 */

import { addDaysStr, dayOfMonth, isoWeekday, parseSlashDate } from './dateUtil';

export interface QuickAddResult {
  title: string;
  priority: 1 | 2 | 3 | 4;
  due_date: string | null;
  due_time: string | null;
  project: string | null;
  labels: string[];
  recurrence: string | null;
  /** Set when a #project tag didn't match any known project (falls back to Inbox). */
  warning?: string;
}

const WEEKDAYS: Array<{ iso: number; name: string; pattern: string }> = [
  { iso: 1, name: 'lunes', pattern: 'lunes' },
  { iso: 2, name: 'martes', pattern: 'martes' },
  { iso: 3, name: 'miércoles', pattern: 'mi[ée]rcoles' },
  { iso: 4, name: 'jueves', pattern: 'jueves' },
  { iso: 5, name: 'viernes', pattern: 'viernes' },
  { iso: 6, name: 'sábado', pattern: 's[áa]bado' },
  { iso: 7, name: 'domingo', pattern: 'domingo' },
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function stripMatch(text: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return text.slice(0, start) + ' ' + text.slice(start + match[0].length);
}

function collapseSpaces(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

export function parseQuickAdd(text: string, today: string, knownProjects: string[] = []): QuickAddResult {
  let remaining = text;
  let priority: 1 | 2 | 3 | 4 = 4;
  let due_date: string | null = null;
  let due_time: string | null = null;
  let project: string | null = null;
  let warning: string | undefined;
  const labels: string[] = [];
  let recurrence: string | null = null;
  let pendingMonthly = false; // "cada mes" — day resolved once due_date is known

  // ── Recurrence ──────────────────────────────────────────────────────────
  {
    let m = remaining.match(/\btodos los d[íi]as\b/i) || remaining.match(/\bcada d[íi]a\b/i);
    if (m) {
      recurrence = 'daily';
      remaining = stripMatch(remaining, m);
    }
  }
  if (!recurrence) {
    const m = remaining.match(/\bcada (\d{1,2}) d[íi]as\b/i);
    if (m) {
      recurrence = `every:${Number(m[1])}:days`;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!recurrence) {
    for (const wd of WEEKDAYS) {
      const m = remaining.match(new RegExp(`\\bcada ${wd.pattern}\\b`, 'i'));
      if (m) {
        recurrence = `weekly:${wd.iso}`;
        remaining = stripMatch(remaining, m);
        break;
      }
    }
  }
  if (!recurrence) {
    const m = remaining.match(/\bcada semana\b/i);
    if (m) {
      recurrence = `weekly:${isoWeekday(today)}`;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!recurrence) {
    const m = remaining.match(/\bcada mes\b/i);
    if (m) {
      pendingMonthly = true;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!recurrence && !pendingMonthly) {
    const m = remaining.match(/\bcada (\d{1,2})\b/i);
    if (m) {
      recurrence = `monthly:${Number(m[1])}`;
      remaining = stripMatch(remaining, m);
    }
  }

  // ── Dates ───────────────────────────────────────────────────────────────
  {
    const m = remaining.match(/\bpasado ma[ñn]ana\b/i);
    if (m) {
      due_date = addDaysStr(today, 2);
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    const m = remaining.match(/\bhoy\b/i);
    if (m) {
      due_date = today;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    const m = remaining.match(/\bma[ñn]ana\b/i);
    if (m) {
      due_date = addDaysStr(today, 1);
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    const m = remaining.match(/\ben (\d{1,2}) d[íi]as\b/i);
    if (m) {
      due_date = addDaysStr(today, Number(m[1]));
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    const m = remaining.match(/\ben (\d{1,2}) semanas\b/i);
    if (m) {
      due_date = addDaysStr(today, Number(m[1]) * 7);
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    const m = remaining.match(/\bpr[óo]xima semana\b/i);
    if (m) {
      due_date = addDaysStr(today, 7);
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_date) {
    for (const wd of WEEKDAYS) {
      const m = remaining.match(new RegExp(`\\b(?:el\\s+)?${wd.pattern}\\b`, 'i'));
      if (m) {
        let candidate = addDaysStr(today, 1);
        for (let i = 1; i <= 7; i++) {
          candidate = addDaysStr(today, i);
          if (isoWeekday(candidate) === wd.iso) break;
        }
        due_date = candidate;
        remaining = stripMatch(remaining, m);
        break;
      }
    }
  }
  if (!due_date) {
    const m = remaining.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/);
    if (m) {
      const day = Number(m[1]);
      const month = Number(m[2]);
      const year = m[3] ? Number(m[3]) : Number(today.slice(0, 4));
      const parsed = parseSlashDate(day, month, year);
      if (parsed) {
        due_date = parsed;
        remaining = stripMatch(remaining, m);
      }
      // An invalid date (e.g. 31/02) is left untouched in the title.
    }
  }

  if (pendingMonthly) {
    const day = due_date ? dayOfMonth(due_date) : dayOfMonth(today);
    recurrence = `monthly:${day}`;
  }

  // ── Time ────────────────────────────────────────────────────────────────
  {
    const m = remaining.match(/\ba las (\d{1,2})(?::(\d{2}))?\b/i);
    if (m) {
      due_time = `${String(Number(m[1])).padStart(2, '0')}:${m[2] ?? '00'}`;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_time) {
    const m = remaining.match(/\b(\d{1,2}):(\d{2})\b/);
    if (m) {
      due_time = `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`;
      remaining = stripMatch(remaining, m);
    }
  }
  if (!due_time) {
    const m = remaining.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    if (m) {
      let hour = Number(m[1]) % 12;
      if (m[2].toLowerCase() === 'pm') hour += 12;
      due_time = `${String(hour).padStart(2, '0')}:00`;
      remaining = stripMatch(remaining, m);
    }
  }

  // ── Priority ────────────────────────────────────────────────────────────
  {
    const m = remaining.match(/\bp([1-4])\b/i);
    if (m) {
      priority = Number(m[1]) as 1 | 2 | 3 | 4;
      remaining = stripMatch(remaining, m);
    }
  }

  // ── Project ─────────────────────────────────────────────────────────────
  {
    const m = remaining.match(/#(\S+)/);
    if (m) {
      const tag = m[1];
      const found = knownProjects.find((p) => normalize(p) === normalize(tag));
      if (found) {
        project = found;
      } else {
        project = null;
        warning = `Proyecto "${tag}" no existe, se guarda en la Bandeja de entrada`;
      }
      remaining = stripMatch(remaining, m);
    }
  }

  // ── Labels ──────────────────────────────────────────────────────────────
  {
    let m: RegExpMatchArray | null;
    while ((m = remaining.match(/@(\S+)/))) {
      labels.push(m[1]);
      remaining = stripMatch(remaining, m);
    }
  }

  return {
    title: collapseSpaces(remaining),
    priority,
    due_date,
    due_time,
    project,
    labels,
    recurrence,
    ...(warning ? { warning } : {}),
  };
}
