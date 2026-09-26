import 'server-only';
import type { Platform } from '@/lib/types';
import { resolveAi } from '@/lib/ai/settings';
import { AiError, modelFor, type StructuredModel } from '@/lib/ai/providers';
import { PlanSchema, PostBatchSchema, type PlanItem, type PostContent } from './schema';
import { buildPlanRequest, buildRegenerateRequest, buildWriteRequest, type PlanRequest } from './prompt';
import { clampDate } from './normalize';

const WRITE_BATCH = 3;

export async function activeModel(): Promise<StructuredModel> {
  const ai = await resolveAi();
  if (!ai) throw new AiError('No AI key yet. Add an Anthropic or OpenAI key in Settings.');
  return modelFor(ai);
}

export async function planPosts(model: StructuredModel, system: string, req: PlanRequest): Promise<PlanItem[]> {
  const plan = await model.structured(system, buildPlanRequest(req), PlanSchema, 'medium');
  return plan.items
    .slice(0, req.count)
    .map((it) => ({ ...it, date: clampDate(it.date, req.start, req.end) }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

/** Writes planned posts in parallel batches. Output is paired with its plan slot by position. */
export async function writePosts(
  model: StructuredModel,
  system: string,
  items: PlanItem[],
  platforms: Platform[],
  brief: string
): Promise<{ plan: PlanItem; content: PostContent }[]> {
  const batches: PlanItem[][] = [];
  for (let i = 0; i < items.length; i += WRITE_BATCH) batches.push(items.slice(i, i + WRITE_BATCH));

  const results = await Promise.all(
    batches.map(async (batch) => {
      const r = await model.structured(system, buildWriteRequest(batch, platforms, brief), PostBatchSchema, 'medium');
      return batch.flatMap((plan, i) => (r.posts[i] ? [{ plan, content: r.posts[i] }] : []));
    })
  );
  return results.flat();
}

export async function rewritePost(
  model: StructuredModel,
  system: string,
  current: { title: string; hook: string; caption: string; pillar: string; format: string },
  note: string,
  platforms: Platform[]
): Promise<PostContent> {
  const r = await model.structured(system, buildRegenerateRequest(current, note, platforms), PostBatchSchema, 'medium');
  const post = r.posts[0];
  if (!post) throw new AiError('No post came back. Try again.');
  return post;
}
