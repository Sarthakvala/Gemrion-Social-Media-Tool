import type { Playbook, PlaybookInput } from './types';

export type ParsedInput = { ok: true; input: PlaybookInput } | { ok: false; message: string };

/**
 * Validates raw form values against a playbook's field spec: trims, enforces
 * max lengths, required fields and select options. Unknown keys are dropped,
 * so nothing outside the spec ever reaches a prompt.
 */
export function parsePlaybookInput(playbook: Pick<Playbook, 'fields'>, raw: Readonly<Record<string, unknown>>): ParsedInput {
  const input: Record<string, string> = {};
  for (const field of playbook.fields) {
    const value = typeof raw[field.name] === 'string' ? (raw[field.name] as string).trim() : '';
    if (field.required && !value) return { ok: false, message: `${field.label} is required.` };
    if (value.length > field.max) return { ok: false, message: `${field.label} must be under ${field.max} characters.` };
    if (field.kind === 'select' && value && !field.options?.includes(value)) {
      return { ok: false, message: `Pick a valid ${field.label.toLowerCase()}.` };
    }
    input[field.name] = value;
  }
  return { ok: true, input };
}

/** "key: value" lines for the fields that were filled, in spec order. */
export function describeInput(playbook: Pick<Playbook, 'fields'>, input: PlaybookInput): string {
  return playbook.fields
    .filter((f) => input[f.name])
    .map((f) => `${f.label}: ${input[f.name]}`)
    .join('\n');
}
