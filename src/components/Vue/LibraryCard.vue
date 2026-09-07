<script setup lang="ts">
import { computed } from 'vue';
import { igdbImage } from '../../utils/igdbImage';
import { storeBadge } from '../../data/stores';
import { MISSING_LABELS, type LibraryGame, type LibraryGroup } from '../../utils/libraryGrouping';
import IconGamepad from '../Icons/IconGamepad.vue';
import IconCalendar from '../Icons/IconCalendar.vue';

const props = defineProps<{ group: LibraryGroup }>();
defineEmits<{ edit: [LibraryGame]; remove: [LibraryGame] }>();

const game = computed(() => props.group.primary);
const posterUrl = computed(() => igdbImage(game.value.poster, 'cover_big'));
const artworkUrl = computed(() => igdbImage(game.value.artworks, 'screenshot_big'));
const genres = computed(() =>
  game.value.genre ? game.value.genre.split(',').map((g) => g.trim()).filter(Boolean).slice(0, 3) : [],
);

/** Multi-store groups need per-copy actions; a single copy keeps the plain button row. */
const isMultiStore = computed(() => props.group.entries.length > 1);
const missingLabels = computed(() => props.group.missing.map((f) => MISSING_LABELS[f]));

function hideBroken(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
}
</script>

<template>
  <article
    role="listitem"
    class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col hover:border-neon-yellow/40"
    :class="{ 'border-neon-pink/30': group.missing.length > 0 }"
  >
    <!-- Blurred artwork backdrop -->
    <div
      v-if="artworkUrl"
      class="absolute inset-0 opacity-20 group-hover:opacity-30 transition-opacity duration-300"
    >
      <img
        :src="artworkUrl"
        alt=""
        aria-hidden="true"
        class="w-full h-full object-cover blur-[2px]"
        @error="hideBroken"
      />
    </div>
    <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/90 to-surface-0/70"></div>

    <div class="relative z-10 flex gap-4 p-3 flex-1">
      <!-- Cover -->
      <div class="shrink-0 w-16 h-22 rounded-lg overflow-hidden bg-surface-3 flex items-center justify-center">
        <img
          v-if="posterUrl"
          :src="posterUrl"
          :alt="game.title"
          class="w-full h-full object-cover"
          loading="lazy"
          @error="hideBroken"
        />
        <IconGamepad v-else :size="22" class="text-text-muted" />
      </div>

      <div class="flex-1 min-w-0 flex flex-col">
        <h3 class="text-sm font-semibold text-text-primary leading-tight line-clamp-2 mb-1">
          {{ game.title }}
        </h3>

        <!-- One badge per store this game is owned on -->
        <div class="flex flex-wrap gap-1 mb-1.5" role="list" aria-label="Tiendas">
          <span
            v-for="s in group.stores"
            :key="s"
            role="listitem"
            class="text-[10px] font-medium px-2 py-0.5 rounded-full border"
            :class="storeBadge(s)"
          >{{ s }}</span>
        </div>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span v-if="game.companie" class="truncate max-w-[60%]">{{ game.companie }}</span>
          <span v-if="game.released" class="inline-flex items-center gap-1">
            <IconCalendar :size="11" />{{ game.released }}
          </span>
          <span v-if="!isMultiStore && game.owned_via" class="text-text-muted">
            · {{ game.owned_via }}
          </span>
        </div>

        <div v-if="genres.length" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span
            v-for="g in genres"
            :key="g"
            role="listitem"
            class="text-[10px] px-1.5 py-0.5 rounded bg-surface-3 text-text-muted"
          >{{ g }}</span>
        </div>

        <!-- Names exactly what IGDB could not fill, so the fix is obvious -->
        <p
          v-if="missingLabels.length"
          class="text-[10px] text-neon-pink/90 mb-2"
          :title="`Sin datos: ${missingLabels.join(', ')}`"
        >
          ⚠ Falta: {{ missingLabels.join(' · ') }}
        </p>

        <p v-if="game.notes" class="text-[11px] text-text-muted italic line-clamp-2 mb-2">
          {{ game.notes }}
        </p>

        <div class="flex-1"></div>

        <!-- Single copy: plain actions. Several copies: one row per store. -->
        <div v-if="!isMultiStore" class="flex items-center gap-2">
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

        <ul v-else class="space-y-1 border-t border-border-default pt-2">
          <li
            v-for="entry in group.entries"
            :key="entry.id"
            class="flex items-center gap-2 text-[11px]"
          >
            <span class="text-text-secondary truncate">{{ entry.store }}</span>
            <span v-if="entry.owned_via" class="text-text-muted shrink-0">· {{ entry.owned_via }}</span>
            <button
              type="button"
              class="ml-auto shrink-0 px-1.5 py-0.5 rounded border border-border-default text-text-muted hover:text-neon-yellow hover:border-neon-yellow/40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-yellow"
              :aria-label="`Editar ${entry.title} en ${entry.store}`"
              @click="$emit('edit', entry)"
            >Editar</button>
            <button
              type="button"
              class="shrink-0 px-1.5 py-0.5 rounded border border-border-default text-text-muted hover:text-neon-pink hover:border-neon-pink/40 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-neon-pink"
              :aria-label="`Borrar ${entry.title} de ${entry.store}`"
              @click="$emit('remove', entry)"
            >Borrar</button>
            <a
              v-if="entry.store_url"
              :href="entry.store_url"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 text-text-muted hover:text-neon-yellow transition-colors"
              :aria-label="`Abrir ${entry.title} en ${entry.store}`"
            >↗</a>
          </li>
        </ul>
      </div>
    </div>
  </article>
</template>
