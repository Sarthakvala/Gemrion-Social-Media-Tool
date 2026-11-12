import 'server-only';
import type { LoadedBrand } from '@/lib/studio/data';
import { aspectOf, renderSlidePng } from '@/lib/studio/renderSlide';
import type { Slide } from '@/lib/studio/types';
import type { MediaFile } from './types';
import type { MediaSummary } from './text';

const MAX_REMOTE_BYTES = 20 * 1024 * 1024;

export interface PostMediaSource {
  id: string;
  title: string;
  aspect: string | null;
  slides_content: Slide[] | null;
  image_url: string;
  video_url: string;
}

async function fetchImage(url: string, alt: string): Promise<MediaFile> {
  // only our own public creatives bucket is fetched server side (no arbitrary URLs)
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/creatives/`;
  if (!url.startsWith(base)) throw new Error('Image is not in the creatives library; re-upload it.');
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load the image (${res.status}).`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.byteLength > MAX_REMOTE_BYTES) throw new Error('Image is over 20 MB.');
  const mime = res.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  return { bytes, mime, filename: url.split('/').pop() || 'image', alt };
}

/**
 * The post's visuals as files ready to upload: rendered brand slides first,
 * otherwise the uploaded image. Videos are reported but not loaded here (large
 * uploads go through the worker).
 */
export async function resolveMedia(post: PostMediaSource, brand: LoadedBrand): Promise<{ files: MediaFile[]; videos: number }> {
  const slides = (post.slides_content ?? []).filter(Boolean);
  if (slides.length) {
    const aspect = aspectOf(post.aspect);
    const files: MediaFile[] = [];
    for (let i = 0; i < slides.length; i++) {
      const png = await renderSlidePng(brand, slides, i, aspect);
      files.push({ bytes: png.bytes, mime: 'image/png', filename: `slide-${i + 1}.png`, alt: [slides[i].headline, slides[i].body].filter(Boolean).join('. ').slice(0, 1000), width: png.width, height: png.height });
    }
    return { files, videos: 0 };
  }
  if (post.image_url) return { files: [await fetchImage(post.image_url, post.title)], videos: 0 };
  return { files: [], videos: post.video_url ? 1 : 0 };
}

export function summarize(files: MediaFile[], videos: number): MediaSummary {
  return { images: files.length, videos, largestImageBytes: files.reduce((n, f) => Math.max(n, f.bytes.byteLength), 0) };
}
