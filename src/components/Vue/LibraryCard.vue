<script setup lang="ts">
import { computed } from 'vue';
import { igdbImage } from '../../utils/igdbImage';
import { storeBadge } from '../../data/stores';
import IconGamepad from '../Icons/IconGamepad.vue';
import IconCalendar from '../Icons/IconCalendar.vue';

interface LibraryGame {
  id: number;
  title: string;
  store: string;
  poster: string;
  artworks: string;
  released: string;
  companie: string;
  genre: string;
  owned_via: string;
  store_url: string;
  notes: string;
}

const props = defineProps<{ game: LibraryGame }>();
defineEmits<{ edit: [LibraryGame]; remove: [LibraryGame] }>();

const posterUrl = computed(() => igdbImage(props.game.poster, 'cover_big'));
const artworkUrl = computed(() => igdbImage(props.game.artworks, 'screenshot_big'));
const badgeClass = computed(() => storeBadge(props.game.store));
const genres = computed(() =>
  props.game.genre ? props.game.genre.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3) : [],
);

function hideBroken(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
}
</script>

<template>
  <article
    role="listitem"
    class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col hover:border-neon-yellow/40"
  >
    <!-- Blurred artwork backdrop -->
    <div v-if="artworkUrl" class="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300">
      <img :src="artworkUrl" alt="" aria-hidden="true" class="w-full h-full object-cover blur-[2px]" @error="hideBroken" />
    </div>
    <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/90 to-surface-0/70"></div>

    <div class="relative z-10 flex gap-4 p-3 flex-1">
      <!-- Cover -->
      <div class="shrink-0 w-16 h-22 rounded-lg overflow-hidden bg-surface-3 flex items-center justify-center">
        <img v-if="posterUrl" :src="posterUrl" :alt="game.title" class="w-full h-full object-cover" loading="lazy" @error="hideBroken" />
        <IconGamepad v-else :size="22" class="text-text-muted" />
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-tight line-clamp-2">
            {{ game.title }}
          </h3>
          <span
            class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full border"
            :class="badgeClass"
          >{{ game.store }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span v-if="game.companie" class="truncate max-w-[60%]">{{ game.companie }}</span>
          <span v-if="game.released" class="inline-flex items-center gap-1">
            <IconCalendar :size="11" />{{ game.released }}
          </span>
          <span v-if="game.owned_via" class="text-text-muted">· {{ game.owned_via }}</span>
        </div>

        <div v-if="genres.length" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span
            v-for="g in genres"
            :key="g"
            role="listitem"
            class="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted"
          >{{ g }}</span>
        </div>

        <p v-if="game.notes" class="text-[11px] text-text-muted italic line-clamp-2 mb-2">{{ game.notes }}</p>

        <div class="flex-1"></div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            class="text-[11px] px-2 py-1 rounded-lg border border-border-default text-text-muted hover:text-neon-yellow hover:border-neon-yellow/40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-yellow"
            @click="$emit('edit', game)"
          >Editar</button>
          <button
            type="button"
            class="text-[11px] px-2 py-1 rounded-lg border border-border-default text-text-muted hover:text-neon-pink hover:border-neon-pink/40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-pink"
            @click="$emit('remove', game)"
          >Borrar</button>
          <a
            v-if="game.store_url"
            :href="game.store_url"
            target="_blank"
            rel="noopener noreferrer"
            class="ml-auto text-[11px] text-text-muted hover:text-neon-yellow transition-colors"
            :aria-label="`Abrir ${game.title} en ${game.store}`"
          >Abrir ↗</a>
        </div>
      </div>
    </div>
  </article>
</template>
