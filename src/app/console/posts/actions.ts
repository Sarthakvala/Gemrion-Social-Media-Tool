'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORMS, type Platform } from '@/lib/types';

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
    scheduled_at: date ? new Date(`${date}T${time}`).toISOString() : null,
    status: String(formData.get('status') || 'scheduled'),
    enabled: formData.get('enabled') === 'on',
  };

  if (!values.client_id) throw new Error('Pick a client.');

  const admin = createAdminClient();

  if (id) {
    const { error } = await admin.from('posts').update(values).eq('id', id);
    if (error) throw new Error(error.message);
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
