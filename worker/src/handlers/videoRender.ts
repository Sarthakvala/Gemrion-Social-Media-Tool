import { readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ReelSpecSchema, specProblem } from '../../../src/lib/video/spec.ts';
import { PermanentError, type Handler } from '../types.ts';
import type { RenderReel } from '../render.ts';

const PROGRESS_STEP = 0.25;

function slug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'reel';
}

/**
 * Renders a reel spec to MP4 and stores it as a `reel` asset for approval.
 * The renderer is injected so the handler can be tested without Chrome.
 */
export function videoRenderHandler(render: RenderReel, concurrency: number): Handler {
  return async (job, ctx) => {
    if (!job.client_id) throw new PermanentError('A render needs a brand.');
    const parsed = ReelSpecSchema.safeParse(job.input.spec);
    if (!parsed.success) throw new PermanentError(`Invalid reel spec: ${specProblem(job.input.spec)}`);
    const spec = parsed.data;
    const reelId = typeof job.input.reel_id === 'string' ? job.input.reel_id : null;

    const out = path.join(tmpdir(), `agencyflow-${job.id}.mp4`);
    let reported = 0;
    try {
      const result = await render(spec, out, {
        concurrency,
        onProgress: (p) => {
          if (p - reported >= PROGRESS_STEP) {
            reported = p;
            ctx.log('rendering', { progress: Math.round(p * 100) });
          }
        },
      });
      const body = new Uint8Array(await readFile(out));
      const { assetId, path: stored } = await ctx.uploadAsset({
        clientId: job.client_id,
        jobId: job.id,
        fileName: `${slug(spec.title)}.mp4`,
        body,
        contentType: 'video/mp4',
        kind: 'reel',
        title: spec.title,
        width: result.width,
        height: result.height,
        durationMs: result.durationMs,
        meta: { source: 'video_render', reel_id: reelId, aspect: spec.aspect },
      });
      return { asset_id: assetId, path: stored, reel_id: reelId, duration_ms: result.durationMs, bytes: body.byteLength };
    } finally {
      await rm(out, { force: true });
    }
  };
}
