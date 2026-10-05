export interface Price {
  /** USD per token. */
  input: number;
  output: number;
}

export interface ModelMeta {
  price: Price;
  /** Reasoning efforts the model accepts on OpenRouter, e.g. ["low", "medium", "high"]. Empty if it has no effort control. */
  efforts: string[];
  defaultEffort: string | null;
}

interface CatalogEntry {
  id: string;
  pricing: { prompt: string; completion: string };
  reasoning?: { supported_efforts?: string[]; default_effort?: string | null } | null;
}

/** Live prices and reasoning-effort support from the OpenRouter catalogue (public, no key needed). */
export async function fetchCatalog(): Promise<Map<string, ModelMeta>> {
  const res = await fetch("https://openrouter.ai/api/v1/models");
  if (!res.ok) {
    throw new Error(`OpenRouter models API returned ${res.status}`);
  }
  const body = (await res.json()) as { data: CatalogEntry[] };
  return new Map(
    body.data.map((m) => [
      m.id,
      {
        price: { input: Number(m.pricing.prompt), output: Number(m.pricing.completion) },
        efforts: m.reasoning?.supported_efforts ?? [],
        defaultEffort: m.reasoning?.default_effort ?? null,
      },
    ]),
  );
}

export async function fetchPrices(): Promise<Map<string, Price>> {
  return new Map([...(await fetchCatalog())].map(([id, meta]) => [id, meta.price]));
}

/**
 * Efforts to run for one model: the requested ones it supports, in the requested order.
 * A model with no effort control runs once at "default".
 */
export function effortsFor(requested: readonly string[], meta: ModelMeta | undefined): string[] {
  if (!meta || meta.efforts.length === 0) {
    return ["default"];
  }
  const chosen = requested.filter((e) => meta.efforts.includes(e));
  return chosen.length > 0 ? chosen : ["default"];
}
