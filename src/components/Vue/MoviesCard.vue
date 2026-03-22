<script setup lang="ts">
interface Movie {
  trakt_id: number;
  tmdb_id: number;
  imdb_id: string;
  title: string;
  year: number;
  released: string;
  runtime: number;
  genres: string;
  overview: string;
  rating: number;
  poster: string;
  list_slug: string;
}

const props = defineProps<{
  movie: Movie;
}>();

function formatRuntime(minutes: number): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function ratingColor(rating: number): string {
  if (rating >= 7) return 'text-neon-green border-neon-green/30 bg-neon-green/10';
  if (rating >= 5) return 'text-neon-yellow border-neon-yellow/30 bg-neon-yellow/10';
  return 'text-neon-pink border-neon-pink/30 bg-neon-pink/10';
}

const genres = props.movie.genres
  ? props.movie.genres.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)
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
    :aria-label="`${movie.title} (${movie.year}), ${formatRuntime(movie.runtime)}, rating ${movie.rating}`"
    class="group relative border border-border-default rounded-xl overflow-hidden transition-all duration-200 hover:border-border-hover h-full flex flex-col"
  >
    <!-- Poster background (decorative) -->
    <div
      v-if="movie.poster"
      class="absolute inset-0 z-0"
      aria-hidden="true"
    >
      <img
        :src="movie.poster"
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
          v-if="movie.poster"
          :src="movie.poster"
          :alt="`Poster de ${movie.title}`"
          @error="onPosterError"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-[2/3] bg-surface-3"
          loading="lazy"
          width="96"
          height="144"
        />
        <div
          :style="movie.poster ? 'display:none' : ''"
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
        <!-- Title + Year -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
            {{ movie.title }}
          </h3>
          <span class="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-md border text-neon-emerald border-neon-emerald/30 bg-neon-emerald/10">
            {{ movie.year }}
          </span>
        </div>

        <!-- Meta: runtime + released -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span v-if="movie.runtime">{{ formatRuntime(movie.runtime) }}</span>
          <template v-if="movie.runtime && movie.released">
            <span class="text-surface-4" aria-hidden="true">&middot;</span>
          </template>
          <span v-if="movie.released">{{ movie.released }}</span>
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

        <!-- Rating + Links -->
        <div class="flex items-center justify-between">
          <span
            v-if="movie.rating"
            :class="ratingColor(movie.rating)"
            class="text-[10px] font-bold px-2 py-0.5 rounded-md border"
          >
            {{ movie.rating.toFixed(1) }}
          </span>
          <div class="flex items-center gap-1.5">
            <a
              v-if="movie.imdb_id"
              :href="`https://www.imdb.com/title/${movie.imdb_id}`"
              target="_blank"
              rel="noopener noreferrer"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-yellow hover:bg-neon-yellow/10 transition-colors cursor-pointer"
              :aria-label="`Ver ${movie.title} en IMDB`"
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
