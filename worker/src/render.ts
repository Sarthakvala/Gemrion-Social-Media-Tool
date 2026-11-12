import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bundle } from '@remotion/bundler';
import { ensureBrowser, renderMedia, selectComposition } from '@remotion/renderer';
import type { ReelSpec } from '../../src/lib/video/spec.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const ENTRY = path.join(here, '..', 'remotion', 'index.ts');
const COMPOSITION = 'Reel';

export interface RenderResult {
  width: number;
  height: number;
  durationMs: number;
}

export interface RenderOptions {
  concurrency: number;
  onProgress?: (progress: number) => void;
}

export type RenderReel = (spec: ReelSpec, outputLocation: string, opts: RenderOptions) => Promise<RenderResult>;

// The bundle is built once per worker process and reused by every render.
let bundled: Promise<string> | null = null;

function getBundle(): Promise<string> {
  bundled ??= bundle({ entryPoint: ENTRY }).catch((e: unknown) => {
    bundled = null; // let the next job retry a failed build
    throw e;
  });
  return bundled;
}

/** Downloads Chrome Headless Shell if missing, and builds the bundle, before the first job. */
export async function prepareRenderer(): Promise<void> {
  await ensureBrowser();
  await getBundle();
}

/** Renders one reel to an H.264 MP4 at `outputLocation`. */
export const renderReel: RenderReel = async (spec, outputLocation, opts) => {
  const serveUrl = await getBundle();
  const inputProps = { spec };
  const composition = await selectComposition({ serveUrl, id: COMPOSITION, inputProps });
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation,
    inputProps,
    concurrency: opts.concurrency,
    // recommended for Debian containers; ignored elsewhere
    chromiumOptions: { enableMultiProcessOnLinux: true },
    onProgress: ({ progress }) => opts.onProgress?.(progress),
  });
  return {
    width: composition.width,
    height: composition.height,
    durationMs: Math.round((composition.durationInFrames / composition.fps) * 1000),
  };
};
