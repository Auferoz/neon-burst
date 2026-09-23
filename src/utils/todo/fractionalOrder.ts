/**
 * Fractional indexing for `sort_order`: a drag & drop reorder writes the
 * midpoint between its two neighbors, so it's a single UPDATE instead of
 * renumbering the whole list.
 */

const GAP = 1000;

export function between(a: number | null, b: number | null): number {
  if (a == null && b == null) return GAP;
  if (a == null) return b! - GAP;
  if (b == null) return a + GAP;
  return (a + b) / 2;
}
