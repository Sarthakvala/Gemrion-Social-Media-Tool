import type { NetworkId } from './networks';

/** Injected so adapters can be tested without the network. Matches the global fetch. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface MediaFile {
  bytes: Uint8Array;
  mime: string;
  filename: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PublishInput {
  text: string;
  media: MediaFile[];
  /** Optional reply posted under the main post (first comment / thread reply). */
  firstComment?: string;
  /** Per-target network settings (visibility, privacy, board, subreddit ...). */
  settings: Record<string, unknown>;
}

export interface PublishResult {
  externalId: string;
  url: string | null;
}

/** What a connect step returns: who the channel is, and the credentials to encrypt and keep. */
export interface ConnectedChannel {
  externalId: string;
  name: string;
  handle: string;
  avatarUrl: string;
  credentials: Record<string, string>;
  settings?: Record<string, unknown>;
}

/** Thrown when retrying cannot help (revoked credentials, rejected content). */
export class PermanentPublishError extends Error {
  constructor(message: string, readonly expired = false) {
    super(message);
    this.name = 'PermanentPublishError';
  }
}

/**
 * One network adapter (Adapter pattern). Credentials arrive decrypted and never
 * leave the server; adapters must not log them.
 */
export interface Provider {
  network: NetworkId;
  publish(credentials: Record<string, string>, input: PublishInput, fetcher?: FetchLike): Promise<PublishResult>;
}

export async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

export type FailureAction = { action: 'retry'; delayAttempt: number } | { action: 'fail'; expireChannel: boolean };

/** Retry transient errors while attempts remain; fail permanent ones at once (and flag revoked credentials). */
export function onFailure(err: unknown, attempts: number, maxAttempts: number): FailureAction {
  if (err instanceof PermanentPublishError) return { action: 'fail', expireChannel: err.expired };
  return attempts < maxAttempts ? { action: 'retry', delayAttempt: attempts } : { action: 'fail', expireChannel: false };
}

/** Turns a failed HTTP response into a retryable or permanent error with the network's own message. */
export function httpError(network: string, res: Response, body: Record<string, unknown>): Error {
  const msg = String(body.message ?? body.error_description ?? body.description ?? body.error ?? body.raw ?? `HTTP ${res.status}`).slice(0, 300);
  const text = `${network}: ${msg}`;
  if (res.status === 401 || res.status === 403) return new PermanentPublishError(text, true);
  if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) return new PermanentPublishError(text);
  return new Error(text);
}
