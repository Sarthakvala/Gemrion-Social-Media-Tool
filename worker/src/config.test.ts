import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.ts';

const base = { SUPABASE_URL: 'https://abc.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'secret' };

describe('loadConfig', () => {
  it('fills sensible defaults', () => {
    const c = loadConfig(base);
    expect(c.kinds).toEqual(['worker_ping', 'video_render']);
    expect(c.pollMs).toBe(5000);
    expect(c.heartbeatMs).toBe(60_000);
    expect(c.workerId).toMatch(/-\d+$/);
  });

  it('names every missing variable without echoing values', () => {
    expect(() => loadConfig({})).toThrow('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  });

  it('rejects a non-https Supabase URL', () => {
    expect(() => loadConfig({ ...base, SUPABASE_URL: 'http://abc.supabase.co' })).toThrow('https');
  });

  it('parses kinds and clamps silly intervals', () => {
    const c = loadConfig({ ...base, WORKER_KINDS: 'worker_ping, video_render ,', POLL_MS: '10', HEARTBEAT_MS: 'abc' });
    expect(c.kinds).toEqual(['worker_ping', 'video_render']);
    expect(c.pollMs).toBe(5000);
    expect(c.heartbeatMs).toBe(60_000);
  });
});
