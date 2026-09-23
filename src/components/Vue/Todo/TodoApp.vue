<script setup lang="ts">
/**
 * Container: bootstraps data, owns the shared store (provided to every
 * descendant), routes between views via `?view=`, and registers the global
 * keyboard shortcuts. See TodoShortcutsModal for the full list.
 */
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue';
import { createTodoStore, TODO_STORE_KEY } from './useTodoStore';
import TodoSidebar from './TodoSidebar.vue';
import TodoQuickAdd from './TodoQuickAdd.vue';
import TodoTaskList from './TodoTaskList.vue';
import TodoTaskDetail from './TodoTaskDetail.vue';
import TodoDashboard from './TodoDashboard.vue';
import TodoUpcoming from './TodoUpcoming.vue';
import TodoCompleted from './TodoCompleted.vue';
import TodoShortcutsModal from './TodoShortcutsModal.vue';
import TodoToasts from './TodoToasts.vue';
import type { Task, Priority } from '../../../utils/todo/types';

const store = createTodoStore();
provide(TODO_STORE_KEY, store);

// ── View routing (?view=) ────────────────────────────────────────────────
// client:load still renders this component once on the server for the
// initial HTML, where `window` doesn't exist — every access below is
// guarded so SSR falls back to the default view instead of throwing.
function viewFromUrl(): string {
  if (typeof window === 'undefined') return 'today';
  return new URLSearchParams(window.location.search).get('view') || 'today';
}

const view = ref(viewFromUrl());

function setView(v: string) {
  view.value = v;
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('view', v);
  window.history.replaceState(null, '', url);
}

function onPopState() {
  view.value = viewFromUrl();
}

const viewKind = computed(() => view.value.split(':')[0]);
const viewId = computed(() => {
  const parts = view.value.split(':');
  return parts[1] ? Number(parts[1]) : null;
});

const currentProject = computed(() => (viewKind.value === 'project' ? store.projects.value.find((p) => p.id === viewId.value) ?? null : null));
const currentLabel = computed(() => (viewKind.value === 'label' ? store.labels.value.find((l) => l.id === viewId.value) ?? null : null));

function topLevel(tasks: Task[]) {
  return tasks.filter((t) => t.parent_id == null);
}

const inboxPool = computed(() => topLevel(store.tasks.value.filter((t) => t.project_id === store.inbox.value?.id)));
const projectPool = computed(() => topLevel(store.tasks.value.filter((t) => t.project_id === viewId.value)));
const labelPool = computed(() => topLevel(store.tasks.value.filter((t) => t.label_ids.includes(viewId.value ?? -1))));
const allOpenPool = computed(() => topLevel(store.tasks.value));

const defaultQuickAddProject = computed<number | null>(() => {
  if (viewKind.value === 'project') return viewId.value;
  return store.inbox.value?.id ?? null;
});

// ── Selected task (detail panel) ────────────────────────────────────────
const selectedTaskId = ref<number | null>(null);
const selectedTask = computed<Task | null>(() =>
  selectedTaskId.value != null ? store.tasks.value.find((t) => t.id === selectedTaskId.value) ?? null : null,
);

function openDetail(task: Task) {
  selectedTaskId.value = task.id;
}
function closeDetail() {
  selectedTaskId.value = null;
}

// ── Mobile sidebar drawer ───────────────────────────────────────────────
const mobileSidebarOpen = ref(false);

// ── Shortcuts help modal ────────────────────────────────────────────────
const shortcutsOpen = ref(false);

// ── Quick add focus ──────────────────────────────────────────────────────
const quickAddRef = ref<InstanceType<typeof TodoQuickAdd> | null>(null);

// ── Keyboard shortcuts ───────────────────────────────────────────────────
let pendingG = false;
let pendingGTimer: number | undefined;

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function focusedTask(): Task | null {
  const el = document.activeElement?.closest('[data-task-id]') as HTMLElement | null;
  const id = el ? Number(el.dataset.taskId) : NaN;
  return Number.isFinite(id) ? store.tasks.value.find((t) => t.id === id) ?? null : null;
}

function onKeydown(e: KeyboardEvent) {
  if (isTyping(e.target)) return;

  if (e.key === 'Escape') {
    if (shortcutsOpen.value) { shortcutsOpen.value = false; return; }
    if (selectedTaskId.value != null) { closeDetail(); return; }
    if (mobileSidebarOpen.value) { mobileSidebarOpen.value = false; return; }
    return;
  }

  if (pendingG) {
    pendingG = false;
    window.clearTimeout(pendingGTimer);
    if (e.key === 'i') { setView('inbox'); return; }
    if (e.key === 't') { setView('today'); return; }
    if (e.key === 'u') { setView('upcoming'); return; }
    return;
  }

  if (e.key === 'g') {
    pendingG = true;
    pendingGTimer = window.setTimeout(() => { pendingG = false; }, 600);
    return;
  }

  if (e.key === 'q') { e.preventDefault(); quickAddRef.value?.focus(); return; }
  if (e.key === '/') { e.preventDefault(); setView('search'); return; }
  if (e.key === '?') { shortcutsOpen.value = !shortcutsOpen.value; return; }

  if (e.key === 'e') {
    const task = focusedTask();
    if (task) store.completeTask(task, task.completed_at == null);
    return;
  }

  if (['1', '2', '3', '4'].includes(e.key)) {
    const task = focusedTask();
    if (task) store.patchTask(task.id, { priority: Number(e.key) as Priority });
  }
}

onMounted(() => {
  store.loadBootstrap();
  window.addEventListener('keydown', onKeydown);
  window.addEventListener('popstate', onPopState);
});
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown);
  window.removeEventListener('popstate', onPopState);
});
</script>

<template>
  <div class="space-y-4">
    <p v-if="store.loadError.value" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2" role="alert">
      {{ store.loadError.value }}
      <button type="button" class="underline ml-2 cursor-pointer" @click="store.loadBootstrap">Reintentar</button>
    </p>

    <div v-if="store.loading.value" class="text-xs text-text-muted py-10 text-center">Cargando...</div>

    <template v-else-if="!store.loadError.value">
      <!-- Mobile top bar -->
      <div class="md:hidden flex items-center justify-between gap-2">
        <button type="button" class="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-3 cursor-pointer" aria-label="Abrir navegación" @click="mobileSidebarOpen = true">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" /></svg>
        </button>
        <button type="button" class="text-[11px] text-text-muted hover:text-text-primary cursor-pointer" @click="shortcutsOpen = true">Atajos (?)</button>
      </div>

      <div class="flex gap-6">
        <TodoSidebar :mobile-open="mobileSidebarOpen" :current-view="view" @navigate="setView" @close="mobileSidebarOpen = false" />

        <div class="min-w-0 flex-1 space-y-5">
          <TodoQuickAdd ref="quickAddRef" :default-project-id="defaultQuickAddProject" />

          <TodoTaskList
            v-if="viewKind === 'inbox'"
            :tasks="inboxPool"
            heading="Bandeja de entrada"
            :project-id="store.inbox.value?.id ?? null"
            empty-message="La bandeja de entrada está vacía."
            @select-task="openDetail"
          />

          <TodoTaskList
            v-else-if="viewKind === 'today'"
            :tasks="allOpenPool"
            heading="Hoy"
            today-grouping
            empty-message="Nada para hoy."
            @select-task="openDetail"
          />

          <TodoTaskList
            v-else-if="viewKind === 'project' && currentProject"
            :tasks="projectPool"
            :heading="currentProject.name"
            :project-id="currentProject.id"
            empty-message="Este proyecto no tiene tareas."
            @select-task="openDetail"
          />

          <TodoTaskList
            v-else-if="viewKind === 'label' && currentLabel"
            :tasks="labelPool"
            :heading="`@${currentLabel.name}`"
            empty-message="Ninguna tarea tiene esta etiqueta."
            @select-task="openDetail"
          />

          <TodoTaskList
            v-else-if="viewKind === 'search'"
            :tasks="allOpenPool"
            heading="Buscar"
            autofocus-search
            empty-message="Sin resultados."
            @select-task="openDetail"
          />

          <TodoUpcoming v-else-if="viewKind === 'upcoming'" @select-task="openDetail" />
          <TodoCompleted v-else-if="viewKind === 'completed'" />
          <TodoDashboard v-else-if="viewKind === 'dashboard'" />
        </div>
      </div>

      <!-- Floating "+" (mobile) -->
      <button
        type="button"
        class="md:hidden fixed right-4 bottom-[calc(var(--spacing-nav-clearance)+0.5rem)] z-[55] w-12 h-12 rounded-full bg-neon-green text-surface-0 flex items-center justify-center shadow-lg shadow-neon-green/30 cursor-pointer"
        aria-label="Agregar tarea"
        @click="quickAddRef?.focus()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
      </button>

      <TodoTaskDetail :task="selectedTask" @close="closeDetail" />
      <TodoShortcutsModal :open="shortcutsOpen" @close="shortcutsOpen = false" />
      <TodoToasts />
    </template>
  </div>
</template>
