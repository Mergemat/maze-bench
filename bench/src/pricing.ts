export interface Price {
  /** USD per token. */
  input: number;
  output: number;
}

/** Live prices from the OpenRouter catalogue (public endpoint, no key needed). */
export async function fetchPrices(): Promise<Map<string, Price>> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) {
    throw new Error(`OpenRouter models API returned ${res.status}`);
  }
  const body = (await res.json()) as { data: Array<{ id: string; pricing: { prompt: string; completion: string } }> };
  return new Map(
    body.data.map((m) => [m.id, { input: Number(m.pricing.prompt), output: Number(m.pricing.completion) }]),
  );
}
