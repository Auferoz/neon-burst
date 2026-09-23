import { addDaysStr } from './dateUtil';
import { isOverdue } from './taskQueries';
import type { Completion, Priority, Task } from './types';

export interface DayCount {
  date: string;
  count: number;
}

export interface Stats {
  completedToday: number;
  completedWeek: number;
  currentStreak: number;
  bestStreak: number;
  overdueCount: number;
  perDay: DayCount[];
  byProject: Record<number, number>;
  byPriority: Record<Priority, number>;
}

function dateOnly(ts: string): string {
  return ts.slice(0, 10);
}

export function computeStats(tasks: Task[], completions: Completion[], today: string): Stats {
  const completionDays = new Set(completions.map((c) => dateOnly(c.completed_at)));

  const completedToday = completions.filter((c) => dateOnly(c.completed_at) === today).length;

  const weekStart = addDaysStr(today, -6);
  const completedWeek = completions.filter((c) => {
    const d = dateOnly(c.completed_at);
    return d >= weekStart && d <= today;
  }).length;

  let currentStreak = 0;
  let cursor = completionDays.has(today) ? today : addDaysStr(today, -1);
  while (completionDays.has(cursor)) {
    currentStreak++;
    cursor = addDaysStr(cursor, -1);
  }

  let bestStreak = 0;
  if (completionDays.size > 0) {
    const sorted = Array.from(completionDays).sort();
    let run = 1;
    bestStreak = 1;
    for (let i = 1; i < sorted.length; i++) {
      run = addDaysStr(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    }
  }

  const overdueCount = tasks.filter((t) => isOverdue(t, today)).length;

  const perDay: DayCount[] = [];
  for (let i = 27; i >= 0; i--) {
    const date = addDaysStr(today, -i);
    perDay.push({ date, count: completions.filter((c) => dateOnly(c.completed_at) === date).length });
  }

  const byProject: Record<number, number> = {};
  const byPriority: Record<number, number> = {};
  for (const c of completions) {
    byProject[c.project_id] = (byProject[c.project_id] ?? 0) + 1;
    byPriority[c.priority] = (byPriority[c.priority] ?? 0) + 1;
  }

  return {
    completedToday,
    completedWeek,
    currentStreak,
    bestStreak,
    overdueCount,
    perDay,
    byProject,
    byPriority: byPriority as Record<Priority, number>,
  };
}
