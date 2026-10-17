import { hostname } from 'node:os';

export interface WorkerConfig {
  supabaseUrl: string;
  serviceKey: string;
  workerId: string;
  kinds: string[];
  pollMs: number;
  heartbeatMs: number;
}

const DEFAULT_KINDS = ['worker_ping', 'video_render'];

function int(value: string | undefined, fallback: number, min: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

/** Reads and validates the environment; fails fast with a readable message. */
export function loadConfig(env: Record<string, string | undefined>): WorkerConfig {
  const supabaseUrl = env.SUPABASE_URL?.trim() ?? '';
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? '';
  const missing = [!supabaseUrl && 'SUPABASE_URL', !serviceKey && 'SUPABASE_SERVICE_ROLE_KEY'].filter(Boolean);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} in worker/.env`);
  if (!/^https:\/\//.test(supabaseUrl)) throw new Error('SUPABASE_URL must start with https://');

  return {
    supabaseUrl,
    serviceKey,
    workerId: env.WORKER_ID?.trim() || `${hostname()}-${process.pid}`,
    kinds: env.WORKER_KINDS?.split(',').map((k) => k.trim()).filter(Boolean) || DEFAULT_KINDS,
    pollMs: int(env.POLL_MS, 5000, 1000),
    heartbeatMs: int(env.HEARTBEAT_MS, 60_000, 5000),
  };
}
