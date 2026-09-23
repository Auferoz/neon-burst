import { describe, it, expect } from 'vitest';
import { nextOccurrence, describeRecurrence } from '../../src/utils/todo/recurrence';

describe('nextOccurrence', () => {
  it('daily: moves one day forward', () => {
    expect(nextOccurrence('daily', '2026-09-23')).toBe('2026-09-24');
  });

  it('every:N:days: moves N days forward', () => {
    expect(nextOccurrence('every:3:days', '2026-09-23')).toBe('2026-09-26');
  });

  it('weekly with a single ISO weekday: finds the next occurrence, rolling into the next week', () => {
    // 2026-09-23 is a Wednesday (ISO 3). weekly:3 (Wednesday) should roll to next week.
    expect(nextOccurrence('weekly:3', '2026-09-23')).toBe('2026-09-30');
  });

  it('weekly with multiple ISO weekdays: picks the nearest one after fromDate', () => {
    // 2026-09-23 Wed. weekly:1,4 (Mon, Thu) -> nearest after Wed is Thu (09-24).
    expect(nextOccurrence('weekly:1,4', '2026-09-23')).toBe('2026-09-24');
  });

  it('monthly: same day next month', () => {
    expect(nextOccurrence('monthly:15', '2026-09-01')).toBe('2026-10-15');
  });

  it('monthly: clamps to the last day when the target month is shorter (Feb)', () => {
    expect(nextOccurrence('monthly:31', '2026-01-05')).toBe('2026-02-28');
  });

  it('monthly: clamps correctly in a leap year', () => {
    expect(nextOccurrence('monthly:30', '2028-01-05')).toBe('2028-02-29');
  });

  it('monthly: rolls the year over in December', () => {
    expect(nextOccurrence('monthly:10', '2026-12-01')).toBe('2027-01-10');
  });

  it('throws on an unrecognized rule', () => {
    expect(() => nextOccurrence('bogus', '2026-09-23')).toThrow();
  });
});

describe('describeRecurrence', () => {
  it('describes daily', () => {
    expect(describeRecurrence('daily')).toBe('cada día');
  });

  it('describes every:N:days', () => {
    expect(describeRecurrence('every:3:days')).toBe('cada 3 días');
  });

  it('describes weekly with one day', () => {
    expect(describeRecurrence('weekly:1')).toBe('cada lunes');
  });

  it('describes weekly with multiple days', () => {
    expect(describeRecurrence('weekly:1,4')).toBe('cada lunes y jueves');
  });

  it('describes monthly', () => {
    expect(describeRecurrence('monthly:15')).toBe('cada 15 de cada mes');
  });
});
