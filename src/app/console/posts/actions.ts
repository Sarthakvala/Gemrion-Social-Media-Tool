'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORMS, type Platform } from '@/lib/types';
import { zonedTimeToUtc } from '@/lib/publishing/plan';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/** The picked date and time are wall-clock time in the brand's zone, not the server's (UTC on Vercel). */
function scheduledAt(date: string, time: string, timeZone: string): string | null {
  if (!DATE.test(date) || !TIME.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return zonedTimeToUtc(y, m, d, h, min, timeZone).toISOString();
}

/**
 * Agency-side write. Uses the service-role client, which bypasses RLS, so
 * requireAgency() is the only thing standing between a caller and every
 * client's data. It runs first, always.
 */
export async function savePost(formData: FormData) {
  await requireAgency();

  const id = String(formData.get('id') || '');
  const date = String(formData.get('date') || '');
  const time = String(formData.get('time') || '10:00');

  const platforms = PLATFORMS.filter((p) =>
    formData.get(`platform_${p}`)
  ) as Platform[];

  const values = {
    client_id: String(formData.get('client_id') || ''),
    title: String(formData.get('title') || '').trim(),
    copy: String(formData.get('copy') || ''),
    caption: String(formData.get('caption') || ''),
    hashtags: String(formData.get('hashtags') || ''),
    link: String(formData.get('link') || ''),
    image_url: String(formData.get('image_url') || ''),
    platforms,
    scheduled_at: null as string | null,
    status: String(formData.get('status') || 'scheduled'),
    enabled: formData.get('enabled') === 'on',
  };

  if (!values.client_id) throw new Error('Pick a client.');

  const admin = createAdminClient();
  const { data: kit } = await admin.from('brand_profiles').select('timezone').eq('client_id', values.client_id).maybeSingle();
  values.scheduled_at = scheduledAt(date, time, (kit?.timezone as string) || 'UTC');

  if (id) {
    const { error } = await admin.from('posts').update(values).eq('id', id);
    if (error) throw new Error(error.message);
    // channels already scheduled for this post follow the new time
    if (values.scheduled_at) {
      await admin.from('post_targets').update({ scheduled_at: values.scheduled_at }).eq('post_id', id).eq('status', 'scheduled');
    }
  } else {
    const { data, error } = await admin
      .from('posts')
      .insert(values)
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    revalidatePath('/console');
    redirect(`/console/posts/${data.id}`);
  }

  revalidatePath('/console');
  revalidatePath(`/console/posts/${id}`);
}

export async function deletePost(formData: FormData) {
  await requireAgency();
  const id = String(formData.get('id') || '');
  if (!id) return;

  const admin = createAdminClient();
  const { error } = await admin.from('posts').delete().eq('id', id);
  if (error) throw new Error(error.message);

  revalidatePath('/console');
  redirect('/console');
}
