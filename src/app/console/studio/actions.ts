'use server';

import { revalidatePath } from 'next/cache';
import * as z from 'zod/v4';
import { requireAgency } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { PLATFORMS, type Platform } from '@/lib/types';
import { loadBrand } from '@/lib/studio/data';
import { buildBrandSystemPrompt, daysInMonth } from '@/lib/studio/prompt';
import { addDays, contentToPostRow } from '@/lib/studio/normalize';
import { activeModel, planPosts, rewritePost, writePosts } from '@/lib/studio/generate';
import { AiError } from '@/lib/ai/providers';
import { SlideSchema } from '@/lib/studio/schema';

export interface ActionResult {
  ok: boolean;
  message: string;
  month?: string;
}

const MAX_POSTS_PER_RUN = 20;
const MAX_WINDOW_DAYS = 92;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function fail(e: unknown): ActionResult {
  if (e instanceof AiError) return { ok: false, message: e.message };
  console.error('[studio]', e);
  return { ok: false, message: e instanceof Error ? e.message : 'Something went wrong.' };
}

function pickPlatforms(formData: FormData): Platform[] {
  return PLATFORMS.filter((p) => formData.get(`platform_${p}`));
}

function windowFrom(formData: FormData): { start: string; end: string } | string {
  const mode = formData.get('mode') === 'brief' ? 'brief' : 'month';
  if (mode === 'month') {
    const [year, month] = String(formData.get('month') || '').split('-').map(Number);
    if (!year || !month) return 'Pick a month.';
    const mm = String(month).padStart(2, '0');
    return { start: `${year}-${mm}-01`, end: `${year}-${mm}-${daysInMonth(year, month)}` };
  }
  const start = String(formData.get('start') || '');
  const end = String(formData.get('end') || '');
  if (!ISO_DATE.test(start) || !ISO_DATE.test(end)) return 'Pick a start and end date.';
  if (end < start) return 'The end date is before the start date.';
  if (end > addDays(start, MAX_WINDOW_DAYS)) return 'Keep a campaign under three months.';
  return { start, end };
}

export async function generatePosts(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAgency();

  const mode = formData.get('mode') === 'brief' ? 'brief' : 'month';
  const clientId = String(formData.get('client_id') || '');
  const count = Math.min(MAX_POSTS_PER_RUN, Math.max(1, Number(formData.get('count')) || 12));
  const platforms = pickPlatforms(formData);
  const brief = String(formData.get('brief') || '').slice(0, 6000);
  const window = windowFrom(formData);

  if (!clientId) return { ok: false, message: 'Pick a brand.' };
  if (typeof window === 'string') return { ok: false, message: window };
  if (!platforms.length) return { ok: false, message: 'Pick at least one platform.' };
  if (mode === 'brief' && !brief.trim()) return { ok: false, message: 'Write the brief first.' };

  try {
    const admin = createAdminClient();
    const brand = await loadBrand(admin, clientId);
    if (!brand) return { ok: false, message: 'Brand not found.' };

    const { data: existing } = await admin
      .from('posts')
      .select('title')
      .eq('client_id', clientId)
      .gte('scheduled_at', `${window.start}T00:00:00Z`)
      .lte('scheduled_at', `${window.end}T23:59:59Z`);

    const model = await activeModel();
    const system = buildBrandSystemPrompt(brand.name, brand.profile, brand.examples);
    const plan = await planPosts(model, system, {
      ...window,
      count,
      platforms,
      brief,
      mode,
      existingTitles: (existing ?? []).map((r) => r.title as string).filter(Boolean),
    });
    const written = await writePosts(model, system, plan, platforms, brief);

    const rows = written.map(({ plan: slot, content }) => ({
      ...contentToPostRow(content, slot, { clientId, timeZone: brand.profile.timezone, platforms }),
      status: 'draft',
      approval: 'pending',
      enabled: true,
    }));
    if (!rows.length) return { ok: false, message: 'No posts came back. Try again.' };

    const { error } = await admin.from('posts').insert(rows);
    if (error) throw new Error(error.message);

    revalidatePath('/console/studio');
    revalidatePath('/console');
    return {
      ok: true,
      message: `Created ${rows.length} draft posts for ${brand.name} with ${model.label}.`,
      month: window.start.slice(0, 7),
    };
  } catch (e) {
    return fail(e);
  }
}

export async function regeneratePost(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const note = String(formData.get('note') || '').slice(0, 1000);

  try {
    const admin = createAdminClient();
    const { data: post } = await admin.from('posts').select('*').eq('id', id).maybeSingle();
    if (!post) return { ok: false, message: 'Post not found.' };

    const brand = await loadBrand(admin, post.client_id);
    if (!brand) return { ok: false, message: 'Brand not found.' };

    const platforms = (post.platforms as Platform[]).length ? (post.platforms as Platform[]) : (['IG', 'LI'] as Platform[]);
    const model = await activeModel();
    const system = buildBrandSystemPrompt(brand.name, brand.profile, brand.examples);
    const content = await rewritePost(
      model,
      system,
      { title: post.title, hook: post.hook, caption: post.copy || post.caption, pillar: post.pillar, format: post.format },
      note,
      platforms
    );

    const when = post.scheduled_at ? new Date(post.scheduled_at).toISOString() : new Date().toISOString();
    const row = contentToPostRow(
      content,
      { date: when.slice(0, 10), time: when.slice(11, 16), pillar: post.pillar, format: post.format, aspect: post.aspect },
      { clientId: post.client_id, timeZone: 'UTC', platforms }
    );

    const { error } = await admin
      .from('posts')
      .update({
        title: row.title,
        hook: row.hook,
        copy: row.copy,
        caption: row.caption,
        hashtags: row.hashtags,
        platform_captions: row.platform_captions,
        visual_brief: row.visual_brief,
        slides_content: row.slides_content,
        approval: 'pending',
      })
      .eq('id', id);
    if (error) throw new Error(error.message);

    revalidatePath(`/console/posts/${id}`);
    return { ok: true, message: `Rewritten with ${model.label}.` };
  } catch (e) {
    return fail(e);
  }
}

const CreativeSchema = z.object({
  id: z.string().uuid(),
  format: z.enum(['single', 'carousel', 'story']),
  aspect: z.enum(['1:1', '4:5', '9:16']),
  hook: z.string().max(500),
  pillar: z.string().max(120),
  visual_brief: z.string().max(2000),
  slides: z.array(SlideSchema).max(10),
  platform_captions: z.record(z.enum(PLATFORMS as [Platform, ...Platform[]]), z.string().max(5000)),
});

export async function saveCreative(input: unknown): Promise<ActionResult> {
  await requireAgency();
  const parsed = CreativeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: 'Invalid creative data.' };
  const c = parsed.data;

  const { error } = await createAdminClient()
    .from('posts')
    .update({
      format: c.format,
      aspect: c.format === 'story' ? '9:16' : c.aspect,
      hook: c.hook,
      pillar: c.pillar,
      visual_brief: c.visual_brief,
      slides_content: c.slides,
      platform_captions: c.platform_captions,
    })
    .eq('id', c.id);
  if (error) return { ok: false, message: error.message };

  revalidatePath(`/console/posts/${c.id}`);
  return { ok: true, message: 'Saved.' };
}

export async function saveAsExample(formData: FormData): Promise<void> {
  await requireAgency();
  const id = String(formData.get('id') || '');
  const admin = createAdminClient();
  const { data: post } = await admin.from('posts').select('client_id, copy, caption, hashtags').eq('id', id).maybeSingle();
  if (!post) return;

  const body = [post.copy || post.caption, post.hashtags].filter(Boolean).join('\n\n').trim();
  if (!body) return;

  const { error } = await admin.from('brand_examples').insert({ client_id: post.client_id, body, post_id: id });
  if (error) throw new Error(error.message);
  revalidatePath(`/console/posts/${id}`);
  revalidatePath(`/console/clients/${post.client_id}/brand`);
}
