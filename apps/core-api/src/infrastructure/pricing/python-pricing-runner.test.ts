import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import { PythonPricingRunner } from "./python-pricing-runner.js";

const createScript = async (content: string): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "pricing-runner-"));
  const filePath = join(dir, "price.py");
  await writeFile(filePath, content, "utf8");
  return filePath;
};

test("python runner executes pricing script and parses json response", async () => {
  const fileRef = await createScript(`
import json, sys
req = json.load(sys.stdin)
print(json.dumps({
  "schemaVersion": "v1",
  "requestId": req["requestId"],
  "resultVersion": req["pricingProgramVersionId"],
  "totals": {"totalPremium": "123.45", "currency": req["currency"]},
  "errors": []
}))
`);

  const runner = new PythonPricingRunner();
  const result = await runner.execute({
    fileRef,
    requestJson: {
      schemaVersion: "v1",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
      productId: "550e8400-e29b-41d4-a716-446655440001",
      productVersionId: "550e8400-e29b-41d4-a716-446655440002",
      productVersionVersion: "1",
      pricingProgramVersionId: "550e8400-e29b-41d4-a716-446655440003",
      transaction: {
        transactionId: "550e8400-e29b-41d4-a716-446655440004",
        type: "NEW_BUSINESS",
        effectiveAt: "2026-01-01T00:00:00.000Z",
      },
      policy: {
        policyId: "550e8400-e29b-41d4-a716-446655440005",
        policyNumber: "P-1",
        termStart: "2026-01-01T00:00:00.000Z",
        termEnd: "2027-01-01T00:00:00.000Z",
      },
      parties: [],
      risks: [],
      coverages: [],
      currency: "SEK",
    },
    timeoutMs: 3000,
    maxOutputBytes: 1024 * 1024,
  });

  assert.equal((result.responseJson.totals as Record<string, unknown>).totalPremium, "123.45");
});

test("python runner fails on invalid json response", async () => {
  const fileRef = await createScript("print('not-json')\n");
  const runner = new PythonPricingRunner();

  await assert.rejects(
    () =>
      runner.execute({
        fileRef,
        requestJson: {
          schemaVersion: "v1",
          requestId: "550e8400-e29b-41d4-a716-446655440000",
          productId: "550e8400-e29b-41d4-a716-446655440001",
          productVersionId: "550e8400-e29b-41d4-a716-446655440002",
          productVersionVersion: "1",
          pricingProgramVersionId: "550e8400-e29b-41d4-a716-446655440003",
          transaction: {
            transactionId: "550e8400-e29b-41d4-a716-446655440004",
            type: "NEW_BUSINESS",
            effectiveAt: "2026-01-01T00:00:00.000Z",
          },
          policy: {
            policyId: "550e8400-e29b-41d4-a716-446655440005",
            policyNumber: "P-1",
            termStart: "2026-01-01T00:00:00.000Z",
            termEnd: "2027-01-01T00:00:00.000Z",
          },
          parties: [],
          risks: [],
          coverages: [],
          currency: "SEK",
        },
        timeoutMs: 3000,
        maxOutputBytes: 1024 * 1024,
      }),
    /valid JSON/i,
  );
});

test("python runner fails on timeout", async () => {
  const fileRef = await createScript("import time\ntime.sleep(2)\nprint('{}')\n");
  const runner = new PythonPricingRunner();

  await assert.rejects(
    () =>
      runner.execute({
        fileRef,
        requestJson: {
          schemaVersion: "v1",
          requestId: "550e8400-e29b-41d4-a716-446655440000",
          productId: "550e8400-e29b-41d4-a716-446655440001",
          productVersionId: "550e8400-e29b-41d4-a716-446655440002",
          productVersionVersion: "1",
          pricingProgramVersionId: "550e8400-e29b-41d4-a716-446655440003",
          transaction: {
            transactionId: "550e8400-e29b-41d4-a716-446655440004",
            type: "NEW_BUSINESS",
            effectiveAt: "2026-01-01T00:00:00.000Z",
          },
          policy: {
            policyId: "550e8400-e29b-41d4-a716-446655440005",
            policyNumber: "P-1",
            termStart: "2026-01-01T00:00:00.000Z",
            termEnd: "2027-01-01T00:00:00.000Z",
          },
          parties: [],
          risks: [],
          coverages: [],
          currency: "SEK",
        },
        timeoutMs: 50,
        maxOutputBytes: 1024 * 1024,
      }),
    /timed out/i,
  );
});
