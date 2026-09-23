/**
 * Priority → visual style, as literal Tailwind class strings (Tailwind scans
 * the source as text; classes built via interpolation get purged). Follows
 * the accent-map pattern in SyncButton.vue / NavCard.astro.
 *
 * P1 = pink (más urgente), P2 = orange, P3 = blue, P4 = muted (sin prioridad).
 */
import type { Priority } from './types';

export interface PriorityStyle {
  label: string;
  dot: string;
  text: string;
  border: string;
  bg: string;
}

export const PRIORITY_STYLES: Record<Priority, PriorityStyle> = {
  1: {
    label: 'P1',
    dot: 'bg-neon-pink',
    text: 'text-neon-pink',
    border: 'border-neon-pink/30',
    bg: 'bg-neon-pink/10',
  },
  2: {
    label: 'P2',
    dot: 'bg-neon-orange',
    text: 'text-neon-orange',
    border: 'border-neon-orange/30',
    bg: 'bg-neon-orange/10',
  },
  3: {
    label: 'P3',
    dot: 'bg-neon-blue',
    text: 'text-neon-blue',
    border: 'border-neon-blue/30',
    bg: 'bg-neon-blue/10',
  },
  4: {
    label: 'P4',
    dot: 'bg-text-muted',
    text: 'text-text-muted',
    border: 'border-border-default',
    bg: 'bg-surface-3',
  },
};

export const PRIORITY_OPTIONS: Priority[] = [1, 2, 3, 4];

/** Project color key → literal dot class. Reuses the site's neon tokens. */
export const PROJECT_COLOR_DOT: Record<string, string> = {
  blue: 'bg-neon-blue',
  cyan: 'bg-neon-cyan',
  pink: 'bg-neon-pink',
  purple: 'bg-neon-purple',
  orange: 'bg-neon-orange',
  gold: 'bg-neon-gold',
  yellow: 'bg-neon-yellow',
  green: 'bg-neon-green',
  emerald: 'bg-neon-emerald',
  indigo: 'bg-neon-indigo',
};

export const PROJECT_COLOR_OPTIONS = Object.keys(PROJECT_COLOR_DOT);

export function projectColorDot(color: string): string {
  return PROJECT_COLOR_DOT[color] ?? 'bg-text-muted';
}
