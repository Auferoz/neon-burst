<script setup lang="ts">
import { computed } from 'vue';

interface MangaEntry {
  id: number;
  anilist_id: number;
  estado: string;
  capitulo_actual: number;
  platform: string;
  rating_personal: number | null;
  title_romaji: string;
  title_english: string;
  type: string;
  format: string;
  status: string;
  cover: string;
  cover_color: string;
  chapters: number | null;
  volumes: number | null;
  genres_json: string;
}

const props = defineProps<{
  manga: MangaEntry;
}>();

/** Cada tipo (Manga/Manhwa/Manhua) en su propio color, literal para que Tailwind no lo purgue. */
const typeClass: Record<string, string> = {
  Manga: 'text-neon-orange border-neon-orange/30 bg-neon-orange/10',
  Manhwa: 'text-neon-cyan border-neon-cyan/30 bg-neon-cyan/10',
  Manhua: 'text-neon-purple border-neon-purple/30 bg-neon-purple/10',
};

const estadoClass: Record<string, string> = {
  Leyendo: 'text-neon-blue border-neon-blue/30 bg-neon-blue/10',
  Completado: 'text-neon-gold border-neon-gold/30 bg-neon-gold/10',
  Pausado: 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10',
  Abandonado: 'text-neon-pink border-neon-pink/30 bg-neon-pink/10',
  Pendiente: 'text-text-secondary border-border-default bg-surface-2',
};

/**
 * Mismas cinco bandas que rating_personal en PlayedGamesCard.vue: es la escala
 * del usuario, no la de la crítica.
 */
function personalColor(score: number): string {
  if (score >= 90) return 'text-neon-blue';
  if (score >= 70) return 'text-neon-green';
  if (score >= 55) return 'text-neon-yellow';
  if (score >= 45) return 'text-neon-orange';
  return 'text-neon-pink';
}

const title = computed(() => props.manga.title_english || props.manga.title_romaji);

const genres = computed(() => {
  try {
    return (JSON.parse(props.manga.genres_json || '[]') as string[]).slice(0, 3);
  } catch { return []; }
});

const progressLabel = computed(() => {
  const total = props.manga.chapters;
  return `${props.manga.capitulo_actual} / ${total ?? '?'}`;
});
</script>

<template>
  <a :href="`/manga/${manga.anilist_id}`" class="block h-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-orange rounded-xl" :aria-label="`${title}, ${manga.estado}, capítulo ${manga.capitulo_actual}`">
  <article class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-border-hover h-full flex flex-col cursor-pointer">
    <!-- Cover background (decorative) -->
    <div v-if="manga.cover" class="absolute inset-0 z-0" aria-hidden="true">
      <img :src="manga.cover" alt="" class="w-full h-full object-cover scale-150 blur-md opacity-40" loading="lazy" />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>
    <div v-else class="absolute inset-0 z-0 bg-surface-1" aria-hidden="true" />

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Cover -->
      <div class="shrink-0">
        <img
          v-if="manga.cover"
          :src="manga.cover"
          :alt="`Portada de ${title}`"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-[2/3] bg-surface-3"
          :style="{ viewTransitionName: `manga-cover-${manga.anilist_id}` }"
          loading="lazy"
          width="96"
          height="144"
        />
        <div v-else class="w-20 sm:w-24 rounded-lg aspect-[2/3] bg-surface-3 flex items-center justify-center text-text-secondary/50 text-xs" aria-hidden="true">?</div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col">
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{{ title }}</h3>
          <span :class="typeClass[manga.type] || typeClass.Manga" class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border">
            {{ manga.type }}
          </span>
        </div>

        <!-- Genre tags -->
        <div v-if="genres.length" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span v-for="g in genres" :key="g" role="listitem" class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded">
            {{ g }}
          </span>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Progress -->
        <div class="text-[11px] text-text-secondary mb-2">
          Cap. {{ progressLabel }}
        </div>

        <!-- Status + Score -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <span :class="estadoClass[manga.estado] || estadoClass.Pendiente" class="text-[10px] font-medium px-2 py-0.5 rounded-md border">
              {{ manga.estado }}
            </span>
            <!-- Mi score: si no lo cargué, no aparece -->
            <template v-if="manga.rating_personal">
              <span
                :class="personalColor(manga.rating_personal)"
                class="inline-flex items-center gap-0.5 text-[10px] font-bold"
                :aria-label="`Mi score: ${manga.rating_personal} de 100`"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                  <path d="M12 2l2.9 6.26 6.6.79-4.9 4.62 1.3 6.83L12 17.2l-5.9 3.3 1.3-6.83L2.5 9.05l6.6-.79L12 2z" />
                </svg>
                {{ manga.rating_personal }}
              </span>
            </template>
          </div>
        </div>
      </div>
    </div>
  </article>
  </a>
</template>
