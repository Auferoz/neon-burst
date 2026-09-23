import { describe, it, expect } from 'vitest';
import { parseImdbRating } from '../src/services/omdb';
import { tmdbToScore, validateRatingPersonal, validateMovieWatchedUpdate } from '../src/services/movieScores';
import { ratingBands } from '../src/utils/ratingBands';

describe('parseImdbRating', () => {
  it('parses a decimal string to a 0-100 score', () => {
    expect(parseImdbRating('7.8')).toBe(78);
  });

  it('parses a perfect score', () => {
    expect(parseImdbRating('10.0')).toBe(100);
  });

  it('returns null for "N/A"', () => {
    expect(parseImdbRating('N/A')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseImdbRating('')).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseImdbRating(undefined)).toBeNull();
  });
});

describe('tmdbToScore', () => {
  it('converts a 0-10 vote_average to 0-100', () => {
    expect(tmdbToScore(7.84, 120)).toBe(78);
  });

  it('returns null when vote_count is 0, not 0', () => {
    expect(tmdbToScore(0, 0)).toBeNull();
    expect(tmdbToScore(8.5, 0)).toBeNull();
  });

  it('returns null when vote_count is undefined', () => {
    expect(tmdbToScore(8.5, undefined)).toBeNull();
  });
});

describe('ratingBands', () => {
  describe('personal', () => {
    it('is pink just below 45 and orange at 45', () => {
      expect(ratingBands.personal(44)).toBe('neon-pink');
      expect(ratingBands.personal(45)).toBe('neon-orange');
    });

    it('is orange just below 55 and yellow at 55', () => {
      expect(ratingBands.personal(54)).toBe('neon-orange');
      expect(ratingBands.personal(55)).toBe('neon-yellow');
    });

    it('is yellow just below 70 and green at 70', () => {
      expect(ratingBands.personal(69)).toBe('neon-yellow');
      expect(ratingBands.personal(70)).toBe('neon-green');
    });

    it('is green just below 90 and blue at 90', () => {
      expect(ratingBands.personal(89)).toBe('neon-green');
      expect(ratingBands.personal(90)).toBe('neon-blue');
    });
  });

  describe('tmdb / imdb', () => {
    it('is pink just below 50 and yellow at 50', () => {
      expect(ratingBands.tmdb(49)).toBe('neon-pink');
      expect(ratingBands.tmdb(50)).toBe('neon-yellow');
    });

    it('is yellow just below 70 and green at 70', () => {
      expect(ratingBands.imdb(69)).toBe('neon-yellow');
      expect(ratingBands.imdb(70)).toBe('neon-green');
    });
  });
});

describe('validateRatingPersonal', () => {
  it('accepts null (clears the score)', () => {
    expect(validateRatingPersonal(null)).toEqual({ ok: true, value: null });
  });

  it('accepts an integer within 0-100', () => {
    expect(validateRatingPersonal(80)).toEqual({ ok: true, value: 80 });
    expect(validateRatingPersonal(0)).toEqual({ ok: true, value: 0 });
    expect(validateRatingPersonal(100)).toEqual({ ok: true, value: 100 });
  });

  it('rejects a value above 100', () => {
    expect(validateRatingPersonal(101).ok).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(validateRatingPersonal(-1).ok).toBe(false);
  });

  it('rejects a non-integer number', () => {
    expect(validateRatingPersonal(7.5).ok).toBe(false);
  });

  it('rejects a string', () => {
    expect(validateRatingPersonal('80').ok).toBe(false);
  });
});

describe('validateMovieWatchedUpdate', () => {
  it('accepts a valid year_watched and platform', () => {
    expect(validateMovieWatchedUpdate({ year_watched: 2024, platform: 'Netflix' }))
      .toEqual({ ok: true, value: { year_watched: 2024, platform: 'Netflix' } });
  });

  it('rejects a non-4-digit year', () => {
    expect(validateMovieWatchedUpdate({ year_watched: 999 }).ok).toBe(false);
    expect(validateMovieWatchedUpdate({ year_watched: 10000 }).ok).toBe(false);
    expect(validateMovieWatchedUpdate({ year_watched: 2024.5 }).ok).toBe(false);
    expect(validateMovieWatchedUpdate({ year_watched: '2024' }).ok).toBe(false);
  });

  it('ignores unknown fields', () => {
    expect(validateMovieWatchedUpdate({ year_watched: 2024, trakt_id: 999, foo: 'bar' }))
      .toEqual({ ok: true, value: { year_watched: 2024 } });
  });

  it('trims platform whitespace', () => {
    expect(validateMovieWatchedUpdate({ platform: '  Cine  ' }))
      .toEqual({ ok: true, value: { platform: 'Cine' } });
  });

  it('accepts an update with only platform', () => {
    expect(validateMovieWatchedUpdate({ platform: 'Cine' }))
      .toEqual({ ok: true, value: { platform: 'Cine' } });
  });

  it('rejects a non-object body', () => {
    expect(validateMovieWatchedUpdate(null).ok).toBe(false);
    expect(validateMovieWatchedUpdate('nope').ok).toBe(false);
  });
});
