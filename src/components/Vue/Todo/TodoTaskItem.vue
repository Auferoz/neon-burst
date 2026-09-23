<script setup lang="ts">
import { computed, inject } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { isOverdue } from '../../../utils/todo/taskQueries';
import { PRIORITY_STYLES } from '../../../utils/todo/priorityStyles';
import { describeRecurrence } from '../../../utils/todo/recurrence';
import { formatDateShort, localToday } from './clientDate';
import IconRepeat from '../../Icons/IconRepeat.vue';
import type { Task } from '../../../utils/todo/types';

const props = withDefaults(defineProps<{
  task: Task;
  compact?: boolean;
  draggable?: boolean;
}>(), { compact: false, draggable: false });

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

const subtasks = computed(() => store.tasks.value.filter((t) => t.parent_id === props.task.id));
const subtasksDone = computed(() => subtasks.value.filter((t) => t.completed_at != null).length);

const taskLabels = computed(() => props.task.label_ids.map((id) => store.labels.value.find((l) => l.id === id)).filter((l): l is NonNullable<typeof l> => !!l));

function toggleComplete(e: Event) {
  e.stopPropagation();
  store.completeTask(props.task, !done.value);
}
</script>

<template>
  <div
    :data-task-id="task.id"
    tabindex="0"
    class="todo-task-item group flex items-start gap-3 px-3 py-2.5 rounded-lg border border-transparent hover:border-border-default hover:bg-surface-2/60 focus-visible:outline-2 focus-visible:outline-neon-green transition-colors cursor-pointer"
    :class="{ 'opacity-60': done }"
    @click="emit('select', task)"
    @keydown.enter="emit('select', task)"
  >
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

    <div class="min-w-0 flex-1 space-y-1">
      <p class="text-sm text-text-primary leading-snug break-words" :class="{ 'line-through text-text-muted': done }">
        {{ task.title }}
      </p>
      <div v-if="!compact || task.due_date || recurrenceLabel || taskLabels.length || subtasks.length" class="flex flex-wrap items-center gap-1.5">
        <span v-if="task.due_date" class="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded border" :class="dueChipClass">
          {{ formatDateShort(task.due_date) }}<template v-if="task.due_time"> · {{ task.due_time }}</template>
        </span>
        <span v-if="recurrenceLabel" class="inline-flex items-center gap-1 text-[10px] text-text-muted" :title="recurrenceLabel">
          <IconRepeat :size="11" />{{ recurrenceLabel }}
        </span>
        <span v-for="label in taskLabels" :key="label.id" class="text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
          @{{ label.name }}
        </span>
        <span v-if="subtasks.length" class="text-[10px] text-text-muted">
          {{ subtasksDone }}/{{ subtasks.length }}
        </span>
      </div>
    </div>
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
</style>
