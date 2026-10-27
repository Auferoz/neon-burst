<script setup lang="ts">
/**
 * Pestaña "Por comprar" de /nextGames. Container: carga `/api/wishlist` (con el
 * precio en vivo de Steam), alta manual por URL/appid y bajas. Los destacados
 * entran solos desde el server; quitar uno acá también lo desmarca y avisa con
 * `unfeatured` para que la pestaña de lanzamientos se actualice.
 */
import { ref, computed, onMounted } from 'vue';
import WishlistCard from './WishlistCard.vue';
import WishlistImportModal from './WishlistImportModal.vue';
import {
  defaultWishlistFilters,
  filterWishlist,
  formatClp,
  hasActiveWishlistFilters,
  PRICE_BUCKETS,
  sortWishlist,
  wishlistReleaseYears,
  wishlistSummary,
  type WishlistFilters,
  type WishlistItem,
  type WishlistSort,
} from '../../utils/wishlist';

const emit = defineEmits<{ unfeatured: [igdbId: number]; count: [n: number] }>();

const items = ref<WishlistItem[]>([]);
const loading = ref(true);
const error = ref('');

const query = ref('');
const adding = ref(false);
const addError = ref('');
const busyId = ref<number | null>(null);
const importOpen = ref(false);
const announcement = ref('');

const sortBy = ref<WishlistSort>('recent');
const filters = ref<WishlistFilters>(defaultWishlistFilters());

const now = Date.now() / 1000;

const filtered = computed(() => filterWishlist(items.value, filters.value, now));
const sorted = computed(() => sortWishlist(filtered.value, sortBy.value));
// The summary describes what is on screen, so it follows the filters.
const summary = computed(() => wishlistSummary(filtered.value));
const onSaleCount = computed(() => items.value.filter(i => i.price && i.price.discount > 0).length);
const releaseYears = computed(() => wishlistReleaseYears(items.value, now));
const filtersActive = computed(() => hasActiveWishlistFilters(filters.value));

function resetFilters() {
  filters.value = defaultWishlistFilters();
}

function setItems(next: WishlistItem[]) {
  items.value = next;
  emit('count', next.length);
}

async function load() {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/wishlist', { cache: 'no-store' });
    if (!res.ok) throw new Error('Error al cargar la lista');
    setItems(await res.json());
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}

async function add() {
  const q = query.value.trim();
  if (!q || adding.value) return;
  adding.value = true;
  addError.value = '';
  try {
    const res = await fetch('/api/wishlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data as { error?: string }).error || `Error ${res.status}`);
    const item = data as WishlistItem;
    setItems([...items.value, item]);
    query.value = '';
    announcement.value = `${item.name} agregado a la lista`;
  } catch (e) {
    addError.value = (e as Error).message;
  } finally {
    adding.value = false;
  }
}

async function remove(item: WishlistItem) {
  busyId.value = item.id;
  try {
    const res = await fetch(`/api/wishlist/${item.id}`, { method: 'DELETE' });
    if (!res.ok && res.status !== 404) throw new Error();
    const data = (await res.json().catch(() => ({}))) as { igdb_id?: number | null };
    setItems(items.value.filter(i => i.id !== item.id));
    if (data.igdb_id) emit('unfeatured', data.igdb_id);
    announcement.value = `${item.name} quitado de la lista`;
  } catch {
    announcement.value = `No se pudo quitar ${item.name}`;
  } finally {
    busyId.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="space-y-6">
    <div class="sr-only" aria-live="polite" role="status">{{ announcement }}</div>

    <!-- Add + summary -->
    <div class="space-y-3">
      <h2 class="text-sm font-semibold text-text-primary">Agregar juego</h2>
      <form class="flex flex-wrap items-start gap-3" @submit.prevent="add">
        <div class="w-full sm:w-96">
          <input
            v-model="query"
            type="text"
            placeholder="URL de la tienda de Steam o appid"
            aria-label="URL de la tienda de Steam o appid del juego"
            :aria-invalid="!!addError"
            aria-describedby="wishlist-add-help"
            class="w-full bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-pink/40 transition-colors"
          />
          <p v-if="addError" id="wishlist-add-help" class="mt-1 text-[11px] text-neon-pink" role="alert">{{ addError }}</p>
          <p v-else id="wishlist-add-help" class="mt-1 text-[11px] text-text-muted">
            Los que marques como destacados en Lanzamientos se agregan solos.
          </p>
        </div>
        <button
          type="submit"
          :disabled="adding || !query.trim()"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {{ adding ? 'Agregando...' : 'Agregar' }}
        </button>
        <button
          type="button"
          aria-haspopup="dialog"
          class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink transition-colors cursor-pointer"
          @click="importOpen = true"
        >
          Agregar lista
        </button>
      </form>
    </div>

    <div class="h-px bg-linear-to-r from-neon-pink/40 via-neon-pink/20 to-transparent"></div>

    <!-- Loading -->
    <div v-if="loading" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium animate-pulse" role="status">[ Consultando precios en Steam... ]</div>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-2" role="alert">[ Error ]</div>
      <p class="text-text-secondary text-xs">{{ error }}</p>
      <button
        type="button"
        class="mt-4 px-4 py-2 text-xs text-neon-pink border border-neon-pink/30 rounded-lg hover:bg-neon-pink/10 transition-colors cursor-pointer"
        @click="load"
      >
        Reintentar
      </button>
    </div>

    <!-- Empty -->
    <div v-else-if="items.length === 0" class="border border-dashed border-neon-pink/20 rounded-xl p-10 sm:p-14 text-center">
      <div class="text-sm text-neon-pink font-medium mb-3">[ Lista vacía ]</div>
      <p class="text-text-secondary text-xs">Destaca un lanzamiento o pega la URL de un juego de Steam.</p>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="space-y-3">
        <h2 class="text-sm font-semibold text-text-primary">Filtros</h2>
        <div class="flex flex-wrap items-center gap-3">
          <input
            v-model="filters.query"
            type="search"
            placeholder="Buscar por nombre..."
            aria-label="Buscar en la lista por nombre"
            class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-neon-pink/40 transition-colors w-full sm:w-64"
          />
          <select
            v-model="filters.price"
            aria-label="Filtrar por precio"
            class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
          >
            <option value="">Todos los precios</option>
            <option v-for="b in PRICE_BUCKETS" :key="b.value" :value="b.value">{{ b.label }}</option>
            <option value="none">Sin precio</option>
          </select>
          <select
            v-model="filters.release"
            aria-label="Filtrar por fecha de salida"
            class="bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
          >
            <option value="">Cualquier fecha</option>
            <option value="released">Ya lanzados</option>
            <option value="upcoming">Por lanzar</option>
            <option v-for="y in releaseYears" :key="y" :value="String(y)">Salida en {{ y }}</option>
          </select>
          <button
            type="button"
            :aria-pressed="filters.onSale"
            class="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border rounded-lg transition-colors cursor-pointer"
            :class="filters.onSale
              ? 'text-neon-pink border-neon-pink/40 bg-neon-pink/10'
              : 'text-text-secondary border-border-default hover:text-neon-pink hover:border-neon-pink/30 hover:bg-neon-pink/5'"
            @click="filters.onSale = !filters.onSale"
          >
            En oferta
            <span v-if="onSaleCount > 0" class="text-neon-pink font-semibold">{{ onSaleCount }}</span>
          </button>
          <button
            v-if="filtersActive"
            type="button"
            class="text-[11px] text-text-secondary underline hover:text-neon-pink cursor-pointer"
            @click="resetFilters"
          >
            Limpiar filtros
          </button>
          <span class="text-[11px] text-text-secondary ml-auto">{{ filtered.length }} de {{ items.length }}</span>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-secondary">
        <span><span class="text-neon-pink font-semibold">{{ filtered.length }}</span> juegos</span>
        <span v-if="summary.priced > 0">
          Total <span class="text-neon-pink font-semibold">{{ formatClp(summary.total) }}</span>
          <span v-if="summary.priced < filtered.length" class="text-text-muted"> ({{ summary.priced }} con precio)</span>
        </span>
        <span v-if="summary.onSale > 0">
          <span class="text-neon-pink font-semibold">{{ summary.onSale }}</span> en oferta
        </span>
        <select
          v-model="sortBy"
          aria-label="Ordenar la lista"
          class="ml-auto bg-surface-2 border border-border-default rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-neon-pink/40 transition-colors cursor-pointer"
        >
          <option value="recent">Agregados recientemente</option>
          <option value="discount">Mayor descuento</option>
          <option value="price">Menor precio</option>
        </select>
      </div>

      <div v-if="filtered.length === 0" class="border border-dashed border-neon-pink/20 rounded-xl p-10 text-center">
        <div class="text-sm text-text-secondary font-medium">Sin resultados para los filtros aplicados</div>
      </div>

      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4" role="list" aria-label="Juegos por comprar">
        <WishlistCard
          v-for="item in sorted"
          :key="item.id"
          :item="item"
          :busy="busyId === item.id"
          @remove="remove"
        />
      </div>
    </template>

    <WishlistImportModal :open="importOpen" @close="importOpen = false" @imported="load" />
  </div>
</template>
