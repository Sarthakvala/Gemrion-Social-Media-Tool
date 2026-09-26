import { PLATFORM_NAMES, type Platform } from '@/lib/types';
import type { PlatformCaptions } from './types';

export interface ExportablePost {
  id: string;
  title: string;
  pillar: string;
  format: string;
  hook: string;
  copy: string;
  caption: string;
  hashtags: string;
  platforms: Platform[];
  platform_captions: PlatformCaptions;
  visual_brief: string;
  scheduled_at: string | null;
  slides_content: unknown[];
}

export function slugify(text: string, max = 40): string {
  const slug = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/, '');
  return slug || 'post';
}

export function dateStamp(iso: string | null): string {
  return iso ? iso.slice(0, 10) : 'unscheduled';
}

/** Hashtags each platform rewards; the list is stored in priority order, so we keep the first N. */
export const HASHTAG_LIMIT: Record<Platform, number> = { IG: 5, TT: 5, LI: 5, X: 2, FB: 2 };

export function hashtagsFor(hashtags: string, platform: Platform): string {
  return hashtags.split(/\s+/).filter(Boolean).slice(0, HASHTAG_LIMIT[platform]).join(' ');
}

/** Caption for one platform: tailored text if present, else the main caption, plus that platform's hashtags. */
export function captionFor(post: ExportablePost, platform: Platform): string {
  const base =
    post.platform_captions?.[platform]?.trim() ||
    (platform === 'X' ? post.caption.trim() || post.copy.trim() : post.copy.trim() || post.caption.trim());
  const tags = hashtagsFor(post.hashtags, platform);
  return tags ? `${base}\n\n${tags}` : base;
}

/** The text file staff copy from when posting by hand. */
export function captionsFile(post: ExportablePost): string {
  const lines = [
    post.title,
    `Date: ${post.scheduled_at ? new Date(post.scheduled_at).toString() : 'unscheduled'}`,
    `Pillar: ${post.pillar || '-'} | Format: ${post.format}`,
    '',
  ];
  for (const p of post.platforms) {
    lines.push(`===== ${PLATFORM_NAMES[p]} =====`, captionFor(post, p), '');
  }
  if (post.visual_brief) lines.push('===== Visual brief =====', post.visual_brief, '');
  return lines.join('\n');
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function calendarCsv(posts: ExportablePost[]): string {
  const header = ['date', 'time_utc', 'title', 'pillar', 'format', 'platforms', 'slides', 'hook', 'caption', 'hashtags', 'folder'];
  const rows = posts.map((p, i) => [
    dateStamp(p.scheduled_at),
    p.scheduled_at ? p.scheduled_at.slice(11, 16) : '',
    p.title,
    p.pillar,
    p.format,
    p.platforms.join(' '),
    String(p.slides_content.length),
    p.hook,
    p.copy,
    p.hashtags,
    postFolderName(p, i),
  ]);
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

export function postFolderName(post: ExportablePost, index: number): string {
  return `${String(index + 1).padStart(2, '0')}-${dateStamp(post.scheduled_at)}-${slugify(post.title)}`;
}
