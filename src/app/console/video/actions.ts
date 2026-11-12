'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AiError } from '@/lib/ai/providers';
import { loadBrand } from '@/lib/studio/data';
import { buildBrandSystemPrompt } from '@/lib/studio/prompt';
import { activeModel } from '@/lib/studio/generate';
import { trackJob } from '@/lib/jobs/track';
import { createJob } from '@/lib/jobs/repo';
import { parsePlaybookInput } from '@/lib/playbooks/input';
import { playbookRef } from '@/lib/playbooks/registry';
import { reelScriptPlaybook } from '@/lib/playbooks/reelScript';
import { scriptToSpec } from '@/lib/video/fromScript';
import { applyEdits, blankScript, type EditorInput } from '@/lib/video/editor';
import { ReelSpecSchema, specProblem } from '@/lib/video/spec';
import { REEL_ASPECTS, type ReelAspect } from '@/lib/video/timing';
import { getReel, insertReel } from '@/lib/video/reels';
import { isInFlight } from '@/lib/jobs/types';

export interface ReelActionResult {
  ok: boolean;
  message: string;
}

const Id = z.string().uuid();

function aspectFrom(formData: FormData): ReelAspect {
  const v = String(formData.get('aspect') || '');
  return (REEL_ASPECTS as readonly string[]).includes(v) ? (v as ReelAspect) : '9:16';
}

/** AI path: runs the reel-scripter playbook on the brand kit, then saves the reel (inside the tracked job). */
export async function createReelFromIdea(_prev: ReelActionResult | null, formData: FormData): Promise<ReelActionResult> {
  const staff = await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(clientId).success) return { ok: false, message: 'Pick a brand.' };
  const parsed = parsePlaybookInput(reelScriptPlaybook, Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { ok: false, message: parsed.message };
  const aspect = aspectFrom(formData);

  let reelId: string;
  try {
    const admin = createAdminClient();
    const brand = await loadBrand(admin, clientId);
    if (!brand) return { ok: false, message: 'Brand not found.' };
    const system = buildBrandSystemPrompt(brand.name, brand.profile, brand.examples);
    const title = parsed.input.idea.split('\n')[0].slice(0, 120);

    reelId = await trackJob(
      { kind: 'playbook', playbook: playbookRef(reelScriptPlaybook), clientId, createdBy: staff.id, input: { ...parsed.input, aspect } },
      async (onUsage) => {
        const model = await activeModel(onUsage);
        const raw = await model.structured(system, reelScriptPlaybook.buildPrompt(parsed.input), reelScriptPlaybook.outputSchema, reelScriptPlaybook.effort);
        const script = reelScriptPlaybook.normalize(raw);
        const spec = scriptToSpec(script, brand, { title, aspect });
        return insertReel(admin, { clientId, title: spec.title, script, spec, createdBy: staff.id });
      },
      (id) => ({ reel_id: id })
    );
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error('[reels] create from idea', e);
    return { ok: false, message: e instanceof Error ? e.message : 'Could not write the script.' };
  }
  revalidatePath('/console/video');
  redirect(`/console/video/${reelId}`);
}

/** Manual path: a template reel to fill in by hand. No AI call. */
export async function createBlankReel(formData: FormData): Promise<void> {
  const staff = await requireAgency();
  const clientId = String(formData.get('client_id') || '');
  if (!Id.safeParse(clientId).success) return;
  const admin = createAdminClient();
  const brand = await loadBrand(admin, clientId);
  if (!brand) return;
  const title = String(formData.get('title') || '').trim().slice(0, 120) || 'Untitled reel';
  const script = blankScript();
  const spec = scriptToSpec(script, brand, { title, aspect: aspectFrom(formData) });
  const id = await insertReel(admin, { clientId, title: spec.title, script, spec, createdBy: staff.id });
  revalidatePath('/console/video');
  redirect(`/console/video/${id}`);
}

const EditorSchema = z.object({
  id: z.string().uuid(),
  title: z.string().max(200),
  aspect: z.string().max(10),
  beats: z.array(z.object({ kind: z.string().max(20), heading: z.string().max(500), sub: z.string().max(500), seconds: z.union([z.number(), z.string().max(10)]) })).max(20),
});

export async function saveReel(input: unknown): Promise<ReelActionResult> {
  await requireAgency();
  const parsed = EditorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Invalid reel data.' };
  const admin = createAdminClient();
  const reel = await getReel(admin, parsed.data.id);
  if (!reel) return { ok: false, message: 'Reel not found.' };

  const current = ReelSpecSchema.safeParse(reel.spec);
  if (!current.success) return { ok: false, message: `The saved reel is invalid: ${specProblem(reel.spec)}` };
  const edited = applyEdits(current.data, parsed.data as EditorInput);
  if (!edited.ok) return edited;

  const { error } = await admin.from('reels').update({ title: edited.spec.title, spec: edited.spec }).eq('id', reel.id);
  if (error) return { ok: false, message: error.message };
  revalidatePath(`/console/video/${reel.id}`);
  return { ok: true, message: 'Saved.' };
}

/** Queues a render on the local worker. The spec is copied into the job, so later edits never change a running render. */
export async function queueRender(formData: FormData): Promise<void> {
  const staff = await requireAgency();
  const id = String(formData.get('id') || '');
  if (!Id.safeParse(id).success) return;
  const admin = createAdminClient();
  const reel = await getReel(admin, id);
  if (!reel || isInFlight(reel.render)) return;
  if (specProblem(reel.spec)) return;

  const job = await createJob(admin, {
    kind: 'video_render',
    runner: 'worker',
    clientId: reel.client_id,
    playbook: 'reel@v1',
    createdBy: staff.id,
    input: { spec: reel.spec, reel_id: reel.id },
  });
  const { error } = await admin.from('reels').update({ render_job_id: job.id }).eq('id', reel.id);
  if (error) throw new Error(`Render queued but not linked to the reel: ${error.message}`);
  revalidatePath(`/console/video/${id}`);
  revalidatePath('/console/video');
}
