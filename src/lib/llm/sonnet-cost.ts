/** Approximate Claude Sonnet 4 USD pricing per million tokens (input / output). */
const SONNET_INPUT_PER_MILLION_USD = 3;
const SONNET_OUTPUT_PER_MILLION_USD = 15;

export function sonnetCostCentsFromUsage(usage: {
  input_tokens: number;
  output_tokens: number;
} | null): number | null {
  if (!usage) return null;
  const usd =
    (usage.input_tokens / 1_000_000) * SONNET_INPUT_PER_MILLION_USD +
    (usage.output_tokens / 1_000_000) * SONNET_OUTPUT_PER_MILLION_USD;
  return Math.round(usd * 100);
}
