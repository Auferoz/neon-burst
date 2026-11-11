<script setup lang="ts">
/**
 * Result screen of the Steam raffle. Shows the winner with a reveal animation
 * (flash, confetti, rotating neon ring, light rays) and emits the follow-up
 * actions; the container owns the pool and the exclusions. The capture
 * ("Guardar captura") is local UI work: it renders a dedicated image with
 * `raffleCapture.ts` and hands it to the user, no state leaves this component.
 * Every animation is disabled under `prefers-reduced-motion`.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import {
  controllerLabel,
  formatHours,
  formatPlaytime,
  normalizeGenres,
  type RaffleGame,
} from '../../utils/steamRaffle';
import {
  canCopyImage,
  copyRaffleCapture,
  deliverRaffleCapture,
  renderRaffleCapture,
} from '../../utils/raffleCapture';
import SteamHeaderImage from './SteamHeaderImage.vue';

const props = defineProps<{
  game: RaffleGame;
  /** Games in the pool when it was drawn (shown on the capture). */
  poolSize: number;
}>();

const emit = defineEmits<{
  again: [];
  excludeAndAgain: [];
  backToFilters: [];
}>();

const STEAM_CDN = 'https://cdn.cloudflare.steamstatic.com/steam/apps';

const genres = computed(() => normalizeGenres(props.game.genres).slice(0, 5));
const heroSources = computed(() => {
  const all = [
    `${STEAM_CDN}/${props.game.appid}/library_hero.jpg`,
    `${STEAM_CDN}/${props.game.appid}/header.jpg`,
    props.game.poster,
  ];
  return all.filter((src, i) => src && all.indexOf(src) === i);
});

const stats = computed(() => [
  { label: 'Historia principal', value: formatHours(props.game.hltb_main) },
  { label: 'Ya jugadas', value: formatPlaytime(props.game.playtime) },
  { label: 'Control', value: controllerLabel(props.game.controller_support) },
]);

// Confetti: generated once per mount (the container re-keys this component on every draw).
const CONFETTI_COLORS = ['#00e5ff', '#ff2d95', '#b026ff', '#ffd700', '#39ff14'];
const confetti = Array.from({ length: 48 }, (_, i) => ({
  id: i,
  style: {
    left: `${Math.random() * 100}%`,
    background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    animationDelay: `${Math.random() * 0.6}s`,
    animationDuration: `${2.4 + Math.random() * 1.8}s`,
    '--drift': `${(Math.random() - 0.5) * 220}px`,
    '--spin': `${360 + Math.random() * 720}deg`,
    width: `${6 + Math.random() * 6}px`,
    height: `${10 + Math.random() * 8}px`,
  } as Record<string, string>,
}));

// ── Capture ──

type CaptureState = 'idle' | 'working' | 'done' | 'error';
const captureState = ref<CaptureState>('idle');
const captureMessage = ref('');
const copyAvailable = typeof window !== 'undefined' && canCopyImage();

async function withCapture(action: () => Promise<string>) {
  if (captureState.value === 'working') return;
  captureState.value = 'working';
  captureMessage.value = '';
  try {
    captureMessage.value = await action();
    captureState.value = 'done';
  } catch (e) {
    captureState.value = 'error';
    captureMessage.value = (e as Error).message || 'No se pudo generar la captura';
  }
}

/**
 * The image is rendered once and reused. It's pre-rendered shortly after the
 * reveal so the share sheet / clipboard (which require the click's user
 * gesture to still be active) get it without waiting.
 */
let capturePromise: Promise<Blob> | null = null;
function getCapture(): Promise<Blob> {
  if (!capturePromise) {
    capturePromise = renderRaffleCapture({ game: props.game, poolSize: props.poolSize });
    capturePromise.catch(() => { capturePromise = null; });
  }
  return capturePromise;
}

let prerenderTimer: ReturnType<typeof setTimeout> | undefined;
onMounted(() => {
  // After the reveal animation, to not compete with it.
  prerenderTimer = setTimeout(() => { getCapture().catch(() => {}); }, 1500);
});
onBeforeUnmount(() => clearTimeout(prerenderTimer));

function saveCapture() {
  const blob = getCapture();
  return withCapture(async () => {
    const outcome = await deliverRaffleCapture(await blob, props.game.name);
    if (outcome === 'shared') return 'Captura compartida';
    if (outcome === 'cancelled') return '';
    return 'Captura descargada';
  });
}

function copyCapture() {
  // Clipboard write starts synchronously in the click, with the image as a promise.
  const done = copyRaffleCapture(getCapture());
  return withCapture(async () => {
    await done;
    return 'Captura copiada al portapapeles';
  });
}

const btnMuted =
  'inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs text-text-secondary border border-border-default bg-surface-1/70 backdrop-blur rounded-lg hover:text-text-primary hover:border-neon-cyan/50 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan disabled:opacity-50 disabled:cursor-wait';
</script>

<template>
  <div class="raffle-stage relative isolate min-h-full overflow-hidden rounded-2xl border border-neon-cyan/20">
    <!-- Backdrop: blurred hero of the game + spotlight + rays -->
    <div class="absolute inset-0 -z-10" aria-hidden="true">
      <SteamHeaderImage :sources="heroSources" class="w-full h-full object-cover scale-110 blur-2xl opacity-40 saturate-150" />
      <div class="absolute inset-0 bg-linear-to-b from-surface-0/40 via-surface-0/60 to-surface-0/95"></div>
      <div class="raffle-rays absolute left-1/2 top-[38%] sm:top-1/2 sm:left-[30%]"></div>
      <div class="absolute inset-0 raffle-scanlines"></div>
    </div>

    <!-- One-shot flash + confetti -->
    <div class="raffle-flash absolute inset-0 pointer-events-none z-20" aria-hidden="true"></div>
    <div class="absolute inset-0 pointer-events-none overflow-hidden z-20" aria-hidden="true">
      <span v-for="c in confetti" :key="c.id" class="raffle-confetti" :style="c.style"></span>
    </div>

    <div class="relative z-10 flex flex-col items-center gap-6 px-4 py-6 sm:py-10 sm:flex-row sm:items-center sm:justify-center sm:gap-10">
      <!-- Poster with rotating neon ring -->
      <div class="raffle-poster-wrap relative shrink-0">
        <div class="raffle-ring absolute -inset-[5px] rounded-[1.1rem]" aria-hidden="true"></div>
        <div class="raffle-poster relative w-48 sm:w-60 aspect-3/4 rounded-xl bg-surface-2 overflow-hidden">
          <img v-if="game.poster" :src="game.poster" :alt="`Poster de ${game.name}`" class="w-full h-full object-cover" />
          <div v-else class="w-full h-full flex items-center justify-center p-3 text-center text-sm font-semibold text-text-primary">
            {{ game.name }}
          </div>
          <div class="raffle-sheen absolute inset-0" aria-hidden="true"></div>
        </div>
        <p class="raffle-badge absolute left-1/2 -bottom-4 whitespace-nowrap px-4 py-1 rounded-full text-[11px] font-extrabold tracking-[0.25em] text-[#1a1200]">
          ★ ELEGIDO ★
        </p>
      </div>

      <div class="min-w-0 max-w-md w-full text-center sm:text-left space-y-5 mt-3 sm:mt-0">
        <div class="raffle-rise" style="--d: 0.35s">
          <p class="text-[11px] font-mono text-text-muted">$ steam --sortear --resultado</p>
          <h3 class="raffle-title text-2xl sm:text-4xl font-bold leading-tight mt-1 break-words">{{ game.name }}</h3>
          <ul v-if="genres.length" class="flex flex-wrap justify-center sm:justify-start gap-1.5 mt-3" aria-label="Géneros">
            <li v-for="g in genres" :key="g" class="text-[10px] text-neon-pink border border-neon-pink/30 bg-neon-pink/10 px-2 py-0.5 rounded-full">
              {{ g }}
            </li>
          </ul>
        </div>

        <dl class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-left">
          <div
            v-for="(s, i) in stats"
            :key="s.label"
            :class="i === 2 ? 'col-span-2 sm:col-span-1' : ''"
            class="raffle-rise rounded-xl border border-neon-cyan/25 bg-surface-1/70 backdrop-blur px-3 py-2"
            :style="{ '--d': `${0.5 + i * 0.1}s` }"
          >
            <dt class="text-[10px] uppercase tracking-wider text-text-muted">{{ s.label }}</dt>
            <dd class="text-sm font-semibold text-neon-cyan mt-0.5">{{ s.value }}</dd>
          </div>
        </dl>

        <div class="raffle-rise flex flex-wrap justify-center sm:justify-start gap-2" style="--d: 0.85s">
          <a :href="`steam://run/${game.appid}`" class="raffle-play inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-surface-0 rounded-lg cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon-cyan">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3" /></svg>
            Jugar en Steam
          </a>
          <a
            :href="`https://store.steampowered.com/app/${game.appid}`"
            target="_blank"
            rel="noopener noreferrer"
            :class="btnMuted"
          >
            Ver en la tienda
          </a>
        </div>

        <div class="raffle-rise space-y-2" style="--d: 0.95s">
          <div class="flex flex-wrap justify-center sm:justify-start gap-2">
            <button type="button" :class="btnMuted" :disabled="captureState === 'working'" @click="saveCapture">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
              </svg>
              {{ captureState === 'working' ? 'Generando…' : 'Guardar captura' }}
            </button>
            <button v-if="copyAvailable" type="button" :class="btnMuted" :disabled="captureState === 'working'" @click="copyCapture">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Copiar imagen
            </button>
          </div>
          <p
            v-if="captureMessage"
            :class="captureState === 'error' ? 'text-neon-pink' : 'text-neon-green'"
            class="text-[11px]"
            :role="captureState === 'error' ? 'alert' : 'status'"
          >
            {{ captureMessage }}
          </p>
        </div>

        <div class="raffle-rise flex flex-wrap justify-center sm:justify-start gap-2 pt-1 border-t border-border-default/60" style="--d: 1.05s">
          <button type="button" :class="btnMuted" class="mt-3" @click="emit('again')">Volver a sortear</button>
          <button type="button" :class="btnMuted" class="mt-3" @click="emit('excludeAndAgain')">Sacarlo y volver a sortear</button>
          <button type="button" :class="btnMuted" class="mt-3" @click="emit('backToFilters')">Cambiar filtros</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.raffle-scanlines {
  background: repeating-linear-gradient(0deg, rgb(255 255 255 / 0.025) 0 1px, transparent 1px 4px);
}

/* Slowly rotating light rays behind the poster. */
.raffle-rays {
  width: 160vmax;
  height: 160vmax;
  translate: -50% -50%;
  background: repeating-conic-gradient(
    from 0deg,
    rgb(0 229 255 / 0.10) 0deg 6deg,
    transparent 6deg 20deg,
    rgb(255 45 149 / 0.08) 20deg 26deg,
    transparent 26deg 40deg
  );
  mask-image: radial-gradient(circle, #000 0%, transparent 45%);
  animation: raffle-spin 40s linear infinite;
}

/* Rotating conic neon ring around the poster. */
.raffle-ring {
  background: conic-gradient(from var(--angle, 0deg), #00e5ff, #b026ff, #ff2d95, #ffd700, #00e5ff);
  filter: blur(0.5px);
  box-shadow: 0 0 40px 6px rgb(0 229 255 / 0.45), 0 0 90px 10px rgb(255 45 149 / 0.25);
  animation: raffle-ring 4s linear infinite, raffle-pulse 2.2s ease-in-out infinite;
}

@property --angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}

.raffle-poster-wrap {
  perspective: 900px;
  animation: raffle-float 5s ease-in-out 1.2s infinite;
}

.raffle-poster {
  animation: raffle-reveal 0.9s cubic-bezier(0.2, 0.9, 0.25, 1.2) both;
}

.raffle-sheen {
  background: linear-gradient(115deg, transparent 30%, rgb(255 255 255 / 0.35) 45%, transparent 60%);
  background-size: 250% 100%;
  animation: raffle-sheen 1.4s ease-out 0.6s both;
}

.raffle-badge {
  background: linear-gradient(90deg, #ffb300, #ffd700, #fff3a0, #ffd700, #ffb300);
  background-size: 200% 100%;
  transform: translateX(-50%);
  box-shadow: 0 0 24px rgb(255 215 0 / 0.7);
  animation: raffle-pop 0.5s cubic-bezier(0.2, 0.9, 0.3, 1.5) 0.7s both, raffle-shimmer 2.5s linear 1.2s infinite;
}

.raffle-title {
  background: linear-gradient(90deg, #ffffff, #00e5ff 45%, #ff2d95);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 12px rgb(0 229 255 / 0.55));
}

.raffle-play {
  background: linear-gradient(90deg, #00e5ff, #b026ff, #ff2d95);
  background-size: 200% 100%;
  box-shadow: 0 0 20px rgb(0 229 255 / 0.5);
  transition: background-position 0.4s, box-shadow 0.3s, transform 0.2s;
}
.raffle-play:hover {
  background-position: 100% 0;
  box-shadow: 0 0 30px rgb(255 45 149 / 0.6);
  transform: translateY(-1px);
}

.raffle-rise {
  animation: raffle-rise 0.6s ease-out var(--d, 0s) both;
}

.raffle-flash {
  background: radial-gradient(circle at 30% 50%, rgb(255 255 255 / 0.85), rgb(0 229 255 / 0.3) 40%, transparent 70%);
  animation: raffle-flash 0.7s ease-out both;
}

.raffle-confetti {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  opacity: 0;
  animation-name: raffle-confetti;
  animation-timing-function: cubic-bezier(0.25, 0.6, 0.4, 1);
  animation-fill-mode: forwards;
}

@keyframes raffle-spin { to { rotate: 360deg; } }
@keyframes raffle-ring { to { --angle: 360deg; } }
@keyframes raffle-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}
@keyframes raffle-float {
  0%, 100% { translate: 0 0; }
  50% { translate: 0 -8px; }
}
@keyframes raffle-reveal {
  0% { opacity: 0; transform: rotateY(90deg) scale(0.6); filter: brightness(3); }
  60% { opacity: 1; transform: rotateY(-8deg) scale(1.05); filter: brightness(1.4); }
  100% { opacity: 1; transform: rotateY(0) scale(1); filter: brightness(1); }
}
@keyframes raffle-sheen {
  from { background-position: 150% 0; }
  to { background-position: -100% 0; }
}
@keyframes raffle-pop {
  from { opacity: 0; transform: translateX(-50%) scale(0.3); }
  to { opacity: 1; transform: translateX(-50%) scale(1); }
}
@keyframes raffle-shimmer {
  to { background-position: -200% 0; }
}
@keyframes raffle-rise {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes raffle-flash {
  from { opacity: 1; }
  to { opacity: 0; }
}
@keyframes raffle-confetti {
  0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0); }
  85% { opacity: 1; }
  100% { opacity: 0; transform: translate3d(var(--drift), 110vh, 0) rotate(var(--spin)); }
}

@media (prefers-reduced-motion: reduce) {
  .raffle-rays,
  .raffle-ring,
  .raffle-poster-wrap,
  .raffle-poster,
  .raffle-sheen,
  .raffle-badge,
  .raffle-rise {
    animation: none;
  }
  .raffle-flash,
  .raffle-confetti {
    display: none;
  }
}
</style>
