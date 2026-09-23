/**
 * Opciones de estado compartidas entre `SeriesFormModal.vue` (alta) y
 * `SeriesEntriesModal.vue` (edición desde la ficha), para no duplicar la
 * lista en dos lugares.
 */
export const SERIES_STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'ongoing', label: 'Ongoing' },
] as const;
