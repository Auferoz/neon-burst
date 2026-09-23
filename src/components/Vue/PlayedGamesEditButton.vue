<script setup lang="ts">
import { ref } from 'vue';
import EditButton from './EditButton.vue';
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
  <EditButton accent="blue" @click="showModal = true" />

  <PlayedGamesFormModal
    :open="showModal"
    :game="game as any"
    @close="showModal = false"
    @saved="onSaved"
  />
</template>
