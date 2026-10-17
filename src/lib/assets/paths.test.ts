import { describe, expect, it } from 'vitest';
import { buildStoragePath, formatBytes, isAssetKind, kindFromMime, pathBelongsTo, safeFileName } from './paths';

const BRAND = '0b6c8d2e-1f3a-4b5c-9d7e-112233445566';

describe('kindFromMime', () => {
  it('maps common types', () => {
    expect(kindFromMime('image/png')).toBe('image');
    expect(kindFromMime('video/mp4')).toBe('video');
    expect(kindFromMime('audio/mpeg')).toBe('audio');
    expect(kindFromMime('application/pdf')).toBe('document');
    expect(kindFromMime('text/plain')).toBe('document');
  });

  it('falls back to other', () => {
    expect(kindFromMime('application/zip')).toBe('other');
    expect(kindFromMime('')).toBe('other');
  });
});

describe('safeFileName', () => {
  it('strips directories and unsafe characters', () => {
    expect(safeFileName('../../etc/Pass Wd!.PNG')).toBe('pass-wd.png');
    expect(safeFileName('C:\\Users\\x\\Reel Final (v2).mp4')).toBe('reel-final-v2.mp4');
  });

  it('keeps a usable name when nothing safe is left', () => {
    expect(safeFileName('???.jpg')).toBe('file.jpg');
    expect(safeFileName('')).toBe('file');
  });
});

describe('buildStoragePath', () => {
  it('scopes the path to the brand and month', () => {
    const path = buildStoragePath(BRAND, 'Hero Shot.jpg', 'abc123', new Date('2026-10-17T00:00:00Z'));
    expect(path).toBe(`${BRAND}/2026-10/abc123-hero-shot.jpg`);
  });

  it('rejects a brand id that is not a uuid', () => {
    expect(() => buildStoragePath('../other', 'a.png', 'x')).toThrow();
  });
});

describe('pathBelongsTo', () => {
  it('accepts paths under the brand only', () => {
    expect(pathBelongsTo(`${BRAND}/2026-10/x.png`, BRAND)).toBe(true);
    expect(pathBelongsTo(`other/${BRAND}/x.png`, BRAND)).toBe(false);
    expect(pathBelongsTo(`${BRAND}/../other/x.png`, BRAND)).toBe(false);
  });
});

describe('isAssetKind', () => {
  it('narrows known kinds', () => {
    expect(isAssetKind('reel')).toBe(true);
    expect(isAssetKind('gif')).toBe(false);
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(25 * 1024 * 1024)).toBe('25 MB');
    expect(formatBytes(3 * 1024 ** 3)).toBe('3.0 GB');
  });
});
