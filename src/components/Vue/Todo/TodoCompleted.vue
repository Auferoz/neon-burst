<script setup lang="ts">
/**
 * "Completadas" view: paginated history via GET /api/todo/completed, not the
 * bootstrap pool (which only carries the last 30 days).
 */
import { ref, onMounted } from 'vue';
import { formatDateLong } from './clientDate';
import { PRIORITY_STYLES } from '../../../utils/todo/priorityStyles';
import type { Task } from '../../../utils/todo/types';

type CompletedTask = Task & { completed_at: string };

const tasks = ref<CompletedTask[]>([]);
const nextBefore = ref<string | null>(null);
const loading = ref(false);
const error = ref('');
const initialLoaded = ref(false);

async function loadPage() {
  loading.value = true;
  error.value = '';
  try {
    const url = new URL('/api/todo/completed', window.location.origin);
    url.searchParams.set('limit', '50');
    if (nextBefore.value) url.searchParams.set('before', nextBefore.value);
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
    tasks.value = [...tasks.value, ...(data as { tasks: CompletedTask[] }).tasks];
    nextBefore.value = (data as { nextBefore: string | null }).nextBefore;
  } catch (e) {
    error.value = (e as Error).message || 'No se pudo cargar el historial';
  } finally {
    loading.value = false;
    initialLoaded.value = true;
  }
}

onMounted(loadPage);
</script>

<template>
  <div class="space-y-4">
    <h2 class="text-lg font-bold text-text-primary">Completadas</h2>

    <p v-if="error" class="text-xs text-neon-pink bg-neon-pink/10 border border-neon-pink/20 rounded-lg px-3 py-2" role="alert">{{ error }}</p>
    <p v-if="initialLoaded && !tasks.length && !error" class="text-xs text-text-muted py-6 text-center">Todavía no completaste ninguna tarea.</p>

    <div class="space-y-1.5">
      <div v-for="t in tasks" :key="`${t.id}-${t.completed_at}`" class="flex items-center gap-3 px-3 py-2 rounded-lg border border-border-default bg-surface-2/40">
        <span class="w-4 h-4 rounded-full bg-neon-green shrink-0"></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm text-text-primary truncate">{{ t.title }}</p>
          <p class="text-[11px] text-text-muted">{{ formatDateLong(t.completed_at.slice(0, 10)) }}</p>
        </div>
        <span class="text-[10px] px-1.5 py-0.5 rounded border shrink-0" :class="[PRIORITY_STYLES[t.priority].bg, PRIORITY_STYLES[t.priority].text, PRIORITY_STYLES[t.priority].border]">
          {{ PRIORITY_STYLES[t.priority].label }}
        </span>
      </div>
    </div>

    <div v-if="nextBefore" class="flex justify-center">
      <button
        type="button"
        :disabled="loading"
        class="px-4 py-2 text-xs text-text-secondary border border-border-default rounded-lg hover:border-border-hover transition-colors cursor-pointer disabled:opacity-50"
        @click="loadPage"
      >
        {{ loading ? 'Cargando...' : 'Cargar más' }}
      </button>
    </div>
  </div>
</template>
