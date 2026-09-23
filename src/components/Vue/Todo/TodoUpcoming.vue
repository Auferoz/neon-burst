<script setup lang="ts">
import { computed, inject } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { groupForToday, upcoming } from '../../../utils/todo/taskQueries';
import { localToday, formatDateLong } from './clientDate';
import TodoTaskItem from './TodoTaskItem.vue';
import type { Task } from '../../../utils/todo/types';

const emit = defineEmits<{ selectTask: [Task] }>();

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

const openTasks = computed(() => store.tasks.value.filter((t) => t.completed_at == null));
const overdue = computed(() => groupForToday(openTasks.value, today).overdue);
// days[0] is today; the next 7 days include today, so ask for 8 to also cover the 7th day ahead.
const days = computed(() => upcoming(openTasks.value, today, 8));
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-text-primary">Próximos</h2>

    <div v-if="overdue.length" class="space-y-1">
      <p class="text-xs font-semibold text-neon-pink uppercase tracking-wide">Vencidas</p>
      <TodoTaskItem v-for="t in overdue" :key="t.id" :task="t" compact @select="emit('selectTask', $event)" />
    </div>

    <div v-for="group in days" :key="group.date" class="space-y-1">
      <p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">
        {{ group.date === today ? 'Hoy' : formatDateLong(group.date) }}
      </p>
      <p v-if="!group.tasks.length" class="text-xs text-text-muted py-1">Sin tareas.</p>
      <TodoTaskItem v-for="t in group.tasks" :key="t.id" :task="t" compact @select="emit('selectTask', $event)" />
    </div>
  </div>
</template>
