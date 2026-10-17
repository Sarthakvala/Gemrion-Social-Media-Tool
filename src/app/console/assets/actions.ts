'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ASSET_BUCKET, ASSET_KINDS, MAX_ASSET_BYTES, buildStoragePath, kindFromMime, pathBelongsTo } from '@/lib/assets/paths';
import type { Approval } from '@/lib/types';

export interface UploadTicket {
  ok: boolean;
  message: string;
  path?: string;
  token?: string;
}

const RequestSchema = z.object({
  clientId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  size: z.number().int().positive().max(MAX_ASSET_BYTES),
});

/**
 * Step 1 of an upload: a one-time signed upload URL. The browser sends the file
 * straight to Storage, so large videos never pass through a server function
 * (whose request body limit would reject them).
 */
export async function requestUpload(input: unknown): Promise<UploadTicket> {
  await requireAgency();
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Files must be under 500 MB.' };
  const { clientId, fileName } = parsed.data;

  const admin = createAdminClient();
  const { data: brand } = await admin.from('clients').select('id').eq('id', clientId).maybeSingle();
  if (!brand) return { ok: false, message: 'Brand not found.' };

  const path = buildStoragePath(clientId, fileName, randomUUID().slice(0, 8));
  const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { ok: false, message: `Could not start the upload: ${error?.message ?? 'unknown error'}` };
  return { ok: true, message: '', path: data.path, token: data.token };
}

const FinalizeSchema = z.object({
  clientId: z.string().uuid(),
  path: z.string().min(1).max(512),
  title: z.string().max(200),
  kind: z.enum(ASSET_KINDS).optional(),
  parentId: z.string().uuid().optional(),
});

export interface FinalizeResult {
  ok: boolean;
  message: string;
  id?: string;
}

/**
 * Step 2: record the uploaded file. Size and type come from Storage itself,
 * not from the browser, and the path must sit under the brand's folder.
 */
export async function finalizeUpload(input: unknown): Promise<FinalizeResult> {
  const staff = await requireAgency();
  const parsed = FinalizeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Invalid upload.' };
  const { clientId, path, title, kind, parentId } = parsed.data;
  if (!pathBelongsTo(path, clientId)) return { ok: false, message: 'That file does not belong to this brand.' };

  const admin = createAdminClient();
  const { data: info, error: infoError } = await admin.storage.from(ASSET_BUCKET).info(path);
  if (infoError || !info) return { ok: false, message: 'The upload did not arrive. Try again.' };

  // a rejected upload must not leave an orphaned file in the bucket
  const discard = async (message: string): Promise<FinalizeResult> => {
    await admin.storage.from(ASSET_BUCKET).remove([path]);
    return { ok: false, message };
  };

  let version = 1;
  if (parentId) {
    const { data: parent } = await admin.from('assets').select('client_id, version').eq('id', parentId).maybeSingle();
    if (!parent || parent.client_id !== clientId) return discard('The previous version was not found.');
    const { data: child } = await admin.from('assets').select('id').eq('parent_id', parentId).limit(1);
    if (child?.length) return discard('Someone already uploaded a newer version. Open the latest one.');
    version = (parent.version as number) + 1;
  }

  const mime = info.contentType ?? '';
  const { data, error } = await admin
    .from('assets')
    .insert({
      client_id: clientId,
      parent_id: parentId ?? null,
      version,
      kind: kind ?? kindFromMime(mime),
      title: title.trim() || path.split('/').pop() || 'Untitled',
      storage_path: path,
      mime,
      bytes: info.size ?? 0,
      meta: { uploaded_by: staff.id },
    })
    .select('id')
    .single();
  // 23505: the one-child-per-version index caught a concurrent upload
  if (error?.code === '23505') return discard('Someone already uploaded a newer version. Open the latest one.');
  if (error || !data) return discard(error?.message ?? 'Could not save the file.');

  revalidatePath('/console/assets');
  if (parentId) revalidatePath(`/console/assets/${parentId}`);
  return { ok: true, message: 'Uploaded.', id: data.id as string };
}

const APPROVALS: Approval[] = ['pending', 'approved', 'changes_requested'];

/** Agency-side approval (e.g. internal sign-off before a client sees it). */
export async function setAssetApproval(formData: FormData): Promise<void> {
  const staff = await requireAgency();
  const id = String(formData.get('id') || '');
  const approval = String(formData.get('approval') || '') as Approval;
  if (!z.string().uuid().safeParse(id).success || !APPROVALS.includes(approval)) return;

  // service key: auth.uid() is null in the trigger, so pass the approver explicitly
  const { error } = await createAdminClient()
    .from('assets')
    .update({ approval, approved_by: approval === 'pending' ? null : staff.id })
    .eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/assets/${id}`);
  revalidatePath('/console/assets');
}
