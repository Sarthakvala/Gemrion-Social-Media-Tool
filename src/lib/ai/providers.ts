import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type * as z from 'zod/v4';
import type { ResolvedAi } from './settings';

export type Effort = 'low' | 'medium' | 'high';

export class AiError extends Error {}

/** One structured-output call, independent of vendor. */
export interface StructuredModel {
  label: string;
  structured<S extends z.ZodType>(system: string, prompt: string, schema: S, effort: Effort): Promise<z.infer<S>>;
  ping(): Promise<void>;
}

const MAX_TOKENS = 32000;

function anthropicModel(ai: ResolvedAi): StructuredModel {
  const client = new Anthropic({ apiKey: ai.apiKey });

  function wrap(e: unknown): never {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('The Anthropic API key was rejected. Check it in Settings.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError('This Anthropic key cannot use that model.');
    if (e instanceof Anthropic.NotFoundError) throw new AiError(`Anthropic model "${ai.model}" was not found.`);
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Rate limited by Anthropic. Wait a minute and retry.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Anthropic error ${e.status}: ${e.message}`);
    throw e;
  }

  return {
    label: `Anthropic · ${ai.model}`,
    async structured(system, prompt, schema, effort) {
      try {
        const stream = client.messages.stream({
          model: ai.model,
          max_tokens: MAX_TOKENS,
          thinking: { type: 'adaptive' },
          output_config: { effort, format: zodOutputFormat(schema) },
          system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: prompt }],
        });
        const message = await stream.finalMessage();
        if (message.stop_reason === 'refusal') throw new AiError('The model declined this request. Rephrase the brief and try again.');
        if (message.stop_reason === 'max_tokens' || !message.parsed_output) {
          throw new AiError('The response was cut off. Try fewer posts per run.');
        }
        return message.parsed_output as z.infer<typeof schema>;
      } catch (e) {
        wrap(e);
      }
    },
    async ping() {
      try {
        await client.messages.create({ model: ai.model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply OK.' }] });
      } catch (e) {
        wrap(e);
      }
    },
  };
}

function openaiModel(ai: ResolvedAi): StructuredModel {
  const client = new OpenAI({ apiKey: ai.apiKey, timeout: 280_000 });
  const reasoning = /^(gpt-5|gpt-6|o\d)/.test(ai.model);

  function wrap(e: unknown): never {
    if (e instanceof AiError) throw e;
    if (e instanceof OpenAI.AuthenticationError) throw new AiError('The OpenAI API key was rejected. Check it in Settings.');
    if (e instanceof OpenAI.NotFoundError) throw new AiError(`OpenAI model "${ai.model}" was not found for this key.`);
    if (e instanceof OpenAI.RateLimitError) throw new AiError('OpenAI rate limit or quota reached. Check billing, then retry.');
    if (e instanceof OpenAI.APIError) throw new AiError(`OpenAI error ${e.status}: ${e.message}`);
    throw e;
  }

  return {
    label: `OpenAI · ${ai.model}`,
    async structured(system, prompt, schema, effort) {
      try {
        const res = await client.responses.parse({
          model: ai.model,
          instructions: system,
          input: prompt,
          max_output_tokens: MAX_TOKENS,
          ...(reasoning ? { reasoning: { effort } } : {}),
          text: { format: zodTextFormat(schema, 'output') },
        });
        if (res.status === 'incomplete') throw new AiError('The response was cut off. Try fewer posts per run.');
        if (!res.output_parsed) throw new AiError('The model returned no usable output. Try again.');
        return res.output_parsed as z.infer<typeof schema>;
      } catch (e) {
        wrap(e);
      }
    },
    async ping() {
      try {
        await client.responses.create({ model: ai.model, input: 'Reply OK.', max_output_tokens: 16 });
      } catch (e) {
        wrap(e);
      }
    },
  };
}

export function modelFor(ai: ResolvedAi): StructuredModel {
  return ai.provider === 'openai' ? openaiModel(ai) : anthropicModel(ai);
}
