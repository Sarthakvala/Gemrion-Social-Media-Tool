'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PILLAR_ROWS, type Pillar } from '@/lib/studio/types';
import { loadBrand } from '@/lib/studio/data';
import { activeModel } from '@/lib/studio/generate';
import { AiError } from '@/lib/ai/providers';
import { readSite, SiteError, type SiteSnapshot } from '@/lib/brand/site';
import { BRAND_SYSTEM, BrandDraftSchema, buildBrandRequest, draftToProfile } from '@/lib/brand/draft';

export interface DraftResult {
  ok: boolean;
  message: string;
  toConfirm: string[];
}

export async function draftBrandWithAi(_prev: DraftResult | null, formData: FormData): Promise<DraftResult> {
  await requireAgency();
  const clientId = text(formData, 'client_id', 64);
  const url = text(formData, 'url', 500);
  const notes = text(formData, 'notes', 6000);
  if (!url && !notes) return { ok: false, message: 'Give a website or some notes to work from.', toConfirm: [] };

  try {
    const admin = createAdminClient();
    const brand = await loadBrand(admin, clientId);
    if (!brand) return { ok: false, message: 'Brand not found.', toConfirm: [] };

    let site: SiteSnapshot | undefined;
    if (url) site = await readSite(url);

    const model = await activeModel();
    const draft = await model.structured(BRAND_SYSTEM, buildBrandRequest({ brandName: brand.name, notes, site }), BrandDraftSchema, 'high');
    const profile = draftToProfile(draft, brand.profile);

    const { error } = await admin.from('brand_profiles').upsert(profile, { onConflict: 'client_id' });
    if (error) throw new Error(error.message);

    revalidatePath(`/console/clients/${clientId}/brand`);
    return {
      ok: true,
      message: `Drafted with ${model.label}${site ? ` from ${new URL(site.url).hostname}` : ''}. Review every field, then save.`,
      toConfirm: draft.to_confirm.filter(Boolean).slice(0, 8),
    };
  } catch (e) {
    if (e instanceof AiError || e instanceof SiteError) return { ok: false, message: e.message, toConfirm: [] };
    console.error('[brand-draft]', e);
    return { ok: false, message: e instanceof Error ? e.message : 'Drafting failed.', toConfirm: [] };
  }
}

const MAX_LOGO_BYTES = 1_000_000;
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const HEX = /^#[0-9a-f]{6}$/i;

function text(formData: FormData, key: string, max = 4000): string {
  return String(formData.get(key) ?? '').trim().slice(0, max);
}

function color(formData: FormData, key: string, fallback: string): string {
  const v = text(formData, key, 7);
  return HEX.test(v) ? v : fallback;
}

function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

async function uploadLogo(clientId: string, file: File): Promise<string> {
  const ext = LOGO_TYPES[file.type];
  if (!ext) throw new Error('Logo must be a PNG or JPG.');
  if (file.size > MAX_LOGO_BYTES) throw new Error('Logo must be under 1 MB.');

  const admin = createAdminClient();
  const path = `brands/${clientId}/logo-${Date.now()}.${ext}`;
  const { error } = await admin.storage
    .from('creatives')
    .upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: true });
  if (error) throw new Error(error.message);
  return admin.storage.from('creatives').getPublicUrl(path).data.publicUrl;
}

export async function saveBrand(formData: FormData) {
  await requireAgency();
  const clientId = text(formData, 'client_id', 64);
  if (!clientId) throw new Error('Missing brand.');

  const pillars: Pillar[] = [];
  for (let i = 0; i < PILLAR_ROWS; i++) {
    const name = text(formData, `pillar_name_${i}`, 80);
    if (!name) continue;
    pillars.push({
      name,
      share: Math.min(100, Math.max(0, Number(formData.get(`pillar_share_${i}`)) || 0)),
      topics: text(formData, `pillar_topics_${i}`, 400),
    });
  }

  const tz = text(formData, 'timezone', 64) || 'Asia/Kolkata';
  const values: Record<string, unknown> = {
    client_id: clientId,
    industry: text(formData, 'industry', 500),
    offer: text(formData, 'offer', 2000),
    audience: text(formData, 'audience'),
    voice: text(formData, 'voice'),
    pillars,
    dos: text(formData, 'dos'),
    donts: text(formData, 'donts'),
    banned_words: text(formData, 'banned_words', 2000),
    cta_style: text(formData, 'cta_style', 1000),
    hashtags: text(formData, 'hashtags', 1000),
    language: text(formData, 'language', 40) || 'English',
    timezone: isValidTimeZone(tz) ? tz : 'Asia/Kolkata',
    handle: text(formData, 'handle', 80),
    palette: {
      bg: color(formData, 'color_bg', '#0b1b3a'),
      fg: color(formData, 'color_fg', '#ffffff'),
      accent: color(formData, 'color_accent', '#ff5a1f'),
      muted: color(formData, 'color_muted', '#9fb0d0'),
    },
    heading_font: text(formData, 'heading_font', 60) || 'Inter',
    body_font: text(formData, 'body_font', 60) || 'Inter',
  };

  const logo = formData.get('logo');
  if (logo instanceof File && logo.size > 0) values.logo_url = await uploadLogo(clientId, logo);
  if (formData.get('remove_logo')) values.logo_url = '';

  const { error } = await createAdminClient().from('brand_profiles').upsert(values, { onConflict: 'client_id' });
  if (error) throw new Error(error.message);

  revalidatePath(`/console/clients/${clientId}/brand`);
  redirect(`/console/clients/${clientId}/brand?saved=1`);
}

export async function addExample(formData: FormData) {
  await requireAgency();
  const clientId = text(formData, 'client_id', 64);
  const body = text(formData, 'body', 5000);
  if (!clientId || !body) return;

  const { error } = await createAdminClient()
    .from('brand_examples')
    .insert({ client_id: clientId, body, platform: text(formData, 'platform', 4) });
  if (error) throw new Error(error.message);
  revalidatePath(`/console/clients/${clientId}/brand`);
}

export async function deleteExample(formData: FormData) {
  await requireAgency();
  const id = text(formData, 'id', 64);
  const clientId = text(formData, 'client_id', 64);
  const { error } = await createAdminClient().from('brand_examples').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath(`/console/clients/${clientId}/brand`);
}
