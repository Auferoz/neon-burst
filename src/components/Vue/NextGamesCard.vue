<script setup lang="ts">
interface NextGame {
  id: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  cover: string;
  bgImage: string;
  releaseDate: number;
  platforms: string[];
  steamUrl: string;
  hypes: number;
  follows: number;
}

const props = defineProps<{
  game: NextGame;
  featured: boolean;
}>();

const emit = defineEmits<{
  toggleFeatured: [id: number];
}>();

const now = Date.now() / 1000;
const isReleased = props.game.releaseDate <= now;

const daysRemaining = isReleased
  ? 0
  : Math.ceil((props.game.releaseDate - now) / 86400);

// Border color based on proximity:
// Released → green | <7 days → bright orange | <30 days → orange | >30 days → default
type Proximity = 'released' | 'imminent' | 'soon' | 'far';

const proximity: Proximity = isReleased
  ? 'released'
  : daysRemaining <= 7
    ? 'imminent'
    : daysRemaining <= 30
      ? 'soon'
      : 'far';

const proximityBorder: Record<Proximity, string> = {
  released: 'border-neon-green/50',
  imminent: 'border-neon-yellow/60',
  soon: 'border-neon-yellow/35',
  far: 'border-border-default',
};

function formatDate(timestamp: number): string {
  if (!timestamp) return 'TBD';
  return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const platformColors: Record<string, string> = {
  PC: 'text-neon-cyan',
  PS5: 'text-neon-blue',
  PS4: 'text-neon-blue',
  XONE: 'text-neon-green',
  'Series X': 'text-neon-green',
  XSX: 'text-neon-green',
  NSW: 'text-neon-pink',
  Switch: 'text-neon-pink',
};

function getPlatformColor(platform: string): string {
  return platformColors[platform] || 'text-text-secondary';
}
</script>

<template>
  <article
    role="listitem"
    :aria-label="`${game.name}${isReleased ? ', ya lanzado' : `, faltan ${daysRemaining} días`}`"
    :class="[
      featured ? 'border-neon-pink/40' : proximityBorder[proximity],
    ]"
    class="group relative border rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col"
  >
    <!-- Background artwork (decorative) -->
    <div class="absolute inset-0 z-0" aria-hidden="true">
      <img
        v-if="game.bgImage"
        :src="game.bgImage"
        alt=""
        class="w-full h-full object-cover object-top scale-105 group-hover:opacity-30 group-hover:blur-sm transition-all duration-300"
        loading="lazy"
      />
      <div
        v-else-if="game.cover"
        class="w-full h-full"
      >
        <img
          :src="game.cover"
          alt=""
          class="w-full h-full object-cover scale-150 blur-md opacity-40"
          loading="lazy"
        />
      </div>
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Poster -->
      <div class="shrink-0">
        <img
          v-if="game.cover"
          :src="game.cover"
          :alt="`Poster de ${game.name}`"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-3/4 bg-surface-3"
          loading="lazy"
          width="96"
          height="128"
        />
        <div
          v-else
          class="w-20 sm:w-24 rounded-lg aspect-3/4 bg-surface-3 flex items-center justify-center text-text-secondary/50"
          aria-hidden="true"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="m9.5 2 .5 4.5M14 2l.5 4.5"/><path d="M2 10h20"/><path d="m12 14 2 2-2 2"/></svg>
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col">
        <!-- Title row + actions -->
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
            {{ game.name }}
          </h3>
          <div class="flex items-center gap-1 shrink-0">
            <!-- Featured toggle -->
            <button
              @click.stop="emit('toggleFeatured', game.id)"
              :aria-label="featured ? `Quitar ${game.name} de destacados` : `Marcar ${game.name} como destacado`"
              :aria-pressed="featured"
              class="w-6 h-6 flex items-center justify-center rounded-md transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink"
              :class="featured ? 'text-neon-pink hover:text-neon-pink/70' : 'text-text-secondary hover:text-neon-pink hover:bg-neon-pink/10'"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" :fill="featured ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/></svg>
            </button>
            <!-- Steam link -->
            <a
              v-if="game.steamUrl"
              :href="game.steamUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors cursor-pointer"
              :aria-label="`Ver ${game.name} en Steam Store`"
              @click.stop
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .127.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524 4.528 4.528 0 0 1 4.524 4.524 4.528 4.528 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.004.105.004.159a3.392 3.392 0 0 1-3.39 3.393 3.396 3.396 0 0 1-3.322-2.727L.533 14.583A11.975 11.975 0 0 0 11.979 24c6.627 0 12.001-5.373 12.001-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.54 2.54 0 0 0 4.867-.895 2.542 2.542 0 0 0-2.54-2.541c-.17 0-.335.02-.496.052l1.521.629a1.87 1.87 0 0 1-1.428 3.456l-.001-.001.05-.09zm8.4-5.878a3.02 3.02 0 0 0 3.016-3.016 3.02 3.02 0 0 0-3.016-3.016 3.02 3.02 0 0 0-3.016 3.016 3.02 3.02 0 0 0 3.016 3.016zm-.001-4.523a1.51 1.51 0 0 1 0 3.018 1.51 1.51 0 0 1 0-3.018z"/></svg>
            </a>
          </div>
        </div>

        <!-- Company -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-1.5">
          <span v-if="game.developer">{{ game.developer }}</span>
          <template v-if="game.developer && game.publisher && game.developer !== game.publisher">
            <span class="text-surface-4" aria-hidden="true">&middot;</span>
            <span>{{ game.publisher }}</span>
          </template>
        </div>

        <!-- Release date + countdown -->
        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] mb-2">
          <span class="text-text-secondary">{{ formatDate(game.releaseDate) }}</span>
          <span v-if="!isReleased && daysRemaining > 0" class="text-neon-pink font-semibold">
            {{ daysRemaining }}d restantes
          </span>
          <span v-else-if="isReleased" class="text-neon-green font-semibold">
            Lanzado
          </span>
        </div>

        <!-- Genre tags -->
        <div v-if="game.genres" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
          <span
            v-for="g in game.genres.replace(/Hack and slash\/Beat 'em up/gi, 'Hack & Slash').split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)"
            :key="g"
            role="listitem"
            class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded"
          >
            {{ g }}
          </span>
        </div>

        <!-- Spacer -->
        <div class="flex-1" />

        <!-- Platforms -->
        <div v-if="game.platforms.length" class="flex flex-wrap gap-1.5" role="list" aria-label="Plataformas">
          <span
            v-for="p in game.platforms.slice(0, 5)"
            :key="p"
            role="listitem"
            :class="getPlatformColor(p)"
            class="text-[10px] font-semibold"
          >
            {{ p }}
          </span>
        </div>
      </div>
    </div>
  </article>
</template>
