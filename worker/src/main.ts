import { loadConfig } from './config.ts';
import { runForever, type Log } from './loop.ts';
import { supabaseQueue } from './supabaseQueue.ts';
import { pingHandler } from './handlers/ping.ts';
import { videoRenderHandler } from './handlers/videoRender.ts';
import { prepareRenderer, renderReel } from './render.ts';
import type { Handler } from './types.ts';

// one JSON line per event; never logs keys or job input
const log: Log = (message, extra) => console.log(JSON.stringify({ t: new Date().toISOString(), message, ...extra }));

const config = loadConfig(process.env);

/** Registry of job kinds this worker can run (Strategy per kind). */
const HANDLERS: Record<string, Handler> = {
  worker_ping: pingHandler,
  video_render: videoRenderHandler(renderReel, config.renderConcurrency),
};
const kinds = config.kinds.filter((k) => HANDLERS[k]);
const controller = new AbortController();

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    log('shutting down after the current job', { signal: sig });
    controller.abort();
  });
}

if (kinds.includes('video_render')) {
  log('preparing renderer (browser + bundle)');
  await prepareRenderer();
}
log('worker started', { worker: config.workerId, kinds, poll_ms: config.pollMs, render_concurrency: config.renderConcurrency });
await runForever(supabaseQueue(config.supabaseUrl, config.serviceKey, config.workerId, kinds), HANDLERS, {
  ...config,
  signal: controller.signal,
  log,
});
