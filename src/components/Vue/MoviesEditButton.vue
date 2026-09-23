<script setup lang="ts">
import { ref } from 'vue';
import EditButton from './EditButton.vue';
import MoviesEntriesModal from './MoviesEntriesModal.vue';

interface MovieWatchedRow {
  watched_id: number;
  year_watched: number;
  platform: string;
}

defineProps<{
  title: string;
  tmdbId: number;
  ratingPersonal: number | null;
  entries: MovieWatchedRow[];
}>();

const showModal = ref(false);
</script>

<template>
  <EditButton accent="emerald" @click="showModal = true" />

  <MoviesEntriesModal
    :open="showModal"
    :title="title"
    :tmdb-id="tmdbId"
    :rating-personal="ratingPersonal"
    :entries="entries"
    @close="showModal = false"
  />
</template>
