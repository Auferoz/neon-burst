import { describe, it, expect } from 'vitest';
import { splitPastedLines, subtaskProgress } from '../../src/utils/todo/subtasks';
import type { Task } from '../../src/utils/todo/types';

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

describe('splitPastedLines', () => {
  it('splits multi-line pasted text into one title per non-empty line', () => {
    expect(splitPastedLines('uno\ndos\ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('trims each line', () => {
    expect(splitPastedLines('  uno  \n  dos  ')).toEqual(['uno', 'dos']);
  });

  it('drops empty lines', () => {
    expect(splitPastedLines('uno\n\n\ndos\n')).toEqual(['uno', 'dos']);
  });

  it('handles CRLF line endings', () => {
    expect(splitPastedLines('uno\r\ndos\r\ntres')).toEqual(['uno', 'dos', 'tres']);
  });

  it('returns a single title for text with no newlines', () => {
    expect(splitPastedLines('solo uno')).toEqual(['solo uno']);
  });

  it('returns an empty array for blank input', () => {
    expect(splitPastedLines('   \n  \n')).toEqual([]);
  });
});

describe('subtaskProgress', () => {
  it('counts done vs total', () => {
    const subs = [
      task({ id: 1, completed_at: '2026-09-01T00:00:00.000Z' }),
      task({ id: 2, completed_at: null }),
      task({ id: 3, completed_at: '2026-09-02T00:00:00.000Z' }),
    ];
    expect(subtaskProgress(subs)).toEqual({ done: 2, total: 3 });
  });

  it('is {done:0,total:0} for no subtasks', () => {
    expect(subtaskProgress([])).toEqual({ done: 0, total: 0 });
  });

  it('done equals total when everything is complete', () => {
    const subs = [task({ id: 1, completed_at: '2026-09-01T00:00:00.000Z' })];
    expect(subtaskProgress(subs)).toEqual({ done: 1, total: 1 });
  });
});
