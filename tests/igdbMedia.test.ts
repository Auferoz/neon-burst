import { describe, it, expect } from 'vitest';
import { mapIgdbMedia, parseGameMedia } from '../src/utils/igdbMedia';

describe('mapIgdbMedia', () => {
  it('maps artworks, screenshots and videos keeping IGDB order', () => {
    const media = mapIgdbMedia({
      artworks: [{ image_id: 'ar1' }, { image_id: 'ar2' }],
      screenshots: [{ image_id: 'sc1' }, { image_id: 'sc2' }],
      videos: [
        { video_id: 'v1', name: 'Gameplay' },
        { video_id: 'v2', name: 'Cinematic' },
      ],
    });
    expect(media.artworks).toEqual(['ar1', 'ar2']);
    expect(media.screenshots).toEqual(['sc1', 'sc2']);
    expect(media.videos).toEqual([
      { id: 'v1', name: 'Gameplay' },
      { id: 'v2', name: 'Cinematic' },
    ]);
  });

  it('strips extensions from image ids', () => {
    const media = mapIgdbMedia({
      artworks: [{ image_id: 'ar1.webp' }],
      screenshots: [{ image_id: 'sc1.jpg' }],
    });
    expect(media.artworks).toEqual(['ar1']);
    expect(media.screenshots).toEqual(['sc1']);
  });

  it('drops empty ids and dedupes', () => {
    const media = mapIgdbMedia({
      artworks: [{ image_id: 'ar1' }, { image_id: '' }, { image_id: 'ar1.webp' }],
      screenshots: [{ image_id: 'sc1' }, { image_id: 'sc1' }],
      videos: [
        { video_id: 'v1', name: 'A' },
        { video_id: '', name: 'B' },
        { video_id: 'v1', name: 'A again' },
      ],
    });
    expect(media.artworks).toEqual(['ar1']);
    expect(media.screenshots).toEqual(['sc1']);
    expect(media.videos).toEqual([{ id: 'v1', name: 'A' }]);
  });

  it('puts the video named like a trailer first', () => {
    const media = mapIgdbMedia({
      videos: [
        { video_id: 'v1', name: 'Gameplay' },
        { video_id: 'v2', name: 'Launch TRAILER' },
        { video_id: 'v3', name: 'Trailer 2' },
      ],
    });
    expect(media.videos.map((v) => v.id)).toEqual(['v2', 'v1', 'v3']);
  });

  it('defaults a missing video name to an empty string', () => {
    const media = mapIgdbMedia({ videos: [{ video_id: 'v1' }] });
    expect(media.videos).toEqual([{ id: 'v1', name: '' }]);
  });

  it('returns empty groups for empty input', () => {
    expect(mapIgdbMedia({})).toEqual({ artworks: [], screenshots: [], videos: [] });
  });
});

describe('parseGameMedia', () => {
  it('round-trips a valid payload', () => {
    const media = { artworks: ['a'], screenshots: ['s'], videos: [{ id: 'v', name: 'T' }] };
    expect(parseGameMedia(JSON.stringify(media))).toEqual(media);
  });

  it('returns null for null, empty or invalid JSON', () => {
    expect(parseGameMedia(null)).toBeNull();
    expect(parseGameMedia('')).toBeNull();
    expect(parseGameMedia('{nope')).toBeNull();
  });

  it('returns null for the wrong shape', () => {
    expect(parseGameMedia('[]')).toBeNull();
    expect(parseGameMedia('"x"')).toBeNull();
    expect(parseGameMedia('{"artworks":"a","screenshots":[],"videos":[]}')).toBeNull();
    expect(parseGameMedia('{"artworks":[],"screenshots":[]}')).toBeNull();
    expect(parseGameMedia('{"artworks":[1],"screenshots":[],"videos":[]}')).toBeNull();
    expect(parseGameMedia('{"artworks":[],"screenshots":[],"videos":[{"id":1}]}')).toBeNull();
  });
});
