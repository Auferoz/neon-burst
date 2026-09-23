import { describe, it, expect } from 'vitest';
import { computeStats } from '../../src/utils/todo/stats';
import type { Completion, Task } from '../../src/utils/todo/types';

const TODAY = '2026-09-23';

function task(overrides: Partial<Task>): Task {
  return {
    id: 1,
    project_id: 1,
    section_id: null,
    parent_id: null,
    title: 't',
    description: null,
    priority: 4,
    sort_order: 0,
    due_date: null,
    due_time: null,
    recurrence: null,
    completed_at: null,
    created_at: '2026-09-01T00:00:00.000Z',
    updated_at: '2026-09-01T00:00:00.000Z',
    label_ids: [],
    ...overrides,
  };
}

function completion(overrides: Partial<Completion>): Completion {
  return { task_id: 1, completed_at: `${TODAY}T10:00:00.000Z`, project_id: 1, priority: 4, ...overrides };
}

describe('computeStats', () => {
  it('counts completions today and this week with no completions at all', () => {
    const s = computeStats([], [], TODAY);
    expect(s.completedToday).toBe(0);
    expect(s.completedWeek).toBe(0);
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
    expect(s.perDay).toHaveLength(28);
    expect(s.perDay.every((d) => d.count === 0)).toBe(true);
  });

  it('counts completedToday and completedWeek correctly', () => {
    const completions = [
      completion({ completed_at: `${TODAY}T09:00:00.000Z` }),
      completion({ completed_at: `${TODAY}T14:00:00.000Z` }),
      completion({ completed_at: '2026-09-18T10:00:00.000Z' }), // within last 7 days
      completion({ completed_at: '2026-09-10T10:00:00.000Z' }), // outside the week
    ];
    const s = computeStats([], completions, TODAY);
    expect(s.completedToday).toBe(2);
    expect(s.completedWeek).toBe(3);
  });

  it('computes a current streak across consecutive days ending today', () => {
    const completions = [
      completion({ completed_at: `${TODAY}T10:00:00.000Z` }),
      completion({ completed_at: '2026-09-22T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-21T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-19T10:00:00.000Z' }), // gap at 09-20
    ];
    const s = computeStats([], completions, TODAY);
    expect(s.currentStreak).toBe(3);
  });

  it('counts a current streak ending yesterday when today has no completions', () => {
    const completions = [
      completion({ completed_at: '2026-09-22T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-21T10:00:00.000Z' }),
    ];
    const s = computeStats([], completions, TODAY);
    expect(s.currentStreak).toBe(2);
  });

  it('current streak is 0 when the gap goes back further than yesterday', () => {
    const completions = [completion({ completed_at: '2026-09-20T10:00:00.000Z' })];
    const s = computeStats([], completions, TODAY);
    expect(s.currentStreak).toBe(0);
  });

  it('finds the best streak across gaps, even if it is not the current one', () => {
    const completions = [
      completion({ completed_at: '2026-09-01T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-02T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-03T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-04T10:00:00.000Z' }),
      completion({ completed_at: '2026-09-10T10:00:00.000Z' }), // isolated day, current streak
    ];
    const s = computeStats([], completions, '2026-09-10');
    expect(s.bestStreak).toBe(4);
    expect(s.currentStreak).toBe(1);
  });

  it('counts multiple completions on the same day once toward the streak', () => {
    const completions = [
      completion({ completed_at: `${TODAY}T09:00:00.000Z` }),
      completion({ completed_at: `${TODAY}T20:00:00.000Z` }),
    ];
    const s = computeStats([], completions, TODAY);
    expect(s.currentStreak).toBe(1);
  });

  it('counts recurring completions (which never set completed_at on the task) toward stats', () => {
    const recurringTask = task({ id: 5, recurrence: 'daily', due_date: '2026-09-24', completed_at: null });
    const completions = [completion({ task_id: 5, completed_at: `${TODAY}T10:00:00.000Z` })];
    const s = computeStats([recurringTask], completions, TODAY);
    expect(s.completedToday).toBe(1);
  });

  it('counts overdue open tasks', () => {
    const tasks = [
      task({ id: 1, due_date: '2026-09-20' }),
      task({ id: 2, due_date: TODAY }),
      task({ id: 3, due_date: '2026-09-20', completed_at: `${TODAY}T00:00:00.000Z` }),
    ];
    const s = computeStats(tasks, [], TODAY);
    expect(s.overdueCount).toBe(1);
  });

  it('builds a 28-day series ending today', () => {
    const completions = [completion({ completed_at: `${TODAY}T10:00:00.000Z` })];
    const s = computeStats([], completions, TODAY);
    expect(s.perDay[27].date).toBe(TODAY);
    expect(s.perDay[27].count).toBe(1);
    expect(s.perDay[0].date).toBe('2026-08-27');
  });

  it('breaks down completions by project and priority', () => {
    const completions = [
      completion({ project_id: 1, priority: 1 }),
      completion({ project_id: 1, priority: 2 }),
      completion({ project_id: 2, priority: 1 }),
    ];
    const s = computeStats([], completions, TODAY);
    expect(s.byProject).toEqual({ 1: 2, 2: 1 });
    expect(s.byPriority).toEqual({ 1: 2, 2: 1 });
  });
});
