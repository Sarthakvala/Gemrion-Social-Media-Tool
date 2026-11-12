'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { nextFreeSlot } from '@/lib/publishing/plan';
import { rollUpPost } from '@/lib/publishing/engine';

export interface TargetsResult {
  ok: boolean;
  message: string;
}

const Input = z.object({
  postId: z.string().uuid(),
  when: z.enum(['post', 'queue', 'now']),
  channels: z
    .array(z.object({ channelId: z.string().uuid(), selected: z.boolean(), text: z.string().max(40_000), firstComment: z.string().max(2000) }))
    .max(50),
});

/**
 * Sets where and when a post goes out. Selected channels get a scheduled target;
 * deselected ones that have not gone out are canceled. Targets wait for client
 * approval in the database (claim_due_targets), so scheduling early is safe.
 */
export async function saveTargets(input: unknown): Promise<TargetsResult> {
  await requireAgency();
  const parsed = Input.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Invalid selection.' };
  const { postId, when, channels } = parsed.data;
  const admin = createAdminClient();

  const { data: post } = await admin.from('posts').select('id, client_id, scheduled_at, approval, enabled').eq('id', postId).maybeSingle();
  if (!post) return { ok: false, message: 'Post not found.' };
  const { data: owned } = await admin.from('channels').select('id').eq('client_id', post.client_id).eq('status', 'active');
  const ownedIds = new Set((owned ?? []).map((c) => c.id as string));
  const selected = channels.filter((c) => c.selected && ownedIds.has(c.channelId));
  if (!selected.length) return { ok: false, message: 'Pick at least one connected channel.' };

  let at: Date;
  if (when === 'now') at = new Date();
  else if (when === 'post') {
    if (!post.scheduled_at) return { ok: false, message: 'Set a date and time on the post first, or use the queue.' };
    at = new Date(post.scheduled_at as string);
  } else {
    const [{ data: slots }, { data: kit }, { data: taken }] = await Promise.all([
      admin.from('posting_slots').select('weekday, local_time').eq('client_id', post.client_id),
      admin.from('brand_profiles').select('timezone').eq('client_id', post.client_id).maybeSingle(),
      admin.from('post_targets').select('scheduled_at').eq('client_id', post.client_id).in('status', ['scheduled', 'publishing']).neq('post_id', postId),
    ]);
    const slot = nextFreeSlot(
      (slots ?? []).map((s) => ({ weekday: s.weekday as number, localTime: s.local_time as string })),
      (kit?.timezone as string) || 'UTC',
      new Date(),
      (taken ?? []).map((t) => new Date(t.scheduled_at as string))
    );
    if (!slot) return { ok: false, message: 'No queue times set for this brand. Add them on the Channels page.' };
    at = slot;
  }

  const rows = selected.map((c) => ({
    post_id: postId,
    channel_id: c.channelId,
    client_id: post.client_id as string,
    text: c.text.trim(),
    settings: c.firstComment.trim() ? { firstComment: c.firstComment.trim() } : {},
    status: 'scheduled',
    scheduled_at: at.toISOString(),
    attempts: 0,
    error: null,
  }));
  const { error } = await admin.from('post_targets').upsert(rows, { onConflict: 'post_id,channel_id' });
  if (error) return { ok: false, message: error.message };

  const keep = selected.map((c) => c.channelId);
  await admin
    .from('post_targets')
    .update({ status: 'canceled' })
    .eq('post_id', postId)
    .in('status', ['draft', 'scheduled'])
    .not('channel_id', 'in', `(${keep.join(',')})`);
  await admin.from('posts').update({ status: 'scheduled', scheduled_at: at.toISOString() }).eq('id', postId);

  revalidatePath(`/console/posts/${postId}`);
  revalidatePath('/console/calendar');
  const wait = post.approval !== 'approved' ? ' It goes out once the client approves it.' : !post.enabled ? ' The post is switched off, so it will not go out until enabled.' : '';
  return { ok: true, message: `Scheduled on ${selected.length} channel${selected.length === 1 ? '' : 's'} for ${at.toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC.${wait}` };
}

const Id = z.string().uuid();

export async function cancelTarget(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  if (!Id.safeParse(id).success) return;
  const admin = createAdminClient();
  const { data } = await admin.from('post_targets').update({ status: 'canceled' }).eq('id', id).in('status', ['draft', 'scheduled']).select('post_id').maybeSingle();
  if (data) {
    await rollUpPost(admin, data.post_id as string);
    revalidatePath(`/console/posts/${data.post_id}`);
  }
}

export async function retryTarget(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  if (!Id.safeParse(id).success) return;
  const admin = createAdminClient();
  const { data } = await admin
    .from('post_targets')
    .update({ status: 'scheduled', attempts: 0, error: null, scheduled_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['failed', 'canceled'])
    .select('post_id')
    .maybeSingle();
  if (data) {
    await admin.from('posts').update({ status: 'scheduled' }).eq('id', data.post_id);
    revalidatePath(`/console/posts/${data.post_id}`);
  }
}
