import { describe, it, expect } from 'vitest';
import { compareHltb, formatHltbShort, hasHltb, parseHltbSort } from '../src/utils/hltb';

type Row = { hltb_main: number | null; hltb_extra: number | null; hltb_completionist: number | null };
const row = (main: number | null, extra: number | null = null, full: number | null = null): Row => ({
  hltb_main: main,
  hltb_extra: extra,
  hltb_completionist: full,
});

describe('formatHltbShort', () => {
  it('formats whole hours', () => {
    expect(formatHltbShort(12)).toBe('12h');
  });
  it('formats hours with minutes', () => {
    expect(formatHltbShort(12.5)).toBe('12h 30m');
  });
  it('formats less than an hour as minutes', () => {
    expect(formatHltbShort(0.75)).toBe('45m');
  });
  it('carries rounded minutes into the next hour', () => {
    expect(formatHltbShort(1.999)).toBe('2h');
  });
  it('returns a dash when there is no data', () => {
    expect(formatHltbShort(null)).toBe('—');
    expect(formatHltbShort(0)).toBe('—');
    expect(formatHltbShort(Number.NaN)).toBe('—');
  });
});

describe('hasHltb', () => {
  it('is true when any of the three times exists', () => {
    expect(hasHltb(row(null, null, 40))).toBe(true);
  });
  it('is false when all three are empty or zero', () => {
    expect(hasHltb(row(null, 0, null))).toBe(false);
  });
});

describe('compareHltb', () => {
  const short = row(5, 8, 12);
  const long = row(30, 45, 80);
  const unknown = row(null, null, null);

  it('sorts ascending by the chosen field', () => {
    const sorted = [long, short].sort((a, b) => compareHltb(a, b, 'hltb_main', 'asc'));
    expect(sorted).toEqual([short, long]);
  });
  it('sorts descending by the chosen field', () => {
    const sorted = [short, long].sort((a, b) => compareHltb(a, b, 'hltb_completionist', 'desc'));
    expect(sorted).toEqual([long, short]);
  });
  it('uses the chosen field, not the others', () => {
    const a = row(10, 50, null);
    const b = row(20, 15, null);
    expect([a, b].sort((x, y) => compareHltb(x, y, 'hltb_extra', 'asc'))).toEqual([b, a]);
  });
  it('keeps games without data last in both directions', () => {
    expect([unknown, long, short].sort((a, b) => compareHltb(a, b, 'hltb_main', 'asc'))).toEqual([short, long, unknown]);
    expect([unknown, short, long].sort((a, b) => compareHltb(a, b, 'hltb_main', 'desc'))).toEqual([long, short, unknown]);
  });
  it('treats zero as no data', () => {
    const zero = row(0);
    expect([zero, short].sort((a, b) => compareHltb(a, b, 'hltb_main', 'desc'))).toEqual([short, zero]);
  });
  it('returns 0 when both lack data', () => {
    expect(compareHltb(unknown, row(0), 'hltb_main', 'asc')).toBe(0);
  });
});

describe('parseHltbSort', () => {
  it('parses a valid sort key', () => {
    expect(parseHltbSort('hltb_extra:desc')).toEqual({ field: 'hltb_extra', dir: 'desc' });
  });
  it('returns null for non-HLTB sort keys', () => {
    expect(parseHltbSort('recent')).toBeNull();
    expect(parseHltbSort('hltb_main:sideways')).toBeNull();
    expect(parseHltbSort('playtime:asc')).toBeNull();
  });
});
