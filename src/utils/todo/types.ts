/**
 * Shared todo domain types. No cloudflare/astro imports on purpose: pure
 * modules under src/utils/todo import only from here and from each other.
 */

export type Priority = 1 | 2 | 3 | 4;

export interface Task {
  id: number;
  project_id: number;
  section_id: number | null;
  parent_id: number | null;
  title: string;
  description: string | null;
  priority: Priority;
  sort_order: number;
  due_date: string | null;
  due_time: string | null;
  recurrence: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  /** Label ids attached to the task. Populated by the service layer joins. */
  label_ids: number[];
}

export interface Project {
  id: number;
  name: string;
  color: string;
  is_inbox: 0 | 1;
  sort_order: number;
  archived: 0 | 1;
  created_at: string;
}

export interface Section {
  id: number;
  project_id: number;
  name: string;
  sort_order: number;
}

export interface Label {
  id: number;
  name: string;
  color: string;
}

export interface Completion {
  task_id: number;
  completed_at: string;
  project_id: number;
  priority: Priority;
}

export interface TaskFilters {
  priority?: Priority[];
  labels?: number[];
  project?: number;
  status?: 'open' | 'completed';
  due?: 'overdue' | 'today' | 'week' | 'none';
}

export type SortMode = 'manual' | 'due' | 'priority' | 'created' | 'title';
