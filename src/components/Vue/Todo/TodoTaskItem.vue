<script setup lang="ts">
import { computed, inject, nextTick, ref, watch } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { isOverdue } from '../../../utils/todo/taskQueries';
import { subtaskProgress, splitPastedLines } from '../../../utils/todo/subtasks';
import { PRIORITY_STYLES, projectColorDot } from '../../../utils/todo/priorityStyles';
import { describeRecurrence } from '../../../utils/todo/recurrence';
import { formatDateShort, localToday } from './clientDate';
import IconRepeat from '../../Icons/IconRepeat.vue';
import type { Task } from '../../../utils/todo/types';

const props = withDefaults(defineProps<{
  task: Task;
  compact?: boolean;
  draggable?: boolean;
  showProject?: boolean;
}>(), { compact: false, draggable: false, showProject: false });

const emit = defineEmits<{ select: [Task] }>();

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

const style = computed(() => PRIORITY_STYLES[props.task.priority]);
const overdue = computed(() => isOverdue(props.task, today));
const isToday = computed(() => props.task.completed_at == null && props.task.due_date === today);
const done = computed(() => props.task.completed_at != null);

const dueChipClass = computed(() => {
  if (overdue.value) return 'text-neon-pink bg-neon-pink/10 border-neon-pink/30';
  if (isToday.value) return 'text-neon-green bg-neon-green/10 border-neon-green/30';
  return 'text-text-muted bg-surface-3 border-border-default';
});

const recurrenceLabel = computed(() => (props.task.recurrence ? describeRecurrence(props.task.recurrence) : null));

const project = computed(() => store.projects.value.find((p) => p.id === props.task.project_id) ?? null);

const subtasks = computed(() => store.tasks.value.filter((t) => t.parent_id === props.task.id));
const openSubtasks = computed(() => subtasks.value.filter((t) => t.completed_at == null));
const progress = computed(() => subtaskProgress(subtasks.value));
const progressPct = computed(() => (progress.value.total ? Math.round((progress.value.done / progress.value.total) * 100) : 0));
const progressComplete = computed(() => progress.value.total > 0 && progress.value.done === progress.value.total);

const taskLabels = computed(() => props.task.label_ids.map((id) => store.labels.value.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l));

// ── Per-card collapsed / hide-completed state, persisted per task ────────
const storageKeyCollapsed = `todo:item:${props.task.id}:collapsed`;
const storageKeyHideCompleted = `todo:item:${props.task.id}:hideCompleted`;

function readBool(key: string, fallback: boolean): boolean {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : raw === '1';
  } catch {
    return fallback;
  }
}

function writeBool(key: string, value: boolean) {
  try {
    window.localStorage.setItem(key, value ? '1' : '0');
  } catch {
    // ignore (private mode, quota, etc.)
  }
}

const collapsed = ref(readBool(storageKeyCollapsed, openSubtasks.value.length === 0 && subtasks.value.length > 0));
const hideCompleted = ref(readBool(storageKeyHideCompleted, false));

watch(collapsed, (v) => writeBool(storageKeyCollapsed, v));
watch(hideCompleted, (v) => writeBool(storageKeyHideCompleted, v));

const visibleSubtasks = computed(() => (hideCompleted.value ? openSubtasks.value : subtasks.value));
const hiddenCompletedCount = computed(() => subtasks.value.length - openSubtasks.value.length);

function toggleComplete(e: Event) {
  e.stopPropagation();
  store.completeTask(props.task, !done.value);
}

function toggleCollapsed(e: Event) {
  e.stopPropagation();
  collapsed.value = !collapsed.value;
}

function toggleHideCompleted(e: Event) {
  e.stopPropagation();
  hideCompleted.value = !hideCompleted.value;
}

function toggleSubtask(sub: Task, e: Event) {
  e.stopPropagation();
  store.completeTask(sub, sub.completed_at == null, { silent: true });
}

// ── Rename subtask (double-click or pencil button) ────────────────────────
const renamingId = ref<number | null>(null);
const renameText = ref('');
let renameInputEl: HTMLInputElement | null = null;

function setRenameInputEl(el: Element | null) {
  renameInputEl = el as HTMLInputElement | null;
}

function startRename(sub: Task, e: Event) {
  e.stopPropagation();
  renamingId.value = sub.id;
  renameText.value = sub.title;
  nextTick(() => renameInputEl?.focus());
}

function saveRename(sub: Task) {
  if (renamingId.value !== sub.id) return;
  const trimmed = renameText.value.trim();
  renamingId.value = null;
  if (!trimmed || trimmed === sub.title) return;
  store.patchTask(sub.id, { title: trimmed });
}

function cancelRename() {
  renamingId.value = null;
}

// ── Add subtask inline ────────────────────────────────────────────────────
const addingSubtask = ref(false);
const newSubtaskText = ref('');
const newSubtaskInput = ref<HTMLInputElement | null>(null);

function openAddSubtask(e: Event) {
  e.stopPropagation();
  addingSubtask.value = true;
  collapsed.value = false;
  nextTick(() => newSubtaskInput.value?.focus());
}

async function addSubtaskFromInput() {
  const lines = splitPastedLines(newSubtaskText.value);
  if (!lines.length) {
    addingSubtask.value = false;
    return;
  }
  newSubtaskText.value = '';
  for (const title of lines) {
    await store.createTask({
      project_id: props.task.project_id,
      section_id: props.task.section_id,
      parent_id: props.task.id,
      title,
      priority: 4,
    });
  }
  nextTick(() => newSubtaskInput.value?.focus());
}

function cancelAddSubtask() {
  addingSubtask.value = false;
  newSubtaskText.value = '';
}

function onSubtaskPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text') ?? '';
  const lines = splitPastedLines(text);
  if (lines.length <= 1) return; // let the default single-line paste happen
  e.preventDefault();
  newSubtaskText.value = '';
  (async () => {
    for (const title of lines) {
      await store.createTask({
        project_id: props.task.project_id,
        section_id: props.task.section_id,
        parent_id: props.task.id,
        title,
        priority: 4,
      });
    }
  })();
}
</script>

<template>
  <div
    :data-task-id="task.id"
    tabindex="0"
    class="todo-task-item group relative flex flex-col gap-2 rounded-xl border border-border-default bg-surface-1 pl-4 pr-3 py-3 overflow-hidden hover:border-border-hover hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-neon-green transition-colors cursor-pointer"
    :class="{ 'opacity-60': done }"
    @click="emit('select', task)"
    @keydown.enter="emit('select', task)"
  >
    <span class="absolute left-0 top-0 bottom-0 w-1" :class="style.dot" aria-hidden="true"></span>

    <div class="flex items-start gap-3">
      <button
        type="button"
        class="shrink-0 mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 todo-check"
        :class="done ? 'bg-neon-green border-neon-green' : [style.border, 'hover:scale-110']"
        :aria-label="done ? `Marcar como pendiente: ${task.title}` : `Completar: ${task.title}`"
        @click="toggleComplete"
      >
        <svg v-if="done" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#06060a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span v-else class="w-2 h-2 rounded-full" :class="style.dot"></span>
      </button>

      <div class="min-w-0 flex-1 space-y-1.5">
        <p class="text-sm text-text-primary leading-snug break-words font-medium" :class="{ 'line-through text-text-muted': done }">
          {{ task.title }}
        </p>
        <div v-if="!compact || task.due_date || recurrenceLabel || taskLabels.length || showProject" class="flex flex-wrap items-center gap-1.5">
          <span v-if="task.due_date" class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border" :class="dueChipClass">
            {{ formatDateShort(task.due_date) }}<template v-if="task.due_time"> · {{ task.due_time }}</template>
          </span>
          <span v-if="recurrenceLabel" class="inline-flex items-center gap-1 text-[10px] text-text-muted" :title="recurrenceLabel">
            <IconRepeat :size="11" />{{ recurrenceLabel }}
          </span>
          <span v-if="showProject && project" class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-default">
            <span class="w-1.5 h-1.5 rounded-full shrink-0" :class="projectColorDot(project.color)"></span>
            {{ project.is_inbox ? 'Bandeja' : project.name }}
          </span>
          <span v-for="label in taskLabels" :key="label.id" class="text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
            @{{ label.name }}
          </span>
        </div>
      </div>
    </div>

    <!-- Subtask progress bar -->
    <div v-if="progress.total > 0" class="pl-8 flex items-center gap-2">
      <div class="flex-1 h-1.5 rounded-full bg-surface-3 overflow-hidden">
        <div
          class="h-full rounded-full todo-progress-bar"
          :class="progressComplete ? 'bg-neon-green' : 'bg-neon-blue'"
          :style="{ width: progressPct + '%' }"
        ></div>
      </div>
      <span class="text-[10px] shrink-0" :class="progressComplete ? 'text-neon-green' : 'text-text-muted'">
        {{ progress.done }}/{{ progress.total }}
      </span>
      <button
        type="button"
        class="shrink-0 text-text-muted hover:text-text-primary cursor-pointer todo-chevron"
        :class="{ 'todo-chevron-open': !collapsed }"
        :aria-label="collapsed ? 'Mostrar subtareas' : 'Ocultar subtareas'"
        :aria-expanded="!collapsed"
        @click="toggleCollapsed"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
    </div>

    <!-- Subtask checklist -->
    <div v-if="!collapsed && (subtasks.length || addingSubtask)" class="pl-8 space-y-1" @click.stop @keydown.stop>
      <div v-if="hiddenCompletedCount > 0" class="flex justify-end">
        <button type="button" class="text-[10px] text-text-muted hover:text-text-primary cursor-pointer" @click="toggleHideCompleted">
          {{ hideCompleted ? `Mostrar completadas (${hiddenCompletedCount})` : 'Ocultar completadas' }}
        </button>
      </div>

      <div v-for="sub in visibleSubtasks" :key="sub.id" class="group/sub flex items-center gap-2 py-0.5">
        <button
          type="button"
          class="shrink-0 w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center"
          :class="sub.completed_at ? 'bg-neon-green border-neon-green' : 'border-border-hover hover:border-neon-green'"
          :aria-label="sub.completed_at ? `Marcar como pendiente: ${sub.title}` : `Completar: ${sub.title}`"
          @click="toggleSubtask(sub, $event)"
        >
          <svg v-if="sub.completed_at" xmlns="http://www.w3.org/2000/svg" width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#06060a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </button>

        <input
          v-if="renamingId === sub.id"
          :ref="setRenameInputEl"
          v-model="renameText"
          type="text"
          :aria-label="`Renombrar subtarea: ${sub.title}`"
          class="flex-1 min-w-0 bg-surface-2 border border-neon-green/40 rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none"
          @blur="saveRename(sub)"
          @keydown.enter="saveRename(sub)"
          @keydown.esc="cancelRename"
        />
        <span
          v-else
          class="flex-1 min-w-0 text-xs text-text-secondary truncate"
          :class="{ 'line-through text-text-muted': sub.completed_at }"
          @dblclick="startRename(sub, $event)"
        >
          {{ sub.title }}
        </span>

        <button
          v-if="renamingId !== sub.id"
          type="button"
          class="shrink-0 opacity-0 group-hover/sub:opacity-100 text-text-muted hover:text-text-primary text-[10px] cursor-pointer"
          :aria-label="`Renombrar subtarea: ${sub.title}`"
          @click="startRename(sub, $event)"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /></svg>
        </button>
      </div>

      <div v-if="addingSubtask" class="flex items-center gap-2 py-0.5">
        <span class="w-3.5 h-3.5 shrink-0"></span>
        <input
          ref="newSubtaskInput"
          v-model="newSubtaskText"
          type="text"
          placeholder="Nueva subtarea"
          aria-label="Nueva subtarea"
          class="flex-1 min-w-0 bg-surface-2 border border-border-default rounded px-1.5 py-0.5 text-xs text-text-primary focus:outline-none focus:border-neon-green/50"
          @keydown.enter.prevent="addSubtaskFromInput"
          @keydown.esc="cancelAddSubtask"
          @blur="cancelAddSubtask"
          @paste="onSubtaskPaste"
        />
      </div>
      <button
        v-else
        type="button"
        class="text-[11px] text-text-muted hover:text-neon-green cursor-pointer pl-5.5"
        @click="openAddSubtask"
      >
        + Subtarea
      </button>
    </div>
    <button
      v-else-if="!addingSubtask"
      type="button"
      class="pl-8 text-left text-[11px] text-text-muted hover:text-neon-green cursor-pointer"
      @click.stop="openAddSubtask"
    >
      + Subtarea
    </button>
  </div>
</template>

<style scoped>
@keyframes todo-check-pop {
  0% { transform: scale(0.7); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
}
.todo-check:has(svg) {
  animation: todo-check-pop 0.25s ease-out;
}
.todo-progress-bar {
  transition: width 0.25s ease-out;
}
.todo-chevron svg {
  transition: transform 0.15s ease-out;
}
.todo-chevron-open svg {
  transform: rotate(180deg);
}
@media (prefers-reduced-motion: reduce) {
  .todo-check:has(svg) { animation: none; }
  .todo-progress-bar, .todo-chevron svg { transition: none; }
}
</style>
