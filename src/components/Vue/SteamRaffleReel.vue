<script setup lang="ts">
/**
 * Slot-machine reel of the Steam raffle. Receives the frozen pool and a
 * schedule already computed by `buildReelSchedule` (the winner was chosen
 * before, so this component only plays the animation). Emits `done` once it
 * has landed; every timer is cleared on unmount, which is also how the parent
 * stops the reel (Escape).
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import type { RaffleGame, ReelStep } from '../../utils/steamRaffle';

const props = defineProps<{
  pool: RaffleGame[];
  schedule: ReelStep[];
}>();

const emit = defineEmits<{ done: [] }>();

const LANDING_MS = 900;

const step = ref(0);
const landed = ref(false);
let timer: ReturnType<typeof setTimeout> | undefined;

const current = computed(() => props.pool[props.schedule[step.value]?.index ?? 0]);

function preload() {
  const seen = new Set<string>();
  for (const s of props.schedule) {
    const url = props.pool[s.index]?.poster;
    if (url && !seen.has(url)) {
      seen.add(url);
      new Image().src = url;
    }
  }
}

function advance() {
  const next = step.value + 1;
  if (next >= props.schedule.length) {
    landed.value = true;
    timer = setTimeout(() => emit('done'), LANDING_MS);
    return;
  }
  step.value = next;
  timer = setTimeout(advance, props.schedule[next].delayMs);
}

onMounted(() => {
  preload();
  timer = setTimeout(advance, props.schedule[0]?.delayMs ?? 0);
});

onBeforeUnmount(() => clearTimeout(timer));
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-5 py-6">
    <p class="text-xs text-neon-cyan tracking-widest uppercase animate-pulse" aria-hidden="true">
      {{ landed ? 'Elegido' : 'Sorteando...' }}
    </p>

    <div
      class="raffle-frame relative w-44 sm:w-52 aspect-3/4 rounded-xl border-2 border-neon-cyan bg-surface-2 overflow-hidden"
      :class="{ 'raffle-landed': landed }"
      aria-hidden="true"
    >
      <img
        v-if="current?.poster"
        :key="current.appid"
        :src="current.poster"
        alt=""
        class="w-full h-full object-cover"
      />
      <div
        v-else
        class="w-full h-full flex items-center justify-center p-3 text-center text-sm font-semibold text-text-primary"
      >
        {{ current?.name }}
      </div>
      <div class="raffle-scanlines absolute inset-0 pointer-events-none"></div>
    </div>

    <p class="text-sm text-text-primary font-semibold text-center max-w-xs min-h-10 line-clamp-2" aria-hidden="true">
      {{ current?.name }}
    </p>

    <button
      type="button"
      class="px-3 py-1.5 text-xs text-text-secondary border border-border-default rounded-lg hover:text-text-primary hover:border-border-hover transition-colors cursor-pointer"
      @click="emit('done')"
    >
      Saltar animación
    </button>
  </div>
</template>

<style scoped>
.raffle-frame {
  box-shadow: 0 0 18px rgb(0 229 255 / 0.45), inset 0 0 12px rgb(0 229 255 / 0.2);
}

.raffle-scanlines {
  background: repeating-linear-gradient(to bottom, transparent 0 2px, rgb(0 0 0 / 0.18) 2px 4px);
}

.raffle-landed {
  animation: raffle-flash 0.9s ease-out both;
}

@keyframes raffle-flash {
  0% { box-shadow: 0 0 60px 20px rgb(0 229 255 / 0.9); filter: brightness(2.2); }
  15% { filter: brightness(0.6); }
  30% { filter: brightness(1.6); }
  45% { filter: brightness(0.8); }
  100% { box-shadow: 0 0 30px 8px rgb(0 229 255 / 0.7); filter: brightness(1); }
}

@media (prefers-reduced-motion: reduce) {
  .raffle-landed {
    animation: none;
  }
}
</style>
