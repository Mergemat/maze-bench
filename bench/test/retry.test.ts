import { describe, expect, test } from "bun:test";
import { APICallError } from "ai";
import { classify, InfraError, withRetry } from "../src/harness/retry.ts";

const apiError = (statusCode: number) =>
  new APICallError({
    message: `HTTP ${statusCode}`,
    url: "https://example.test",
    requestBodyValues: {},
    statusCode,
    isRetryable: statusCode === 429 || statusCode >= 500,
  });

const noSleep = { sleep: async () => {} };

describe("classify", () => {
  test("maps status codes and messages to categories", () => {
    expect(classify(apiError(429)).category).toBe("rate_limit");
    expect(classify(apiError(503)).category).toBe("server");
    expect(classify(apiError(400))).toMatchObject({ category: "client", retryable: false });
    expect(classify(new Error("fetch failed")).category).toBe("network");
    expect(classify(new Error("The operation timed out")).category).toBe("timeout");
    expect(classify(new Error("something odd"))).toMatchObject({ category: "unknown", retryable: false });
  });
});

describe("withRetry", () => {
  test("retries transient errors, then succeeds", async () => {
    let calls = 0;
    const out = await withRetry(
      async () => {
        calls++;
        if (calls < 3) {
          throw apiError(502);
        }
        return "ok";
      },
      noSleep,
    );
    expect(out).toBe("ok");
    expect(calls).toBe(3);
  });

  test("does not retry client errors", async () => {
    let calls = 0;
    await expect(
      withRetry(async () => {
        calls++;
        throw apiError(400);
      }, noSleep),
    ).rejects.toBeInstanceOf(InfraError);
    expect(calls).toBe(1);
  });

  test("gives up after the retry limit", async () => {
    let calls = 0;
    const retries: number[] = [];
    await expect(
      withRetry(
        async () => {
          calls++;
          throw apiError(429);
        },
        { ...noSleep, retries: 2, onRetry: (_e, n) => retries.push(n) },
      ),
    ).rejects.toMatchObject({ category: "rate_limit" });
    expect(calls).toBe(3);
    expect(retries).toEqual([1, 2]);
  });
});
