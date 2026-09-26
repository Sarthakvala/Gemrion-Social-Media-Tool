'use server';

import { revalidatePath } from 'next/cache';
import { requireAgency } from '@/lib/auth';
import { resolveAi, saveAiSettings, ANTHROPIC_MODELS, type Provider } from '@/lib/ai/settings';
import { AiError, modelFor } from '@/lib/ai/providers';

export interface SettingsResult {
  ok: boolean;
  message: string;
}

const MODEL_ID = /^[a-z0-9][a-z0-9.\-_]{1,63}$/i;

function field(formData: FormData, key: string, max = 300): string {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

export async function saveSettings(_prev: SettingsResult | null, formData: FormData): Promise<SettingsResult> {
  await requireAgency();

  const provider: Provider = field(formData, 'provider') === 'openai' ? 'openai' : 'anthropic';
  const anthropicModel = field(formData, 'anthropic_model', 64);
  const openaiModel = field(formData, 'openai_model', 64);
  const anthropicKey = field(formData, 'anthropic_key');
  const openaiKey = field(formData, 'openai_key');

  if (!ANTHROPIC_MODELS.some((m) => m.id === anthropicModel)) return { ok: false, message: 'Pick a Claude model from the list.' };
  if (!MODEL_ID.test(openaiModel)) return { ok: false, message: 'That OpenAI model name looks wrong.' };
  if (anthropicKey && !anthropicKey.startsWith('sk-ant-')) return { ok: false, message: 'Anthropic keys start with "sk-ant-".' };
  if (openaiKey && !openaiKey.startsWith('sk-')) return { ok: false, message: 'OpenAI keys start with "sk-".' };

  try {
    await saveAiSettings({
      provider,
      anthropicModel,
      openaiModel,
      anthropicKey: anthropicKey || undefined,
      openaiKey: openaiKey || undefined,
      clearAnthropic: formData.get('clear_anthropic') === 'on',
      clearOpenai: formData.get('clear_openai') === 'on',
    });
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not save.' };
  }

  revalidatePath('/console/settings');
  revalidatePath('/console/studio');
  return { ok: true, message: 'Saved. Keys are encrypted and never shown again.' };
}

/** One tiny request with whichever provider/key would be used for generation. */
export async function testConnection(): Promise<SettingsResult> {
  await requireAgency();
  const ai = await resolveAi();
  if (!ai) return { ok: false, message: 'No key saved yet.' };
  const model = modelFor(ai);
  try {
    await model.ping();
    return { ok: true, message: `Working: ${model.label}.` };
  } catch (e) {
    return { ok: false, message: e instanceof AiError ? e.message : 'Connection failed.' };
  }
}
