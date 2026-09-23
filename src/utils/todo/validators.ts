/**
 * Pure request-body validators for the todo API. Each returns
 * `{ ok: true, value }` or `{ ok: false, error }` (a Spanish message safe to
 * send straight back in the response body).
 */

import { isValidDateString } from './dateUtil';
import type { Priority } from './types';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidTimeString(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

function isPriority(v: unknown): v is Priority {
  return typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 4;
}

export interface TaskCreateInput {
  project_id: number;
  section_id?: number | null;
  parent_id?: number | null;
  title: string;
  description?: string | null;
  priority: Priority;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
  labels?: string[];
}

export function validateTaskCreate(body: unknown): ValidationResult<TaskCreateInput> {
  if (!isPlainObject(body)) return { ok: false, error: 'Cuerpo inválido' };

  if (!Number.isInteger(body.project_id)) {
    return { ok: false, error: 'project_id es obligatorio' };
  }

  if (typeof body.title !== 'string' || body.title.trim() === '') {
    return { ok: false, error: 'El título es obligatorio' };
  }

  const value: TaskCreateInput = {
    project_id: body.project_id as number,
    title: body.title.trim(),
    priority: 4,
  };

  if (body.section_id !== undefined) {
    if (body.section_id !== null && !Number.isInteger(body.section_id)) {
      return { ok: false, error: 'section_id inválido' };
    }
    value.section_id = body.section_id as number | null;
  }

  if (body.parent_id !== undefined) {
    if (body.parent_id !== null && !Number.isInteger(body.parent_id)) {
      return { ok: false, error: 'parent_id inválido' };
    }
    value.parent_id = body.parent_id as number | null;
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { ok: false, error: 'description inválida' };
    }
    value.description = body.description as string | null;
  }

  if (body.priority !== undefined) {
    if (!isPriority(body.priority)) return { ok: false, error: 'priority debe ser 1-4' };
    value.priority = body.priority;
  }

  if (body.due_date !== undefined) {
    if (body.due_date !== null && (typeof body.due_date !== 'string' || !isValidDateString(body.due_date))) {
      return { ok: false, error: 'due_date inválida' };
    }
    value.due_date = body.due_date as string | null;
  }

  if (body.due_time !== undefined) {
    if (body.due_time !== null && (typeof body.due_time !== 'string' || !isValidTimeString(body.due_time))) {
      return { ok: false, error: 'due_time inválida' };
    }
    value.due_time = body.due_time as string | null;
  }

  if (body.recurrence !== undefined) {
    if (body.recurrence !== null && typeof body.recurrence !== 'string') {
      return { ok: false, error: 'recurrence inválida' };
    }
    value.recurrence = body.recurrence as string | null;
  }

  if (body.labels !== undefined) {
    if (!Array.isArray(body.labels) || body.labels.some((l) => typeof l !== 'string')) {
      return { ok: false, error: 'labels debe ser un array de strings' };
    }
    value.labels = (body.labels as string[]).map((l) => l.trim()).filter(Boolean);
  }

  return { ok: true, value };
}

export type TaskPatchInput = Partial<Omit<TaskCreateInput, 'project_id' | 'title'>> & {
  project_id?: number;
  title?: string;
};

export function validateTaskPatch(body: unknown): ValidationResult<TaskPatchInput> {
  if (!isPlainObject(body)) return { ok: false, error: 'Cuerpo inválido' };

  const value: TaskPatchInput = {};

  if (body.project_id !== undefined) {
    if (!Number.isInteger(body.project_id)) return { ok: false, error: 'project_id inválido' };
    value.project_id = body.project_id as number;
  }

  if (body.section_id !== undefined) {
    if (body.section_id !== null && !Number.isInteger(body.section_id)) {
      return { ok: false, error: 'section_id inválido' };
    }
    value.section_id = body.section_id as number | null;
  }

  if (body.parent_id !== undefined) {
    if (body.parent_id !== null && !Number.isInteger(body.parent_id)) {
      return { ok: false, error: 'parent_id inválido' };
    }
    value.parent_id = body.parent_id as number | null;
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return { ok: false, error: 'El título no puede quedar vacío' };
    }
    value.title = body.title.trim();
  }

  if (body.description !== undefined) {
    if (body.description !== null && typeof body.description !== 'string') {
      return { ok: false, error: 'description inválida' };
    }
    value.description = body.description as string | null;
  }

  if (body.priority !== undefined) {
    if (!isPriority(body.priority)) return { ok: false, error: 'priority debe ser 1-4' };
    value.priority = body.priority;
  }

  if (body.due_date !== undefined) {
    if (body.due_date !== null && (typeof body.due_date !== 'string' || !isValidDateString(body.due_date))) {
      return { ok: false, error: 'due_date inválida' };
    }
    value.due_date = body.due_date as string | null;
  }

  if (body.due_time !== undefined) {
    if (body.due_time !== null && (typeof body.due_time !== 'string' || !isValidTimeString(body.due_time))) {
      return { ok: false, error: 'due_time inválida' };
    }
    value.due_time = body.due_time as string | null;
  }

  if (body.recurrence !== undefined) {
    if (body.recurrence !== null && typeof body.recurrence !== 'string') {
      return { ok: false, error: 'recurrence inválida' };
    }
    value.recurrence = body.recurrence as string | null;
  }

  if (body.labels !== undefined) {
    if (!Array.isArray(body.labels) || body.labels.some((l) => typeof l !== 'string')) {
      return { ok: false, error: 'labels debe ser un array de strings' };
    }
    value.labels = (body.labels as string[]).map((l) => l.trim()).filter(Boolean);
  }

  return { ok: true, value };
}

export interface CompleteInput {
  done: boolean;
  today?: string;
}

export function validateCompleteBody(body: unknown): ValidationResult<CompleteInput> {
  if (!isPlainObject(body)) return { ok: false, error: 'Cuerpo inválido' };
  if (typeof body.done !== 'boolean') return { ok: false, error: 'done es obligatorio y debe ser booleano' };

  if (body.today !== undefined) {
    if (typeof body.today !== 'string' || !isValidDateString(body.today)) {
      return { ok: false, error: 'today inválida' };
    }
  }

  if (body.done === true && body.today === undefined) {
    return { ok: false, error: 'today es obligatorio para completar una tarea' };
  }

  return { ok: true, value: { done: body.done, today: body.today as string | undefined } };
}

export interface ReorderInput {
  id: number;
  project_id: number;
  section_id: number | null;
  sort_order: number;
}

export function validateReorderBody(body: unknown): ValidationResult<ReorderInput> {
  if (!isPlainObject(body)) return { ok: false, error: 'Cuerpo inválido' };
  if (!Number.isInteger(body.id)) return { ok: false, error: 'id es obligatorio' };
  if (!Number.isInteger(body.project_id)) return { ok: false, error: 'project_id es obligatorio' };
  if (body.section_id !== undefined && body.section_id !== null && !Number.isInteger(body.section_id)) {
    return { ok: false, error: 'section_id inválido' };
  }
  if (typeof body.sort_order !== 'number' || Number.isNaN(body.sort_order)) {
    return { ok: false, error: 'sort_order es obligatorio' };
  }

  return {
    ok: true,
    value: {
      id: body.id as number,
      project_id: body.project_id as number,
      section_id: (body.section_id as number | null | undefined) ?? null,
      sort_order: body.sort_order as number,
    },
  };
}
