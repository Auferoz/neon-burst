/**
 * "Today" for the Todo UI is always computed on the client in local time —
 * never derived from a server timestamp, so a task due today doesn't flip to
 * overdue because of a UTC offset. Sent to the API wherever it needs it
 * (completing a task, filtering by due date).
 */
export function localToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const WEEKDAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTH_LABELS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** 'YYYY-MM-DD' → 'lun 23 sep' style short label, in Spanish, no timezone math. */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = WEEKDAY_LABELS[date.getUTCDay()].slice(0, 3);
  return `${weekday} ${d} ${MONTH_LABELS[m - 1].slice(0, 3)}`;
}

export function formatDateLong(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const weekday = WEEKDAY_LABELS[date.getUTCDay()];
  return `${weekday} ${d} de ${MONTH_LABELS[m - 1]}`;
}
