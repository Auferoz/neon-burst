<script setup lang="ts">
import { computed } from 'vue';

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
      icon: 'playing',
      color: 'neon-blue',
      bg: 'bg-neon-blue/10',
      border: 'border-neon-blue/25',
      text: 'text-neon-blue',
    },
    {
      label: 'Pausado',
      count: counts['Pausado'] || 0,
      icon: 'paused',
      color: 'neon-yellow',
      bg: 'bg-neon-yellow/10',
      border: 'border-neon-yellow/25',
      text: 'text-neon-yellow',
    },
    {
      label: 'Completado',
      count: counts['Completado'] || 0,
      icon: 'completed',
      color: 'neon-green',
      bg: 'bg-neon-green/10',
      border: 'border-neon-green/25',
      text: 'text-neon-green',
    },
    {
      label: 'Abandonado',
      count: counts['Abandonado'] || 0,
      icon: 'abandoned',
      color: 'neon-pink',
      bg: 'bg-neon-pink/10',
      border: 'border-neon-pink/25',
      text: 'text-neon-pink',
    },
  ];
});
</script>

<template>
  <div class="grid grid-cols-2 lg:grid-cols-4 gap-2" role="list" aria-label="Resumen de estados">
    <div
      v-for="stat in stats"
      :key="stat.label"
      role="listitem"
      :aria-label="`${stat.count} juegos ${stat.label.toLowerCase()}`"
      :class="[stat.bg, stat.border]"
      class="relative border rounded-lg px-3 py-2 flex items-center gap-2 transition-colors duration-200 overflow-hidden"
    >
      <!-- Icon -->
      <div :class="stat.text" class="shrink-0" aria-hidden="true">
        <!-- Jugando: gamepad -->
        <svg v-if="stat.icon === 'playing'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="6" y1="11" x2="10" y2="11" /><line x1="8" y1="9" x2="8" y2="13" />
          <line x1="15" y1="12" x2="15.01" y2="12" /><line x1="18" y1="10" x2="18.01" y2="10" />
          <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.544-.604-6.584-.685-7.258-.007-.05-.011-.1-.017-.151A4 4 0 0 0 17.32 5z" />
        </svg>

        <!-- Pausado: pause circle -->
        <svg v-else-if="stat.icon === 'paused'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="10" y1="15" x2="10" y2="9" /><line x1="14" y1="15" x2="14" y2="9" />
        </svg>

        <!-- Completado: check circle -->
        <svg v-else-if="stat.icon === 'completed'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
        </svg>

        <!-- Abandonado: x circle -->
        <svg v-else-if="stat.icon === 'abandoned'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>

      <!-- Text -->
      <div class="min-w-0">
        <div :class="stat.text" class="text-lg lg:text-xl font-bold leading-none mb-0.5">
          {{ stat.count }}
        </div>
        <div class="text-[11px] lg:text-xs text-text-muted truncate">
          {{ stat.label }}
        </div>
      </div>
    </div>
  </div>
</template>
