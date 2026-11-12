// Renders the sample spec to worker/out/sample.mp4 without touching Supabase.
// Smoke test for the renderer: `npm run render:sample` inside worker/.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareRenderer, renderReel } from './render.ts';
import { SAMPLE_SPEC } from '../remotion/sample.ts';

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'out', 'sample.mp4');
await mkdir(path.dirname(out), { recursive: true });
const started = Date.now();
await prepareRenderer();
let last = -1;
const result = await renderReel(SAMPLE_SPEC, out, {
  concurrency: 2,
  onProgress: (p) => {
    const pct = Math.floor(p * 10) * 10;
    if (pct !== last) {
      last = pct;
      console.log(`render ${pct}%`);
    }
  },
});
console.log(JSON.stringify({ out, ...result, seconds: Math.round((Date.now() - started) / 1000) }));
