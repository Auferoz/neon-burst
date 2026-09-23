/**
 * Shared reactive state + API calls for the Todo app. TodoApp.vue creates one
 * instance and provides it (see TODO_STORE_KEY) to every descendant, instead
 * of prop-drilling through Sidebar/TaskList/TaskDetail/Dashboard.
 *
 * Mutations are optimistic: the local state updates immediately, the request
 * fires, and on failure the previous snapshot is restored plus an error
 * toast. Complete/delete additionally offer a 5s "Deshacer" undo toast.
 */
import { ref, computed, type InjectionKey } from 'vue';
import type { Task, Project, Section, Label, Completion, Priority } from '../../../utils/todo/types';
import { localToday } from './clientDate';

export interface TaskCreatePayload {
  project_id: number;
  title: string;
  section_id?: number | null;
  parent_id?: number | null;
  description?: string | null;
  priority?: Priority;
  due_date?: string | null;
  due_time?: string | null;
  recurrence?: string | null;
  labels?: string[];
}

export type TaskPatchPayload = Partial<Omit<TaskCreatePayload, 'project_id'>> & { project_id?: number };

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Error ${res.status}`);
  }
  return data as T;
}

export function createTodoStore() {
  const projects = ref<Project[]>([]);
  const sections = ref<Section[]>([]);
  const labels = ref<Label[]>([]);
  const tasks = ref<Task[]>([]);
  const completions = ref<Completion[]>([]);

  const loading = ref(true);
  const loadError = ref('');
  const errorToast = ref('');
  let errorTimer: number | undefined;

  const undoToast = ref<{ message: string; run: () => void } | null>(null);
  let undoTimer: number | undefined;

  const inbox = computed(() => projects.value.find((p) => p.is_inbox === 1) ?? null);
  const projectNames = computed(() => projects.value.map((p) => p.name));

  function showError(message: string) {
    errorToast.value = message;
    window.clearTimeout(errorTimer);
    errorTimer = window.setTimeout(() => { errorToast.value = ''; }, 4500);
  }

  function dismissError() {
    errorToast.value = '';
    window.clearTimeout(errorTimer);
  }

  function showUndo(message: string, run: () => void) {
    window.clearTimeout(undoTimer);
    undoToast.value = { message, run };
    undoTimer = window.setTimeout(() => { undoToast.value = null; }, 5000);
  }

  function runUndo() {
    const toast = undoToast.value;
    if (!toast) return;
    window.clearTimeout(undoTimer);
    undoToast.value = null;
    toast.run();
  }

  function dismissUndo() {
    window.clearTimeout(undoTimer);
    undoToast.value = null;
  }

  async function loadBootstrap() {
    loading.value = true;
    loadError.value = '';
    try {
      const data = await apiFetch<{
        projects: Project[]; sections: Section[]; labels: Label[]; tasks: Task[]; completions: Completion[];
      }>('/api/todo/bootstrap');
      projects.value = data.projects;
      sections.value = data.sections;
      labels.value = data.labels;
      tasks.value = data.tasks;
      completions.value = data.completions;
    } catch (e) {
      loadError.value = (e as Error).message || 'No se pudo cargar Todo';
    } finally {
      loading.value = false;
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────

  async function createTask(payload: TaskCreatePayload): Promise<Task | null> {
    try {
      const task = await apiFetch<Task>('/api/todo/tasks', {
        method: 'POST',
        body: JSON.stringify({ priority: 4, ...payload }),
      });
      tasks.value = [...tasks.value, task];
      return task;
    } catch (e) {
      showError((e as Error).message || 'No se pudo crear la tarea');
      return null;
    }
  }

  async function patchTask(id: number, patch: TaskPatchPayload): Promise<boolean> {
    const idx = tasks.value.findIndex((t) => t.id === id);
    if (idx === -1) return false;
    const before = tasks.value[idx];
    const optimistic: Task = { ...before, ...patch } as Task;
    if (patch.labels !== undefined) {
      // label ids are resolved server-side; keep the previous ids until the response lands
    }
    tasks.value = tasks.value.map((t) => (t.id === id ? optimistic : t));
    try {
      const updated = await apiFetch<Task>(`/api/todo/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      tasks.value = tasks.value.map((t) => (t.id === id ? updated : t));
      return true;
    } catch (e) {
      tasks.value = tasks.value.map((t) => (t.id === id ? before : t));
      showError((e as Error).message || 'No se pudo actualizar la tarea');
      return false;
    }
  }

  async function deleteTask(id: number) {
    const before = tasks.value;
    const removed = before.find((t) => t.id === id);
    if (!removed) return;
    tasks.value = before.filter((t) => t.id !== id);

    try {
      await apiFetch(`/api/todo/tasks/${id}`, { method: 'DELETE' });
      showUndo('Tarea eliminada', async () => {
        // No restore endpoint: undo re-creates the task from the snapshot.
        const recreated = await createTask({
          project_id: removed.project_id,
          section_id: removed.section_id,
          parent_id: removed.parent_id,
          title: removed.title,
          description: removed.description,
          priority: removed.priority,
          due_date: removed.due_date,
          due_time: removed.due_time,
          recurrence: removed.recurrence,
        });
        if (!recreated) showError('No se pudo deshacer el borrado');
      });
    } catch (e) {
      tasks.value = before;
      showError((e as Error).message || 'No se pudo eliminar la tarea');
    }
  }

  /** done:true completes (or advances, if recurring); done:false undoes it. */
  async function completeTask(task: Task, done: boolean, opts: { silent?: boolean } = {}) {
    const before = tasks.value;
    const optimistic: Task = done
      ? { ...task, completed_at: task.recurrence ? task.completed_at : new Date().toISOString() }
      : { ...task, completed_at: null };
    tasks.value = before.map((t) => (t.id === task.id ? optimistic : t));

    try {
      const result = await apiFetch<{ task: Task; recurring: boolean }>(`/api/todo/tasks/${task.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({ done, today: localToday() }),
      });
      tasks.value = tasks.value.map((t) => (t.id === task.id ? result.task : t));
      if (done && !opts.silent) {
        showUndo(result.recurring ? 'Tarea completada (recurrente)' : 'Tarea completada', () => {
          completeTask(result.task, false, { silent: true });
        });
      }
    } catch (e) {
      tasks.value = before;
      showError((e as Error).message || 'No se pudo completar la tarea');
    }
  }

  async function reorderTask(task: Task, projectId: number, sectionId: number | null, sortOrder: number) {
    const before = tasks.value;
    tasks.value = before.map((t) => (t.id === task.id ? { ...t, project_id: projectId, section_id: sectionId, sort_order: sortOrder } : t));
    try {
      await apiFetch('/api/todo/tasks/reorder', {
        method: 'POST',
        body: JSON.stringify({ id: task.id, project_id: projectId, section_id: sectionId, sort_order: sortOrder }),
      });
    } catch (e) {
      tasks.value = before;
      showError((e as Error).message || 'No se pudo reordenar');
    }
  }

  // ── Projects ───────────────────────────────────────────────────────────

  async function createProject(name: string, color: string): Promise<Project | null> {
    try {
      const project = await apiFetch<Project>('/api/todo/projects', { method: 'POST', body: JSON.stringify({ name, color }) });
      projects.value = [...projects.value, project];
      return project;
    } catch (e) {
      showError((e as Error).message || 'No se pudo crear el proyecto');
      return null;
    }
  }

  async function patchProject(id: number, patch: Partial<{ name: string; color: string; archived: 0 | 1; sort_order: number }>) {
    const before = projects.value;
    projects.value = before.map((p) => (p.id === id ? { ...p, ...patch } : p));
    try {
      const updated = await apiFetch<Project>(`/api/todo/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
      projects.value = projects.value.map((p) => (p.id === id ? updated : p));
    } catch (e) {
      projects.value = before;
      showError((e as Error).message || 'No se pudo actualizar el proyecto');
    }
  }

  async function deleteProject(id: number) {
    const beforeProjects = projects.value;
    const beforeTasks = tasks.value;
    const box = inbox.value;
    try {
      await apiFetch(`/api/todo/projects/${id}`, { method: 'DELETE' });
      projects.value = beforeProjects.filter((p) => p.id !== id);
      if (box) {
        tasks.value = beforeTasks.map((t) => (t.project_id === id ? { ...t, project_id: box.id, section_id: null } : t));
      }
    } catch (e) {
      showError((e as Error).message || 'No se pudo borrar el proyecto');
    }
  }

  // ── Sections ───────────────────────────────────────────────────────────

  async function createSection(projectId: number, name: string): Promise<Section | null> {
    try {
      const section = await apiFetch<Section>('/api/todo/sections', { method: 'POST', body: JSON.stringify({ project_id: projectId, name }) });
      sections.value = [...sections.value, section];
      return section;
    } catch (e) {
      showError((e as Error).message || 'No se pudo crear la sección');
      return null;
    }
  }

  async function deleteSection(id: number) {
    const before = sections.value;
    sections.value = before.filter((s) => s.id !== id);
    try {
      await apiFetch(`/api/todo/sections/${id}`, { method: 'DELETE' });
      tasks.value = tasks.value.map((t) => (t.section_id === id ? { ...t, section_id: null } : t));
    } catch (e) {
      sections.value = before;
      showError((e as Error).message || 'No se pudo borrar la sección');
    }
  }

  // ── Labels ─────────────────────────────────────────────────────────────

  async function createLabel(name: string, color = 'green'): Promise<Label | null> {
    try {
      const label = await apiFetch<Label>('/api/todo/labels', { method: 'POST', body: JSON.stringify({ name, color }) });
      labels.value = [...labels.value, label];
      return label;
    } catch (e) {
      showError((e as Error).message || 'No se pudo crear la etiqueta');
      return null;
    }
  }

  async function deleteLabel(id: number) {
    const beforeLabels = labels.value;
    const beforeTasks = tasks.value;
    labels.value = beforeLabels.filter((l) => l.id !== id);
    tasks.value = beforeTasks.map((t) => (t.label_ids.includes(id) ? { ...t, label_ids: t.label_ids.filter((l) => l !== id) } : t));
    try {
      await apiFetch(`/api/todo/labels/${id}`, { method: 'DELETE' });
    } catch (e) {
      labels.value = beforeLabels;
      tasks.value = beforeTasks;
      showError((e as Error).message || 'No se pudo borrar la etiqueta');
    }
  }

  return {
    projects, sections, labels, tasks, completions,
    loading, loadError, errorToast, undoToast,
    inbox, projectNames,
    loadBootstrap, showError, dismissError, showUndo, runUndo, dismissUndo,
    createTask, patchTask, deleteTask, completeTask, reorderTask,
    createProject, patchProject, deleteProject,
    createSection, deleteSection,
    createLabel, deleteLabel,
  };
}

export type TodoStore = ReturnType<typeof createTodoStore>;
export const TODO_STORE_KEY: InjectionKey<TodoStore> = Symbol('todo-store');
