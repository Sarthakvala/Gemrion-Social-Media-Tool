import { PermanentError, type ClaimedJob, type Handler, type JobQueue } from './types.ts';

export type Log = (message: string, extra?: Record<string, unknown>) => void;

/** The job ran but its result could not be saved; the loop must not treat the queue as merely offline. */
export class RecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordError';
  }
}

export interface LoopOptions {
  workerId: string;
  heartbeatMs: number;
  log: Log;
}

export type RunResult = 'idle' | 'succeeded' | 'retrying' | 'failed';

/** Retry while attempts remain, unless the handler said retrying is pointless. */
export function shouldRetry(job: Pick<ClaimedJob, 'attempts' | 'max_attempts'>, error: unknown): boolean {
  return !(error instanceof PermanentError) && job.attempts < job.max_attempts;
}

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 2000);
}

/** Claims at most one job, runs its handler with a heartbeat, and records the outcome. */
export async function runOnce(queue: JobQueue, handlers: Record<string, Handler>, opts: LoopOptions): Promise<RunResult> {
  const job = await queue.claim();
  if (!job) return 'idle';

  const log: Log = (m, extra) => opts.log(m, { job: job.id, kind: job.kind, ...extra });
  log('claimed', { attempt: job.attempts });

  // keeps locked_at fresh so claim_job does not hand a long render to another worker
  const beat = setInterval(() => {
    queue.heartbeat(job.id).catch((e: unknown) => log('heartbeat failed', { error: message(e) }));
  }, opts.heartbeatMs);

  let output: Record<string, unknown>;
  try {
    const handler = handlers[job.kind];
    if (!handler) throw new PermanentError(`This worker has no handler for "${job.kind}".`);
    output = await handler(job, { workerId: opts.workerId, uploadAsset: queue.uploadAsset, log });
  } catch (error) {
    clearInterval(beat);
    const retry = shouldRetry(job, error);
    await queue.fail(job.id, message(error), retry);
    log(retry ? 'failed, will retry' : 'failed', { error: message(error) });
    return retry ? 'retrying' : 'failed';
  }

  // The work is done. If recording success fails, do NOT requeue: rerunning a
  // render would duplicate it. Throw so the loop backs off; if the worker stays
  // silent, claim_job's stale check settles the row.
  clearInterval(beat);
  try {
    await queue.succeed(job.id, output);
  } catch (error) {
    log('finished but could not record success', { error: message(error) });
    throw new RecordError(message(error));
  }
  log('succeeded');
  return 'succeeded';
}

export interface ForeverOptions extends LoopOptions {
  pollMs: number;
  signal: AbortSignal;
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      resolve();
    }, { once: true });
  });

/**
 * Pull loop: drains the queue back to back, sleeps when idle, and backs off
 * when the queue itself is unreachable (machine offline, Supabase down).
 * Aborting the signal stops after the current job finishes.
 */
export async function runForever(queue: JobQueue, handlers: Record<string, Handler>, opts: ForeverOptions): Promise<void> {
  let backoff = opts.pollMs;
  while (!opts.signal.aborted) {
    try {
      const result = await runOnce(queue, handlers, opts);
      backoff = opts.pollMs;
      if (result === 'idle') await sleep(opts.pollMs, opts.signal);
    } catch (error) {
      opts.log(error instanceof RecordError ? 'could not save a finished job' : 'queue unreachable', { error: message(error), retry_in_ms: backoff });
      await sleep(backoff, opts.signal);
      backoff = Math.min(backoff * 2, 5 * 60_000);
    }
  }
  opts.log('stopped');
}
