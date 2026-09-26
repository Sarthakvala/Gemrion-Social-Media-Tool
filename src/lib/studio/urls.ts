import type { Post } from '@/lib/types';
import type { ZipPost } from './zip';

export function toZipPost(p: Post): ZipPost {
  return {
    id: p.id,
    title: p.title,
    pillar: p.pillar,
    format: p.format,
    hook: p.hook,
    copy: p.copy,
    caption: p.caption,
    hashtags: p.hashtags,
    platforms: p.platforms,
    platform_captions: p.platform_captions ?? {},
    visual_brief: p.visual_brief,
    scheduled_at: p.scheduled_at,
    slides_content: p.slides_content ?? [],
    urls: slideUrls(p),
  };
}

/** Rendered slide URLs for generated posts, else the uploaded creative URLs. */
export function slideUrls(post: Pick<Post, 'id' | 'slides_content' | 'slides' | 'image_url' | 'updated_at'>): string[] {
  const count = post.slides_content?.length ?? 0;
  if (count > 0) {
    const v = encodeURIComponent(post.updated_at ?? '');
    return Array.from({ length: count }, (_, i) => `/api/render?post=${post.id}&slide=${i}&v=${v}`);
  }
  if (post.slides?.length) return post.slides;
  return post.image_url ? [post.image_url] : [];
}

export const ASPECT_CLASS: Record<string, string> = {
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
  '9:16': 'aspect-[9/16]',
};
