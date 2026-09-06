import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Profile, Client } from '@/lib/types';

/** The signed-in user's profile, or null when signed out. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', user.id)
    .single();

  return (data as Profile) ?? null;
}

/** Require any signed-in user. Redirects to /login otherwise. */
export async function requireUser(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect('/login');
  return profile;
}

/**
 * Require an agency user. Use this in every route that touches the admin
 * (service-role) client, because that client bypasses RLS.
 */
export async function requireAgency(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== 'agency') redirect('/portal');
  return profile;
}

/** Client workspaces the signed-in user may see. RLS does the filtering. */
export async function getVisibleClients(): Promise<Client[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clients')
    .select('id, name, color, created_at')
    .order('name');
  return (data as Client[]) ?? [];
}
