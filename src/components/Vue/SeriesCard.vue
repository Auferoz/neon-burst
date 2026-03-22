<script setup lang="ts">
interface SeriesEntry {
  id: number;
  trakt_slug: string;
  season_number: number;
  year_watched: number;
  platform: string;
  status_viewed: string;
  title: string;
  year: number;
  rating: number;
  genres: string;
  network: string;
  runtime: number;
  poster: string;
  imdb_id: string;
}

const props = defineProps<{
  series: SeriesEntry;
}>();

const emit = defineEmits<{
  edit: [series: SeriesEntry];
}>();

function ratingColor(rating: number): string {
  if (rating >= 7) return 'text-neon-green border-neon-green/30 bg-neon-green/10';
  if (rating >= 5) return 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10';
  return 'text-neon-pink border-neon-pink/30 bg-neon-pink/10';
}

const genres = props.series.genres
  ? props.series.genres.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)
  : [];

function onPosterError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
  const placeholder = img.nextElementSibling as HTMLElement;
  if (placeholder) placeholder.style.display = 'flex';
}
</script>

<template>
  <article
    :aria-label="`${series.title || series.trakt_slug} T${series.season_number}, ${series.platform}`"
    class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-border-hover h-full flex flex-col"
  >
    <!-- Poster background (decorative) -->
    <div
      v-if="series.poster"
      class="absolute inset-0 z-0"
      aria-hidden="true"
    >
      <img
        :src="series.poster"
        alt=""
        class="w-full h-full object-cover scale-110 blur-md opacity-30 group-hover:opacity-40 transition-all duration-300"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>
    <div
      v-else
      class="absolute inset-0 z-0 bg-surface-1"
      aria-hidden="true"
    />

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Poster -->
      <div class="shrink-0">
        <img
          v-if="series.poster"
          :src="series.poster"
          :alt="`Poster de ${series.title || series.trakt_slug}`"
          @error="onPosterError"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-[2/3] bg-surface-3"
          loading="lazy"
          width="96"
          height="144"
        />
        <div
          :style="series.poster ? 'display:none' : ''"
          class="w-20 sm:w-24 rounded-lg aspect-[2/3] bg-surface-3 flex items-center justify-center text-text-secondary/50"
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" /><line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" /><line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="7" x2="22" y2="7" /><line x1="17" y1="17" x2="22" y2="17" />
          </svg>
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- Title + Season badge -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
            {{ series.title || series.trakt_slug }}
          </h3>
          <span class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border text-neon-indigo border-neon-indigo/30 bg-neon-indigo/10">
            T{{ series.season_number }}
          </span>
        </div>

        <!-- Meta: platform + network + year -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span v-if="series.platform" class="capitalize">{{ series.platform }}</span>
          <template v-if="series.platform && series.network">
            <span class="text-surface-4" aria-hidden="true">&middot;</span>
          </template>
          <span v-if="series.network">{{ series.network }}</span>
          <template v-if="(series.platform || series.network) && series.year">
            <span class="text-surface-4" aria-hidden="true">&middot;</span>
          </template>
          <span v-if="series.year">{{ series.year }}</span>
        </div>

        <!-- Genre tags -->
        <div v-if="genres.length" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span
            v-for="g in genres"
            :key="g"
            role="listitem"
            class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded capitalize"
          >
            {{ g }}
          </span>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Status + Rating + Actions -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5">
            <!-- Status badge -->
            <span
              :class="series.status_viewed === 'completed'
                ? 'text-neon-green border-neon-green/30 bg-neon-green/10'
                : 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10'"
              class="text-[10px] font-medium px-2 py-0.5 rounded-md border capitalize"
            >
              {{ series.status_viewed }}
            </span>
            <!-- Rating -->
            <span
              v-if="series.rating"
              :class="ratingColor(series.rating)"
              class="text-[10px] font-bold px-2 py-0.5 rounded-md border"
            >
              {{ series.rating.toFixed(1) }}
            </span>
          </div>
          <div class="flex items-center gap-1">
            <!-- Edit button -->
            <button
              @click.stop="emit('edit', series)"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-indigo hover:bg-neon-indigo/10 transition-colors cursor-pointer"
              aria-label="Editar"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <!-- Trakt link -->
            <a
              :href="`https://trakt.tv/shows/${series.trakt_slug}`"
              target="_blank"
              rel="noopener noreferrer"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-indigo hover:bg-neon-indigo/10 transition-colors cursor-pointer"
              :aria-label="`Ver ${series.title || series.trakt_slug} en Trakt`"
              @click.stop
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
