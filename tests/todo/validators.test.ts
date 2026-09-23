import { describe, it, expect } from 'vitest';
import {
  validateTaskCreate,
  validateTaskPatch,
  validateCompleteBody,
  validateReorderBody,
} from '../../src/utils/todo/validators';

describe('validateTaskCreate', () => {
  it('accepts a minimal valid body', () => {
    const r = validateTaskCreate({ project_id: 1, title: 'pagar luz' });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.project_id).toBe(1);
      expect(r.value.title).toBe('pagar luz');
      expect(r.value.priority).toBe(4);
    }
  });

  it('trims the title and rejects an empty one', () => {
    expect(validateTaskCreate({ project_id: 1, title: '   ' }).ok).toBe(false);
    const r = validateTaskCreate({ project_id: 1, title: '  hola  ' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.title).toBe('hola');
  });

  it('requires project_id to be an integer', () => {
    expect(validateTaskCreate({ project_id: 'x', title: 'a' }).ok).toBe(false);
    expect(validateTaskCreate({ title: 'a' }).ok).toBe(false);
  });

  it('accepts an explicit valid priority 1-4', () => {
    expect(validateTaskCreate({ project_id: 1, title: 'a', priority: 1 }).ok).toBe(true);
  });

  it('rejects a priority outside 1-4', () => {
    expect(validateTaskCreate({ project_id: 1, title: 'a', priority: 0 }).ok).toBe(false);
    expect(validateTaskCreate({ project_id: 1, title: 'a', priority: 5 }).ok).toBe(false);
  });

  it('validates due_date format', () => {
    expect(validateTaskCreate({ project_id: 1, title: 'a', due_date: '2026-09-23' }).ok).toBe(true);
    expect(validateTaskCreate({ project_id: 1, title: 'a', due_date: '23/09/2026' }).ok).toBe(false);
    expect(validateTaskCreate({ project_id: 1, title: 'a', due_date: '2026-02-30' }).ok).toBe(false);
  });

  it('validates due_time format', () => {
    expect(validateTaskCreate({ project_id: 1, title: 'a', due_time: '18:30' }).ok).toBe(true);
    expect(validateTaskCreate({ project_id: 1, title: 'a', due_time: '25:00' }).ok).toBe(false);
  });

  it('accepts a labels array of strings', () => {
    const r = validateTaskCreate({ project_id: 1, title: 'a', labels: ['urgente', 'casa'] });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.labels).toEqual(['urgente', 'casa']);
  });

  it('rejects a non-array labels field', () => {
    expect(validateTaskCreate({ project_id: 1, title: 'a', labels: 'urgente' }).ok).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateTaskCreate(null).ok).toBe(false);
    expect(validateTaskCreate('x').ok).toBe(false);
  });
});

describe('validateTaskPatch', () => {
  it('accepts a partial body with a single field', () => {
    const r = validateTaskPatch({ title: 'nuevo título' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ title: 'nuevo título' });
  });

  it('accepts an empty body (no-op)', () => {
    expect(validateTaskPatch({})).toEqual({ ok: true, value: {} });
  });

  it('ignores unknown fields', () => {
    const r = validateTaskPatch({ title: 'a', bogus: 1 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toEqual({ title: 'a' });
  });

  it('rejects an invalid priority', () => {
    expect(validateTaskPatch({ priority: 9 }).ok).toBe(false);
  });

  it('accepts due_date: null to clear it', () => {
    const r = validateTaskPatch({ due_date: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.due_date).toBeNull();
  });

  it('accepts section_id / parent_id: null to clear them', () => {
    const r = validateTaskPatch({ section_id: null, parent_id: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.section_id).toBeNull();
      expect(r.value.parent_id).toBeNull();
    }
  });
});

describe('validateCompleteBody', () => {
  it('accepts { done: true, today }', () => {
    expect(validateCompleteBody({ done: true, today: '2026-09-23' })).toEqual({
      ok: true,
      value: { done: true, today: '2026-09-23' },
    });
  });

  it('accepts { done: false } without today', () => {
    expect(validateCompleteBody({ done: false })).toEqual({ ok: true, value: { done: false, today: undefined } });
  });

  it('rejects done:true with a missing or invalid today', () => {
    expect(validateCompleteBody({ done: true }).ok).toBe(false);
    expect(validateCompleteBody({ done: true, today: '23/09/2026' }).ok).toBe(false);
  });

  it('rejects a non-boolean done', () => {
    expect(validateCompleteBody({ done: 'yes' }).ok).toBe(false);
  });
});

describe('validateReorderBody', () => {
  it('accepts a valid reorder payload', () => {
    const r = validateReorderBody({ id: 1, project_id: 2, section_id: null, sort_order: 15.5 });
    expect(r.ok).toBe(true);
  });

  it('rejects a missing id or sort_order', () => {
    expect(validateReorderBody({ project_id: 2, sort_order: 1 }).ok).toBe(false);
    expect(validateReorderBody({ id: 1, project_id: 2 }).ok).toBe(false);
  });
});
