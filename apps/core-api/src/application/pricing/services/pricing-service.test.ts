import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  CalculatePricingInput,
  PricingContext,
  PricingDomainEventPublisher,
  PricingExecutionResult,
  PricingPolicyContext,
  PricingRepository,
  PricingRunRecord,
  PricingRunner,
} from "../ports/pricing.js";
import { PricingService } from "./pricing-service.js";
import { PythonPricingRunner } from "../../../infrastructure/pricing/python-pricing-runner.js";

class InMemoryPricingRepository implements PricingRepository {
  public readonly runs = new Map<string, PricingRunRecord>();

  public async getPricingContextByProductVersionId(productVersionId: string): Promise<PricingContext | null> {
    return {
      productId: randomUUID(),
      productVersionId,
      productVersionVersion: "1",
      pricingProgramVersionId: randomUUID(),
      pricingProgramVersionStatus: "ACTIVE",
      pricingProgramFileRef: "tests/price.py",
      pricingInputSchema: {},
      pricingOutputSchema: {},
      defaultCurrency: "SEK",
      allowedCurrencies: ["SEK", "EUR"],
    };
  }

  public async getPricingPolicyContextByTransactionId(transactionId: string): Promise<PricingPolicyContext | null> {
    return {
      policyId: randomUUID(),
      policyNumber: "P-100",
      productId: randomUUID(),
      productVersionId: randomUUID(),
      termId: randomUUID(),
      termStart: new Date("2026-01-01T00:00:00.000Z"),
      termEnd: new Date("2027-01-01T00:00:00.000Z"),
      transactionId,
      transactionType: "NEW_BUSINESS",
      effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
      risks: [{ riskType: "VEHICLE", riskKey: "REG-100", attributes: {} }],
      coverages: [{ coverageCode: "CASCO", attributes: {}, terms: [] }],
    };
  }

  public async getPricingRunByRequestId(requestId: string): Promise<PricingRunRecord | null> {
    return this.runs.get(requestId) ?? null;
  }

  public async createPricingRun(input: {
    requestId: string;
    policyTransactionId: string | null;
    productVersionId: string;
    pricingProgramVersionId: string;
    pricingProgramFileRef: string;
    pricingProgramFileHash: string;
    requestJson: Record<string, unknown>;
    responseJson: Record<string, unknown>;
    durationMs: number;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    success: boolean;
    errorSummary: string | null;
  }): Promise<PricingRunRecord> {
    const row: PricingRunRecord = {
      id: randomUUID(),
      requestId: input.requestId,
      policyTransactionId: input.policyTransactionId,
      productVersionId: input.productVersionId,
      pricingProgramVersionId: input.pricingProgramVersionId,
      pricingProgramFileRef: input.pricingProgramFileRef,
      pricingProgramFileHash: input.pricingProgramFileHash,
      requestJson: input.requestJson,
      responseJson: input.responseJson,
      occurredAt: new Date(),
      durationMs: input.durationMs,
      currency: input.currency,
      success: input.success,
      errorSummary: input.errorSummary,
    };
    this.runs.set(row.requestId, row);
    return row;
  }
}

class StubRunner implements PricingRunner {
  public executions = 0;

  public async execute(input: {
    fileRef: string;
    requestJson: import("@nodecore/contracts/pricing").PricingRequest;
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<PricingExecutionResult> {
    void input.fileRef;
    void input.timeoutMs;
    void input.maxOutputBytes;
    this.executions += 1;
    return {
      durationMs: 12,
      stderr: "",
      responseJson: {
        schemaVersion: "v1",
        requestId: input.requestJson.requestId,
        resultVersion: input.requestJson.pricingProgramVersionId,
        totals: {
          totalPremium: "100.00",
          currency: input.requestJson.currency,
        },
        errors: [],
      },
    };
  }
}

class NoopEventPublisher implements PricingDomainEventPublisher {
  public async publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    void input;
  }
}

test("pricing calculate is idempotent by requestId", async () => {
  const programRoot = await mkdtemp(join(tmpdir(), "pricing-programs-"));
  const pricingRoot = join(programRoot, "tests");
  await mkdir(pricingRoot, { recursive: true });
  await writeFile(join(pricingRoot, "price.py"), "print('{}')\n", "utf8");
  process.env.PRICING_PROGRAMS_DIR = programRoot;

  const repo = new InMemoryPricingRepository();
  const runner = new StubRunner();
  const service = new PricingService(repo, runner, new NoopEventPublisher());

  const requestId = randomUUID();
  const input: CalculatePricingInput = {
    requestId,
    productVersionId: randomUUID(),
    policyTransactionId: randomUUID(),
  };

  const first = await service.calculate(input);
  const second = await service.calculate(input);

  assert.equal(first.requestId, second.requestId);
  assert.equal(runner.executions, 1);
  assert.equal(repo.runs.size, 1);
});

test("pricing service executes real python program for transaction payload", async () => {
  const programRoot = await mkdtemp(join(tmpdir(), "pricing-programs-"));
  const dir = join(programRoot, "tests");
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "price.py"),
    `import json, sys\nreq = json.load(sys.stdin)\nprint(json.dumps({\n  "schemaVersion": "v1",\n  "requestId": req["requestId"],\n  "resultVersion": req["pricingProgramVersionId"],\n  "totals": {"totalPremium": "777.00", "currency": req["currency"]},\n  "errors": []\n}))\n`,
    "utf8",
  );
  process.env.PRICING_PROGRAMS_DIR = programRoot;

  const repo = new InMemoryPricingRepository();
  const service = new PricingService(repo, new PythonPricingRunner(), new NoopEventPublisher());

  const response = await service.calculate({
    requestId: randomUUID(),
    productVersionId: randomUUID(),
    policyTransactionId: randomUUID(),
    currency: "SEK",
  });

  assert.equal(response.response.totals.totalPremium, "777.00");
  assert.equal(repo.runs.size, 1);
});
