import type { NetworkId } from './networks';
import type { Platform, PostStatus } from '@/lib/types';

/** Which of the post's per-platform captions a network uses (Studio writes IG/FB/X/LI/TT). */
const CAPTION_KEY: Partial<Record<NetworkId, Platform>> = {
  instagram: 'IG',
  threads: 'IG',
  facebook: 'FB',
  x: 'X',
  bluesky: 'X',
  mastodon: 'X',
  linkedin: 'LI',
  linkedin_page: 'LI',
  tiktok: 'TT',
};

export interface PostText {
  copy: string;
  caption: string;
  platform_captions: Partial<Record<Platform, string>> | null;
}

/** The body text for one network: its tailored caption if Studio wrote one, else the main copy. */
export function bodyFor(id: NetworkId, post: PostText): string {
  const key = CAPTION_KEY[id];
  const tailored = key ? post.platform_captions?.[key]?.trim() : '';
  return tailored || post.copy.trim() || post.caption.trim();
}

export type TargetStatus = 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'canceled';

/**
 * A post's overall status from its channel targets. Still moving -> scheduled;
 * all done -> published, unless any failed. Null when there is nothing to report.
 */
export function postStatusFrom(statuses: readonly TargetStatus[]): PostStatus | null {
  const live = statuses.filter((s) => s !== 'canceled' && s !== 'draft');
  if (!live.length) return null;
  if (live.some((s) => s === 'scheduled' || s === 'publishing')) return 'scheduled';
  return live.some((s) => s === 'failed') ? 'failed' : 'published';
}

/** Retry backoff after a transient failure: 2, 4, 8 ... minutes, capped at an hour. */
export function retryDelayMs(attempt: number): number {
  return Math.min(60, 2 ** Math.max(1, attempt)) * 60_000;
}

// ----------------------------------------------------------- queue slots

export interface Slot {
  weekday: number; // 0 = Sunday, as in JS Date
  localTime: string; // "HH:MM" or "HH:MM:SS"
}

/** Wall-clock parts of an instant in a time zone. */
function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { year: +get('year'), month: +get('month'), day: +get('day'), hour: +get('hour'), minute: +get('minute'), second: +get('second'), weekday: weekdays.indexOf(get('weekday')) };
}

/** "YYYY-MM-DD" and "HH:MM" of an instant on a time zone's wall clock (for date/time inputs). */
export function zonedInputValues(date: Date, timeZone: string): { date: string; time: string } {
  const p = zonedParts(date, timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

/** The UTC instant at which a time zone's wall clock reads the given date and time. */
export function zonedTimeToUtc(year: number, month: number, day: number, hour: number, minute: number, timeZone: string): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  // correct by the zone's offset at that moment; twice handles a DST change between guess and target
  let utc = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(utc), timeZone);
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    utc += guess - shown;
  }
  return new Date(utc);
}

/**
 * The earliest queue slot after `after` that is not already taken, looking up to
 * `daysAhead` days ahead in the brand's time zone. Null when no slots are set.
 */
export function nextFreeSlot(slots: readonly Slot[], timeZone: string, after: Date, taken: readonly Date[], daysAhead = 28): Date | null {
  if (!slots.length) return null;
  const takenMs = new Set(taken.map((d) => Math.floor(d.getTime() / 60_000)));
  const start = zonedParts(after, timeZone);
  for (let d = 0; d <= daysAhead; d++) {
    // walk calendar days in the zone using a UTC noon anchor (never crosses a date line by DST)
    const anchor = new Date(Date.UTC(start.year, start.month - 1, start.day + d, 12));
    const weekday = anchor.getUTCDay();
    const dayCandidates = slots
      .filter((s) => s.weekday === weekday)
      .map((s) => {
        const [h, m] = s.localTime.split(':').map(Number);
        return zonedTimeToUtc(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, anchor.getUTCDate(), h, m, timeZone);
      })
      .filter((t) => t.getTime() > after.getTime() && !takenMs.has(Math.floor(t.getTime() / 60_000)))
      .sort((a, b) => a.getTime() - b.getTime());
    if (dayCandidates.length) return dayCandidates[0];
  }
  return null;
}
