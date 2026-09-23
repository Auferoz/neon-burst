<script setup lang="ts">
/**
 * The actual navigation content (views + projects + labels). Rendered both
 * in the desktop column and inside the mobile drawer by TodoSidebar.vue.
 */
import { ref, computed, inject, nextTick } from 'vue';
import { TODO_STORE_KEY } from './useTodoStore';
import { groupForToday } from '../../../utils/todo/taskQueries';
import { projectColorDot, PROJECT_COLOR_OPTIONS } from '../../../utils/todo/priorityStyles';
import { localToday } from './clientDate';

const props = defineProps<{ currentView: string }>();
const emit = defineEmits<{ navigate: [string] }>();

const store = inject(TODO_STORE_KEY)!;
const today = localToday();

// Top-level only: subtasks live inside their parent's card, so counting them
// would disagree with the list views ("Bandeja 3" vs "2 tareas").
const openTasks = computed(() => store.tasks.value.filter((t) => t.completed_at == null && t.parent_id == null));
const inboxCount = computed(() => openTasks.value.filter((t) => t.project_id === store.inbox.value?.id).length);
const todayGroup = computed(() => groupForToday(openTasks.value, today));
const todayCount = computed(() => todayGroup.value.overdue.length + todayGroup.value.today.length);
const hasOverdue = computed(() => todayGroup.value.overdue.length > 0);

const nonInboxProjects = computed(() => store.projects.value.filter((p) => p.is_inbox !== 1 && p.archived !== 1));

function countForProject(id: number) {
  return openTasks.value.filter((t) => t.project_id === id).length;
}

function itemClass(active: boolean) {
  return [
    'flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm border transition-colors cursor-pointer',
    active ? 'text-neon-green bg-neon-green/10 border-neon-green/20' : 'text-text-secondary border-transparent hover:text-text-primary hover:bg-surface-3/60',
  ];
}

function go(view: string) {
  emit('navigate', view);
}

const newProjectOpen = ref(false);
const newProjectName = ref('');
const newProjectColor = ref('green');
const newProjectInput = ref<HTMLInputElement | null>(null);

function openNewProject() {
  newProjectOpen.value = !newProjectOpen.value;
  if (newProjectOpen.value) nextTick(() => newProjectInput.value?.focus());
}

async function addProject() {
  const name = newProjectName.value.trim();
  if (!name) return;
  const project = await store.createProject(name, newProjectColor.value);
  if (project) {
    newProjectName.value = '';
    newProjectOpen.value = false;
    go(`project:${project.id}`);
  }
}

const newLabelOpen = ref(false);
const newLabelName = ref('');
const newLabelInput = ref<HTMLInputElement | null>(null);

function openNewLabel() {
  newLabelOpen.value = !newLabelOpen.value;
  if (newLabelOpen.value) nextTick(() => newLabelInput.value?.focus());
}

async function addLabel() {
  const name = newLabelName.value.trim();
  if (!name) return;
  const label = await store.createLabel(name);
  if (label) {
    newLabelName.value = '';
    newLabelOpen.value = false;
  }
}

async function archiveProject(id: number) {
  await store.patchProject(id, { archived: 1 });
}

async function removeProject(id: number) {
  if (!window.confirm('¿Borrar este proyecto? Sus tareas pasan a la Bandeja de entrada.')) return;
  await store.deleteProject(id);
  if (props.currentView === `project:${id}`) go('inbox');
}

async function removeLabel(id: number) {
  if (!window.confirm('¿Borrar esta etiqueta?')) return;
  await store.deleteLabel(id);
}
</script>

<template>
  <div class="space-y-5">
    <div class="space-y-1">
      <button type="button" :class="itemClass(currentView === 'inbox')" @click="go('inbox')">
        <span>Bandeja</span>
        <span v-if="inboxCount" class="text-[11px] text-text-muted">{{ inboxCount }}</span>
      </button>
      <button type="button" :class="itemClass(currentView === 'today')" @click="go('today')">
        <span>Hoy</span>
        <span v-if="todayCount" class="text-[11px]" :class="hasOverdue ? 'text-neon-pink font-semibold' : 'text-text-muted'">{{ todayCount }}</span>
      </button>
      <button type="button" :class="itemClass(currentView === 'upcoming')" @click="go('upcoming')">Próximos</button>
      <button type="button" :class="itemClass(currentView === 'dashboard')" @click="go('dashboard')">Dashboard</button>
      <button type="button" :class="itemClass(currentView === 'completed')" @click="go('completed')">Completadas</button>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between px-1">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Proyectos</p>
        <button type="button" class="text-text-muted hover:text-neon-green cursor-pointer" aria-label="Agregar proyecto" @click="openNewProject">+</button>
      </div>

      <form v-if="newProjectOpen" class="flex items-center gap-1.5 px-1" @submit.prevent="addProject">
        <select v-model="newProjectColor" aria-label="Color del proyecto" class="bg-surface-2 border border-border-default rounded-lg px-1 py-1 text-xs cursor-pointer">
          <option v-for="c in PROJECT_COLOR_OPTIONS" :key="c" :value="c">●</option>
        </select>
        <input ref="newProjectInput" v-model="newProjectName" type="text" placeholder="Nombre" aria-label="Nombre del proyecto" class="flex-1 min-w-0 bg-surface-2 border border-border-default rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-neon-green/50" />
        <button type="submit" class="text-xs text-neon-green cursor-pointer">OK</button>
      </form>

      <div v-for="p in nonInboxProjects" :key="p.id" class="group" :class="itemClass(currentView === `project:${p.id}`)" role="button" tabindex="0" @click="go(`project:${p.id}`)" @keydown.enter="go(`project:${p.id}`)">
        <span class="flex items-center gap-2 min-w-0">
          <span class="w-2 h-2 rounded-full shrink-0" :class="projectColorDot(p.color)"></span>
          <span class="truncate">{{ p.name }}</span>
        </span>
        <span class="flex items-center gap-1.5 shrink-0">
          <span v-if="countForProject(p.id)" class="text-[11px] text-text-muted">{{ countForProject(p.id) }}</span>
          <button type="button" class="opacity-0 group-hover:opacity-100 text-text-muted hover:text-neon-pink text-[11px] cursor-pointer" :aria-label="`Borrar proyecto ${p.name}`" @click.stop="removeProject(p.id)">✕</button>
        </span>
      </div>
    </div>

    <div class="space-y-1.5">
      <div class="flex items-center justify-between px-1">
        <p class="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Etiquetas</p>
        <button type="button" class="text-text-muted hover:text-neon-green cursor-pointer" aria-label="Agregar etiqueta" @click="openNewLabel">+</button>
      </div>

      <form v-if="newLabelOpen" class="flex items-center gap-1.5 px-1" @submit.prevent="addLabel">
        <input ref="newLabelInput" v-model="newLabelName" type="text" placeholder="Nombre" aria-label="Nombre de la etiqueta" class="flex-1 min-w-0 bg-surface-2 border border-border-default rounded-lg px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-neon-green/50" />
        <button type="submit" class="text-xs text-neon-green cursor-pointer">OK</button>
      </form>

      <div v-for="l in store.labels.value" :key="l.id" class="group" :class="itemClass(currentView === `label:${l.id}`)" role="button" tabindex="0" @click="go(`label:${l.id}`)" @keydown.enter="go(`label:${l.id}`)">
        <span class="truncate">@{{ l.name }}</span>
        <button type="button" class="opacity-0 group-hover:opacity-100 shrink-0 text-text-muted hover:text-neon-pink text-[11px] cursor-pointer" :aria-label="`Borrar etiqueta ${l.name}`" @click.stop="removeLabel(l.id)">✕</button>
      </div>
      <p v-if="!store.labels.value.length" class="px-2.5 text-[11px] text-text-muted">Sin etiquetas todavía.</p>
    </div>
  </div>
</template>
