import { describe, it, expect } from 'vitest';
import { sqlQuote, slugToSearchQuery } from '../db/scoreBackfillUtils.js';

describe('sqlQuote', () => {
  it('returns a plain string unchanged', () => {
    expect(sqlQuote('breaking-bad')).toBe('breaking-bad');
  });

  it('doubles single quotes so the literal stays valid SQL', () => {
    expect(sqlQuote("marvel's-agents-of-s.h.i.e.l.d")).toBe("marvel''s-agents-of-s.h.i.e.l.d");
  });

  it('stringifies a non-string value', () => {
    expect(sqlQuote(42)).toBe('42');
  });
});

describe('slugToSearchQuery', () => {
  it('splits a slug with a trailing year', () => {
    expect(slugToSearchQuery('the-office-2005')).toEqual({ query: 'the office', year: 2005 });
  });

  it('leaves a slug with no year alone', () => {
    expect(slugToSearchQuery('my-hero-academia')).toEqual({ query: 'my hero academia' });
  });

  it('ignores an out-of-range trailing number', () => {
    expect(slugToSearchQuery('serie-9999')).toEqual({ query: 'serie 9999' });
  });
});
