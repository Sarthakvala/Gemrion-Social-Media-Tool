import { loadConfig } from './config.ts';
import { runForever, type Log } from './loop.ts';
import { supabaseQueue } from './supabaseQueue.ts';
import { pingHandler } from './handlers/ping.ts';
import type { Handler } from './types.ts';

/** Registry of job kinds this worker can run. Phase 2 adds video_render. */
const HANDLERS: Record<string, Handler> = {
  worker_ping: pingHandler,
};

// one JSON line per event; never logs keys or job input
const log: Log = (message, extra) => console.log(JSON.stringify({ t: new Date().toISOString(), message, ...extra }));

const config = loadConfig(process.env);
const kinds = config.kinds.filter((k) => HANDLERS[k]);
const controller = new AbortController();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log('shutting down after the current job', { signal: sig });
    controller.abort();
  });
}

log('worker started', { worker: config.workerId, kinds, poll_ms: config.pollMs });
await runForever(supabaseQueue(config.supabaseUrl, config.serviceKey, config.workerId, kinds), HANDLERS, {
  ...config,
  signal: controller.signal,
  log,
});
