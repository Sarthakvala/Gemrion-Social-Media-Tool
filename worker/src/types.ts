/** The subset of a public.jobs row the worker reads. */
export interface ClaimedJob {
  id: string;
  client_id: string | null;
  kind: string;
  playbook: string;
  input: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

export interface NewAsset {
  clientId: string;
  jobId: string;
  fileName: string;
  body: Uint8Array | string;
  contentType: string;
  kind: string;
  title: string;
  meta?: Record<string, unknown>;
}

/** What a handler may do besides compute: everything goes through the queue's storage. */
export interface HandlerContext {
  workerId: string;
  uploadAsset(asset: NewAsset): Promise<{ assetId: string; path: string }>;
  log(message: string, extra?: Record<string, unknown>): void;
}

export type Handler = (job: ClaimedJob, ctx: HandlerContext) => Promise<Record<string, unknown>>;

/** Storage and state transitions for jobs (Repository pattern; Supabase in production, fakes in tests). */
export interface JobQueue {
  claim(): Promise<ClaimedJob | null>;
  heartbeat(jobId: string): Promise<void>;
  succeed(jobId: string, output: Record<string, unknown>): Promise<void>;
  /** `retry` puts the job back in the queue; otherwise it is failed for good. */
  fail(jobId: string, message: string, retry: boolean): Promise<void>;
  uploadAsset: HandlerContext['uploadAsset'];
}

/** Throw this from a handler when retrying cannot help (bad input, unknown kind). */
export class PermanentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermanentError';
  }
}
