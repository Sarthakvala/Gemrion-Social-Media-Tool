import { describe, expect, it } from 'vitest';
import { costUsd, sumUsage, type TokenUsage } from './usage';

const call = (over: Partial<TokenUsage> = {}): TokenUsage => ({
  model: 'claude-opus-5-5',
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  ...over,
});

describe('costUsd', () => {
  it('prices input and output per million tokens', () => {
    expect(costUsd(call({ inputTokens: 1_000_000, outputTokens: 1_000_000 }))).toBeCloseTo(24);
  });

  it('prices cache reads and writes separately from fresh input', () => {
    // opus 5.5: read $0.20/M, write 1.25 x $4 = $5/M
    expect(costUsd(call({ cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 }))).toBeCloseTo(5.2);
  });

  it('returns null for a model with no known price', () => {
    expect(costUsd(call({ model: 'gpt-5.5', inputTokens: 10 }))).toBeNull();
  });
});

describe('sumUsage', () => {
  it('adds tokens across calls, counting cached input as input', () => {
    const t = sumUsage([call({ inputTokens: 100, cacheReadTokens: 50, outputTokens: 10 }), call({ inputTokens: 1, outputTokens: 2 })]);
    expect(t).toMatchObject({ model: 'claude-opus-5-5', inputTokens: 151, outputTokens: 12 });
    expect(t.costUsd).toBeGreaterThan(0);
  });

  it('nulls the cost when any call is unpriced instead of under-reporting', () => {
    const t = sumUsage([call({ inputTokens: 100 }), call({ model: 'gpt-5.5', inputTokens: 100 })]);
    expect(t.costUsd).toBeNull();
    expect(t.model).toBe('claude-opus-5-5, gpt-5.5');
  });

  it('handles a job that made no calls', () => {
    expect(sumUsage([])).toEqual({ model: '', inputTokens: 0, outputTokens: 0, costUsd: 0 });
  });
});
