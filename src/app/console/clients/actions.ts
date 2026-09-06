'use server';

import { revalidatePath } from 'next/cache';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

export async function createClientAction(formData: FormData) {
  await requireAgency();
  const name = String(formData.get('name') || '').trim();
  const color = String(formData.get('color') || '#ff5a1f');
  if (!name) throw new Error('Client name is required.');

  const admin = createAdminClient();
  const { error } = await admin.from('clients').insert({ name, color });
  if (error) throw new Error(error.message);

  revalidatePath('/console/clients');
  revalidatePath('/console');
}

export async function inviteUserAction(formData: FormData) {
  await requireAgency();
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const clientId = String(formData.get('client_id') || '');
  if (!email || !clientId) throw new Error('Email and client are required.');

  const admin = createAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id')
    .eq('email', email)
    .single();

  if (!profile) {
    throw new Error(
      `No account found for ${email}. Ask them to sign in at /login first, then invite again.`
    );
  }

  const { error } = await admin.from('client_users').upsert(
    { user_id: profile.id, client_id: clientId },
    { onConflict: 'user_id,client_id' }
  );
  if (error) throw new Error(error.message);

  revalidatePath('/console/clients');
}

export async function removeUserAction(formData: FormData) {
  await requireAgency();
  const userId = String(formData.get('user_id') || '');
  const clientId = String(formData.get('client_id') || '');
  if (!userId || !clientId) return;

  const admin = createAdminClient();
  const { error } = await admin
    .from('client_users')
    .delete()
    .eq('user_id', userId)
    .eq('client_id', clientId);
  if (error) throw new Error(error.message);

  revalidatePath('/console/clients');
}

export async function deleteClientAction(formData: FormData) {
  await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  if (!clientId) return;

  const admin = createAdminClient();
  const { error } = await admin.from('clients').delete().eq('id', clientId);
  if (error) throw new Error(error.message);

  revalidatePath('/console/clients');
  revalidatePath('/console');
}
