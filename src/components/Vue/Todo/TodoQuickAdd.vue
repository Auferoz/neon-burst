<script setup lang="ts">
/**
 * Quick-capture bar with a live preview of the parsed chips (priority, date,
 * #project, @labels, recurrence). Always mounted inline; the floating "+"
 * button (mobile) and the `q` shortcut just call focus() on it.
 */
import { ref, computed, inject } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { parseQuickAdd } from '../../../utils/todo/quickAdd';
import { describeRecurrence } from '../../../utils/todo/recurrence';
import { PRIORITY_STYLES } from '../../../utils/todo/priorityStyles';
import { formatDateShort, localToday } from './clientDate';

const props = defineProps<{ defaultProjectId: number | null }>();

const store = inject(TODO_STORE_KEY)!;
const text = ref('');
const inputEl = ref<HTMLInputElement | null>(null);
const saving = ref(false);

const today = localToday();

const parsed = computed(() => (text.value.trim() ? parseQuickAdd(text.value, today, store.projectNames.value) : null));

function focus() {
  inputEl.value?.focus();
}
defineExpose({ focus });

async function submit() {
  const raw = text.value.trim();
  if (!raw || saving.value) return;
  const result = parseQuickAdd(raw, today, store.projectNames.value);
  if (!result.title.trim()) return;

  saving.value = true;
  const project = result.project ? store.projects.value.find((p) => p.name === result.project) : null;
  const labelNames = result.labels;

  const task = await store.createTask({
    project_id: project?.id ?? props.defaultProjectId ?? store.inbox.value?.id ?? 0,
    title: result.title,
    priority: result.priority,
    due_date: result.due_date,
    due_time: result.due_time,
    recurrence: result.recurrence,
    labels: labelNames,
  });

  saving.value = false;
  if (task) {
    text.value = '';
    if (result.warning) store.showError(result.warning);
  }
}
</script>

<template>
  <div class="space-y-1.5">
    <form class="flex items-center gap-2" @submit.prevent="submit">
      <input
        ref="inputEl"
        v-model="text"
        type="text"
        placeholder="Agregar tarea... ej: pagar luz mañana 18:00 p1 #Casa @urgente cada mes"
        aria-label="Agregar tarea rápida"
        class="flex-1 bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-green/50 transition-colors"
      />
      <button
        type="submit"
        :disabled="!text.trim() || saving"
        class="shrink-0 px-3 py-2 text-xs font-medium text-neon-green border border-neon-green/30 rounded-lg hover:bg-neon-green/10 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-default"
      >
        {{ saving ? 'Agregando...' : 'Agregar' }}
      </button>
    </form>

    <div v-if="parsed" class="flex flex-wrap items-center gap-1.5" aria-live="polite">
      <span class="text-[10px] px-1.5 py-0.5 rounded border" :class="[PRIORITY_STYLES[parsed.priority].bg, PRIORITY_STYLES[parsed.priority].text, PRIORITY_STYLES[parsed.priority].border]">
        {{ PRIORITY_STYLES[parsed.priority].label }}
      </span>
      <span v-if="parsed.due_date" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-default">
        {{ formatDateShort(parsed.due_date) }}<template v-if="parsed.due_time"> · {{ parsed.due_time }}</template>
      </span>
      <span v-if="parsed.project" class="text-[10px] px-1.5 py-0.5 rounded bg-neon-green/10 text-neon-green border border-neon-green/20">
        #{{ parsed.project }}
      </span>
      <span v-if="parsed.warning" class="text-[10px] px-1.5 py-0.5 rounded bg-neon-pink/10 text-neon-pink border border-neon-pink/20">
        {{ parsed.warning }}
      </span>
      <span v-for="l in parsed.labels" :key="l" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-default">
        @{{ l }}
      </span>
      <span v-if="parsed.recurrence" class="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-secondary border border-border-default">
        {{ describeRecurrence(parsed.recurrence) }}
      </span>
    </div>
  </div>
</template>
