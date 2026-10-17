/** Tokens one model call consumed. `inputTokens` excludes cache reads/writes. */
export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export type UsageListener = (usage: TokenUsage) => void;

interface Price {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/** 5-minute cache writes cost 1.25x the input rate. */
const CACHE_WRITE_MULTIPLIER = 1.25;

function price(input: number, output: number, cacheRead: number): Price {
  return { input, output, cacheRead, cacheWrite: input * CACHE_WRITE_MULTIPLIER };
}

/**
 * USD per 1M tokens, Anthropic first-party rates (claude-api skill table, 2026-10-06).
 * Models missing here (including all OpenAI models) record tokens with a null cost
 * rather than a guessed one. Haiku 5.5 is priced at its <=100K-prompt rate.
 */
export const PRICES: Readonly<Record<string, Price>> = {
  'claude-fable-5-1': price(10, 50, 0.25),
  'claude-opus-5-5': price(4, 20, 0.2),
  'claude-opus-5': price(5, 25, 0.5),
  'claude-sonnet-5-5': price(2, 10, 0.2),
  'claude-sonnet-5': price(2, 10, 0.2),
  'claude-haiku-5-5': price(0.1, 0.5, 0.01),
};

const PER_TOKEN = 1 / 1_000_000;

/** Cost of one call in USD, or null when the model has no known price. */
export function costUsd(u: TokenUsage): number | null {
  const p = PRICES[u.model];
  if (!p) return null;
  const total =
    u.inputTokens * p.input +
    u.outputTokens * p.output +
    u.cacheReadTokens * p.cacheRead +
    u.cacheWriteTokens * p.cacheWrite;
  return total * PER_TOKEN;
}

export interface UsageTotals {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
}

/** Sums calls into the totals a job row stores. Cost is null if any call is unpriced. */
export function sumUsage(calls: readonly TokenUsage[]): UsageTotals {
  const models = [...new Set(calls.map((c) => c.model))];
  const costs = calls.map(costUsd);
  return {
    model: models.join(', '),
    inputTokens: calls.reduce((n, c) => n + c.inputTokens + c.cacheReadTokens + c.cacheWriteTokens, 0),
    outputTokens: calls.reduce((n, c) => n + c.outputTokens, 0),
    costUsd: costs.some((c) => c === null) ? null : costs.reduce<number>((n, c) => n + (c ?? 0), 0),
  };
}
