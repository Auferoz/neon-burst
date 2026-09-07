/**
 * Build an IGDB image URL from a bare image_id (e.g. "co26z5").
 *
 * The DB stores image ids without extension, but older rows may still carry one,
 * so it is stripped defensively. Common sizes: cover_big, cover_big_2x,
 * screenshot_big, screenshot_huge, thumb.
 */
export function igdbImage(imageId: string | null | undefined, size: string): string {
  if (!imageId) return '';
  const clean = imageId.replace(/\.\w+$/, '');
  return `https://images.igdb.com/igdb/image/upload/t_${size}/${clean}.webp`;
}
