import { describe, it, expect } from 'vitest';
import { isTodoApiPath, isPrivateApiPath } from '../../src/utils/todo/routeMatch';

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

describe('isPrivateApiPath', () => {
  it('matches the todo API', () => {
    expect(isPrivateApiPath('/api/todo')).toBe(true);
    expect(isPrivateApiPath('/api/todo/tasks/5')).toBe(true);
  });

  it('matches the manga API root and nested routes', () => {
    expect(isPrivateApiPath('/api/manga')).toBe(true);
    expect(isPrivateApiPath('/api/manga/12')).toBe(true);
    expect(isPrivateApiPath('/api/manga/lookup')).toBe(true);
    expect(isPrivateApiPath('/api/manga/cache/30013')).toBe(true);
  });

  it('does not match a route that merely starts with the same prefix text', () => {
    expect(isPrivateApiPath('/api/mangaka')).toBe(false);
  });

  it('does not match public API routes or the unlock endpoint', () => {
    expect(isPrivateApiPath('/api/movies')).toBe(false);
    expect(isPrivateApiPath('/api/search')).toBe(false);
    expect(isPrivateApiPath('/api/streaming/unlock')).toBe(false);
  });

  it('does not match page routes', () => {
    expect(isPrivateApiPath('/ListManga')).toBe(false);
    expect(isPrivateApiPath('/manga/30013')).toBe(false);
  });
});
