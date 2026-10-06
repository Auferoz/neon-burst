import { describe, it, expect } from 'vitest';
import { igdbSlug, igdbGameUrl } from '../src/utils/igdbUrl';

describe('igdbSlug', () => {
  it('lowercases and joins words with dashes', () => {
    expect(igdbSlug('Final Fantasy VII Remake Intergrade')).toBe('final-fantasy-vii-remake-intergrade');
  });

  it('drops punctuation such as colons', () => {
    expect(igdbSlug('The Witcher 3: Wild Hunt')).toBe('the-witcher-3-wild-hunt');
  });

  it('removes apostrophes instead of splitting the word', () => {
    expect(igdbSlug("Marvel's Spider-Man")).toBe('marvels-spider-man');
    expect(igdbSlug('Assassin’s Creed')).toBe('assassins-creed');
  });

  it('turns ampersands into "and"', () => {
    expect(igdbSlug('Ratchet & Clank')).toBe('ratchet-and-clank');
  });

  it('strips diacritics', () => {
    expect(igdbSlug('Pokémon Légendes')).toBe('pokemon-legendes');
  });

  it('collapses repeated separators and trims the ends', () => {
    expect(igdbSlug('  Doom -- Eternal!  ')).toBe('doom-eternal');
  });
});

describe('igdbGameUrl', () => {
  it('builds the game page URL from the title slug', () => {
    expect(igdbGameUrl('Final Fantasy VII Remake Intergrade')).toBe(
      'https://www.igdb.com/games/final-fantasy-vii-remake-intergrade',
    );
  });

  it('returns an empty string when the title has no usable characters', () => {
    expect(igdbGameUrl('')).toBe('');
    expect(igdbGameUrl('!!!')).toBe('');
  });
});
