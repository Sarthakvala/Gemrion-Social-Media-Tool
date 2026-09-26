import { PLATFORMS, type Platform } from '@/lib/types';
import type { PostContent } from './schema';
import type { PostFormat, Aspect, Slide } from './types';

const MAX_CAROUSEL_SLIDES = 8;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "GMT+05:30" style offset for a zone at a given instant, e.g. "+05:30". */
export function zoneOffset(timeZone: string, at: Date): string {
  const name = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')?.value;
  const match = name?.match(/GMT([+-]\d{2}:\d{2})/);
  return match ? match[1] : '+00:00';
}

export function parseTime(value: string): string {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return '10:00';
  const h = Math.min(23, Number(m[1]));
  const min = Math.min(59, Number(m[2]));
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** A valid YYYY-MM-DD inside [start, end]; invalid or out-of-range dates snap to the nearest edge. */
export function clampDate(date: string, start: string, end: string): string {
  const d = ISO_DATE.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ? date : start;
  if (d < start) return start;
  if (d > end) return end;
  return d;
}

/** Local wall-clock date/time in the brand's zone -> UTC ISO string. */
export function toScheduledIso(date: string, time: string, timeZone: string): string {
  const local = `${date}T${parseTime(time)}:00`;
  const offset = zoneOffset(timeZone, new Date(`${local}Z`));
  return new Date(`${local}${offset}`).toISOString();
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function normalizeHashtags(tags: string[]): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const tag = '#' + raw.replace(/^#+/, '').replace(/[^\p{L}\p{M}\p{N}_]/gu, '');
    if (tag.length < 2) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
  }
  return out.join(' ');
}

export function normalizeSlides(slides: Slide[], format: PostFormat): Slide[] {
  const clean = slides
    .filter((s) => s.headline.trim() || s.stat.trim() || s.points.length)
    .map((s) => ({
      layout: s.layout,
      kicker: s.kicker.trim(),
      headline: s.headline.trim(),
      body: s.body.trim(),
      points: s.layout === 'list' ? s.points.map((p) => p.trim()).filter(Boolean).slice(0, 6) : [],
      stat: s.layout === 'stat' ? s.stat.trim() : '',
    }));

  if (format === 'carousel') return clean.slice(0, MAX_CAROUSEL_SLIDES);
  return clean.slice(0, 1);
}

export interface Slot {
  date: string;
  time: string;
  pillar: string;
  format: PostFormat;
  aspect: Aspect;
}

export interface PostRowFromDraft {
  client_id: string;
  title: string;
  hook: string;
  pillar: string;
  format: PostFormat;
  aspect: Aspect;
  copy: string;
  caption: string;
  hashtags: string;
  platforms: Platform[];
  platform_captions: Partial<Record<Platform, string>>;
  visual_brief: string;
  slides_content: Slide[];
  scheduled_at: string;
}

export function contentToPostRow(
  content: PostContent,
  slot: Slot,
  opts: { clientId: string; timeZone: string; platforms: Platform[] }
): PostRowFromDraft {
  const platforms = PLATFORMS.filter((p) => opts.platforms.includes(p));

  const platform_captions: Partial<Record<Platform, string>> = {};
  for (const p of platforms) {
    const text = content.platform_captions[p]?.trim();
    if (text) platform_captions[p] = text;
  }

  const format = slot.format;
  const aspect: Aspect = format === 'story' ? '9:16' : slot.aspect;

  return {
    client_id: opts.clientId,
    title: content.title.trim() || content.hook.trim().slice(0, 60),
    hook: content.hook.trim(),
    pillar: slot.pillar.trim(),
    format,
    aspect,
    copy: content.caption.trim(),
    caption: content.short_caption.trim(),
    hashtags: normalizeHashtags(content.hashtags),
    platforms,
    platform_captions,
    visual_brief: content.visual_brief.trim(),
    slides_content: normalizeSlides(content.slides, format),
    scheduled_at: toScheduledIso(slot.date, slot.time, opts.timeZone),
  };
}
