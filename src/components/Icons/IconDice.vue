<template>
  <svg xmlns="http://www.w3.org/2000/svg" :width="size" :height="size" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <circle cx="8.5" cy="8.5" r="0.75" fill="currentColor" /><circle cx="15.5" cy="8.5" r="0.75" fill="currentColor" /><circle cx="12" cy="12" r="0.75" fill="currentColor" /><circle cx="8.5" cy="15.5" r="0.75" fill="currentColor" /><circle cx="15.5" cy="15.5" r="0.75" fill="currentColor" />
  </svg>
</template>
<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 20 });
</script>
