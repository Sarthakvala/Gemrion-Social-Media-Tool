'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { AiError } from '@/lib/ai/providers';
import { loadBrand } from '@/lib/studio/data';
import { buildBrandSystemPrompt } from '@/lib/studio/prompt';
import { activeModel } from '@/lib/studio/generate';
import { trackJob } from '@/lib/jobs/track';
import { getPlaybook, playbookRef } from '@/lib/playbooks/registry';
import { parsePlaybookInput } from '@/lib/playbooks/input';

export interface PlaybookRunResult {
  ok: boolean;
  message: string;
  text?: string;
}

/** Runs one playbook for one brand as a tracked, costed job; the result is kept in the job's output. */
export async function runPlaybook(_prev: PlaybookRunResult | null, formData: FormData): Promise<PlaybookRunResult> {
  const staff = await requireAgency();
  const playbook = getPlaybook(String(formData.get('playbook') || ''));
  const clientId = String(formData.get('client_id') || '');
  if (!playbook) return { ok: false, message: 'Unknown playbook.' };
  if (!z.string().uuid().safeParse(clientId).success) return { ok: false, message: 'Pick a brand.' };

  const parsed = parsePlaybookInput(playbook, Object.fromEntries(formData.entries()));
  if (!parsed.ok) return { ok: false, message: parsed.message };

  try {
    const brand = await loadBrand(createAdminClient(), clientId);
    if (!brand) return { ok: false, message: 'Brand not found.' };
    const system = buildBrandSystemPrompt(brand.name, brand.profile, brand.examples);

    const { label, text } = await trackJob(
      { kind: 'playbook', playbook: playbookRef(playbook), clientId, createdBy: staff.id, input: parsed.input },
      async (onUsage) => {
        const model = await activeModel(onUsage);
        const raw = await model.structured(system, playbook.buildPrompt(parsed.input), playbook.outputSchema, playbook.effort);
        const output = playbook.normalize(raw);
        return { label: model.label, output, text: playbook.toText(output) };
      },
      (r) => ({ result: r.output, text: r.text, model: r.label })
    );

    revalidatePath('/console/playbooks');
    return { ok: true, message: `${playbook.title} for ${brand.name} with ${label}.`, text };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, message: e.message };
    console.error('[playbooks]', e);
    return { ok: false, message: e instanceof Error ? e.message : 'The playbook failed.' };
  }
}
