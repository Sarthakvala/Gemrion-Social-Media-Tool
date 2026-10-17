'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { cancelQueuedJob, createJob, requeueJob } from '@/lib/jobs/repo';

const Id = z.string().uuid();

/** Queues a harmless round-trip job: proves the local worker can claim, upload and finish. */
export async function sendWorkerPing(formData: FormData): Promise<void> {
  const staff = await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(clientId).success) return;
  const admin = createAdminClient();
  const { data: brand } = await admin.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!brand) return;
  await createJob(admin, {
    kind: 'worker_ping',
    runner: 'worker',
    clientId,
    createdBy: staff.id,
    input: { note: 'connectivity test from the Jobs page' },
  });
  revalidatePath('/console/jobs');
}

export async function retryJob(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  if (!Id.safeParse(id).success) return;
  await requeueJob(createAdminClient(), id);
  revalidatePath('/console/jobs');
}

export async function cancelJob(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  if (!Id.safeParse(id).success) return;
  await cancelQueuedJob(createAdminClient(), id);
  revalidatePath('/console/jobs');
}
