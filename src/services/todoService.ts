/**
 * Todo service — D1 CRUD for projects, sections, tasks, labels and
 * completions. Follows seriesService.ts: allowlisted updates, `db.batch` for
 * multi-statement writes.
 */

import { nextOccurrence } from '../utils/todo/recurrence';
import type { Completion, Label, Project, Section, Task } from '../utils/todo/types';
import type { CompleteInput, ReorderInput, TaskCreateInput, TaskPatchInput } from '../utils/todo/validators';

export class TodoServiceError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ── Rows → domain types ─────────────────────────────────────────────────────

interface TaskRow {
  id: number;
  project_id: number;
  section_id: number | null;
  parent_id: number | null;
  title: string;
  description: string | null;
  priority: number;
  sort_order: number;
  due_date: string | null;
  due_time: string | null;
  recurrence: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow, labelIds: number[]): Task {
  return { ...row, priority: row.priority as Task['priority'], label_ids: labelIds };
}

async function getTaskLabelIds(db: D1Database, taskIds: number[]): Promise<Map<number, number[]>> {
  const map = new Map<number, number[]>();
  if (taskIds.length === 0) return map;
  const placeholders = taskIds.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT task_id, label_id FROM todo_task_labels WHERE task_id IN (${placeholders})`)
    .bind(...taskIds)
    .all<{ task_id: number; label_id: number }>();
  for (const r of results) {
    const arr = map.get(r.task_id) ?? [];
    arr.push(r.label_id);
    map.set(r.task_id, arr);
  }
  return map;
}

// ── Projects ─────────────────────────────────────────────────────────────

export async function getAllProjects(db: D1Database): Promise<Project[]> {
  const { results } = await db
    .prepare('SELECT * FROM todo_projects ORDER BY archived ASC, sort_order ASC, id ASC')
    .all<Project>();
  return results;
}

export async function getInboxProject(db: D1Database): Promise<Project> {
  const inbox = await db.prepare('SELECT * FROM todo_projects WHERE is_inbox = 1 LIMIT 1').first<Project>();
  if (!inbox) throw new TodoServiceError('No existe la Bandeja de entrada, corré la migración', 500);
  return inbox;
}

export async function createProject(
  db: D1Database,
  data: { name: string; color: string },
): Promise<Project> {
  const result = await db
    .prepare('INSERT INTO todo_projects (name, color, is_inbox, sort_order, archived) VALUES (?, ?, 0, 0, 0)')
    .bind(data.name, data.color)
    .run();
  const id = result.meta.last_row_id as number;
  return (await db.prepare('SELECT * FROM todo_projects WHERE id = ?').bind(id).first<Project>())!;
}

const PROJECT_PATCH_COLUMNS = new Set(['name', 'color', 'sort_order', 'archived']);

export async function updateProject(
  db: D1Database,
  id: number,
  data: Partial<{ name: string; color: string; sort_order: number; archived: 0 | 1 }>,
): Promise<Project | null> {
  const existing = await db.prepare('SELECT * FROM todo_projects WHERE id = ?').bind(id).first<Project>();
  if (!existing) return null;
  if (existing.is_inbox && (data.name !== undefined || data.archived !== undefined)) {
    throw new TodoServiceError('La Bandeja de entrada no se puede renombrar ni archivar', 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && PROJECT_PATCH_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return existing;

  values.push(id);
  await db.prepare(`UPDATE todo_projects SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return db.prepare('SELECT * FROM todo_projects WHERE id = ?').bind(id).first<Project>();
}

/** Deletes a project and moves its tasks (and their sections become null) to the Inbox. Refuses the Inbox itself. */
export async function deleteProject(db: D1Database, id: number): Promise<boolean> {
  const existing = await db.prepare('SELECT * FROM todo_projects WHERE id = ?').bind(id).first<Project>();
  if (!existing) return false;
  if (existing.is_inbox) {
    throw new TodoServiceError('La Bandeja de entrada no se puede borrar', 400);
  }

  const inbox = await getInboxProject(db);

  await db.batch([
    db
      .prepare('UPDATE todo_tasks SET project_id = ?, section_id = NULL WHERE project_id = ?')
      .bind(inbox.id, id),
    db.prepare('DELETE FROM todo_sections WHERE project_id = ?').bind(id),
    db.prepare('DELETE FROM todo_projects WHERE id = ?').bind(id),
  ]);

  return true;
}

// ── Sections ─────────────────────────────────────────────────────────────

export async function getAllSections(db: D1Database): Promise<Section[]> {
  const { results } = await db.prepare('SELECT * FROM todo_sections ORDER BY project_id ASC, sort_order ASC').all<Section>();
  return results;
}

export async function createSection(db: D1Database, data: { project_id: number; name: string; sort_order?: number }): Promise<Section> {
  const result = await db
    .prepare('INSERT INTO todo_sections (project_id, name, sort_order) VALUES (?, ?, ?)')
    .bind(data.project_id, data.name, data.sort_order ?? 0)
    .run();
  const id = result.meta.last_row_id as number;
  return (await db.prepare('SELECT * FROM todo_sections WHERE id = ?').bind(id).first<Section>())!;
}

const SECTION_PATCH_COLUMNS = new Set(['name', 'sort_order', 'project_id']);

export async function updateSection(
  db: D1Database,
  id: number,
  data: Partial<{ name: string; sort_order: number; project_id: number }>,
): Promise<Section | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && SECTION_PATCH_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM todo_sections WHERE id = ?').bind(id).first<Section>();

  values.push(id);
  await db.prepare(`UPDATE todo_sections SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return db.prepare('SELECT * FROM todo_sections WHERE id = ?').bind(id).first<Section>();
}

export async function deleteSection(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM todo_sections WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

// ── Labels ───────────────────────────────────────────────────────────────

export async function getAllLabels(db: D1Database): Promise<Label[]> {
  const { results } = await db.prepare('SELECT * FROM todo_labels ORDER BY name COLLATE NOCASE ASC').all<Label>();
  return results;
}

/** Finds labels by name (case-insensitive), creating any that don't exist yet. Returns their ids. */
async function resolveLabelIds(db: D1Database, names: string[]): Promise<number[]> {
  const ids: number[] = [];
  for (const name of names) {
    const existing = await db.prepare('SELECT id FROM todo_labels WHERE name = ? COLLATE NOCASE').bind(name).first<{ id: number }>();
    if (existing) {
      ids.push(existing.id);
      continue;
    }
    const result = await db.prepare('INSERT INTO todo_labels (name, color) VALUES (?, ?)').bind(name, 'green').run();
    ids.push(result.meta.last_row_id as number);
  }
  return ids;
}

export async function createLabel(db: D1Database, data: { name: string; color: string }): Promise<Label> {
  const result = await db.prepare('INSERT INTO todo_labels (name, color) VALUES (?, ?)').bind(data.name, data.color).run();
  const id = result.meta.last_row_id as number;
  return (await db.prepare('SELECT * FROM todo_labels WHERE id = ?').bind(id).first<Label>())!;
}

const LABEL_PATCH_COLUMNS = new Set(['name', 'color']);

export async function updateLabel(db: D1Database, id: number, data: Partial<{ name: string; color: string }>): Promise<Label | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && LABEL_PATCH_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }
  if (fields.length === 0) return db.prepare('SELECT * FROM todo_labels WHERE id = ?').bind(id).first<Label>();

  values.push(id);
  await db.prepare(`UPDATE todo_labels SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return db.prepare('SELECT * FROM todo_labels WHERE id = ?').bind(id).first<Label>();
}

export async function deleteLabel(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM todo_labels WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

// ── Tasks ────────────────────────────────────────────────────────────────

export async function createTask(db: D1Database, data: TaskCreateInput): Promise<Task> {
  if (data.parent_id != null) {
    const parent = await db.prepare('SELECT parent_id FROM todo_tasks WHERE id = ?').bind(data.parent_id).first<{ parent_id: number | null }>();
    if (!parent) throw new TodoServiceError('La tarea padre no existe', 400);
    if (parent.parent_id != null) throw new TodoServiceError('Las subtareas admiten un solo nivel', 400);
  }

  const labelIds = data.labels ? await resolveLabelIds(db, data.labels) : [];

  const result = await db
    .prepare(
      `INSERT INTO todo_tasks (project_id, section_id, parent_id, title, description, priority, sort_order, due_date, due_time, recurrence)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      data.project_id,
      data.section_id ?? null,
      data.parent_id ?? null,
      data.title,
      data.description ?? null,
      data.priority,
      0,
      data.due_date ?? null,
      data.due_time ?? null,
      data.recurrence ?? null,
    )
    .run();

  const id = result.meta.last_row_id as number;

  if (labelIds.length > 0) {
    await db.batch(labelIds.map((labelId) => db.prepare('INSERT INTO todo_task_labels (task_id, label_id) VALUES (?, ?)').bind(id, labelId)));
  }

  const row = (await db.prepare('SELECT * FROM todo_tasks WHERE id = ?').bind(id).first<TaskRow>())!;
  return rowToTask(row, labelIds);
}

const TASK_PATCH_COLUMNS = new Set([
  'project_id',
  'section_id',
  'parent_id',
  'title',
  'description',
  'priority',
  'due_date',
  'due_time',
  'recurrence',
]);

export async function updateTask(db: D1Database, id: number, data: TaskPatchInput): Promise<Task | null> {
  const existing = await db.prepare('SELECT * FROM todo_tasks WHERE id = ?').bind(id).first<TaskRow>();
  if (!existing) return null;

  if (data.parent_id != null) {
    if (data.parent_id === id) throw new TodoServiceError('Una tarea no puede ser su propia subtarea', 400);
    const parent = await db.prepare('SELECT parent_id FROM todo_tasks WHERE id = ?').bind(data.parent_id).first<{ parent_id: number | null }>();
    if (!parent) throw new TodoServiceError('La tarea padre no existe', 400);
    if (parent.parent_id != null) throw new TodoServiceError('Las subtareas admiten un solo nivel', 400);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (key === 'labels') continue;
    if (value !== undefined && TASK_PATCH_COLUMNS.has(key)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  }

  const statements: D1PreparedStatement[] = [];
  if (fields.length > 0) {
    fields.push("updated_at = datetime('now')");
    values.push(id);
    statements.push(db.prepare(`UPDATE todo_tasks SET ${fields.join(', ')} WHERE id = ?`).bind(...values));
  }

  let labelIds: number[] | null = null;
  if (data.labels !== undefined) {
    labelIds = await resolveLabelIds(db, data.labels);
    statements.push(db.prepare('DELETE FROM todo_task_labels WHERE task_id = ?').bind(id));
    for (const labelId of labelIds) {
      statements.push(db.prepare('INSERT INTO todo_task_labels (task_id, label_id) VALUES (?, ?)').bind(id, labelId));
    }
  }

  if (statements.length > 0) await db.batch(statements);

  const row = (await db.prepare('SELECT * FROM todo_tasks WHERE id = ?').bind(id).first<TaskRow>())!;
  const finalLabelIds = labelIds ?? (await getTaskLabelIds(db, [id])).get(id) ?? [];
  return rowToTask(row, finalLabelIds);
}

export async function deleteTask(db: D1Database, id: number): Promise<boolean> {
  const result = await db.prepare('DELETE FROM todo_tasks WHERE id = ?').bind(id).run();
  return result.meta.changes > 0;
}

export async function reorderTask(db: D1Database, data: ReorderInput): Promise<boolean> {
  const result = await db
    .prepare('UPDATE todo_tasks SET project_id = ?, section_id = ?, sort_order = ? WHERE id = ?')
    .bind(data.project_id, data.section_id, data.sort_order, data.id)
    .run();
  return result.meta.changes > 0;
}

export interface CompleteResult {
  task: Task;
  recurring: boolean;
}

/**
 * Recurring task + done:true: does NOT mark the task done. Logs the
 * completion and moves due_date to nextOccurrence(recurrence, due_date ||
 * today). done:false on a recurring task deletes its latest completion row
 * (the due_date it advanced from is not restored — recurrence is one-way).
 *
 * Normal task: done:true sets completed_at + logs a completion. done:false
 * clears completed_at and deletes that task's latest completion row.
 */
export async function completeTask(db: D1Database, id: number, input: CompleteInput): Promise<CompleteResult | null> {
  const existing = await db.prepare('SELECT * FROM todo_tasks WHERE id = ?').bind(id).first<TaskRow>();
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  const recurring = existing.recurrence != null;

  if (recurring) {
    if (input.done) {
      const from = existing.due_date || input.today!;
      const newDueDate = nextOccurrence(existing.recurrence!, from);
      await db.batch([
        db.prepare('INSERT INTO todo_completions (task_id, completed_at) VALUES (?, ?)').bind(id, nowIso),
        db.prepare("UPDATE todo_tasks SET due_date = ?, updated_at = datetime('now') WHERE id = ?").bind(newDueDate, id),
      ]);
    } else {
      const last = await db
        .prepare('SELECT id FROM todo_completions WHERE task_id = ? ORDER BY completed_at DESC, id DESC LIMIT 1')
        .bind(id)
        .first<{ id: number }>();
      if (last) await db.prepare('DELETE FROM todo_completions WHERE id = ?').bind(last.id).run();
    }
  } else if (input.done) {
    await db.batch([
      db.prepare("UPDATE todo_tasks SET completed_at = ?, updated_at = datetime('now') WHERE id = ?").bind(nowIso, id),
      db.prepare('INSERT INTO todo_completions (task_id, completed_at) VALUES (?, ?)').bind(id, nowIso),
    ]);
  } else {
    const last = await db
      .prepare('SELECT id FROM todo_completions WHERE task_id = ? ORDER BY completed_at DESC, id DESC LIMIT 1')
      .bind(id)
      .first<{ id: number }>();
    const statements = [db.prepare("UPDATE todo_tasks SET completed_at = NULL, updated_at = datetime('now') WHERE id = ?").bind(id)];
    if (last) statements.push(db.prepare('DELETE FROM todo_completions WHERE id = ?').bind(last.id));
    await db.batch(statements);
  }

  const row = (await db.prepare('SELECT * FROM todo_tasks WHERE id = ?').bind(id).first<TaskRow>())!;
  const labelIds = (await getTaskLabelIds(db, [id])).get(id) ?? [];
  return { task: rowToTask(row, labelIds), recurring };
}

// ── Bootstrap & completed history ───────────────────────────────────────

export interface BootstrapData {
  projects: Project[];
  sections: Section[];
  labels: Label[];
  tasks: Task[];
  completions: Completion[];
}

/** Open tasks + tasks completed in the last 30 days, plus completions of the last 90 days for stats. */
export async function getBootstrapData(db: D1Database): Promise<BootstrapData> {
  const [projects, sections, labels] = await Promise.all([getAllProjects(db), getAllSections(db), getAllLabels(db)]);

  const { results: taskRows } = await db
    .prepare(
      `SELECT * FROM todo_tasks
       WHERE completed_at IS NULL OR completed_at >= datetime('now', '-30 days')
       ORDER BY sort_order ASC, id ASC`,
    )
    .all<TaskRow>();

  const labelMap = await getTaskLabelIds(db, taskRows.map((t) => t.id));
  const tasks = taskRows.map((row) => rowToTask(row, labelMap.get(row.id) ?? []));

  const { results: completions } = await db
    .prepare(
      `SELECT c.task_id, c.completed_at, t.project_id, t.priority
       FROM todo_completions c
       JOIN todo_tasks t ON t.id = c.task_id
       WHERE c.completed_at >= datetime('now', '-90 days')
       ORDER BY c.completed_at ASC`,
    )
    .all<Completion>();

  return { projects, sections, labels, tasks, completions };
}

export interface CompletedPage {
  tasks: Array<Task & { completed_at: string }>;
  nextBefore: string | null;
}

export async function getCompletedHistory(db: D1Database, before: string | undefined, limit: number): Promise<CompletedPage> {
  const query = before
    ? db
        .prepare('SELECT * FROM todo_tasks WHERE completed_at IS NOT NULL AND completed_at < ? ORDER BY completed_at DESC LIMIT ?')
        .bind(before, limit)
    : db.prepare('SELECT * FROM todo_tasks WHERE completed_at IS NOT NULL ORDER BY completed_at DESC LIMIT ?').bind(limit);

  const { results } = await query.all<TaskRow>();
  const labelMap = await getTaskLabelIds(db, results.map((t) => t.id));
  const tasks = results.map((row) => ({ ...rowToTask(row, labelMap.get(row.id) ?? []), completed_at: row.completed_at! }));

  return {
    tasks,
    nextBefore: results.length === limit ? results[results.length - 1].completed_at : null,
  };
}
