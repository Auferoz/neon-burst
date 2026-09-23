<script setup lang="ts">
import { ref } from 'vue';
import EditButton from './EditButton.vue';
import SeriesEntriesModal from './SeriesEntriesModal.vue';

interface SeriesEntryRow {
  id: number;
  season_number: number;
  year_watched: number;
  platform: string;
  status_viewed: string;
}

defineProps<{
  title: string;
  traktSlug: string;
  ratingPersonal: number | null;
  ratingTmdb: number | null;
  ratingImdb: number | null;
  entries: SeriesEntryRow[];
}>();

const showModal = ref(false);
</script>

<template>
  <EditButton accent="indigo" @click="showModal = true" />

  <SeriesEntriesModal
    :open="showModal"
    :title="title"
    :trakt-slug="traktSlug"
    :rating-personal="ratingPersonal"
    :rating-tmdb="ratingTmdb"
    :rating-imdb="ratingImdb"
    :entries="entries"
    @close="showModal = false"
  />
</template>
