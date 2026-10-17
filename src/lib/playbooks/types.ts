import type * as z from 'zod/v4';
import type { Effort } from '@/lib/ai/providers';

/** One form field. The form is generated from these, and input is validated against them. */
export interface PlaybookField {
  name: string;
  label: string;
  kind: 'text' | 'textarea' | 'select';
  options?: readonly string[];
  placeholder?: string;
  max: number;
  required?: boolean;
}

/**
 * A skill ported into the app: a versioned method that runs on top of the
 * brand's system prompt (the brand "training"). Bump `version` whenever the
 * prompt or schema changes, so job history shows which method produced what.
 */
export interface Playbook<S extends z.ZodType = z.ZodType> {
  id: string;
  version: number;
  title: string;
  summary: string;
  /** The Claude Code skill this method was ported from. */
  skill: string;
  fields: readonly PlaybookField[];
  effort: Effort;
  outputSchema: S;
  buildPrompt(input: Readonly<Record<string, string>>): string;
  /** Enforces counts and lengths the schema leaves open (constrained decoding works best unbounded). */
  normalize(output: z.infer<S>): z.infer<S>;
  /** Plain-text version for copying into a scheduler, doc or chat. */
  toText(output: z.infer<S>): string;
}

export type PlaybookInput = Readonly<Record<string, string>>;
