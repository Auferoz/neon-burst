import { describe, it, expect } from 'vitest';
import { isTodoApiPath } from '../../src/utils/todo/routeMatch';

describe('isTodoApiPath', () => {
  it('matches the todo API root', () => {
    expect(isTodoApiPath('/api/todo')).toBe(true);
  });

  it('matches nested todo API routes', () => {
    expect(isTodoApiPath('/api/todo/tasks')).toBe(true);
    expect(isTodoApiPath('/api/todo/tasks/5/complete')).toBe(true);
    expect(isTodoApiPath('/api/todo/projects/1')).toBe(true);
  });

  it('does not match other API routes', () => {
    expect(isTodoApiPath('/api/movies')).toBe(false);
    expect(isTodoApiPath('/api/streaming/unlock')).toBe(false);
  });

  it('does not match a route that merely starts with the same prefix text', () => {
    expect(isTodoApiPath('/api/todoist')).toBe(false);
  });

  it('does not match the page route', () => {
    expect(isTodoApiPath('/myTodoist')).toBe(false);
  });
});
