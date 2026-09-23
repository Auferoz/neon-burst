<script setup lang="ts">
import { inject } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';

const store = inject(TODO_STORE_KEY)!;
</script>

<template>
  <Teleport to="body">
    <div class="fixed z-[60] left-1/2 -translate-x-1/2 bottom-[calc(var(--spacing-nav-clearance)+0.5rem)] flex flex-col items-center gap-2 pointer-events-none">
      <div
        v-if="store.undoToast.value"
        class="pointer-events-auto flex items-center gap-3 bg-surface-2 border border-border-hover rounded-lg shadow-2xl px-4 py-2.5 text-xs text-text-primary"
        role="status"
      >
        <span>{{ store.undoToast.value.message }}</span>
        <button type="button" class="text-neon-green font-semibold hover:underline cursor-pointer" @click="store.runUndo">Deshacer</button>
        <button type="button" class="text-text-muted hover:text-text-primary cursor-pointer" aria-label="Cerrar" @click="store.dismissUndo">✕</button>
      </div>

      <div
        v-if="store.errorToast.value"
        class="pointer-events-auto flex items-center gap-3 bg-neon-pink/10 border border-neon-pink/30 rounded-lg shadow-2xl px-4 py-2.5 text-xs text-neon-pink"
        role="alert"
      >
        <span>{{ store.errorToast.value }}</span>
        <button type="button" class="text-neon-pink/80 hover:text-neon-pink cursor-pointer" aria-label="Cerrar" @click="store.dismissError">✕</button>
      </div>
    </div>
  </Teleport>
</template>
