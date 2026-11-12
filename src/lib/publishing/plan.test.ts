import { describe, expect, it } from 'vitest';
import { bodyFor, nextFreeSlot, postStatusFrom, retryDelayMs, zonedInputValues, zonedTimeToUtc } from './plan';
import { PermanentPublishError, onFailure } from './types';

const post = { copy: 'Long LinkedIn-style copy', caption: 'caption', platform_captions: { X: 'Short X line', LI: 'LinkedIn version', IG: '' } };

describe('bodyFor', () => {
  it('uses the tailored caption for the network family', () => {
    expect(bodyFor('linkedin_page', post)).toBe('LinkedIn version');
    expect(bodyFor('bluesky', post)).toBe('Short X line');
    expect(bodyFor('mastodon', post)).toBe('Short X line');
  });

  it('falls back to copy, then caption', () => {
    expect(bodyFor('instagram', post)).toBe('Long LinkedIn-style copy');
    expect(bodyFor('discord', { copy: ' ', caption: 'cap', platform_captions: null })).toBe('cap');
  });
});

describe('postStatusFrom', () => {
  it('stays scheduled while anything is still pending', () => {
    expect(postStatusFrom(['published', 'publishing'])).toBe('scheduled');
    expect(postStatusFrom(['scheduled', 'failed'])).toBe('scheduled');
  });

  it('reports failed if any channel failed once all are done', () => {
    expect(postStatusFrom(['published', 'failed'])).toBe('failed');
    expect(postStatusFrom(['published', 'canceled'])).toBe('published');
  });

  it('has nothing to report for drafts or canceled-only', () => {
    expect(postStatusFrom(['draft', 'canceled'])).toBeNull();
    expect(postStatusFrom([])).toBeNull();
  });
});

describe('retryDelayMs', () => {
  it('backs off exponentially up to an hour', () => {
    expect(retryDelayMs(1)).toBe(2 * 60_000);
    expect(retryDelayMs(3)).toBe(8 * 60_000);
    expect(retryDelayMs(10)).toBe(60 * 60_000);
  });
});

describe('zonedTimeToUtc', () => {
  it('converts wall-clock time in a zone, across DST', () => {
    expect(zonedTimeToUtc(2026, 11, 13, 9, 0, 'Asia/Kolkata').toISOString()).toBe('2026-11-13T03:30:00.000Z');
    expect(zonedTimeToUtc(2026, 7, 1, 9, 0, 'Europe/London').toISOString()).toBe('2026-07-01T08:00:00.000Z');
    expect(zonedTimeToUtc(2026, 1, 15, 9, 0, 'Europe/London').toISOString()).toBe('2026-01-15T09:00:00.000Z');
  });
});

describe('nextFreeSlot', () => {
  // 2026-11-13 is a Friday
  const slots = [
    { weekday: 5, localTime: '09:00' },
    { weekday: 5, localTime: '18:30' },
    { weekday: 1, localTime: '10:00:00' },
  ];
  const tz = 'Asia/Kolkata';

  it('picks the next slot later today in the brand zone', () => {
    const after = new Date('2026-11-13T04:00:00Z'); // 09:30 IST
    expect(nextFreeSlot(slots, tz, after, [])?.toISOString()).toBe('2026-11-13T13:00:00.000Z'); // 18:30 IST
  });

  it('skips taken slots and rolls to the next matching weekday', () => {
    const after = new Date('2026-11-13T04:00:00Z');
    const taken = [new Date('2026-11-13T13:00:00Z')];
    expect(nextFreeSlot(slots, tz, after, taken)?.toISOString()).toBe('2026-11-16T04:30:00.000Z'); // Monday 10:00 IST
  });

  it('returns null with no slots', () => {
    expect(nextFreeSlot([], tz, new Date(), [])).toBeNull();
  });
});

describe('onFailure', () => {
  it('retries transient errors while attempts remain', () => {
    expect(onFailure(new Error('timeout'), 1, 3)).toEqual({ action: 'retry', delayAttempt: 1 });
    expect(onFailure(new Error('timeout'), 3, 3)).toEqual({ action: 'fail', expireChannel: false });
  });

  it('fails permanent errors at once and expires the channel only for revoked credentials', () => {
    expect(onFailure(new PermanentPublishError('too long'), 1, 3)).toEqual({ action: 'fail', expireChannel: false });
    expect(onFailure(new PermanentPublishError('revoked', true), 1, 3)).toEqual({ action: 'fail', expireChannel: true });
  });
});

describe('zonedInputValues', () => {
  it('shows an instant as the brand wall clock and round-trips with zonedTimeToUtc', () => {
    const at = new Date('2026-11-13T03:30:00Z');
    expect(zonedInputValues(at, 'Asia/Kolkata')).toEqual({ date: '2026-11-13', time: '09:00' });
    expect(zonedInputValues(new Date('2026-11-13T20:00:00Z'), 'Asia/Kolkata')).toEqual({ date: '2026-11-14', time: '01:30' });
    expect(zonedTimeToUtc(2026, 11, 13, 9, 0, 'Asia/Kolkata').getTime()).toBe(at.getTime());
  });
});
