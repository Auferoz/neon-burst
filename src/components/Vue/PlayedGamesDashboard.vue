<script setup lang="ts">
import { computed, type Component } from 'vue';
import IconGamepad from '../Icons/IconGamepad.vue';
import IconRepeat from '../Icons/IconRepeat.vue';
import IconPauseCircle from '../Icons/IconPauseCircle.vue';
import IconCheckCircle from '../Icons/IconCheckCircle.vue';
import IconTrophy from '../Icons/IconTrophy.vue';
import IconXCircle from '../Icons/IconXCircle.vue';

const props = defineProps<{
  games: { estado: string }[];
}>();

const stats = computed(() => {
  const counts: Record<string, number> = {};
  for (const g of props.games) {
    counts[g.estado] = (counts[g.estado] || 0) + 1;
  }

  return [
    {
      label: 'Jugando',
      count: counts['Jugando'] || 0,
      icon: IconGamepad as Component,
      bg: 'bg-neon-blue/10',
      border: 'border-neon-blue/25',
      text: 'text-neon-blue',
    },
    {
      label: 'Recurrente',
      count: counts['Recurrente'] || 0,
      icon: IconRepeat as Component,
      bg: 'bg-neon-purple/10',
      border: 'border-neon-purple/25',
      text: 'text-neon-purple',
    },
    {
      label: 'Pausado',
      count: counts['Pausado'] || 0,
      icon: IconPauseCircle as Component,
      bg: 'bg-neon-yellow/10',
      border: 'border-neon-yellow/25',
      text: 'text-neon-yellow',
    },
    {
      label: 'Terminado',
      count: counts['Terminado'] || 0,
      icon: IconCheckCircle as Component,
      bg: 'bg-neon-green/10',
      border: 'border-neon-green/25',
      text: 'text-neon-green',
    },
    {
      // Completado es el 100% de logros: por eso el trofeo y no el check
      label: 'Completado',
      count: counts['Completado'] || 0,
      icon: IconTrophy as Component,
      bg: 'bg-neon-gold/10',
      border: 'border-neon-gold/25',
      text: 'text-neon-gold',
    },
    {
      label: 'Abandonado',
      count: counts['Abandonado'] || 0,
      icon: IconXCircle as Component,
      bg: 'bg-neon-pink/10',
      border: 'border-neon-pink/25',
      text: 'text-neon-pink',
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-2" role="list" aria-label="Resumen de estados">
    <div
      v-for="stat in stats"
      :key="stat.label"
      role="listitem"
      :aria-label="`${stat.count} juegos ${stat.label.toLowerCase()}`"
      :class="[stat.bg, stat.border]"
      class="relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden"
    >
      <div :class="stat.text" class="shrink-0" aria-hidden="true">
        <component :is="stat.icon" :size="20" />
      </div>
      <div class="min-w-0">
        <div :class="stat.text" class="text-lg lg:text-xl font-bold leading-none mb-0.5">
          {{ stat.count }}
        </div>
        <div class="text-[11px] lg:text-xs text-text-secondary truncate">
          {{ stat.label }}
        </div>
      </div>
    </div>
  </div>
</template>
