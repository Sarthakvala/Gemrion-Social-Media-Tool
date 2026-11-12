import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReelScript } from '@/lib/playbooks/reelScript';
import type { Job } from '@/lib/jobs/types';
import type { ReelSpec } from './spec';

/** Row of public.reels (supabase/008_reels.sql). Agency only: always read with the admin client. */
export interface Reel {
  id: string;
  client_id: string;
  title: string;
  script: ReelScript | Record<string, never>;
  spec: ReelSpec;
  script_job_id: string | null;
  render_job_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type RenderJob = Pick<Job, 'id' | 'status' | 'error' | 'attempts' | 'max_attempts' | 'created_at' | 'finished_at'>;
export type ReelRow = Reel & { clients: { name: string } | null; render: RenderJob | null };

const RENDER_COLUMNS = 'id, status, error, attempts, max_attempts, created_at, finished_at';

export async function insertReel(
  db: SupabaseClient,
  row: { clientId: string; title: string; script: ReelScript; spec: ReelSpec; scriptJobId?: string | null; createdBy: string }
): Promise<string> {
  const { data, error } = await db
    .from('reels')
    .insert({ client_id: row.clientId, title: row.title, script: row.script, spec: row.spec, script_job_id: row.scriptJobId ?? null, created_by: row.createdBy })
    .select('id')
    .single();
  if (error || !data) throw new Error(`Could not save the reel: ${error?.message ?? 'no row'}`);
  return data.id as string;
}

/** Reels with their brand and latest render job, newest first. */
export async function listReels(db: SupabaseClient, limit = 30): Promise<ReelRow[]> {
  const { data, error } = await db
    .from('reels')
    .select(`*, clients(name), render:jobs!reels_render_job_id_fkey(${RENDER_COLUMNS})`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Could not load reels: ${error.message}`);
  return (data ?? []) as ReelRow[];
}

export async function getReel(db: SupabaseClient, id: string): Promise<ReelRow | null> {
  const { data, error } = await db
    .from('reels')
    .select(`*, clients(name), render:jobs!reels_render_job_id_fkey(${RENDER_COLUMNS})`)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`Could not load the reel: ${error.message}`);
  return (data as ReelRow) ?? null;
}
