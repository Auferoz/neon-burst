<script setup lang="ts">
/**
 * Desktop: static column. Mobile: a drawer (teleported overlay), bottom
 * cleared of the floating nav via pb-nav-clearance, closed by
 * Escape/backdrop/navigating. Both wrap TodoSidebarNav so the actual
 * views/projects/labels markup lives in one place.
 */
import IconCheckSquare from '../../Icons/IconCheckSquare.vue';
import TodoSidebarNav from './TodoSidebarNav.vue';

defineProps<{ mobileOpen: boolean; currentView: string }>();
const emit = defineEmits<{ navigate: [string]; close: [] }>();

function onNavigate(view: string) {
  emit('navigate', view);
}
</script>

<template>
  <!-- Desktop column -->
  <nav class="hidden md:block w-56 shrink-0" aria-label="Navegación de Todo">
    <TodoSidebarNav :current-view="currentView" @navigate="onNavigate" />
  </nav>

  <!-- Mobile drawer -->
  <Teleport to="body">
    <div
      v-if="mobileOpen"
      class="md:hidden fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
      @click="emit('close')"
      @keydown.escape="emit('close')"
    >
      <div
        class="absolute left-0 top-0 bottom-0 w-72 max-w-[85vw] bg-surface-1 border-r border-border-default p-4 pb-nav-clearance overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Navegación de Todo"
        @click.stop
      >
        <div class="flex items-center justify-between mb-4">
          <span class="inline-flex items-center gap-2 text-sm font-semibold text-neon-green">
            <IconCheckSquare :size="18" />Todo
          </span>
          <button type="button" class="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-3 cursor-pointer" aria-label="Cerrar menú" @click="emit('close')">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
        <TodoSidebarNav :current-view="currentView" @navigate="(v) => { onNavigate(v); emit('close'); }" />
      </div>
    </div>
  </Teleport>
</template>
