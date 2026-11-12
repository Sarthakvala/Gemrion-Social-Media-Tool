'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const Id = z.string().uuid();
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function refresh(clientId: string) {
  revalidatePath(`/console/clients/${clientId}/channels`);
}

/** Adds one queue time on one or more weekdays ("Add to queue" picks the next free one). */
export async function addSlots(formData: FormData): Promise<void> {
  await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  const time = String(formData.get('time') || '');
  const days = formData.getAll('weekday').map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  if (!Id.safeParse(clientId).success || !TIME.test(time) || !days.length) return;
  const rows = days.map((weekday) => ({ client_id: clientId, weekday, local_time: time }));
  // duplicates are ignored by the unique index
  await createAdminClient().from('posting_slots').upsert(rows, { onConflict: 'client_id,weekday,local_time', ignoreDuplicates: true });
  refresh(clientId);
}

export async function removeSlot(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(id).success || !Id.safeParse(clientId).success) return;
  await createAdminClient().from('posting_slots').delete().eq('id', id).eq('client_id', clientId);
  refresh(clientId);
}

export async function saveSignature(formData: FormData): Promise<void> {
  await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const body = String(formData.get('body') || '').trim().slice(0, 2000);
  const isDefault = formData.get('is_default') === 'on';
  if (!Id.safeParse(clientId).success || !name || !body) return;
  const admin = createAdminClient();
  // only one default per brand (enforced by a unique index); clear the old one first
  if (isDefault) await admin.from('signatures').update({ is_default: false }).eq('client_id', clientId).eq('is_default', true);
  await admin.from('signatures').upsert({ client_id: clientId, name, body, is_default: isDefault }, { onConflict: 'client_id,name' });
  refresh(clientId);
}

export async function removeSignature(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(id).success || !Id.safeParse(clientId).success) return;
  await createAdminClient().from('signatures').delete().eq('id', id).eq('client_id', clientId);
  refresh(clientId);
}

export async function saveHashtagGroup(formData: FormData): Promise<void> {
  await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  const name = String(formData.get('name') || '').trim().slice(0, 80);
  const tags = [...new Set(String(formData.get('tags') || '').split(/[\s,]+/).map((t) => t.replace(/^#+/, '').trim()).filter((t) => /^[\p{L}\p{N}_]{1,60}$/u.test(t)))].slice(0, 30);
  if (!Id.safeParse(clientId).success || !name || !tags.length) return;
  await createAdminClient().from('hashtag_groups').upsert({ client_id: clientId, name, tags }, { onConflict: 'client_id,name' });
  refresh(clientId);
}

export async function removeHashtagGroup(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(id).success || !Id.safeParse(clientId).success) return;
  await createAdminClient().from('hashtag_groups').delete().eq('id', id).eq('client_id', clientId);
  refresh(clientId);
}
