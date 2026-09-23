<script setup lang="ts">
defineProps<{ open: boolean }>();
const emit = defineEmits<{ close: [] }>();

const shortcuts: Array<[string, string]> = [
  ['q', 'Agregar tarea rápida'],
  ['/', 'Buscar'],
  ['g i', 'Ir a Bandeja'],
  ['g t', 'Ir a Hoy'],
  ['g u', 'Ir a Próximos'],
  ['e', 'Completar la tarea enfocada'],
  ['1-4', 'Cambiar prioridad de la tarea enfocada'],
  ['Esc', 'Cerrar panel / modal'],
  ['?', 'Mostrar esta ayuda'],
];
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      @click.self="emit('close')"
      @keydown.escape="emit('close')"
    >
      <div
        class="w-full max-w-sm bg-surface-1 border border-border-default rounded-2xl shadow-2xl p-5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-shortcuts-title"
      >
        <div class="flex items-center justify-between mb-4">
          <h2 id="todo-shortcuts-title" class="text-sm font-bold text-text-primary">Atajos de teclado</h2>
          <button type="button" class="text-text-muted hover:text-text-primary cursor-pointer" aria-label="Cerrar" @click="emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <dl class="space-y-2">
          <div v-for="[key, desc] in shortcuts" :key="key" class="flex items-center justify-between gap-3 text-xs">
            <dt><kbd class="px-1.5 py-0.5 rounded bg-surface-3 border border-border-default text-text-primary font-mono">{{ key }}</kbd></dt>
            <dd class="text-text-secondary text-right">{{ desc }}</dd>
          </div>
        </dl>
      </div>
    </div>
  </Teleport>
</template>
