import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptSecret, encryptSecret, keyHint } from './crypto';

export type Provider = 'anthropic' | 'openai';

export const ANTHROPIC_MODELS = [
  { id: 'claude-opus-5', label: 'Claude Opus 5 (best writing)' },
  { id: 'claude-sonnet-5', label: 'Claude Sonnet 5 (faster, cheaper)' },
];

export const OPENAI_MODEL_SUGGESTIONS = ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini'];

export interface AiSettingsView {
  provider: Provider;
  anthropicModel: string;
  openaiModel: string;
  anthropicHint: string;
  openaiHint: string;
  anthropicFromEnv: boolean;
  openaiFromEnv: boolean;
}

export interface ResolvedAi {
  provider: Provider;
  model: string;
  apiKey: string;
}

function secret(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
}

async function row() {
  const { data, error } = await createAdminClient().from('ai_settings').select('*').eq('id', 1).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Safe to pass to the UI: never includes key material. */
export async function getAiSettingsView(): Promise<AiSettingsView> {
  const r = await row();
  return {
    provider: (r?.provider as Provider) ?? 'anthropic',
    anthropicModel: r?.anthropic_model ?? 'claude-opus-5',
    openaiModel: r?.openai_model ?? 'gpt-5.5',
    anthropicHint: r?.anthropic_key ? r.anthropic_hint : '',
    openaiHint: r?.openai_key ? r.openai_hint : '',
    anthropicFromEnv: !!process.env.ANTHROPIC_API_KEY,
    openaiFromEnv: !!process.env.OPENAI_API_KEY,
  };
}

export async function saveAiSettings(input: {
  provider: Provider;
  anthropicModel: string;
  openaiModel: string;
  anthropicKey?: string;
  openaiKey?: string;
  clearAnthropic?: boolean;
  clearOpenai?: boolean;
}): Promise<void> {
  const values: Record<string, string> = {
    provider: input.provider,
    anthropic_model: input.anthropicModel,
    openai_model: input.openaiModel,
  };
  if (input.clearAnthropic) Object.assign(values, { anthropic_key: '', anthropic_hint: '' });
  else if (input.anthropicKey) Object.assign(values, { anthropic_key: encryptSecret(input.anthropicKey, secret()), anthropic_hint: keyHint(input.anthropicKey) });
  if (input.clearOpenai) Object.assign(values, { openai_key: '', openai_hint: '' });
  else if (input.openaiKey) Object.assign(values, { openai_key: encryptSecret(input.openaiKey, secret()), openai_hint: keyHint(input.openaiKey) });

  const { error } = await createAdminClient().from('ai_settings').upsert({ id: 1, ...values });
  if (error) throw new Error(error.message);
}

function decrypt(sealed: string | undefined): string {
  try {
    return decryptSecret(sealed ?? '', secret());
  } catch {
    // service key rotated or value corrupted: treat as missing so the UI asks for it again
    return '';
  }
}

/**
 * The provider to generate with. Uses the preferred provider when it has a key
 * (saved in Settings, else env), otherwise falls back to whichever one does.
 */
export async function resolveAi(): Promise<ResolvedAi | null> {
  const r = await row();
  const keys: Record<Provider, string> = {
    anthropic: decrypt(r?.anthropic_key) || process.env.ANTHROPIC_API_KEY || '',
    openai: decrypt(r?.openai_key) || process.env.OPENAI_API_KEY || '',
  };
  const models: Record<Provider, string> = {
    anthropic: r?.anthropic_model || 'claude-opus-5',
    openai: r?.openai_model || 'gpt-5.5',
  };
  const preferred: Provider = (r?.provider as Provider) ?? 'anthropic';
  const order: Provider[] = preferred === 'openai' ? ['openai', 'anthropic'] : ['anthropic', 'openai'];
  const provider = order.find((p) => keys[p]);
  return provider ? { provider, model: models[provider], apiKey: keys[provider] } : null;
}
