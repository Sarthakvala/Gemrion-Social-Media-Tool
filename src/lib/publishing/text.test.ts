import { describe, expect, it } from 'vitest';
import { composeText, graphemeLength, networkLength, validateForNetwork } from './text';
import { NETWORKS, isAvailable, isNetworkId, needsDeveloperApp, network } from './networks';

const none = { images: 0, videos: 0, largestImageBytes: 0 };

describe('networks', () => {
  it('lists four networks that work without a developer app', () => {
    expect(NETWORKS.filter((n) => !needsDeveloperApp(n)).map((n) => n.id)).toEqual(['bluesky', 'mastodon', 'telegram', 'discord']);
  });

  it('is available only when its app env vars are set', () => {
    expect(isAvailable(network('bluesky'), {})).toBe(true);
    expect(isAvailable(network('x'), {})).toBe(false);
    expect(isAvailable(network('x'), { X_CLIENT_ID: 'a', X_CLIENT_SECRET: 'b' })).toBe(true);
    expect(isAvailable(network('x'), { X_CLIENT_ID: 'a', X_CLIENT_SECRET: '  ' })).toBe(false);
  });

  it('narrows ids', () => {
    expect(isNetworkId('bluesky')).toBe(true);
    expect(isNetworkId('myspace')).toBe(false);
  });
});

describe('text', () => {
  it('counts emoji and accents as one character where the network does', () => {
    expect(graphemeLength('👍🏽é')).toBe(2);
    expect(networkLength('bluesky', '👍🏽')).toBe(1);
    expect(networkLength('discord', '👍🏽')).toBe(4);
  });

  it('composes body, signature and normalised hashtags', () => {
    expect(composeText({ body: ' Hello ', signature: '— Team', hashtags: 'growth, #cash  ##flow' })).toBe('Hello\n\n— Team\n\n#growth #cash #flow');
    expect(composeText({ body: 'Only body' })).toBe('Only body');
  });
});

describe('validateForNetwork', () => {
  it('accepts a normal post', () => {
    expect(validateForNetwork('bluesky', 'Hi there', none)).toEqual([]);
  });

  it('flags text over the limit in network terms', () => {
    expect(validateForNetwork('bluesky', 'x'.repeat(301), none)[0]).toContain('300 characters');
    expect(validateForNetwork('x', 'x'.repeat(280), none)).toEqual([]);
  });

  it('uses the caption limit when media is attached', () => {
    const withImage = { images: 1, videos: 0, largestImageBytes: 1000 };
    expect(validateForNetwork('telegram', 'x'.repeat(2000), none)).toEqual([]);
    expect(validateForNetwork('telegram', 'x'.repeat(2000), withImage)[0]).toContain('1024 characters with media');
  });

  it('requires media where the network does, and caps image count and size', () => {
    expect(validateForNetwork('instagram', 'caption', none)).toContain('Instagram needs an image or video.');
    expect(validateForNetwork('bluesky', 'x', { images: 5, videos: 0, largestImageBytes: 10 })[0]).toContain('at most 4 images');
    expect(validateForNetwork('bluesky', 'x', { images: 1, videos: 0, largestImageBytes: 2 * 1024 * 1024 })[0]).toContain('2.0 MB');
  });

  it('rejects empty posts and unsupported video', () => {
    expect(validateForNetwork('discord', '  ', none)).toEqual(['Nothing to post: add text or media.']);
    expect(validateForNetwork('bluesky', 'x', { images: 0, videos: 1, largestImageBytes: 0 })[0]).toContain('video publishing is not supported yet');
  });
});
