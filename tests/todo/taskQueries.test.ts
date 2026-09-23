import { describe, it, expect } from 'vitest';
import {
  isOverdue,
  groupForToday,
  upcoming,
  applyFilters,
  sortTasks,
  searchTasks,
} from '../../src/utils/todo/taskQueries';
import type { Task } from '../../src/utils/todo/types';

const TODAY = '2026-09-23';

function task(overrides: Partial<Task>): Task {
  return {
    id: 1,
    project_id: 1,
    section_id: null,
    parent_id: null,
    title: 'tarea',
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

describe('isOverdue', () => {
  it('is true for a due_date before today, uncompleted', () => {
    expect(isOverdue(task({ due_date: '2026-09-20' }), TODAY)).toBe(true);
  });

  it('is false for a due_date of today', () => {
    expect(isOverdue(task({ due_date: TODAY }), TODAY)).toBe(false);
  });

  it('is false with no due_date', () => {
    expect(isOverdue(task({ due_date: null }), TODAY)).toBe(false);
  });

  it('is false once completed, even if the date is in the past', () => {
    expect(isOverdue(task({ due_date: '2026-09-20', completed_at: '2026-09-21T00:00:00.000Z' }), TODAY)).toBe(false);
  });
});

describe('groupForToday', () => {
  it('splits into overdue and today buckets', () => {
    const tasks = [
      task({ id: 1, due_date: '2026-09-20' }),
      task({ id: 2, due_date: TODAY }),
      task({ id: 3, due_date: '2026-09-25' }),
      task({ id: 4, due_date: null }),
    ];
    const { overdue, today } = groupForToday(tasks, TODAY);
    expect(overdue.map((t) => t.id)).toEqual([1]);
    expect(today.map((t) => t.id)).toEqual([2]);
  });

  it('excludes completed tasks from both buckets', () => {
    const tasks = [task({ id: 1, due_date: '2026-09-20', completed_at: '2026-09-20T00:00:00.000Z' })];
    const { overdue, today } = groupForToday(tasks, TODAY);
    expect(overdue).toEqual([]);
    expect(today).toEqual([]);
  });
});

describe('upcoming', () => {
  it('groups tasks by day for the next N days, starting today', () => {
    const tasks = [
      task({ id: 1, due_date: '2026-09-23' }),
      task({ id: 2, due_date: '2026-09-24' }),
      task({ id: 3, due_date: '2026-09-30' }), // out of range for 7 days
      task({ id: 4, due_date: null }),
    ];
    const groups = upcoming(tasks, TODAY, 7);
    expect(groups).toHaveLength(7);
    expect(groups[0].date).toBe('2026-09-23');
    expect(groups[0].tasks.map((t) => t.id)).toEqual([1]);
    expect(groups[1].tasks.map((t) => t.id)).toEqual([2]);
    expect(groups[6].date).toBe('2026-09-29');
    expect(groups.flatMap((g) => g.tasks.map((t) => t.id))).not.toContain(3);
  });

  it('excludes completed tasks', () => {
    const tasks = [task({ id: 1, due_date: '2026-09-23', completed_at: '2026-09-23T00:00:00.000Z' })];
    const groups = upcoming(tasks, TODAY, 7);
    expect(groups[0].tasks).toEqual([]);
  });
});

describe('applyFilters', () => {
  const tasks = [
    task({ id: 1, priority: 1, label_ids: [1], project_id: 10, due_date: '2026-09-20' }), // overdue
    task({ id: 2, priority: 2, label_ids: [2], project_id: 20, due_date: TODAY }), // today
    task({ id: 3, priority: 3, label_ids: [1, 2], project_id: 10, completed_at: '2026-09-01T00:00:00.000Z' }),
    task({ id: 4, priority: 4, label_ids: [], project_id: 30, due_date: '2026-09-29' }), // within week
  ];

  it('filters by priority', () => {
    expect(applyFilters(tasks, { priority: [1, 2] }, TODAY).map((t) => t.id)).toEqual([1, 2]);
  });

  it('filters by label', () => {
    expect(applyFilters(tasks, { labels: [2] }, TODAY).map((t) => t.id)).toEqual([2, 3]);
  });

  it('filters by project', () => {
    expect(applyFilters(tasks, { project: 10 }, TODAY).map((t) => t.id)).toEqual([1, 3]);
  });

  it('filters by status open/completed', () => {
    expect(applyFilters(tasks, { status: 'completed' }, TODAY).map((t) => t.id)).toEqual([3]);
    expect(applyFilters(tasks, { status: 'open' }, TODAY).map((t) => t.id)).toEqual([1, 2, 4]);
  });

  it('filters by due=overdue', () => {
    expect(applyFilters(tasks, { due: 'overdue' }, TODAY).map((t) => t.id)).toEqual([1]);
  });

  it('filters by due=today', () => {
    expect(applyFilters(tasks, { due: 'today' }, TODAY).map((t) => t.id)).toEqual([2]);
  });

  it('filters by due=week', () => {
    expect(applyFilters(tasks, { due: 'week' }, TODAY).map((t) => t.id)).toEqual([2, 4]);
  });

  it('filters by due=none', () => {
    const noDate = [...tasks, task({ id: 5, due_date: null })];
    expect(applyFilters(noDate, { due: 'none' }, TODAY).map((t) => t.id)).toEqual([3, 5]);
  });

  it('combines multiple filters', () => {
    expect(applyFilters(tasks, { priority: [1, 2], project: 10 }, TODAY).map((t) => t.id)).toEqual([1]);
  });

  it('returns all tasks for an empty filter set', () => {
    expect(applyFilters(tasks, {}, TODAY)).toHaveLength(4);
  });
});

describe('sortTasks', () => {
  const tasks = [
    task({ id: 1, sort_order: 30, priority: 3, due_date: '2026-09-25', created_at: '2026-09-03T00:00:00.000Z', title: 'banana' }),
    task({ id: 2, sort_order: 10, priority: 1, due_date: '2026-09-20', created_at: '2026-09-01T00:00:00.000Z', title: 'Árbol' }),
    task({ id: 3, sort_order: 20, priority: 2, due_date: null, created_at: '2026-09-02T00:00:00.000Z', title: 'cereza' }),
  ];

  it('sorts manually by sort_order', () => {
    expect(sortTasks(tasks, 'manual').map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it('sorts by due date, nulls last', () => {
    expect(sortTasks(tasks, 'due').map((t) => t.id)).toEqual([2, 1, 3]);
  });

  it('sorts by priority ascending (1 = highest first)', () => {
    expect(sortTasks(tasks, 'priority').map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it('sorts by created_at ascending', () => {
    expect(sortTasks(tasks, 'created').map((t) => t.id)).toEqual([2, 3, 1]);
  });

  it('sorts by title, accent-insensitive', () => {
    expect(sortTasks(tasks, 'title').map((t) => t.id)).toEqual([2, 1, 3]);
  });

  it('does not mutate the input array', () => {
    const copy = [...tasks];
    sortTasks(tasks, 'due');
    expect(tasks).toEqual(copy);
  });
});

describe('searchTasks', () => {
  const tasks = [
    task({ id: 1, title: 'Pagar la luz', description: null }),
    task({ id: 2, title: 'Comprar pan', description: 'con la tarjeta' }),
    task({ id: 3, title: 'Sacar el perro', description: null }),
  ];

  it('matches by title, case-insensitive', () => {
    expect(searchTasks(tasks, 'pagar').map((t) => t.id)).toEqual([1]);
  });

  it('matches by description', () => {
    expect(searchTasks(tasks, 'tarjeta').map((t) => t.id)).toEqual([2]);
  });

  it('is accent-insensitive', () => {
    const withAccent = [task({ id: 4, title: 'Ir al médico' })];
    expect(searchTasks(withAccent, 'medico').map((t) => t.id)).toEqual([4]);
  });

  it('returns all tasks for an empty query', () => {
    expect(searchTasks(tasks, '')).toHaveLength(3);
  });

  it('returns nothing when nothing matches', () => {
    expect(searchTasks(tasks, 'zzz')).toEqual([]);
  });
});
