import { describe, it, expect } from 'vitest';
import { parseQuickAdd } from '../../src/utils/todo/quickAdd';

// Fixed "today": 2026-09-23 is a Wednesday.
const TODAY = '2026-09-23';

describe('parseQuickAdd', () => {
  it('parses a plain title with no tokens', () => {
    const r = parseQuickAdd('comprar pan', TODAY);
    expect(r.title).toBe('comprar pan');
    expect(r.priority).toBe(4);
    expect(r.due_date).toBeNull();
    expect(r.due_time).toBeNull();
    expect(r.project).toBeNull();
    expect(r.labels).toEqual([]);
    expect(r.recurrence).toBeNull();
  });

  it('parses priority p1-p4 and removes it from the title', () => {
    expect(parseQuickAdd('pagar luz p1', TODAY).priority).toBe(1);
    expect(parseQuickAdd('pagar luz p1', TODAY).title).toBe('pagar luz');
    expect(parseQuickAdd('p2 llamar al banco', TODAY).priority).toBe(2);
    expect(parseQuickAdd('tarea p3', TODAY).priority).toBe(3);
    expect(parseQuickAdd('tarea p4', TODAY).priority).toBe(4);
  });

  it('parses a project tag against known projects, case- and accent-insensitive', () => {
    const r = parseQuickAdd('pagar luz #Casa', TODAY, ['Casa', 'Trabajo']);
    expect(r.project).toBe('Casa');
    expect(r.title).toBe('pagar luz');
    expect(r.warning).toBeUndefined();
  });

  it('falls back to Inbox with a warning for an unknown project', () => {
    const r = parseQuickAdd('pagar luz #Bogus', TODAY, ['Casa']);
    expect(r.project).toBeNull();
    expect(r.warning).toMatch(/Bogus/);
    expect(r.title).toBe('pagar luz');
  });

  it('parses multiple labels', () => {
    const r = parseQuickAdd('pagar luz @urgente @casa', TODAY);
    expect(r.labels).toEqual(['urgente', 'casa']);
    expect(r.title).toBe('pagar luz');
  });

  it('parses "hoy"', () => {
    expect(parseQuickAdd('tarea hoy', TODAY).due_date).toBe('2026-09-23');
  });

  it('parses "mañana" and its accent-less form', () => {
    expect(parseQuickAdd('tarea mañana', TODAY).due_date).toBe('2026-09-24');
    expect(parseQuickAdd('tarea manana', TODAY).due_date).toBe('2026-09-24');
  });

  it('parses "pasado mañana"', () => {
    expect(parseQuickAdd('tarea pasado mañana', TODAY).due_date).toBe('2026-09-25');
  });

  it('parses a weekday name, rolling to the next occurrence', () => {
    // today is Wednesday; "lunes" should roll to next Monday.
    expect(parseQuickAdd('tarea lunes', TODAY).due_date).toBe('2026-09-28');
  });

  it('parses "el <weekday>"', () => {
    expect(parseQuickAdd('tarea el viernes', TODAY).due_date).toBe('2026-09-25');
  });

  it('accepts an accented weekday name written without the accent (sabado/sábado)', () => {
    expect(parseQuickAdd('tarea sabado', TODAY).due_date).toBe('2026-09-26');
    expect(parseQuickAdd('tarea sábado', TODAY).due_date).toBe('2026-09-26');
  });

  it('parses DD/MM', () => {
    expect(parseQuickAdd('tarea 25/12', TODAY).due_date).toBe('2026-12-25');
  });

  it('parses DD/MM/YYYY', () => {
    expect(parseQuickAdd('tarea 25/12/2027', TODAY).due_date).toBe('2027-12-25');
  });

  it('leaves an invalid date in the title and does not set due_date', () => {
    const r = parseQuickAdd('tarea 31/02', TODAY);
    expect(r.due_date).toBeNull();
    expect(r.title).toBe('tarea 31/02');
  });

  it('parses "en N días"', () => {
    expect(parseQuickAdd('tarea en 3 días', TODAY).due_date).toBe('2026-09-26');
  });

  it('parses "en N semanas"', () => {
    expect(parseQuickAdd('tarea en 2 semanas', TODAY).due_date).toBe('2026-10-07');
  });

  it('parses "próxima semana"', () => {
    expect(parseQuickAdd('tarea próxima semana', TODAY).due_date).toBe('2026-09-30');
  });

  it('parses "a las 18" as 18:00', () => {
    expect(parseQuickAdd('tarea a las 18', TODAY).due_time).toBe('18:00');
  });

  it('parses "18:30"', () => {
    expect(parseQuickAdd('tarea 18:30', TODAY).due_time).toBe('18:30');
  });

  it('parses "6pm" as 18:00', () => {
    expect(parseQuickAdd('tarea 6pm', TODAY).due_time).toBe('18:00');
  });

  it('parses "todos los días" and "cada día" as daily recurrence', () => {
    expect(parseQuickAdd('tarea todos los días', TODAY).recurrence).toBe('daily');
    expect(parseQuickAdd('tarea cada día', TODAY).recurrence).toBe('daily');
  });

  it('parses "cada semana"', () => {
    // today (Wed, iso 3) is the anchor weekday for "cada semana"
    expect(parseQuickAdd('tarea cada semana', TODAY).recurrence).toBe('weekly:3');
  });

  it('parses "cada lunes"', () => {
    expect(parseQuickAdd('tarea cada lunes', TODAY).recurrence).toBe('weekly:1');
  });

  it('parses "cada mes"', () => {
    expect(parseQuickAdd('tarea cada mes', TODAY).recurrence).toBe('monthly:23');
  });

  it('parses "cada 15" as monthly on the 15th', () => {
    expect(parseQuickAdd('tarea cada 15', TODAY).recurrence).toBe('monthly:15');
  });

  it('parses "cada 3 días"', () => {
    expect(parseQuickAdd('tarea cada 3 días', TODAY).recurrence).toBe('every:3:days');
  });

  it('parses a full combination with tokens scattered through the title', () => {
    const r = parseQuickAdd('pagar luz mañana 18:00 p1 #Casa @urgente cada mes', TODAY, ['Casa']);
    expect(r.title).toBe('pagar luz');
    expect(r.priority).toBe(1);
    expect(r.due_date).toBe('2026-09-24');
    expect(r.due_time).toBe('18:00');
    expect(r.project).toBe('Casa');
    expect(r.labels).toEqual(['urgente']);
    expect(r.recurrence).toBe('monthly:24');
  });

  it('parses tokens in the middle of the title', () => {
    const r = parseQuickAdd('llamar p2 al banco mañana por la tarde', TODAY);
    expect(r.priority).toBe(2);
    expect(r.due_date).toBe('2026-09-24');
    expect(r.title).toBe('llamar al banco por la tarde');
  });
});
