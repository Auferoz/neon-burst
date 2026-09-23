<script setup lang="ts">
defineProps<{
  accent: 'blue' | 'indigo' | 'emerald' | 'orange';
}>();

const emit = defineEmits<{ click: [] }>();

// Clases literales por acento: Tailwind escanea el código como texto y purga
// cualquier clase armada por interpolación (mismo patrón que SyncButton.vue).
const accentClasses: Record<string, string> = {
  blue: 'text-neon-blue border-neon-blue/30 hover:bg-neon-blue/10',
  indigo: 'text-neon-indigo border-neon-indigo/30 hover:bg-neon-indigo/10',
  emerald: 'text-neon-emerald border-neon-emerald/30 hover:bg-neon-emerald/10',
  orange: 'text-neon-orange border-neon-orange/30 hover:bg-neon-orange/10',
};
</script>

<template>
  <button
    type="button"
    @click="emit('click')"
    :class="accentClasses[accent]"
    class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium border rounded-lg transition-colors cursor-pointer"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
    Editar
  </button>
</template>
