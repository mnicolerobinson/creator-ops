/** Approximate Claude Haiku 4.5 USD pricing per million tokens (input / output). */
const HAIKU_INPUT_PER_MILLION_USD = 0.25;
const HAIKU_OUTPUT_PER_MILLION_USD = 1.25;

export function haikuCostCentsFromUsage(usage: {
  input_tokens: number;
  output_tokens: number;
} | null): number | null {
  if (!usage) return null;
  const usd =
    (usage.input_tokens / 1_000_000) * HAIKU_INPUT_PER_MILLION_USD +
    (usage.output_tokens / 1_000_000) * HAIKU_OUTPUT_PER_MILLION_USD;
  return Math.round(usd * 100);
}
