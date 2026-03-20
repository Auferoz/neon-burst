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
  old: { border: 'border-border-default', badge: 'bg-surface-3/60 text-text-muted', badgeText: 'text-text-muted', label: '' },
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
  // Fallback to Steam header image
  if (!img.dataset.fallback) {
    img.dataset.fallback = '1';
    const appid = img.dataset.appid;
    img.src = `https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/header.jpg`;
  }
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
      <div v-if="!loading && games.length > 0" class="flex items-center gap-2 lg:gap-4 mt-2 text-xs text-text-muted">
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
        <span><span class="text-neon-cyan font-semibold">{{ playedCount }}</span> jugados</span>
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
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-neon-cyan/40 transition-colors w-full sm:w-64"
        />
        <select
          v-model="sortBy"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-cyan/40 transition-colors cursor-pointer"
        >
          <option value="recent">Recientes</option>
          <option value="name">Nombre</option>
          <option value="playtime">Más jugados</option>
        </select>
        <select
          v-model="filterPlayed"
          class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-cyan/40 transition-colors cursor-pointer"
        >
          <option value="all">Todos</option>
          <option value="played">Jugados</option>
          <option value="unplayed">Sin jugar</option>
        </select>
        <span class="text-[11px] text-text-muted ml-auto">
          {{ filteredGames.length }} de {{ games.length }}
        </span>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-cyan/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-cyan/60 font-medium animate-pulse">[ Conectando con Steam... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink/60 font-medium mb-2">[ Error ]</div>
      <p class="text-text-muted text-xs">{{ error }}</p>
      <button
        @click="fetchGames"
        class="mt-4 px-4 py-2 text-xs text-neon-cyan border border-neon-cyan/30 rounded-lg hover:bg-neon-cyan/10 transition-colors cursor-pointer"
      >
        Reintentar
      </button>
    </div>

    <!-- No results -->
    <div v-else-if="filteredGames.length === 0 && games.length > 0" class="border border-dashed border-neon-cyan/20 rounded-xl p-10 text-center">
      <div class="text-sm text-text-muted font-medium">Sin resultados para los filtros aplicados</div>
    </div>

    <!-- Games grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <a
        v-for="game in filteredGames"
        :key="game.appid"
        :href="`https://store.steampowered.com/app/${game.appid}`"
        target="_blank"
        rel="noopener noreferrer"
        :class="recencyStyles[getRecency(game.last_played)].border"
        class="group relative border rounded-xl overflow-hidden transition-all duration-200 hover:border-neon-cyan/40 h-full flex flex-col"
      >
        <!-- Recency badge -->
        <span
          v-if="getRecency(game.last_played) !== 'old'"
          :class="recencyStyles[getRecency(game.last_played)].badge"
          class="absolute top-2 right-2 z-10 text-[10px] font-medium px-2 py-0.5 rounded-md"
        >
          {{ recencyStyles[getRecency(game.last_played)].label }}
        </span>

        <div class="flex gap-3 p-3 flex-1">
          <!-- Poster -->
          <div class="shrink-0">
            <img
              :src="game.poster || `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.appid}/library_600x900.jpg`"
              :alt="game.name"
              :data-appid="game.appid"
              @error="onPosterError"
              class="w-20 sm:w-24 rounded-lg object-cover aspect-[2/3] bg-surface-3"
              loading="lazy"
              width="96"
              height="144"
            />
          </div>

          <!-- Info -->
          <div class="flex-1 min-w-0 flex flex-col">
            <!-- Title -->
            <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2 group-hover:text-neon-cyan transition-colors">
              {{ game.name }}
            </h3>

            <!-- Developer & Release -->
            <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[11px] text-text-muted">
              <span v-if="game.developer">{{ game.developer }}</span>
              <template v-if="game.developer && game.released">
                <span class="text-border-default">&middot;</span>
              </template>
              <span v-if="game.released">{{ game.released }}</span>
            </div>

            <!-- Genres -->
            <div v-if="game.genres" class="flex flex-wrap gap-1 mt-1.5">
              <span
                v-for="g in game.genres.split(',').map(s => s.trim()).filter(Boolean).slice(0, 3)"
                :key="g"
                class="text-[10px] text-text-muted bg-surface-3/60 px-1.5 py-0.5 rounded"
              >
                {{ g }}
              </span>
            </div>

            <!-- Spacer -->
            <div class="flex-1" />

            <!-- Playtime -->
            <div class="mt-2 text-[11px] text-text-muted">
              <div class="flex items-center justify-between">
                <span>Jugado:</span>
                <span :class="game.playtime > 0 ? 'text-neon-cyan font-semibold' : ''">
                  {{ formatPlaytime(game.playtime) }}
                </span>
              </div>
              <div v-if="game.last_played" class="flex items-center justify-between mt-0.5">
                <span>Último:</span>
                <span>{{ formatDate(game.last_played) }}</span>
              </div>
            </div>

            <!-- HLTB -->
            <div v-if="game.hltb_main || game.hltb_extra || game.hltb_completionist" class="mt-2 pt-2 border-t border-border-default/50">
              <div class="text-[10px] text-text-muted mb-1 font-medium">HowLongToBeat</div>
              <div class="grid grid-cols-3 gap-1 text-[10px]">
                <div class="text-center">
                  <div class="text-neon-cyan font-semibold">{{ formatHltb(game.hltb_main) }}</div>
                  <div class="text-text-muted">Main</div>
                </div>
                <div class="text-center">
                  <div class="text-neon-blue font-semibold">{{ formatHltb(game.hltb_extra) }}</div>
                  <div class="text-text-muted">Extra</div>
                </div>
                <div class="text-center">
                  <div class="text-neon-green font-semibold">{{ formatHltb(game.hltb_completionist) }}</div>
                  <div class="text-text-muted">100%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </a>
    </div>
  </div>
</template>
