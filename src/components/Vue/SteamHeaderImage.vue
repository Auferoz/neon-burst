<script setup lang="ts">
/**
 * Imagen decorativa con cadena de respaldo: si una fuente da error pasa a la
 * siguiente, y cuando se acaban renderiza el slot `fallback`. Las fuentes salen
 * de `steamHeaderCandidates()`. Los atributos (class, loading…) van al <img>.
 */
import { ref, watch } from 'vue';

defineOptions({ inheritAttrs: false });

const props = defineProps<{ sources: string[] }>();

const index = ref(0);

watch(() => props.sources.join('|'), () => { index.value = 0; });

function next() {
  index.value++;
}
</script>

<template>
  <img
    v-if="index < sources.length"
    :key="sources[index]"
    :src="sources[index]"
    alt=""
    v-bind="$attrs"
    @error="next"
  />
  <slot v-else name="fallback" />
</template>
