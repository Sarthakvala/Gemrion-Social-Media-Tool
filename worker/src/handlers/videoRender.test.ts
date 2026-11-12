import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { videoRenderHandler } from './videoRender.ts';
import { PermanentError, type ClaimedJob, type HandlerContext } from '../types.ts';
import type { RenderReel } from '../render.ts';
import { SAMPLE_SPEC } from '../../remotion/sample.ts';

const job = (input: Record<string, unknown>, over: Partial<ClaimedJob> = {}): ClaimedJob => ({
  id: 'job-1234abcd',
  client_id: 'brand-1',
  kind: 'video_render',
  playbook: '',
  input,
  attempts: 1,
  max_attempts: 3,
  ...over,
});

function ctx(): HandlerContext & { uploads: unknown[] } {
  const uploads: unknown[] = [];
  return {
    uploads,
    workerId: 'w1',
    log: () => {},
    uploadAsset: vi.fn(async (a) => {
      uploads.push(a);
      return { assetId: 'asset-1', path: 'brand-1/2026-10/x.mp4' };
    }),
  };
}

/** Writes a fake MP4 where the real renderer would. */
const fakeRender: RenderReel = vi.fn(async (_spec, out) => {
  await writeFile(out, new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]));
  return { width: 1080, height: 1920, durationMs: 16000 };
});

describe('videoRenderHandler', () => {
  it('renders, uploads a reel asset with dimensions, and cleans up the temp file', async () => {
    const c = ctx();
    let outPath = '';
    const render: RenderReel = async (spec, out, opts) => {
      outPath = out;
      return fakeRender(spec, out, opts);
    };
    const output = await videoRenderHandler(render, 2)(job({ spec: SAMPLE_SPEC, reel_id: 'reel-9' }), c);

    expect(output).toMatchObject({ asset_id: 'asset-1', reel_id: 'reel-9', duration_ms: 16000, bytes: 8 });
    expect(c.uploads[0]).toMatchObject({ kind: 'reel', contentType: 'video/mp4', width: 1080, height: 1920, durationMs: 16000, fileName: 'sample-reel.mp4' });
    expect(existsSync(outPath)).toBe(false);
  });

  it('fails permanently on an invalid spec without rendering', async () => {
    const render = vi.fn() as unknown as RenderReel;
    await expect(videoRenderHandler(render, 2)(job({ spec: { ...SAMPLE_SPEC, beats: [] } }), ctx())).rejects.toBeInstanceOf(PermanentError);
    expect(render).not.toHaveBeenCalled();
  });

  it('fails permanently without a brand', async () => {
    await expect(videoRenderHandler(fakeRender, 2)(job({ spec: SAMPLE_SPEC }, { client_id: null }), ctx())).rejects.toBeInstanceOf(PermanentError);
  });

  it('lets render errors through as retryable and still cleans up', async () => {
    let outPath = '';
    const broken: RenderReel = async (_s, out) => {
      outPath = out;
      await writeFile(out, 'partial');
      throw new Error('Chrome crashed');
    };
    const err = await videoRenderHandler(broken, 2)(job({ spec: SAMPLE_SPEC }), ctx()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(PermanentError);
    expect(existsSync(outPath)).toBe(false);
  });
});
