/**
 * IGDB game pages are addressed by slug (/games/<slug>), not by numeric id,
 * and the slug is not stored in `games`. It is derived from the title with
 * IGDB's own convention: lowercase ASCII, apostrophes dropped, "&" → "and",
 * any other run of non-alphanumerics → "-".
 *
 * Caveat: IGDB disambiguates duplicate titles with suffixes ("-2"), which a
 * title alone cannot reproduce.
 */
export function igdbSlug(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function igdbGameUrl(title: string): string {
  const slug = igdbSlug(title);
  return slug ? `https://www.igdb.com/games/${slug}` : '';
}
