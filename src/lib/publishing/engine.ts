import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadBrand, type LoadedBrand } from '@/lib/studio/data';
import { isNetworkId, type NetworkId } from './networks';
import { getProvider } from './registry';
import { openCredentials } from './channels';
import { resolveMedia, summarize, type PostMediaSource } from './media';
import { bodyFor, postStatusFrom, retryDelayMs, type PostText, type TargetStatus } from './plan';
import { composeText, validateForNetwork } from './text';
import { PermanentPublishError, onFailure, type MediaFile } from './types';

interface ClaimedTarget {
  id: string;
  post_id: string;
  channel_id: string;
  client_id: string;
  text: string;
  settings: Record<string, unknown>;
  attempts: number;
  max_attempts: number;
}

type PostRow = PostMediaSource & PostText & { client_id: string; hashtags: string };
interface ChannelSecret {
  id: string;
  network: string;
  secret: string;
  settings: Record<string, unknown>;
}

export interface PublishReport {
  claimed: number;
  published: number;
  retrying: number;
  failed: number;
}

const POST_COLUMNS = 'id, client_id, title, aspect, slides_content, image_url, video_url, copy, caption, hashtags, platform_captions';

/**
 * Publishes every due, approved target (claimed atomically by claim_due_targets),
 * records each outcome, and rolls the post status up from its targets. Safe to
 * run concurrently: a target is only ever held by one run.
 */
export async function publishDue(db: SupabaseClient, opts: { batch?: number; deadline?: number } = {}): Promise<PublishReport> {
  const deadline = opts.deadline ?? Date.now() + 50_000;
  const { data, error } = await db.rpc('claim_due_targets', { batch: opts.batch ?? 20 });
  if (error) throw new Error(`claim_due_targets failed: ${error.message}`);
  const targets = (data ?? []) as ClaimedTarget[];
  const report: PublishReport = { claimed: targets.length, published: 0, retrying: 0, failed: 0 };

  const brands = new Map<string, LoadedBrand | null>();
  const media = new Map<string, Promise<{ files: MediaFile[]; videos: number }>>();
  const touchedPosts = new Set<string>();

  for (const t of targets) {
    touchedPosts.add(t.post_id);
    if (Date.now() > deadline) {
      // out of time: hand it back untouched (attempt not counted against it)
      await db.from('post_targets').update({ status: 'scheduled', locked_at: null, attempts: Math.max(0, t.attempts - 1) }).eq('id', t.id);
      continue;
    }
    const outcome = await publishOne(db, t, brands, media).catch((e: unknown) => ({ error: e }));
    if ('url' in outcome) {
      report.published++;
      await db.from('post_targets').update({ status: 'published', external_id: outcome.externalId, external_url: outcome.url, error: null, locked_at: null, published_at: new Date().toISOString() }).eq('id', t.id);
      continue;
    }
    const err = outcome.error;
    const message = (err instanceof Error ? err.message : String(err)).slice(0, 1000);
    const next = onFailure(err, t.attempts, t.max_attempts);
    if (next.action === 'retry') {
      report.retrying++;
      await db.from('post_targets').update({ status: 'scheduled', error: message, locked_at: null, scheduled_at: new Date(Date.now() + retryDelayMs(next.delayAttempt)).toISOString() }).eq('id', t.id);
    } else {
      report.failed++;
      await db.from('post_targets').update({ status: 'failed', error: message, locked_at: null }).eq('id', t.id);
      if (next.expireChannel) await db.from('channels').update({ status: 'expired', last_error: message }).eq('id', t.channel_id);
    }
  }

  for (const postId of touchedPosts) await rollUpPost(db, postId);
  return report;
}

async function publishOne(
  db: SupabaseClient,
  t: ClaimedTarget,
  brands: Map<string, LoadedBrand | null>,
  media: Map<string, Promise<{ files: MediaFile[]; videos: number }>>
): Promise<{ externalId: string; url: string | null }> {
  const [{ data: post }, { data: channel }, { data: signature }] = await Promise.all([
    db.from('posts').select(POST_COLUMNS).eq('id', t.post_id).maybeSingle(),
    db.from('channels').select('id, network, secret, settings').eq('id', t.channel_id).maybeSingle(),
    db.from('signatures').select('body').eq('client_id', t.client_id).eq('is_default', true).maybeSingle(),
  ]);
  if (!post) throw new PermanentPublishError('The post was deleted.');
  if (!channel) throw new PermanentPublishError('The channel was removed.');
  const ch = channel as ChannelSecret;
  if (!isNetworkId(ch.network)) throw new PermanentPublishError(`Unknown network ${ch.network}.`);
  const networkId: NetworkId = ch.network;
  const provider = getProvider(networkId);
  if (!provider) throw new PermanentPublishError(`Publishing to ${networkId} is not available yet.`);

  if (!brands.has(t.client_id)) brands.set(t.client_id, await loadBrand(db, t.client_id));
  const brand = brands.get(t.client_id);
  if (!brand) throw new PermanentPublishError('Brand not found.');

  const p = post as PostRow;
  // the same slides are rendered once per run, however many channels the post goes to
  if (!media.has(p.id)) media.set(p.id, resolveMedia(p, brand));
  const { files, videos } = await media.get(p.id)!;

  const text = t.text.trim() || composeText({ body: bodyFor(networkId, p), signature: signature?.body as string | undefined, hashtags: p.hashtags });
  const problems = validateForNetwork(networkId, text, summarize(files, videos));
  if (problems.length) throw new PermanentPublishError(problems.join(' '));

  const firstComment = typeof t.settings.firstComment === 'string' ? t.settings.firstComment : undefined;
  const settings = { ...ch.settings, ...t.settings, idempotencyKey: t.id };
  const result = await provider.publish(openCredentials(ch.secret), { text, media: files, firstComment, settings });
  return { externalId: result.externalId, url: result.url };
}

/** Post status follows its targets, so the calendar and portal show one truthful state. */
export async function rollUpPost(db: SupabaseClient, postId: string): Promise<void> {
  const { data } = await db.from('post_targets').select('status, error, published_at').eq('post_id', postId);
  const rows = (data ?? []) as { status: TargetStatus; error: string | null; published_at: string | null }[];
  const status = postStatusFrom(rows.map((r) => r.status));
  if (!status) return;
  const firstError = rows.find((r) => r.status === 'failed')?.error ?? null;
  const publishedAt = rows.map((r) => r.published_at).filter(Boolean).sort()[0] ?? null;
  await db.from('posts').update({ status, publish_error: firstError, ...(publishedAt ? { published_at: publishedAt } : {}) }).eq('id', postId);
}
