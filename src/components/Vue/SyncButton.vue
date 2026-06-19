<script setup lang="ts">
import { ref } from 'vue';
import IconRepeat from '../Icons/IconRepeat.vue';

const props = withDefaults(defineProps<{
  endpoint: string;
  accent?: 'indigo' | 'emerald' | 'pink' | 'cyan' | 'blue';
  label?: string;
}>(), {
  accent: 'indigo',
  label: 'Sync',
});

const emit = defineEmits<{ synced: [] }>();

type Status = 'idle' | 'loading' | 'success' | 'error';
const status = ref<Status>('idle');
const message = ref('');

const SECRET_KEY = 'nb_sync_secret';

// Static class strings so Tailwind keeps them in the bundle
const accentClasses: Record<string, string> = {
  indigo: 'text-neon-indigo border-neon-indigo/30 hover:bg-neon-indigo/10',
  emerald: 'text-neon-emerald border-neon-emerald/30 hover:bg-neon-emerald/10',
  pink: 'text-neon-pink border-neon-pink/30 hover:bg-neon-pink/10',
  cyan: 'text-neon-cyan border-neon-cyan/30 hover:bg-neon-cyan/10',
  blue: 'text-neon-blue border-neon-blue/30 hover:bg-neon-blue/10',
};

function getSecret(forcePrompt = false): string | null {
  let secret = forcePrompt ? null : localStorage.getItem(SECRET_KEY);
  if (!secret) {
    secret = window.prompt('Ingresa el CRON_SECRET para sincronizar:');
    if (secret) localStorage.setItem(SECRET_KEY, secret);
  }
  return secret;
}

async function runSync() {
  if (status.value === 'loading') return;

  const secret = getSecret(status.value === 'error');
  if (!secret) return;

  status.value = 'loading';
  message.value = '';

  try {
    const res = await fetch(`${props.endpoint}?secret=${encodeURIComponent(secret)}`);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      localStorage.removeItem(SECRET_KEY);
      status.value = 'error';
      message.value = 'Secret inválido';
      return;
    }

    if (!res.ok) {
      status.value = 'error';
      message.value = (data as any).detail || (data as any).error || 'Error al sincronizar';
      return;
    }

    status.value = 'success';
    message.value = (data as any).message || 'Sincronizado';
    emit('synced');
    setTimeout(() => {
      if (status.value === 'success') status.value = 'idle';
    }, 4000);
  } catch (e) {
    status.value = 'error';
    message.value = (e as Error).message || 'Error de red';
  }
}
</script>

<template>
  <div class="inline-flex items-center gap-2">
    <button
      @click="runSync"
      :disabled="status === 'loading'"
      :class="accentClasses[accent]"
      class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border rounded-lg transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait"
      :title="`Sincronizar catálogo (${endpoint})`"
    >
      <IconRepeat :size="14" :class="{ 'animate-spin': status === 'loading' }" />
      {{ status === 'loading' ? 'Sincronizando...' : label }}
    </button>
    <span
      v-if="status === 'success'"
      class="text-[11px] text-neon-green"
      role="status"
    >✓ {{ message }}</span>
    <span
      v-else-if="status === 'error'"
      class="text-[11px] text-neon-pink"
      role="alert"
    >✗ {{ message }}</span>
  </div>
</template>
