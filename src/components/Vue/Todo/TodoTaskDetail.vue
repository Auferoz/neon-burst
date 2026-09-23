<script setup lang="ts">
/**
 * Side panel on desktop, full-screen modal on mobile. Edits every field
 * (title/description/priority/date/time/recurrence/project/section/labels),
 * subtasks (one level only — hidden when the task is itself a subtask), and
 * offers complete/delete. Follows the modal a11y pattern from
 * SeriesEntriesModal.vue (role=dialog, aria-modal, labelled, Escape).
 */
import { ref, computed, watch, inject, nextTick } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { describeRecurrence } from '../../../utils/todo/recurrence';
import { isoWeekday, dayOfMonth } from '../../../utils/todo/dateUtil';
import { PRIORITY_OPTIONS, PRIORITY_STYLES } from '../../../utils/todo/priorityStyles';
import { localToday } from './clientDate';
import type { Task, Priority } from '../../../utils/todo/types';

const props = defineProps<{ task: Task | null }>();
const emit = defineEmits<{ close: [] }>();

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

const title = ref('');
const description = ref('');
const dueDate = ref('');
const dueTime = ref('');
const projectId = ref<number | null>(null);
const sectionId = ref<number | null>(null);

type RecurrenceKind = 'none' | 'daily' | 'weekly' | 'monthly' | 'every';
const recurrenceKind = ref<RecurrenceKind>('none');
const everyN = ref(2);

const newLabelName = ref('');
const newSubtaskTitle = ref('');
const titleInput = ref<HTMLInputElement | null>(null);

const sections = computed(() => store.sections.value.filter((s) => s.project_id === projectId.value));
const subtasks = computed(() => (props.task ? store.tasks.value.filter((t) => t.parent_id === props.task!.id) : []));
const isSubtask = computed(() => props.task?.parent_id != null);

const recurrenceRule = computed<string | null>(() => {
  const base = dueDate.value || today;
  switch (recurrenceKind.value) {
    case 'none': return null;
    case 'daily': return 'daily';
    case 'weekly': return `weekly:${isoWeekday(base)}`;
    case 'monthly': return `monthly:${dayOfMonth(base)}`;
    case 'every': return `every:${Math.max(1, everyN.value)}:days`;
    default: return null;
  }
});

const recurrencePreview = computed(() => (recurrenceRule.value ? describeRecurrence(recurrenceRule.value) : null));

function resetFrom(task: Task) {
  title.value = task.title;
  description.value = task.description ?? '';
  dueDate.value = task.due_date ?? '';
  dueTime.value = task.due_time ?? '';
  projectId.value = task.project_id;
  sectionId.value = task.section_id;
  newLabelName.value = '';
  newSubtaskTitle.value = '';

  if (!task.recurrence) {
    recurrenceKind.value = 'none';
  } else if (task.recurrence === 'daily') {
    recurrenceKind.value = 'daily';
  } else if (task.recurrence.startsWith('weekly:')) {
    recurrenceKind.value = 'weekly';
  } else if (task.recurrence.startsWith('monthly:')) {
    recurrenceKind.value = 'monthly';
  } else if (task.recurrence.startsWith('every:')) {
    recurrenceKind.value = 'every';
    everyN.value = Number(task.recurrence.split(':')[1]) || 2;
  }
}

watch(
  () => props.task?.id,
  () => {
    if (props.task) {
      resetFrom(props.task);
      nextTick(() => titleInput.value?.focus());
    }
  },
  { immediate: true },
);

function saveField(patch: Record<string, unknown>) {
  if (!props.task) return;
  store.patchTask(props.task.id, patch);
}

function onTitleBlur() {
  const trimmed = title.value.trim();
  if (!trimmed || trimmed === props.task?.title) return;
  saveField({ title: trimmed });
}

function onDescriptionBlur() {
  if (description.value === (props.task?.description ?? '')) return;
  saveField({ description: description.value || null });
}

function setPriority(p: Priority) {
  saveField({ priority: p });
}

function onDateChange() {
  saveField({ due_date: dueDate.value || null });
}

function onTimeChange() {
  saveField({ due_time: dueTime.value || null });
}

function onProjectChange() {
  sectionId.value = null;
  saveField({ project_id: projectId.value, section_id: null });
}

function onSectionChange() {
  saveField({ section_id: sectionId.value });
}

function onRecurrenceChange() {
  saveField({ recurrence: recurrenceRule.value });
}

function toggleLabel(id: number) {
  if (!props.task) return;
  const ids = props.task.label_ids.includes(id)
    ? props.task.label_ids.filter((l) => l !== id)
    : [...props.task.label_ids, id];
  const names = ids.map((lid) => store.labels.value.find((l) => l.id === lid)?.name).filter((n): n is string => !!n);
  saveField({ labels: names });
}

async function addLabelAndAttach() {
  const name = newLabelName.value.trim();
  if (!name || !props.task) return;
  const existing = store.labels.value.find((l) => l.name.toLowerCase() === name.toLowerCase());
  const names = [...props.task.label_ids.map((lid) => store.labels.value.find((l) => l.id === lid)?.name).filter((n): n is string => !!n)];
  if (existing && !names.includes(existing.name)) names.push(existing.name);
  else if (!existing) names.push(name);
  saveField({ labels: names });
  newLabelName.value = '';
}

async function addSubtask() {
  const t = newSubtaskTitle.value.trim();
  if (!t || !props.task) return;
  await store.createTask({
    project_id: props.task.project_id,
    section_id: props.task.section_id,
    parent_id: props.task.id,
    title: t,
    priority: 4,
  });
  newSubtaskTitle.value = '';
}

function toggleSubtask(sub: Task) {
  store.completeTask(sub, sub.completed_at == null);
}

function deleteSubtask(sub: Task) {
  store.deleteTask(sub.id);
}

async function deleteThisTask() {
  if (!props.task) return;
  if (!window.confirm('¿Eliminar esta tarea?')) return;
  const id = props.task.id;
  emit('close');
  await store.deleteTask(id);
}

function toggleComplete() {
  if (!props.task) return;
  store.completeTask(props.task, props.task.completed_at == null);
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="task"
      class="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm sm:bg-black/30"
      @click.self="emit('close')"
      @keydown="onKeydown"
    >
      <div
        class="fixed inset-0 sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[420px] bg-surface-1 border-l border-border-default flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-detail-title"
      >
        <div class="flex items-center justify-between p-4 border-b border-border-default shrink-0">
          <button type="button" class="text-xs text-text-muted hover:text-text-primary cursor-pointer" @click="emit('close')">← Cerrar</button>
          <button type="button" class="text-xs text-neon-pink hover:underline cursor-pointer" @click="deleteThisTask">Eliminar</button>
        </div>

        <div class="flex-1 overflow-y-auto p-4 space-y-5">
          <h2 id="todo-detail-title" class="sr-only">Detalle de tarea</h2>

          <div class="flex items-start gap-3">
            <button
              type="button"
              class="mt-1 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors"
              :class="task.completed_at ? 'bg-neon-green border-neon-green' : 'border-border-hover hover:border-neon-green'"
              :aria-label="task.completed_at ? `Marcar como pendiente: ${task.title}` : `Completar: ${task.title}`"
              @click="toggleComplete"
            >
              <svg v-if="task.completed_at" xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#06060a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </button>
            <textarea
              ref="titleInput"
              v-model="title"
              rows="2"
              placeholder="Título"
              aria-label="Título de la tarea"
              class="flex-1 bg-transparent text-lg font-semibold text-text-primary placeholder:text-text-muted focus:outline-none resize-none"
              @blur="onTitleBlur"
            ></textarea>
          </div>

          <div>
            <label for="todo-detail-desc" class="block text-xs text-text-muted mb-1">Descripción</label>
            <textarea
              id="todo-detail-desc"
              v-model="description"
              rows="3"
              placeholder="Sin descripción"
              class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/50 resize-none"
              @blur="onDescriptionBlur"
            ></textarea>
          </div>

          <div>
            <p class="text-xs text-text-muted mb-1.5">Prioridad</p>
            <div class="flex gap-1.5">
              <button
                v-for="p in PRIORITY_OPTIONS"
                :key="p"
                type="button"
                class="px-2.5 py-1 text-xs rounded-lg border transition-colors cursor-pointer"
                :class="task.priority === p ? [PRIORITY_STYLES[p].bg, PRIORITY_STYLES[p].text, PRIORITY_STYLES[p].border] : 'text-text-muted border-border-default hover:border-border-hover'"
                @click="setPriority(p)"
              >
                {{ PRIORITY_STYLES[p].label }}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="todo-detail-date" class="block text-xs text-text-muted mb-1">Fecha</label>
              <input id="todo-detail-date" v-model="dueDate" type="date" class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50" @change="onDateChange" />
            </div>
            <div>
              <label for="todo-detail-time" class="block text-xs text-text-muted mb-1">Hora</label>
              <input id="todo-detail-time" v-model="dueTime" type="time" :disabled="!dueDate" class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50 disabled:opacity-40" @change="onTimeChange" />
            </div>
          </div>

          <div>
            <label for="todo-detail-recurrence" class="block text-xs text-text-muted mb-1">Repetir</label>
            <div class="flex items-center gap-2">
              <select id="todo-detail-recurrence" v-model="recurrenceKind" class="flex-1 bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50 cursor-pointer" @change="onRecurrenceChange">
                <option value="none">No se repite</option>
                <option value="daily">Cada día</option>
                <option value="weekly">Cada semana</option>
                <option value="monthly">Cada mes</option>
                <option value="every">Cada N días</option>
              </select>
              <input v-if="recurrenceKind === 'every'" v-model.number="everyN" type="number" min="1" class="w-16 bg-surface-2 border border-border-default rounded-lg px-2 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50" @change="onRecurrenceChange" />
            </div>
            <p v-if="recurrencePreview" class="text-[11px] text-neon-green mt-1">{{ recurrencePreview }}</p>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label for="todo-detail-project" class="block text-xs text-text-muted mb-1">Proyecto</label>
              <select id="todo-detail-project" v-model.number="projectId" class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50 cursor-pointer" @change="onProjectChange">
                <option v-for="p in store.projects.value" :key="p.id" :value="p.id">{{ p.is_inbox ? 'Bandeja de entrada' : p.name }}</option>
              </select>
            </div>
            <div>
              <label for="todo-detail-section" class="block text-xs text-text-muted mb-1">Sección</label>
              <select id="todo-detail-section" v-model="sectionId" :disabled="!sections.length" class="w-full bg-surface-2 border border-border-default rounded-lg px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:border-neon-green/50 cursor-pointer disabled:opacity-40" @change="onSectionChange">
                <option :value="null">Sin sección</option>
                <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
          </div>

          <div>
            <p class="text-xs text-text-muted mb-1.5">Etiquetas</p>
            <div class="flex flex-wrap gap-1.5 mb-2">
              <button
                v-for="l in store.labels.value"
                :key="l.id"
                type="button"
                class="text-[11px] px-2 py-1 rounded-lg border transition-colors cursor-pointer"
                :class="task.label_ids.includes(l.id) ? 'bg-neon-green/10 text-neon-green border-neon-green/30' : 'text-text-muted border-border-default hover:border-border-hover'"
                @click="toggleLabel(l.id)"
              >
                @{{ l.name }}
              </button>
            </div>
            <form class="flex items-center gap-1.5" @submit.prevent="addLabelAndAttach">
              <input v-model="newLabelName" type="text" placeholder="Nueva etiqueta" aria-label="Nueva etiqueta" class="flex-1 bg-surface-2 border border-border-default rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-neon-green/50" />
              <button type="submit" class="text-xs text-neon-green cursor-pointer">Agregar</button>
            </form>
          </div>

          <div v-if="!isSubtask">
            <p class="text-xs text-text-muted mb-1.5">Subtareas</p>
            <div class="space-y-1">
              <div v-for="sub in subtasks" :key="sub.id" class="flex items-center gap-2">
                <button
                  type="button"
                  class="shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center"
                  :class="sub.completed_at ? 'bg-neon-green border-neon-green' : 'border-border-hover'"
                  :aria-label="sub.completed_at ? `Marcar como pendiente: ${sub.title}` : `Completar: ${sub.title}`"
                  @click="toggleSubtask(sub)"
                ></button>
                <span class="flex-1 text-sm text-text-secondary" :class="{ 'line-through text-text-muted': sub.completed_at }">{{ sub.title }}</span>
                <button type="button" class="text-text-muted hover:text-neon-pink text-[11px] cursor-pointer" :aria-label="`Eliminar subtarea ${sub.title}`" @click="deleteSubtask(sub)">✕</button>
              </div>
            </div>
            <form class="flex items-center gap-1.5 mt-2" @submit.prevent="addSubtask">
              <input v-model="newSubtaskTitle" type="text" placeholder="Nueva subtarea" aria-label="Nueva subtarea" class="flex-1 bg-surface-2 border border-border-default rounded-lg px-2.5 py-1 text-xs text-text-primary focus:outline-none focus:border-neon-green/50" />
              <button type="submit" class="text-xs text-neon-green cursor-pointer">Agregar</button>
            </form>
          </div>
          <p v-else class="text-[11px] text-text-muted">Las subtareas admiten un solo nivel.</p>
        </div>
      </div>
    </div>
  </Teleport>
</template>
