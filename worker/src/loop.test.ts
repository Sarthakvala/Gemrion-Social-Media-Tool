import { describe, expect, it, vi } from 'vitest';
import { runForever, runOnce, shouldRetry } from './loop.ts';
import { PermanentError, type ClaimedJob, type Handler, type JobQueue } from './types.ts';

const job = (over: Partial<ClaimedJob> = {}): ClaimedJob => ({
  id: 'job-1',
  client_id: 'brand-1',
  kind: 'worker_ping',
  playbook: '',
  input: {},
  attempts: 1,
  max_attempts: 3,
  ...over,
});

function fakeQueue(jobs: (ClaimedJob | null)[]): JobQueue & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    claim: vi.fn(async () => jobs.shift() ?? null),
    heartbeat: vi.fn(async (id) => void calls.push(`beat:${id}`)),
    succeed: vi.fn(async (id) => void calls.push(`ok:${id}`)),
    fail: vi.fn(async (id, _m, retry) => void calls.push(`${retry ? 'retry' : 'fail'}:${id}`)),
    uploadAsset: vi.fn(async () => ({ assetId: 'a1', path: 'p' })),
  };
}

const opts = { workerId: 'w1', heartbeatMs: 10_000, log: () => {} };

describe('shouldRetry', () => {
  it('retries while attempts remain', () => {
    expect(shouldRetry({ attempts: 1, max_attempts: 3 }, new Error('x'))).toBe(true);
    expect(shouldRetry({ attempts: 3, max_attempts: 3 }, new Error('x'))).toBe(false);
  });

  it('never retries a permanent error', () => {
    expect(shouldRetry({ attempts: 1, max_attempts: 3 }, new PermanentError('bad input'))).toBe(false);
  });
});

describe('runOnce', () => {
  it('reports idle when the queue is empty', async () => {
    expect(await runOnce(fakeQueue([null]), {}, opts)).toBe('idle');
  });

  it('runs the matching handler and records success with its output', async () => {
    const q = fakeQueue([job()]);
    const handler: Handler = vi.fn(async () => ({ asset_id: 'a1' }));
    expect(await runOnce(q, { worker_ping: handler }, opts)).toBe('succeeded');
    expect(q.succeed).toHaveBeenCalledWith('job-1', { asset_id: 'a1' });
  });

  it('requeues a transient failure while attempts remain', async () => {
    const q = fakeQueue([job({ attempts: 1 })]);
    const result = await runOnce(q, { worker_ping: async () => Promise.reject(new Error('network')) }, opts);
    expect(result).toBe('retrying');
    expect(q.fail).toHaveBeenCalledWith('job-1', 'network', true);
  });

  it('fails for good on the last attempt', async () => {
    const q = fakeQueue([job({ attempts: 3 })]);
    expect(await runOnce(q, { worker_ping: async () => Promise.reject(new Error('boom')) }, opts)).toBe('failed');
    expect(q.calls).toContain('fail:job-1');
  });

  it('fails permanently when no handler exists for the kind', async () => {
    const q = fakeQueue([job({ kind: 'video_render' })]);
    expect(await runOnce(q, {}, opts)).toBe('failed');
    expect(q.fail).toHaveBeenCalledWith('job-1', expect.stringContaining('no handler'), false);
  });

  it('never requeues a job whose handler finished when saving success fails', async () => {
    const q = fakeQueue([job()]);
    q.succeed = vi.fn(async () => Promise.reject(new Error('network')));
    await expect(runOnce(q, { worker_ping: async () => ({}) }, opts)).rejects.toThrow('network');
    expect(q.fail).not.toHaveBeenCalled();
  });

  it('sends heartbeats while a long job runs and stops after', async () => {
    vi.useFakeTimers();
    const q = fakeQueue([job()]);
    const slow: Handler = () => new Promise((r) => setTimeout(() => r({}), 25));
    const running = runOnce(q, { worker_ping: slow }, { ...opts, heartbeatMs: 10 });
    await vi.advanceTimersByTimeAsync(30);
    await running;
    const beats = q.calls.filter((c) => c.startsWith('beat')).length;
    expect(beats).toBe(2);
    await vi.advanceTimersByTimeAsync(50);
    expect(q.calls.filter((c) => c.startsWith('beat')).length).toBe(beats);
    vi.useRealTimers();
  });
});

describe('runForever', () => {
  it('drains queued jobs then stops when aborted', async () => {
    const q = fakeQueue([job({ id: 'a' }), job({ id: 'b' }), null]);
    const controller = new AbortController();
    const handler: Handler = async (j) => {
      if (j.id === 'b') controller.abort();
      return {};
    };
    await runForever(q, { worker_ping: handler }, { ...opts, pollMs: 1, signal: controller.signal });
    expect(q.calls.filter((c) => c.startsWith('ok'))).toEqual(['ok:a', 'ok:b']);
  });

  it('backs off instead of crashing when the queue is unreachable', async () => {
    const controller = new AbortController();
    const log = vi.fn();
    let n = 0;
    const q = fakeQueue([]);
    q.claim = vi.fn(async () => {
      if (++n >= 2) controller.abort();
      throw new Error('offline');
    });
    await runForever(q, {}, { ...opts, log, pollMs: 1, signal: controller.signal });
    expect(log).toHaveBeenCalledWith('queue unreachable', expect.objectContaining({ error: 'offline' }));
  });
});
