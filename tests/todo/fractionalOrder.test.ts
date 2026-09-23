import { describe, it, expect } from 'vitest';
import { between } from '../../src/utils/todo/fractionalOrder';

describe('between', () => {
  it('returns a value below b when a is null', () => {
    const v = between(null, 10);
    expect(v).toBeLessThan(10);
  });

  it('returns a value above a when b is null', () => {
    const v = between(10, null);
    expect(v).toBeGreaterThan(10);
  });

  it('returns a default when both neighbors are null (first item in an empty list)', () => {
    expect(typeof between(null, null)).toBe('number');
  });

  it('returns the midpoint between two neighbors', () => {
    expect(between(10, 20)).toBe(15);
  });

  it('keeps producing distinct, ordered values after repeated inserts at the same spot', () => {
    let lo = 0;
    let hi = 100;
    const values: number[] = [];
    for (let i = 0; i < 40; i++) {
      const v = between(lo, hi);
      expect(v).toBeGreaterThan(lo);
      expect(v).toBeLessThan(hi);
      values.push(v);
      hi = v; // keep inserting just below the previous insert
    }
    // strictly decreasing, no collisions
    for (let i = 1; i < values.length; i++) {
      expect(values[i]).toBeLessThan(values[i - 1]);
    }
  });
});
