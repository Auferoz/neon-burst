import { addDaysStr } from './dateUtil';
import type { SortMode, Task, TaskFilters } from './types';

export function isOverdue(task: Task, today: string): boolean {
  return task.completed_at == null && task.due_date != null && task.due_date < today;
}

export function groupForToday(tasks: Task[], today: string): { overdue: Task[]; today: Task[] } {
  return {
    overdue: tasks.filter((t) => isOverdue(t, today)),
    today: tasks.filter((t) => t.completed_at == null && t.due_date === today),
  };
}

export interface UpcomingGroup {
  date: string;
  tasks: Task[];
}

export function upcoming(tasks: Task[], today: string, days: number): UpcomingGroup[] {
  const groups: UpcomingGroup[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDaysStr(today, i);
    groups.push({
      date,
      tasks: tasks.filter((t) => t.completed_at == null && t.due_date === date),
    });
  }
  return groups;
}

export function applyFilters(tasks: Task[], filters: TaskFilters, today: string): Task[] {
  return tasks.filter((t) => {
    if (filters.priority && !filters.priority.includes(t.priority)) return false;
    if (filters.labels && !filters.labels.some((l) => t.label_ids.includes(l))) return false;
    if (filters.project != null && t.project_id !== filters.project) return false;
    if (filters.status === 'open' && t.completed_at != null) return false;
    if (filters.status === 'completed' && t.completed_at == null) return false;

    if (filters.due) {
      if (filters.due === 'overdue' && !isOverdue(t, today)) return false;
      if (filters.due === 'today' && !(t.completed_at == null && t.due_date === today)) return false;
      if (filters.due === 'week') {
        const weekEnd = addDaysStr(today, 6);
        if (!(t.completed_at == null && t.due_date != null && t.due_date >= today && t.due_date <= weekEnd)) return false;
      }
      if (filters.due === 'none' && t.due_date != null) return false;
    }

    return true;
  });
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  const copy = [...tasks];
  switch (mode) {
    case 'manual':
      return copy.sort((a, b) => a.sort_order - b.sort_order);
    case 'due':
      return copy.sort((a, b) => {
        if (a.due_date == null && b.due_date == null) return 0;
        if (a.due_date == null) return 1;
        if (b.due_date == null) return -1;
        return a.due_date.localeCompare(b.due_date);
      });
    case 'priority':
      return copy.sort((a, b) => a.priority - b.priority);
    case 'created':
      return copy.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title':
      return copy.sort((a, b) => normalize(a.title).localeCompare(normalize(b.title)));
    default:
      return copy;
  }
}

export function searchTasks(tasks: Task[], q: string): Task[] {
  const needle = normalize(q.trim());
  if (!needle) return [...tasks];
  return tasks.filter((t) => {
    const haystack = normalize(`${t.title} ${t.description ?? ''}`);
    return haystack.includes(needle);
  });
}

/**
 * Like searchTasks, but a match on a subtask's title/description surfaces
 * its top-level parent card instead of the subtask itself — subtasks never
 * render as their own row in list views.
 */
export function searchTasksWithSubtasks(topLevel: Task[], allTasks: Task[], q: string): Task[] {
  const needle = normalize(q.trim());
  if (!needle) return [...topLevel];

  const matchesDirectly = new Set(searchTasks(topLevel, q).map((t) => t.id));
  const parentsWithMatchingSubtask = new Set(
    allTasks
      .filter((t) => t.parent_id != null && normalize(`${t.title} ${t.description ?? ''}`).includes(needle))
      .map((t) => t.parent_id as number),
  );

  return topLevel.filter((t) => matchesDirectly.has(t.id) || parentsWithMatchingSubtask.has(t.id));
}
