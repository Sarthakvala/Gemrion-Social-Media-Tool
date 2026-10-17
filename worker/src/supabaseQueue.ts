import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { buildStoragePath, ASSET_BUCKET } from '../../src/lib/assets/paths.ts';
import type { ClaimedJob, JobQueue, NewAsset } from './types.ts';

/**
 * JobQueue backed by the production Supabase project. Uses the service role key
 * (the agency's chosen setup), so this process has full database access: keep
 * worker/.env private and never run it on a shared machine.
 */
export function supabaseQueue(url: string, serviceKey: string, workerId: string, kinds: string[]): JobQueue {
  const db: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  async function update(jobId: string, patch: Record<string, unknown>) {
    // only touch rows this worker still holds, so a requeued job is never overwritten
    const { data, error } = await db.from('jobs').update(patch).eq('id', jobId).eq('locked_by', workerId).select('id');
    if (error) throw new Error(`jobs update failed: ${error.message}`);
    if (!data?.length) throw new Error('This worker no longer holds the job (it was requeued or canceled).');
  }

  return {
    async claim(): Promise<ClaimedJob | null> {
      const { data, error } = await db.rpc('claim_job', { worker_id: workerId, kinds });
      if (error) throw new Error(`claim_job failed: ${error.message}`);
      return ((data as ClaimedJob[] | null) ?? [])[0] ?? null;
    },

    heartbeat: (jobId) => update(jobId, { locked_at: new Date().toISOString() }),

    succeed: (jobId, output) =>
      update(jobId, { status: 'succeeded', output, error: null, finished_at: new Date().toISOString(), locked_by: null, locked_at: null }),

    fail: (jobId, message, retry) =>
      update(
        jobId,
        retry
          ? { status: 'queued', error: message, locked_by: null, locked_at: null }
          : { status: 'failed', error: message, finished_at: new Date().toISOString(), locked_by: null, locked_at: null }
      ),

    async uploadAsset(asset: NewAsset) {
      const path = buildStoragePath(asset.clientId, asset.fileName, asset.jobId.slice(0, 8));
      const body = typeof asset.body === 'string' ? new TextEncoder().encode(asset.body) : asset.body;
      const { error: upErr } = await db.storage.from(ASSET_BUCKET).upload(path, body, { contentType: asset.contentType, upsert: true });
      if (upErr) throw new Error(`upload failed: ${upErr.message}`);

      const { data, error } = await db
        .from('assets')
        .upsert(
          {
            client_id: asset.clientId,
            job_id: asset.jobId,
            kind: asset.kind,
            title: asset.title,
            storage_path: path,
            mime: asset.contentType,
            bytes: body.byteLength,
            meta: { ...asset.meta, worker: workerId },
          },
          { onConflict: 'storage_path' }
        )
        .select('id')
        .single();
      if (error || !data) throw new Error(`asset insert failed: ${error?.message ?? 'no row'}`);
      return { assetId: data.id as string, path };
    },
  };
}
