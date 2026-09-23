<script setup lang="ts">
/**
 * Generic task list: search + filter + sort toolbar, optional "today"
 * grouping (overdue / hoy), and optional drag & drop reorder (SortableJS)
 * when scoped to a single project, sort mode is "manual", and no
 * search/filter is narrowing the list (drag order wouldn't mean anything
 * against a filtered subset).
 */
import { ref, computed, inject, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import Sortable from 'sortablejs';
import { TODO_STORE_KEY } from './useTodoStore';
import { applyFilters, searchTasksWithSubtasks, sortTasks, groupForToday } from '../../../utils/todo/taskQueries';
import { between } from '../../../utils/todo/fractionalOrder';
import { PRIORITY_OPTIONS, PRIORITY_STYLES } from '../../../utils/todo/priorityStyles';
import { localToday, formatDateLong } from './clientDate';
import TodoTaskItem from './TodoTaskItem.vue';
import type { Task, SortMode, Priority } from '../../../utils/todo/types';

const props = withDefaults(defineProps<{
  tasks: Task[];
  heading: string;
  emptyMessage?: string;
  todayGrouping?: boolean;
  projectId?: number | null;
  autofocusSearch?: boolean;
}>(), {
  emptyMessage: 'No hay tareas acá.',
  todayGrouping: false,
  projectId: null,
  autofocusSearch: false,
});

const emit = defineEmits<{ selectTask: [Task] }>();

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

const search = ref('');
const sortMode = ref<SortMode>('manual');
const priorityFilter = ref<Priority[]>([]);
const labelFilter = ref<number[]>([]);
const filtersOpen = ref(false);
const searchInput = ref<HTMLInputElement | null>(null);

onMounted(() => {
  if (props.autofocusSearch) searchInput.value?.focus();
});

const openPool = computed(() => props.tasks.filter((t) => t.completed_at == null));

const filtered = computed(() => {
  const hasPriority = priorityFilter.value.length > 0;
  const hasLabels = labelFilter.value.length > 0;
  let list = applyFilters(
    openPool.value,
    { priority: hasPriority ? priorityFilter.value : undefined, labels: hasLabels ? labelFilter.value : undefined },
    today,
  );
  list = searchTasksWithSubtasks(list, store.tasks.value, search.value);
  return list;
});

const filtersActive = computed(() => priorityFilter.value.length > 0 || labelFilter.value.length > 0 || search.value.trim() !== '');

const dragEnabled = computed(() => props.projectId != null && sortMode.value === 'manual' && !filtersActive.value);

const showProject = computed(() => props.projectId == null);

const sections = computed(() => store.sections.value.filter((s) => s.project_id === props.projectId));

interface Group { id: number | null; name: string; tasks: Task[] }

const groups = computed<Group[]>(() => {
  if (props.projectId == null || sections.value.length === 0) {
    return [{ id: null, name: '', tasks: sortTasks(filtered.value, sortMode.value) }];
  }
  const bySection = new Map<number | null, Task[]>();
  bySection.set(null, []);
  for (const s of sections.value) bySection.set(s.id, []);
  for (const t of filtered.value) {
    const key = bySection.has(t.section_id) ? t.section_id : null;
    bySection.get(key)!.push(t);
  }
  const result: Group[] = [{ id: null, name: 'Sin sección', tasks: sortTasks(bySection.get(null) ?? [], sortMode.value) }];
  for (const s of sections.value) result.push({ id: s.id, name: s.name, tasks: sortTasks(bySection.get(s.id) ?? [], sortMode.value) });
  return result;
});

const todayGroups = computed(() => (props.todayGrouping ? groupForToday(filtered.value, today) : null));

// ── Drag & drop ────────────────────────────────────────────────────────
const listEls = new Map<string, HTMLElement>();
let sortables: Sortable[] = [];

function setListEl(key: string, el: Element | null) {
  if (el) listEls.set(key, el as HTMLElement);
  else listEls.delete(key);
}

function destroySortables() {
  sortables.forEach((s) => s.destroy());
  sortables = [];
}

function initSortables() {
  destroySortables();
  if (!dragEnabled.value) return;
  for (const g of groups.value) {
    const el = listEls.get(String(g.id));
    if (!el) continue;
    sortables.push(
      Sortable.create(el, {
        group: `todo-project-${props.projectId}`,
        animation: 150,
        delay: 120,
        delayOnTouchOnly: true,
        onEnd: (evt) => onDragEnd(evt, g.id),
      }),
    );
  }
}

function onDragEnd(evt: Sortable.SortableEvent, sectionId: number | null) {
  const taskId = Number((evt.item as HTMLElement).dataset.taskId);
  const task = props.tasks.find((t) => t.id === taskId);
  if (!task || !evt.to) return;
  const ids = Array.from(evt.to.children).map((c) => Number((c as HTMLElement).dataset.taskId));
  const newIndex = evt.newIndex ?? 0;
  const prevTask = newIndex > 0 ? props.tasks.find((t) => t.id === ids[newIndex - 1]) : null;
  const nextTask = newIndex < ids.length - 1 ? props.tasks.find((t) => t.id === ids[newIndex + 1]) : null;
  const newOrder = between(prevTask?.sort_order ?? null, nextTask?.sort_order ?? null);
  store.reorderTask(task, props.projectId!, sectionId, newOrder);
}

const groupKey = computed(() => groups.value.map((g) => g.id).join(','));
watch([groupKey, dragEnabled], () => nextTick(initSortables));
onMounted(() => nextTick(initSortables));
onBeforeUnmount(destroySortables);

function togglePriority(p: Priority) {
  priorityFilter.value = priorityFilter.value.includes(p) ? priorityFilter.value.filter((x) => x !== p) : [...priorityFilter.value, p];
}

function toggleLabel(id: number) {
  labelFilter.value = labelFilter.value.includes(id) ? labelFilter.value.filter((x) => x !== id) : [...labelFilter.value, id];
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h2 class="text-lg font-bold text-text-primary">{{ heading }}</h2>
      <span class="text-xs text-text-muted">{{ filtered.length }} tarea{{ filtered.length === 1 ? '' : 's' }}</span>
    </div>

    <!-- Toolbar -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="relative flex-1 min-w-[160px]">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
          <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
        </svg>
        <input
          ref="searchInput"
          v-model="search"
          type="search"
          placeholder="Buscar..."
          aria-label="Buscar tareas"
          class="w-full bg-surface-2 border border-border-default rounded-lg pl-8 pr-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-neon-green/50 transition-colors"
        />
      </div>

      <select
        v-model="sortMode"
        aria-label="Ordenar por"
        class="bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-xs text-text-secondary focus:outline-none focus:border-neon-green/50 cursor-pointer"
      >
        <option value="manual">Manual</option>
        <option value="due">Fecha</option>
        <option value="priority">Prioridad</option>
        <option value="created">Creación</option>
        <option value="title">Título</option>
      </select>

      <button
        type="button"
        @click="filtersOpen = !filtersOpen"
        class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer"
        :class="priorityFilter.length || labelFilter.length ? 'text-neon-green border-neon-green/40 bg-neon-green/10' : 'text-text-secondary border-border-default hover:border-border-hover'"
        :aria-expanded="filtersOpen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filtros
      </button>
    </div>

    <div v-if="filtersOpen" class="flex flex-wrap items-start gap-4 p-3 bg-surface-2/60 border border-border-default rounded-lg text-xs">
      <div class="space-y-1.5">
        <p class="text-text-muted">Prioridad</p>
        <div class="flex gap-1.5">
          <button
            v-for="p in PRIORITY_OPTIONS"
            :key="p"
            type="button"
            @click="togglePriority(p)"
            class="px-2 py-1 rounded border transition-colors cursor-pointer"
            :class="priorityFilter.includes(p) ? [PRIORITY_STYLES[p].bg, PRIORITY_STYLES[p].text, PRIORITY_STYLES[p].border] : 'text-text-muted border-border-default hover:border-border-hover'"
          >
            {{ PRIORITY_STYLES[p].label }}
          </button>
        </div>
      </div>
      <div v-if="store.labels.value.length" class="space-y-1.5">
        <p class="text-text-muted">Etiquetas</p>
        <div class="flex flex-wrap gap-1.5 max-w-xs">
          <button
            v-for="l in store.labels.value"
            :key="l.id"
            type="button"
            @click="toggleLabel(l.id)"
            class="px-2 py-1 rounded border transition-colors cursor-pointer"
            :class="labelFilter.includes(l.id) ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'text-text-muted border-border-default hover:border-border-hover'"
          >
            @{{ l.name }}
          </button>
        </div>
      </div>
    </div>

    <p v-if="projectId != null && sortMode !== 'manual'" class="text-[11px] text-text-muted">
      El arrastre está desactivado: cambiá el orden a "Manual" para reordenar a mano.
    </p>
    <p v-else-if="projectId != null && filtersActive" class="text-[11px] text-text-muted">
      El arrastre está desactivado mientras hay una búsqueda o un filtro activo.
    </p>

    <!-- Today grouping -->
    <template v-if="todayGroups">
      <div v-if="todayGroups.overdue.length" class="space-y-1">
        <p class="text-xs font-semibold text-neon-pink uppercase tracking-wide">Vencidas</p>
        <TodoTaskItem v-for="t in todayGroups.overdue" :key="t.id" :task="t" show-project @select="emit('selectTask', $event)" />
      </div>
      <div class="space-y-1">
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Hoy</p>
        <p v-if="!todayGroups.today.length" class="text-xs text-text-muted py-2">Sin tareas para hoy.</p>
        <TodoTaskItem v-for="t in todayGroups.today" :key="t.id" :task="t" show-project @select="emit('selectTask', $event)" />
      </div>
    </template>

    <!-- Grouped-by-section list -->
    <template v-else>
      <p v-if="filtered.length === 0" class="text-xs text-text-muted py-6 text-center">{{ emptyMessage }}</p>
      <div v-for="g in groups" :key="g.id ?? 'none'" class="space-y-1">
        <p v-if="g.name" class="text-xs font-semibold text-text-secondary uppercase tracking-wide">{{ g.name }}</p>
        <div :ref="(el) => setListEl(String(g.id), el as Element | null)" class="space-y-1 min-h-2">
          <TodoTaskItem
            v-for="t in g.tasks"
            :key="t.id"
            :task="t"
            :draggable="dragEnabled"
            :show-project="showProject"
            @select="emit('selectTask', $event)"
          />
        </div>
      </div>
    </template>
  </div>
</template>
