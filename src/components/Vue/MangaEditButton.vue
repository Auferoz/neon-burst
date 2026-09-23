<script setup lang="ts">
import { ref } from 'vue';
import EditButton from './EditButton.vue';
import MangaFormModal from './MangaFormModal.vue';

const props = defineProps<{
  entry: Record<string, unknown>;
}>();

const showModal = ref(false);

function onSaved() {
  window.location.reload();
}

function onDeleted() {
  window.location.href = '/ListManga';
}
</script>

<template>
  <EditButton accent="orange" @click="showModal = true" />

  <MangaFormModal
    :open="showModal"
    :entry="entry as any"
    @close="showModal = false"
    @saved="onSaved"
    @deleted="onDeleted"
  />
</template>
