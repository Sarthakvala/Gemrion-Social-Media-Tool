import { describe, expect, it } from 'vitest';
import { canCancel, canRetry, durationMs, isFinished, workerLastSeen } from './types';

describe('job state rules', () => {
  it('treats succeeded, failed and canceled as finished', () => {
    expect(['succeeded', 'failed', 'canceled'].every((s) => isFinished(s as never))).toBe(true);
    expect(isFinished('queued')).toBe(false);
    expect(isFinished('running')).toBe(false);
  });

  it('retries only failed or canceled worker jobs', () => {
    expect(canRetry({ runner: 'worker', status: 'failed' })).toBe(true);
    expect(canRetry({ runner: 'worker', status: 'canceled' })).toBe(true);
    expect(canRetry({ runner: 'worker', status: 'running' })).toBe(false);
    expect(canRetry({ runner: 'app', status: 'failed' })).toBe(false);
  });

  it('cancels only queued jobs', () => {
    expect(canCancel({ runner: 'worker', status: 'queued' })).toBe(true);
    expect(canCancel({ runner: 'worker', status: 'running' })).toBe(false);
  });

  it('measures duration only once a job has both timestamps', () => {
    expect(durationMs({ started_at: '2026-10-17T10:00:00Z', finished_at: '2026-10-17T10:00:02.500Z' })).toBe(2500);
    expect(durationMs({ started_at: '2026-10-17T10:00:00Z', finished_at: null })).toBeNull();
  });
});

describe('workerLastSeen', () => {
  const base = { runner: 'worker' as const, attempts: 1, locked_at: null, finished_at: null };
  it('uses finish times because the worker clears locked_at on completion', () => {
    expect(workerLastSeen([{ ...base, status: 'succeeded', finished_at: '2026-10-17T10:00:00Z' }])).toBe('2026-10-17T10:00:00.000Z');
  });

  it('prefers the newest of heartbeats and finishes', () => {
    const seen = workerLastSeen([
      { ...base, status: 'succeeded', finished_at: '2026-10-17T10:00:00Z' },
      { ...base, status: 'running', locked_at: '2026-10-17T11:00:00Z' },
    ]);
    expect(seen).toBe('2026-10-17T11:00:00.000Z');
  });

  it('ignores app jobs, unclaimed jobs and canceled finishes', () => {
    expect(
      workerLastSeen([
        { ...base, runner: 'app', status: 'succeeded', finished_at: '2026-10-17T10:00:00Z' },
        { ...base, attempts: 0, status: 'canceled', finished_at: '2026-10-17T10:00:00Z' },
      ])
    ).toBeNull();
  });
});
