<script setup lang="ts">
/**
 * Refresca el detalle de un manga desde AniList del lado del navegador,
 * porque el servidor no puede: AniList bloquea las IPs de Cloudflare Workers
 * (ver src/services/anilist.ts). Se monta solo cuando getMangaDetail() marcó
 * `needs_refresh` (nunca se cargó, o sigue RELEASING y el caché tiene más de
 * 7 días). Si funciona, recarga la página una vez; si falla, no rompe nada
 * visible — el dato cacheado se queda como estaba.
 */
import { onMounted, ref } from 'vue';
import { fetchAnilistMedia } from '../../services/anilist';

const props = defineProps<{ anilistId: number }>();

const refreshing = ref(true);

function sessionKey(id: number): string {
  return `nb_manga_refreshed_${id}`;
}

onMounted(async () => {
  const key = sessionKey(props.anilistId);

  try {
    if (sessionStorage.getItem(key)) {
      // Ya se intentó en esta pestaña (falló o el reload no vino) — no reintentar en loop.
      refreshing.value = false;
      return;
    }
  } catch {
    // sessionStorage no disponible (privado estricto, etc.) — seguir sin el guard.
  }

  try {
    sessionStorage.setItem(key, '1');
  } catch {
    // noop
  }

  try {
    const media = await fetchAnilistMedia(props.anilistId);
    const res = await fetch(`/api/manga/cache/${props.anilistId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ media }),
    });
    if (res.ok) {
      window.location.reload();
      return;
    }
  } catch {
    // Sin conexión a AniList o error de red: el caché queda como estaba.
  }

  refreshing.value = false;
});
</script>

<template>
  <p v-if="refreshing" class="text-[11px] text-text-muted mt-1" aria-live="polite">Actualizando datos…</p>
</template>
