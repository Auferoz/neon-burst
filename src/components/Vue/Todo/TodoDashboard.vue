<script setup lang="ts">
/**
 * Stat tiles + a 28-day completion bar chart as inline SVG (no chart lib).
 * Each bar carries a <title> (hover) and its own accessible label; a plain
 * text summary underneath repeats the same data for screen readers / anyone
 * who'd rather not parse a chart.
 */
import { computed, inject } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { computeStats } from '../../../utils/todo/stats';
import { PRIORITY_STYLES, projectColorDot } from '../../../utils/todo/priorityStyles';
import { localToday, formatDateLong } from './clientDate';
import type { Priority } from '../../../utils/todo/types';

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

const stats = computed(() => computeStats(store.tasks.value, store.completions.value, today));

const maxDay = computed(() => Math.max(1, ...stats.value.perDay.map((d) => d.count)));

const CHART_W = 560;
const CHART_H = 96;
const BAR_GAP = 2;

const barWidth = computed(() => (CHART_W - BAR_GAP * (stats.value.perDay.length - 1)) / stats.value.perDay.length);

function barHeight(count: number) {
  return Math.max(2, (count / maxDay.value) * CHART_H);
}

const projectBreakdown = computed(() =>
  Object.entries(stats.value.byProject)
    .map(([id, count]) => ({ id: Number(id), count, project: store.projects.value.find((p) => p.id === Number(id)) }))
    .filter((r) => r.project)
    .sort((a, b) => b.count - a.count),
);

const priorityBreakdown = computed(() =>
  ([1, 2, 3, 4] as Priority[]).map((p) => ({ priority: p, count: stats.value.byPriority[p] ?? 0 })),
);

const totalCompletions = computed(() => store.completions.value.length);
const avgPerDay = computed(() => (stats.value.perDay.reduce((s, d) => s + d.count, 0) / stats.value.perDay.length).toFixed(1));
</script>

<template>
  <div class="space-y-6">
    <h2 class="text-lg font-bold text-text-primary">Dashboard</h2>

    <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-3 text-center">
        <p class="text-2xl font-bold text-neon-green">{{ stats.completedToday }}</p>
        <p class="text-[11px] text-text-muted mt-1">Hoy</p>
      </div>
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-3 text-center">
        <p class="text-2xl font-bold text-neon-green">{{ stats.completedWeek }}</p>
        <p class="text-[11px] text-text-muted mt-1">Semana</p>
      </div>
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-3 text-center">
        <p class="text-2xl font-bold text-neon-cyan">{{ stats.currentStreak }}</p>
        <p class="text-[11px] text-text-muted mt-1">Racha actual</p>
      </div>
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-3 text-center">
        <p class="text-2xl font-bold text-neon-indigo">{{ stats.bestStreak }}</p>
        <p class="text-[11px] text-text-muted mt-1">Mejor racha</p>
      </div>
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-3 text-center">
        <p class="text-2xl font-bold text-neon-pink">{{ stats.overdueCount }}</p>
        <p class="text-[11px] text-text-muted mt-1">Vencidas</p>
      </div>
    </div>

    <div class="bg-surface-2/60 border border-border-default rounded-xl p-4 space-y-2">
      <p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Últimos 28 días</p>
      <svg
        :viewBox="`0 0 ${CHART_W} ${CHART_H}`"
        class="w-full h-24"
        role="img"
        :aria-label="`Tareas completadas por día en los últimos 28 días, hasta ${stats.perDay.length} entradas, máximo ${maxDay} en un día`"
      >
        <rect
          v-for="(d, i) in stats.perDay"
          :key="d.date"
          :x="i * (barWidth + BAR_GAP)"
          :y="CHART_H - barHeight(d.count)"
          :width="barWidth"
          :height="barHeight(d.count)"
          :fill="d.date === today ? 'var(--color-neon-green)' : 'var(--color-neon-emerald)'"
          :opacity="d.count === 0 ? 0.25 : 0.9"
          :aria-label="`${formatDateLong(d.date)}: ${d.count} completada${d.count === 1 ? '' : 's'}`"
        >
          <title>{{ formatDateLong(d.date) }}: {{ d.count }} completada{{ d.count === 1 ? '' : 's' }}</title>
        </rect>
      </svg>
      <p class="text-[11px] text-text-muted">
        {{ totalCompletions }} completadas en 28 días · promedio {{ avgPerDay }} por día
      </p>
    </div>

    <div class="grid sm:grid-cols-2 gap-4">
      <div class="bg-surface-2/60 border border-border-default rounded-xl p-4 space-y-2">
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Por proyecto</p>
        <p v-if="!projectBreakdown.length" class="text-xs text-text-muted">Sin datos todavía.</p>
        <div v-for="row in projectBreakdown" :key="row.id" class="flex items-center justify-between gap-2 text-xs">
          <span class="flex items-center gap-2 min-w-0">
            <span class="w-2 h-2 rounded-full shrink-0" :class="projectColorDot(row.project!.color)"></span>
            <span class="truncate text-text-secondary">{{ row.project!.name }}</span>
          </span>
          <span class="text-text-muted shrink-0">{{ row.count }}</span>
        </div>
      </div>

      <div class="bg-surface-2/60 border border-border-default rounded-xl p-4 space-y-2">
        <p class="text-xs font-semibold text-text-secondary uppercase tracking-wide">Por prioridad</p>
        <div v-for="row in priorityBreakdown" :key="row.priority" class="flex items-center justify-between gap-2 text-xs">
          <span class="px-1.5 py-0.5 rounded border" :class="[PRIORITY_STYLES[row.priority].bg, PRIORITY_STYLES[row.priority].text, PRIORITY_STYLES[row.priority].border]">
            {{ PRIORITY_STYLES[row.priority].label }}
          </span>
          <span class="text-text-muted">{{ row.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
