import { describe, it, expect } from 'vitest';
import { parseImdbRating } from '../src/services/omdb';
import {
  mergeFetchedScores,
  tmdbToScore,
  validateMovieWatchedUpdate,
  validateRatingPersonal,
  validateScoreUpdateBody,
} from '../src/services/movieScores';
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

describe('mergeFetchedScores', () => {
  const auto = { rating_tmdb: 60, rating_imdb: 65, rating_tmdb_manual: false, rating_imdb_manual: false };

  it('updates both fields when neither is manual', () => {
    expect(mergeFetchedScores(auto, { rating_tmdb: 70, rating_imdb: 75 }))
      .toEqual({ rating_tmdb: 70, rating_imdb: 75 });
  });

  it('keeps the current value when the fetch returns null (a fetch failure never erases an existing score)', () => {
    expect(mergeFetchedScores(auto, { rating_tmdb: null, rating_imdb: null }))
      .toEqual({ rating_tmdb: 60, rating_imdb: 65 });
  });

  it('never overwrites a manual field, even when the fetch returns a value', () => {
    const current = { rating_tmdb: 82, rating_imdb: 65, rating_tmdb_manual: true, rating_imdb_manual: false };
    expect(mergeFetchedScores(current, { rating_tmdb: 55, rating_imdb: 75 }))
      .toEqual({ rating_tmdb: 82, rating_imdb: 75 });
  });

  it('respects each field independently when both are manual', () => {
    const current = { rating_tmdb: 82, rating_imdb: 91, rating_tmdb_manual: true, rating_imdb_manual: true };
    expect(mergeFetchedScores(current, { rating_tmdb: 10, rating_imdb: 10 }))
      .toEqual({ rating_tmdb: 82, rating_imdb: 91 });
  });
});

describe('validateScoreUpdateBody', () => {
  it('leaves absent keys untouched', () => {
    expect(validateScoreUpdateBody({})).toEqual({ ok: true, value: {} });
    expect(validateScoreUpdateBody({ rating_personal: 80 }))
      .toEqual({ ok: true, value: { rating_personal: 80 } });
  });

  it('accepts null to clear a field', () => {
    expect(validateScoreUpdateBody({ rating_tmdb: null }))
      .toEqual({ ok: true, value: { rating_tmdb: null } });
  });

  it('accepts the three fields together, at their 0/100 edges', () => {
    expect(validateScoreUpdateBody({ rating_personal: 0, rating_tmdb: 100, rating_imdb: 0 }))
      .toEqual({ ok: true, value: { rating_personal: 0, rating_tmdb: 100, rating_imdb: 0 } });
  });

  it('rejects a value above 100', () => {
    expect(validateScoreUpdateBody({ rating_tmdb: 101 }).ok).toBe(false);
  });

  it('rejects a negative value', () => {
    expect(validateScoreUpdateBody({ rating_imdb: -1 }).ok).toBe(false);
  });

  it('rejects a non-integer number', () => {
    expect(validateScoreUpdateBody({ rating_tmdb: 7.5 }).ok).toBe(false);
  });

  it('rejects a string', () => {
    expect(validateScoreUpdateBody({ rating_imdb: '80' }).ok).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateScoreUpdateBody(null).ok).toBe(false);
    expect(validateScoreUpdateBody('nope').ok).toBe(false);
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
