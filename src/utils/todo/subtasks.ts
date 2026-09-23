/**
 * Pure helpers for the in-card subtask checklist (TodoTaskItem.vue) and the
 * subtask detail panel (TodoTaskDetail.vue).
 */
import type { Task } from './types';

/** One non-empty, trimmed title per non-empty line of pasted text. */
export function splitPastedLines(text: string): string[] {
  return text
    .split(/\r\n|\r|\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export interface SubtaskProgress {
  done: number;
  total: number;
}

export function subtaskProgress(subtasks: Task[]): SubtaskProgress {
  return {
    done: subtasks.filter((t) => t.completed_at != null).length,
    total: subtasks.length,
  };
}
