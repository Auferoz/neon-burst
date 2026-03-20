<script setup lang="ts">
import { ref } from 'vue';
import PlayedGamesFormModal from './PlayedGamesFormModal.vue';

const props = defineProps<{
  game: Record<string, unknown>;
}>();

const showModal = ref(false);

function onSaved() {
  // Reload page to reflect changes
  window.location.reload();
}
</script>

<template>
  <button
    @click="showModal = true"
    class="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-neon-blue border border-neon-blue/30 rounded-lg hover:bg-neon-blue/10 transition-colors cursor-pointer"
  >
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
    </svg>
    Editar
  </button>

  <PlayedGamesFormModal
    :open="showModal"
    :game="game as any"
    @close="showModal = false"
    @saved="onSaved"
  />
</template>
