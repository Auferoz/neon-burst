<script setup lang="ts">
/** Card de un juego de la lista "Por comprar". Presentacional: emite `remove`. */
import { computed } from 'vue';
import IconSteam from '../Icons/IconSteam.vue';
import SteamHeaderImage from './SteamHeaderImage.vue';
import { formatClp, type WishlistItem } from '../../utils/wishlist';

const props = defineProps<{ item: WishlistItem; busy: boolean }>();
const emit = defineEmits<{ remove: [item: WishlistItem] }>();

const CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

const posterSources = computed(() => {
  const { cover, image, steam_appid } = props.item;
  return [cover, steam_appid ? `${CDN}/${steam_appid}/library_600x900.jpg` : '', image].filter(Boolean);
});

const backdropSources = computed(() => {
  const { cover, image, steam_appid } = props.item;
  return [image, steam_appid ? `${CDN}/${steam_appid}/header.jpg` : '', cover].filter(Boolean);
});

const releaseText = computed(() => {
  const { release_date, release_label } = props.item;
  if (release_date) {
    return new Date(release_date * 1000).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  return release_label;
});

const onSale = computed(() => !!props.item.price && props.item.price.discount > 0);
</script>

<template>
  <article
    role="listitem"
    :aria-label="`${item.name}${item.price ? ', ' + formatClp(item.price.final) : ''}${onSale ? ', en oferta' : ''}`"
    :class="onSale ? 'border-neon-pink/50' : 'border-border-default'"
    class="group relative border rounded-xl overflow-hidden transition-all duration-200 h-full flex flex-col hover:border-neon-pink/40"
  >
    <!-- Background (decorative) -->
    <div class="absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      <SteamHeaderImage
        :sources="backdropSources"
        class="w-full h-full object-cover object-top scale-105 group-hover:opacity-30 group-hover:blur-sm transition-all duration-300"
        loading="lazy"
      />
      <div class="absolute inset-0 bg-linear-to-t from-surface-0 via-surface-0/95 to-surface-0/85 opacity-90" />
    </div>

    <div class="relative z-10 flex gap-4 p-2 flex-1">
      <!-- Poster -->
      <div class="shrink-0">
        <SteamHeaderImage
          :sources="posterSources"
          class="w-20 sm:w-24 rounded-lg object-cover aspect-3/4 bg-surface-3"
          loading="lazy"
          width="96"
          height="128"
        >
          <template #fallback>
            <div class="w-20 sm:w-24 rounded-lg aspect-3/4 bg-surface-3 flex items-center justify-center text-text-secondary/50">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><path d="m9.5 2 .5 4.5M14 2l.5 4.5"/><path d="M2 10h20"/><path d="m12 14 2 2-2 2"/></svg>
            </div>
          </template>
        </SteamHeaderImage>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 flex flex-col">
        <div class="flex items-start justify-between gap-2 mb-1">
          <h3 class="text-sm font-semibold text-text-primary leading-snug line-clamp-2">{{ item.name }}</h3>
          <div class="flex items-center gap-1 shrink-0">
            <a
              v-if="item.steam_appid"
              :href="`https://store.steampowered.com/app/${item.steam_appid}`"
              target="_blank"
              rel="noopener noreferrer"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-cyan hover:bg-neon-cyan/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan transition-colors"
              :aria-label="`Ver ${item.name} en Steam Store`"
            >
              <IconSteam :size="14" />
            </a>
            <button
              type="button"
              :disabled="busy"
              class="w-6 h-6 flex items-center justify-center rounded-md text-text-secondary hover:text-neon-pink hover:bg-neon-pink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-pink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              :aria-label="item.source === 'featured' ? `Quitar ${item.name} de la lista y de destacados` : `Quitar ${item.name} de la lista`"
              @click="emit('remove', item)"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-text-secondary mb-2">
          <span v-if="releaseText">{{ releaseText }}</span>
          <span v-if="releaseText" class="text-surface-4" aria-hidden="true">&middot;</span>
          <span v-if="item.source === 'featured'" class="inline-flex items-center gap-1 text-neon-pink">
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 2h14a1 1 0 0 1 1 1v19.143a.5.5 0 0 1-.766.424L12 18.03l-7.234 4.536A.5.5 0 0 1 4 22.143V3a1 1 0 0 1 1-1z"/></svg>
            Destacado
          </span>
          <span v-else>Agregado a mano</span>
        </div>

        <div class="flex-1" />

        <!-- Price -->
        <div v-if="item.price" class="flex flex-wrap items-center gap-2">
          <span v-if="onSale" class="text-[11px] font-bold text-surface-0 bg-neon-pink px-1.5 py-0.5 rounded">
            -{{ item.price.discount }}%
          </span>
          <span v-if="onSale" class="text-[11px] text-text-muted line-through">
            <span class="sr-only">Antes</span> {{ formatClp(item.price.initial) }}
          </span>
          <span class="text-base font-bold" :class="onSale ? 'text-neon-pink neon-glow-pink' : 'text-text-primary'">
            {{ formatClp(item.price.final) }}
          </span>
        </div>
        <p v-else-if="item.steam_appid" class="text-[11px] text-text-muted">Sin precio en Steam todavía</p>
        <p v-else class="text-[11px] text-text-muted">No está vinculado a Steam</p>
      </div>
    </div>
  </article>
</template>
