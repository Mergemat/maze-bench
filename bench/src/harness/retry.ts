import { APICallError } from "ai";

export type ErrorCategory = "rate_limit" | "server" | "network" | "timeout" | "client" | "unknown";

export class InfraError extends Error {
  constructor(
    message: string,
    readonly category: ErrorCategory,
    readonly retryable: boolean,
  ) {
    super(message);
  }
}

export function classify(error: unknown): InfraError {
  if (error instanceof InfraError) {
    return error;
  }
  // The AI SDK wraps the last API error in a RetryError once its own retries run out.
  if (error instanceof Error && "lastError" in error && (error as { lastError?: unknown }).lastError) {
    return classify((error as { lastError: unknown }).lastError);
  }
  const message = error instanceof Error ? error.message : String(error);
  if (APICallError.isInstance(error)) {
    const status = error.statusCode ?? 0;
    const body = typeof error.responseBody === "string" ? ` ${error.responseBody.slice(0, 300)}` : "";
    if (status === 429) {
      return new InfraError(`429 ${message}${body}`, "rate_limit", true);
    }
    if (status >= 500) {
      return new InfraError(`${status} ${message}${body}`, "server", true);
    }
    if (status >= 400) {
      return new InfraError(`${status} ${message}${body}`, "client", error.isRetryable);
    }
    return new InfraError(`${message}${body}`, "network", true);
  }
  const lower = message.toLowerCase();
  if (lower.includes("timeout") || lower.includes("timed out") || lower.includes("aborted")) {
    return new InfraError(message, "timeout", true);
  }
  if (/econnreset|econnrefused|enotfound|socket|fetch failed|network|certificate|tls|ssl/.test(lower)) {
    return new InfraError(message, "network", true);
  }
  // Providers sometimes return an empty or malformed body; one retry is cheap.
  if (/no content|empty response|invalid json|json parse|unexpected token/.test(lower)) {
    return new InfraError(message, "server", true);
  }
  return new InfraError(message, "unknown", false);
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (error: InfraError, attempt: number, delayMs: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

/** Retry transient failures with exponential backoff and full jitter. Rate limits wait longer. */
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const { retries = 4, baseDelayMs = 1000, maxDelayMs = 60_000, onRetry } = opts;
  const sleep = opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (raw) {
      const error = classify(raw);
      if (!error.retryable || attempt >= retries) {
        throw error;
      }
      const factor = error.category === "rate_limit" ? 4 : 1;
      const cap = Math.min(maxDelayMs, baseDelayMs * factor * 2 ** attempt);
      const delay = Math.round(cap / 2 + (Math.random() * cap) / 2);
      onRetry?.(error, attempt + 1, delay);
      await sleep(delay);
    }
  }
}
