import { describe, it, expect } from 'vitest';
import { splitOversizedStatements } from '../db/sqlDumpSplit.js';

const opts = { limit: 120, chunk: 20 };

describe('splitOversizedStatements', () => {
  it('leaves statements under the limit untouched', () => {
    const lines = ['CREATE TABLE t (id INTEGER);', `INSERT INTO "t" ("id") VALUES(1);`];
    const { main, deferred } = splitOversizedStatements(lines, opts);
    expect(main).toEqual(lines);
    expect(deferred).toEqual([]);
  });

  it('rewrites an oversized INSERT as an empty-text INSERT plus chunked appends', () => {
    const big = 'x'.repeat(50);
    const line = `INSERT INTO "series_cache" ("trakt_slug","year","seasons_json") VALUES('mha',2016,'${big}');`;
    const { main, deferred } = splitOversizedStatements([line], opts);

    expect(main).toEqual([]);
    expect(deferred[0]).toBe(`INSERT INTO "series_cache" ("trakt_slug","year","seasons_json") VALUES('mha',2016,'');`);
    expect(deferred.slice(1)).toEqual([
      `UPDATE "series_cache" SET "seasons_json" = "seasons_json" || '${'x'.repeat(20)}' WHERE "trakt_slug" = 'mha';`,
      `UPDATE "series_cache" SET "seasons_json" = "seasons_json" || '${'x'.repeat(20)}' WHERE "trakt_slug" = 'mha';`,
      `UPDATE "series_cache" SET "seasons_json" = "seasons_json" || '${'x'.repeat(10)}' WHERE "trakt_slug" = 'mha';`,
    ]);
  });

  it('keeps escaped quotes, NULLs and commas inside literals intact', () => {
    const text = `it''s, ${'y'.repeat(80)}`;
    const line = `INSERT INTO "t" ("id","a","b") VALUES(7,NULL,'${text}');`;
    const { deferred } = splitOversizedStatements([line], opts);

    expect(deferred[0]).toBe(`INSERT INTO "t" ("id","a","b") VALUES(7,NULL,'');`);
    // Chunks are cut on the unescaped text and re-escaped, so a quote never splits.
    const appended = deferred.slice(1).map(s => s.match(/\|\| '(.*)' WHERE/)![1].replace(/''/g, "'")).join('');
    expect(appended).toBe(`it's, ${'y'.repeat(80)}`);
    expect(deferred.every(s => s.endsWith('WHERE "id" = 7;') || s.startsWith('INSERT'))).toBe(true);
  });

  it('throws on an oversized statement it cannot rewrite', () => {
    expect(() => splitOversizedStatements(['CREATE VIEW v AS ' + 'x'.repeat(200)], opts)).toThrow();
  });
});
