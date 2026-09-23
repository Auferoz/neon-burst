import { describe, it, expect } from 'vitest';
import { averageScore } from '../src/utils/ratingBands';

describe('averageScore', () => {
  it('averages three present scores', () => {
    expect(averageScore([80, 70, 90])).toBe(80);
  });

  it('averages two present scores, ignoring the missing one', () => {
    expect(averageScore([80, null, 90])).toBe(85);
  });

  it('returns the single present score when only one exists', () => {
    expect(averageScore([undefined, null, 77])).toBe(77);
  });

  it('returns null when none are present', () => {
    expect(averageScore([null, undefined])).toBeNull();
    expect(averageScore([])).toBeNull();
  });

  it('rounds 78.5 up to 79', () => {
    expect(averageScore([78, 79])).toBe(79);
  });
});
