<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import IconGrid from '../Icons/IconGrid.vue';
import IconClock from '../Icons/IconClock.vue';

interface SteamGame {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  genres: string;
  released: string;
  poster: string;
  playtime: number;
  last_played: number;
  hltb_main: number | null;
  hltb_extra: number | null;
  hltb_completionist: number | null;
}

const games = ref<SteamGame[]>([]);
const loading = ref(true);
const error = ref('');

const searchQuery = ref('');
const sortBy = ref<'recent' | 'name' | 'playtime'>('recent');
const filterPlayed = ref<'all' | 'played' | 'unplayed'>('all');

const now = Date.now() / 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60;
const SIX_MONTHS = 180 * 24 * 60 * 60;

type Recency = 'recent' | 'old' | 'never';

function getRecency(lastPlayed: number): Recency {
  if (!lastPlayed) return 'never';
  const diff = now - lastPlayed;
  if (diff < THIRTY_DAYS) return 'recent';
  return 'old';
}

const recencyStyles: Record<Recency, { border: string; badge: string; badgeText: string; label: string }> = {
  recent: { border: 'border-neon-cyan/40', badge: 'bg-neon-cyan/15 text-neon-cyan', badgeText: 'text-neon-cyan', label: 'Reciente' },
  old: { border: 'border-border-default', badge: 'bg-surface-3/60 text-text-secondary', badgeText: 'text-text-secondary', label: '' },
  never: { border: 'border-border-default opacity-60', badge: 'bg-neon-pink/10 text-neon-pink', badgeText: 'text-neon-pink', label: 'Sin jugar' },
};

const filteredGames = computed(() => {
  let result = games.value;

  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    result = result.filter(g =>
      g.name.toLowerCase().includes(q) ||
      g.developer?.toLowerCase().includes(q) ||
      g.genres?.toLowerCase().includes(q)
    );
  }

  if (filterPlayed.value === 'played') {
    result = result.filter(g => g.playtime > 0);
  } else if (filterPlayed.value === 'unplayed') {
    result = result.filter(g => g.playtime === 0);
  }

  return [...result].sort((a, b) => {
    if (sortBy.value === 'name') return a.name.localeCompare(b.name);
    if (sortBy.value === 'playtime') return b.playtime - a.playtime;
    return b.last_played - a.last_played;
  });
});

const totalHours = computed(() =>
  Math.round(games.value.reduce((s, g) => s + g.playtime, 0) / 60)
);
const playedCount = computed(() => games.value.filter(g => g.playtime > 0).length);

function formatPlaytime(minutes: number): string {
  if (minutes === 0) return 'Sin jugar';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatHltb(hours: number | null): string {
  if (!hours) return '-';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatDate(timestamp: number): string {
  if (!timestamp) return 'Nunca';
  return new Date(timestamp * 1000).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function onPosterError(e: Event) {
  const img = e.target as HTMLImageElement;
  img.style.display = 'none';
  const placeholder = img.nextElementSibling as HTMLElement;
  if (placeholder) placeholder.style.display = 'flex';
}

async function fetchGames() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/steam');
    if (!res.ok) throw new Error('Error al cargar la biblioteca');
    games.value = await res.json();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

onMounted(fetchGames);
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h1 class="text-xl sm:text-2xl font-bold text-neon-cyan neon-glow-cyan leading-tight">steam_library</h1>
      <p class="text-text-secondary text-sm leading-relaxed mt-1">Tu colección completa de juegos en Steam</p>

      <!-- Totals -->
      <div v-if="!loading && games.length > 0" class="flex items-center gap-2 lg:gap-4 mt-2 text-xs text-text-secondary">
        <span class="inline-flex items-center gap-1">
          <IconGrid :size="14" class="text-neon-cyan" />
          <span class="text-neon-cyan font-semibold">{{ games.length }}</span> juegos
        </span>
        <span class="text-border-default">&middot;</span>
        <span class="inline-flex items-center gap-1">
          <IconClock :size="14" class="text-neon-cyan" />
          <span class="text-neon-cyan font-semibold">{{ totalHours.toLocaleString() }}h</span> jugadas
        </span>
        <span class="text-border-default">&middot;</span>
        <span class="inline-flex items-center gap-1"><span class="text-neon-cyan font-semibold">{{ playedCount }}</span> jugados</span>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-linear-to-r from-neon-cyan/40 via-neon-cyan/20 to-transparent"></div>

    <!-- Filters -->
    <div v-if="!loading && games.length > 0" class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
      <div class="flex flex-wrap items-center gap-3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Buscar juego, developer, género..."
          aria-label="Buscar juego por nombre, developer o género"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-cyan/40 transition-colors w-full sm:w-64"
        />
        <select
          v-model="sortBy"
          aria-label="Ordenar por"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-cyan/40 transition-colors cursor-pointer"
        >
          <option value="recent">Recientes</option>
          <option value="name">Nombre</option>
          <option value="playtime">Más jugados</option>
        </select>
        <select
          v-model="filterPlayed"
          aria-label="Filtrar por estado"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-cyan/40 transition-colors cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="played">Jugados</option>
          <option value="unplayed">Sin jugar</option>
        </select>
        <span class="text-[11px] text-text-secondary ml-auto">
          {{ filteredGames.length }} de {{ games.length }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-cyan/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-cyan font-medium animate-pulse" role="status">[ Conectando con Steam... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        @click="fetchGames"
        class="mt-4 px-4 py-2 text-xs text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="filteredGames.length === 0 && games.length > 0" class="border border-dashed border-neon-cyan/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Games grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Biblioteca de juegos Steam">
      <article
        v-for="game in filteredGames"
        :key="game.appid"
        role="listitem"
        :aria-label="`${game.name}${game.playtime > 0 ? ', ' + formatPlaytime(game.playtime) + ' jugadas' : ', sin jugar'}`"
        :class="recencyStyles[getRecency(game.last_played)].border"
        class="group relative border rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col"
      >
        <!-- Artwork background (decorative) -->
        <div class="absolute inset-0 z-0" aria-hidden="true">
          <img
            :src="`https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/header.jpg`"
            alt=""
            class="w-full h-full object-cover object-top scale-105 group-hover:opacity-30 group-hover:blur-sm transition-all duration-300"
            loading="lazy"
          />
          <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
        </div>

        <div class="relative z-10 flex gap-4 p-2 flex-1">
          <!-- Poster -->
          <div class="shrink-0">
            <img
              v-if="game.poster"
              :src="game.poster"
              :alt="`Poster de ${game.name}`"
              @error="onPosterError"
              class="w-20 sm:w-24 rounded-lg object-cover aspect-3/4 bg-surface-3"
              loading="lazy"
              width="96"
              height="128"
            />
            <div
              :style="game.poster ? 'display:none' : ''"
              class="w-20 sm:w-24 rounded-lg aspect-3/4 bg-surface-3 flex items-center justify-center text-text-secondary/50"
              aria-hidden="true"
            >
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="m9.5 2 .5 4.5M14 2l.5 4.5"/><path d="M2 10h20"/><path d="m12 14 2 2-2 2"/></svg>
            </div>
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0 flex flex-col">
            <!-- Title + Steam link + Recency -->
            <div class="flex items-start justify-between gap-2 mb-1">
              <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">
                {{ game.name }}
              </h3>
              <div class="flex items-center gap-1.5 shrink-0">
                <a
                  :href="`https://store.steampowered.com/app/${game.appid}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors cursor-pointer"
                  :aria-label="`Ver ${game.name} en Steam Store`"
                  @click.stop
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658a3.387 3.387 0 0 1 1.912-.59c.064 0 .127.003.19.008l2.861-4.142V8.91a4.528 4.528 0 0 1 4.524-4.524 4.528 4.528 0 0 1 4.524 4.524 4.528 4.528 0 0 1-4.524 4.524h-.105l-4.076 2.911c0 .052.004.105.004.159a3.392 3.392 0 0 1-3.39 3.393 3.396 3.396 0 0 1-3.322-2.727L.533 14.583A11.975 11.975 0 0 0 11.979 24c6.627 0 12.001-5.373 12.001-12S18.606 0 11.979 0zM7.54 18.21l-1.473-.61a2.54 2.54 0 0 0 4.867-.895 2.542 2.542 0 0 0-2.54-2.541c-.17 0-.335.02-.496.052l1.521.629a1.87 1.87 0 0 1-1.428 3.456l-.001-.001.05-.09zm8.4-5.878a3.02 3.02 0 0 0 3.016-3.016 3.02 3.02 0 0 0-3.016-3.016 3.02 3.02 0 0 0-3.016 3.016 3.02 3.02 0 0 0 3.016 3.016zm-.001-4.523a1.51 1.51 0 0 1 0 3.018 1.51 1.51 0 0 1 0-3.018z"/></svg>
                </a>
                <span
                  v-if="getRecency(game.last_played) !== 'old'"
                  :class="recencyStyles[getRecency(game.last_played)].badge"
                  class="text-[10px] font-medium px-2 py-0.5 rounded-md"
                >
                  {{ recencyStyles[getRecency(game.last_played)].label }}
                </span>
              </div>
            </div>

            <!-- Meta -->
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
              <span v-if="game.developer">{{ game.developer }}</span>
              <template v-if="game.developer && game.released">
                <span class="text-surface-4" aria-hidden="true">&middot;</span>
              </template>
              <span v-if="game.released">{{ game.released }}</span>
              <template v-if="(game.developer || game.released) && game.playtime > 0">
                <span class="text-surface-4" aria-hidden="true">&middot;</span>
              </template>
              <span v-if="game.playtime > 0" class="text-neon-cyan font-semibold">{{ formatPlaytime(game.playtime) }}</span>
            </div>

            <!-- Genre tags -->
            <div v-if="game.genres" class="flex flex-wrap gap-1 mb-2" role="list" aria-label="Géneros">
              <span
                v-for="g in game.genres.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)"
                :key="g"
                role="listitem"
                class="text-[10px] text-text-secondary bg-surface-3/80 px-1.5 py-0.5 rounded"
              >
                {{ g }}
              </span>
            </div>

            <!-- Spacer -->
            <div class="flex-1" />

            <!-- HLTB -->
            <div v-if="game.hltb_main || game.hltb_extra || game.hltb_completionist" aria-label="Tiempos de HowLongToBeat">
              <div class="flex justify-between text-[10px] text-text-secondary mb-1">
                <span>HowLongToBeat</span>
              </div>
              <div class="grid grid-cols-3 gap-1 text-[10px]">
                <div class="text-center" v-if="game.hltb_main">
                  <span class="text-neon-cyan font-semibold">{{ formatHltb(game.hltb_main) }}</span>
                  <span class="text-text-secondary ml-0.5">main</span>
                  <span class="sr-only">(historia principal)</span>
                </div>
                <div class="text-center" v-if="game.hltb_extra">
                  <span class="text-neon-blue font-semibold">{{ formatHltb(game.hltb_extra) }}</span>
                  <span class="text-text-secondary ml-0.5">extra</span>
                  <span class="sr-only">(contenido extra)</span>
                </div>
                <div class="text-center" v-if="game.hltb_completionist">
                  <span class="text-neon-green font-semibold">{{ formatHltb(game.hltb_completionist) }}</span>
                  <span class="text-text-secondary ml-0.5">100%</span>
                  <span class="sr-only">(completar al 100%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
