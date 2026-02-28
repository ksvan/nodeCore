import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { PolicyService } from "./policy-service.js";
import type {
  CoverageTermDraftRecord,
  CoverageTermRecord,
  DomainEventPublisher,
  JsonObject,
  PolicyCoverageDraftRecord,
  PolicyCoverageRecord,
  PolicyPremiumRecord,
  PolicyRecord,
  PolicyRepository,
  PolicyRiskDraftRecord,
  PolicyRiskRecord,
  PolicyTermRecord,
  PolicyTransactionRecord,
} from "../ports/policy.js";

class InMemoryEventPublisher implements DomainEventPublisher {
  public async publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    void input;
  }
}

class InMemoryPolicyRepository implements PolicyRepository {
  private readonly policies = new Map<string, PolicyRecord>();
  private readonly terms = new Map<string, PolicyTermRecord>();
  private readonly transactions = new Map<string, PolicyTransactionRecord>();
  private readonly riskDrafts = new Map<string, PolicyRiskDraftRecord>();
  private readonly coverageDrafts = new Map<string, PolicyCoverageDraftRecord>();
  private readonly coverageTermDrafts = new Map<string, CoverageTermDraftRecord>();
  private readonly risks = new Map<string, PolicyRiskRecord>();
  private readonly coverages = new Map<string, PolicyCoverageRecord>();
  private readonly coverageTerms = new Map<string, CoverageTermRecord>();
  private readonly premiums = new Map<string, PolicyPremiumRecord>();
  private readonly idempotency = new Map<string, JsonObject>();

  public async createPolicy(input: {
    policyNumber: string;
    productId: string;
    productVersionId: string;
  }): Promise<PolicyRecord> {
    const now = new Date();
    const row: PolicyRecord = {
      id: randomUUID(),
      policyNumber: input.policyNumber,
      status: "DRAFT",
      productId: input.productId,
      productVersionId: input.productVersionId,
      createdAt: now,
      updatedAt: now,
    };
    this.policies.set(row.id, row);
    return row;
  }

  public async listPolicies(query?: string): Promise<readonly PolicyRecord[]> {
    const rows = [...this.policies.values()];
    if (!query) {
      return rows;
    }
    return rows.filter((row) => row.policyNumber.includes(query) || row.id.includes(query));
  }

  public async getPolicyById(policyId: string): Promise<PolicyRecord | null> {
    return this.policies.get(policyId) ?? null;
  }

  public async updatePolicyStatus(policyId: string, status: PolicyRecord["status"]): Promise<PolicyRecord> {
    const row = this.policies.get(policyId);
    if (!row) {
      throw new Error("policy not found");
    }
    const updated: PolicyRecord = { ...row, status, updatedAt: new Date() };
    this.policies.set(policyId, updated);
    return updated;
  }

  public async createPolicyTerm(input: {
    policyId: string;
    termStart: Date;
    termEnd: Date;
    status: PolicyTermRecord["status"];
  }): Promise<PolicyTermRecord> {
    const now = new Date();
    const row: PolicyTermRecord = {
      id: randomUUID(),
      policyId: input.policyId,
      termStart: input.termStart,
      termEnd: input.termEnd,
      status: input.status,
      createdAt: now,
      updatedAt: now,
    };
    this.terms.set(row.id, row);
    return row;
  }

  public async updatePolicyTermStatus(termId: string, status: PolicyTermRecord["status"]): Promise<PolicyTermRecord> {
    const row = this.terms.get(termId);
    if (!row) {
      throw new Error("term not found");
    }
    const updated: PolicyTermRecord = { ...row, status, updatedAt: new Date() };
    this.terms.set(termId, updated);
    return updated;
  }

  public async getPolicyTermById(termId: string): Promise<PolicyTermRecord | null> {
    return this.terms.get(termId) ?? null;
  }

  public async getLatestPolicyTerm(policyId: string): Promise<PolicyTermRecord | null> {
    return (
      [...this.terms.values()]
        .filter((term) => term.policyId === policyId)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null
    );
  }

  public async createPolicyTransaction(input: {
    policyId: string;
    termId: string;
    type: "NEW_BUSINESS" | "ENDORSEMENT";
    effectiveAt: Date;
    requestId: string | null;
    idempotencyKey: string | null;
  }): Promise<PolicyTransactionRecord> {
    const row: PolicyTransactionRecord = {
      id: randomUUID(),
      policyId: input.policyId,
      termId: input.termId,
      type: input.type,
      status: "DRAFT",
      effectiveAt: input.effectiveAt,
      requestId: input.requestId,
      idempotencyKey: input.idempotencyKey,
      ratingRequestJson: null,
      ratingResponseJson: null,
      ratedAt: null,
      createdAt: new Date(),
      committedAt: null,
    };
    this.transactions.set(row.id, row);
    return row;
  }

  public async listPolicyTransactions(policyId: string): Promise<readonly PolicyTransactionRecord[]> {
    return [...this.transactions.values()].filter((tx) => tx.policyId === policyId);
  }

  public async getPolicyTransactionById(transactionId: string): Promise<PolicyTransactionRecord | null> {
    return this.transactions.get(transactionId) ?? null;
  }

  public async commitPolicyTransaction(transactionId: string, committedAt: Date): Promise<PolicyTransactionRecord> {
    const tx = this.transactions.get(transactionId);
    if (!tx) {
      throw new Error("tx not found");
    }
    const updated: PolicyTransactionRecord = { ...tx, status: "COMMITTED", committedAt };
    this.transactions.set(transactionId, updated);
    return updated;
  }

  public async setPolicyTransactionRating(input: {
    transactionId: string;
    ratingRequestJson: JsonObject;
    ratingResponseJson: JsonObject;
    ratedAt: Date;
  }): Promise<PolicyTransactionRecord> {
    const tx = this.transactions.get(input.transactionId);
    if (!tx) {
      throw new Error("tx not found");
    }
    const updated: PolicyTransactionRecord = {
      ...tx,
      ratingRequestJson: input.ratingRequestJson,
      ratingResponseJson: input.ratingResponseJson,
      ratedAt: input.ratedAt,
    };
    this.transactions.set(input.transactionId, updated);
    return updated;
  }

  public async replaceRiskDrafts(input: {
    policyId: string;
    transactionId: string;
    risks: readonly {
      riskType: "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
      riskKey: string | null;
      attributes: JsonObject;
    }[];
  }): Promise<void> {
    for (const [id, row] of this.riskDrafts.entries()) {
      if (row.transactionId === input.transactionId) {
        this.riskDrafts.delete(id);
      }
    }
    for (const risk of input.risks) {
      const row: PolicyRiskDraftRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        transactionId: input.transactionId,
        riskType: risk.riskType,
        riskKey: risk.riskKey,
        attributes: risk.attributes,
        createdAt: new Date(),
      };
      this.riskDrafts.set(row.id, row);
    }
  }

  public async listRiskDrafts(transactionId: string): Promise<readonly PolicyRiskDraftRecord[]> {
    return [...this.riskDrafts.values()].filter((row) => row.transactionId === transactionId);
  }

  public async replaceCoverageDrafts(input: {
    policyId: string;
    transactionId: string;
    coverages: readonly {
      coverageCode: string;
      appliesToRiskKey: string | null;
      attributes: JsonObject;
    }[];
  }): Promise<void> {
    for (const [id, row] of this.coverageDrafts.entries()) {
      if (row.transactionId === input.transactionId) {
        this.coverageDrafts.delete(id);
      }
    }
    for (const [id, row] of this.coverageTermDrafts.entries()) {
      if (row.transactionId === input.transactionId) {
        this.coverageTermDrafts.delete(id);
      }
    }

    for (const coverage of input.coverages) {
      const row: PolicyCoverageDraftRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        transactionId: input.transactionId,
        coverageCode: coverage.coverageCode,
        appliesToRiskKey: coverage.appliesToRiskKey,
        attributes: coverage.attributes,
        createdAt: new Date(),
      };
      this.coverageDrafts.set(row.id, row);
    }
  }

  public async listCoverageDrafts(transactionId: string): Promise<readonly PolicyCoverageDraftRecord[]> {
    return [...this.coverageDrafts.values()].filter((row) => row.transactionId === transactionId);
  }

  public async replaceCoverageTermDrafts(input: {
    policyId: string;
    transactionId: string;
    terms: readonly {
      coverageCode: string;
      appliesToRiskKey: string | null;
      termCode: string;
      valueType: "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }[];
  }): Promise<void> {
    for (const [id, row] of this.coverageTermDrafts.entries()) {
      if (row.transactionId === input.transactionId) {
        this.coverageTermDrafts.delete(id);
      }
    }

    const coverageByRef = new Map<string, PolicyCoverageDraftRecord>();
    for (const row of this.coverageDrafts.values()) {
      if (row.transactionId === input.transactionId) {
        coverageByRef.set(`${row.coverageCode}::${row.appliesToRiskKey ?? ""}`, row);
      }
    }

    for (const term of input.terms) {
      const draft = coverageByRef.get(`${term.coverageCode}::${term.appliesToRiskKey ?? ""}`);
      if (!draft) {
        throw new Error("coverage draft not found");
      }
      const row: CoverageTermDraftRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        transactionId: input.transactionId,
        policyCoverageDraftId: draft.id,
        termCode: term.termCode,
        valueType: term.valueType,
        moneyAmount: term.moneyAmount,
        moneyCurrency: term.moneyCurrency,
        numberValue: term.numberValue,
        stringValue: term.stringValue,
        booleanValue: term.booleanValue,
        createdAt: new Date(),
      };
      this.coverageTermDrafts.set(row.id, row);
    }
  }

  public async listCoverageTermDrafts(transactionId: string): Promise<readonly CoverageTermDraftRecord[]> {
    return [...this.coverageTermDrafts.values()].filter((row) => row.transactionId === transactionId);
  }

  public async closeActiveRisks(policyId: string, effectiveAt: Date): Promise<void> {
    for (const [id, row] of this.risks.entries()) {
      if (row.policyId === policyId && row.effectiveFrom < effectiveAt && row.effectiveTo > effectiveAt) {
        this.risks.set(id, { ...row, effectiveTo: effectiveAt });
      }
    }
  }

  public async closeActiveCoverages(policyId: string, effectiveAt: Date): Promise<void> {
    for (const [id, row] of this.coverages.entries()) {
      if (row.policyId === policyId && row.effectiveFrom < effectiveAt && row.effectiveTo > effectiveAt) {
        this.coverages.set(id, { ...row, effectiveTo: effectiveAt });
      }
    }
  }

  public async closeActiveCoverageTerms(policyId: string, effectiveAt: Date): Promise<void> {
    const coverageIds = [...this.coverages.values()]
      .filter((coverage) => coverage.policyId === policyId)
      .map((coverage) => coverage.id);
    const ids = new Set(coverageIds);

    for (const [id, row] of this.coverageTerms.entries()) {
      if (ids.has(row.policyCoverageId) && row.effectiveFrom < effectiveAt && row.effectiveTo > effectiveAt) {
        this.coverageTerms.set(id, { ...row, effectiveTo: effectiveAt });
      }
    }
  }

  public async closeActivePremiums(policyId: string, effectiveAt: Date): Promise<void> {
    for (const [id, row] of this.premiums.entries()) {
      if (row.policyId === policyId && row.effectiveFrom < effectiveAt && row.effectiveTo > effectiveAt) {
        this.premiums.set(id, { ...row, effectiveTo: effectiveAt });
      }
    }
  }

  public async createPolicyRisks(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    risks: readonly {
      riskType: "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
      riskKey: string | null;
      attributes: JsonObject;
    }[];
  }): Promise<readonly PolicyRiskRecord[]> {
    const rows: PolicyRiskRecord[] = [];
    for (const risk of input.risks) {
      const row: PolicyRiskRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        termId: input.termId,
        riskType: risk.riskType,
        riskKey: risk.riskKey,
        attributes: risk.attributes,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
        createdAt: new Date(),
      };
      this.risks.set(row.id, row);
      rows.push(row);
    }
    return rows;
  }

  public async createPolicyCoverages(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    coverages: readonly {
      coverageCode: string;
      appliesToRiskId: string | null;
      attributes: JsonObject;
    }[];
  }): Promise<readonly PolicyCoverageRecord[]> {
    const rows: PolicyCoverageRecord[] = [];
    for (const coverage of input.coverages) {
      const row: PolicyCoverageRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        termId: input.termId,
        coverageCode: coverage.coverageCode,
        appliesToRiskId: coverage.appliesToRiskId,
        attributes: coverage.attributes,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
        createdAt: new Date(),
      };
      this.coverages.set(row.id, row);
      rows.push(row);
    }
    return rows;
  }

  public async createCoverageTerms(input: {
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    terms: readonly {
      policyCoverageId: string;
      termCode: string;
      valueType: "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }[];
  }): Promise<void> {
    for (const term of input.terms) {
      const row: CoverageTermRecord = {
        id: randomUUID(),
        policyCoverageId: term.policyCoverageId,
        termCode: term.termCode,
        valueType: term.valueType,
        moneyAmount: term.moneyAmount,
        moneyCurrency: term.moneyCurrency,
        numberValue: term.numberValue,
        stringValue: term.stringValue,
        booleanValue: term.booleanValue,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
        createdAt: new Date(),
      };
      this.coverageTerms.set(row.id, row);
    }
  }

  public async createPolicyPremiums(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    premiums: readonly {
      coverageId: string | null;
      riskId: string | null;
      totalAmount: string;
      currency: string;
      breakdown: JsonObject | null;
    }[];
  }): Promise<void> {
    for (const premium of input.premiums) {
      const row: PolicyPremiumRecord = {
        id: randomUUID(),
        policyId: input.policyId,
        termId: input.termId,
        coverageId: premium.coverageId,
        riskId: premium.riskId,
        totalAmount: premium.totalAmount,
        currency: premium.currency,
        breakdown: premium.breakdown,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
        createdAt: new Date(),
      };
      this.premiums.set(row.id, row);
    }
  }

  public async getAsOfRisks(policyId: string, asOf: Date): Promise<readonly PolicyRiskRecord[]> {
    return [...this.risks.values()].filter(
      (row) => row.policyId === policyId && row.effectiveFrom <= asOf && row.effectiveTo > asOf,
    );
  }

  public async getAsOfCoverages(policyId: string, asOf: Date): Promise<readonly PolicyCoverageRecord[]> {
    return [...this.coverages.values()].filter(
      (row) => row.policyId === policyId && row.effectiveFrom <= asOf && row.effectiveTo > asOf,
    );
  }

  public async getAsOfCoverageTermsByCoverageIds(
    coverageIds: readonly string[],
    asOf: Date,
  ): Promise<readonly CoverageTermRecord[]> {
    const ids = new Set(coverageIds);
    return [...this.coverageTerms.values()].filter(
      (row) => ids.has(row.policyCoverageId) && row.effectiveFrom <= asOf && row.effectiveTo > asOf,
    );
  }

  public async getAsOfPremiums(policyId: string, asOf: Date): Promise<readonly PolicyPremiumRecord[]> {
    return [...this.premiums.values()].filter(
      (row) => row.policyId === policyId && row.effectiveFrom <= asOf && row.effectiveTo > asOf,
    );
  }

  public async getIdempotency(scope: string, key: string): Promise<JsonObject | null> {
    return this.idempotency.get(`${scope}::${key}`) ?? null;
  }

  public async saveIdempotency(input: {
    policyId: string | null;
    scope: string;
    key: string;
    responseJson: JsonObject;
  }): Promise<void> {
    void input.policyId;
    this.idempotency.set(`${input.scope}::${input.key}`, structuredClone(input.responseJson));
  }
}

test("NB commit creates structured effective-dated risks/coverages/terms", async () => {
  const service = new PolicyService(
    new InMemoryPolicyRepository(),
    {
      calculate: async () => ({
        requestId: randomUUID(),
        response: {
          schemaVersion: "v1",
          requestId: randomUUID(),
          resultVersion: "test",
          totals: { totalPremium: "100.00", currency: "SEK" },
          errors: [],
        },
      }),
    },
    new InMemoryEventPublisher(),
  );

  const policy = await service.createPolicy({
    policyNumber: "P-001",
    productId: randomUUID(),
    productVersionId: randomUUID(),
    termStart: new Date("2026-01-01T00:00:00.000Z"),
    termEnd: new Date("2027-01-01T00:00:00.000Z"),
    idempotencyKey: "create-policy-1",
  });

  const tx = await service.createTransaction({
    policyId: policy.id,
    type: "NEW_BUSINESS",
    effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    requestId: randomUUID(),
    idempotencyKey: "nb-tx-1",
  });

  await service.replaceTransactionRisks({
    transactionId: tx.id,
    risks: [{ riskType: "VEHICLE", riskKey: "ABC123", attributes: { vin: "VIN1" } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: tx.id,
    coverages: [{ coverageCode: "COLLISION", appliesToRiskKey: "ABC123", attributes: { selected: true } }],
  });
  await service.replaceTransactionCoverageTerms({
    transactionId: tx.id,
    terms: [
      {
        coverageCode: "COLLISION",
        appliesToRiskKey: "ABC123",
        termCode: "LIMIT",
        valueType: "MONEY",
        moneyAmount: "100000.00",
        moneyCurrency: "SEK",
        numberValue: null,
        stringValue: null,
        booleanValue: null,
      },
    ],
  });

  await service.commitTransaction({ transactionId: tx.id, idempotencyKey: "commit-1" });
  const snapshot = await service.getPolicySnapshot(policy.id, new Date("2026-01-02T00:00:00.000Z"));

  assert.equal(snapshot.risks.length, 1);
  assert.equal(snapshot.coverages.length, 1);
  assert.equal(snapshot.coverages[0]?.terms.length, 1);
  assert.equal(snapshot.coverages[0]?.terms[0]?.termCode, "LIMIT");
});

test("endorsement closes previous rows and inserts new rows at effective date", async () => {
  const service = new PolicyService(
    new InMemoryPolicyRepository(),
    {
      calculate: async () => ({
        requestId: randomUUID(),
        response: {
          schemaVersion: "v1",
          requestId: randomUUID(),
          resultVersion: "test",
          totals: { totalPremium: "100.00", currency: "SEK" },
          errors: [],
        },
      }),
    },
    new InMemoryEventPublisher(),
  );

  const policy = await service.createPolicy({
    policyNumber: "P-002",
    productId: randomUUID(),
    productVersionId: randomUUID(),
    termStart: new Date("2026-01-01T00:00:00.000Z"),
    termEnd: new Date("2027-01-01T00:00:00.000Z"),
    idempotencyKey: "create-policy-2",
  });
  const nb = await service.createTransaction({
    policyId: policy.id,
    type: "NEW_BUSINESS",
    effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    requestId: null,
    idempotencyKey: "nb-tx-2",
  });
  await service.replaceTransactionRisks({
    transactionId: nb.id,
    risks: [{ riskType: "VEHICLE", riskKey: "REG-1", attributes: { seats: 4 } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: nb.id,
    coverages: [{ coverageCode: "TP", appliesToRiskKey: "REG-1", attributes: {} }],
  });
  await service.commitTransaction({ transactionId: nb.id, idempotencyKey: "nb-commit-2" });

  const endorsementDate = new Date("2026-06-01T00:00:00.000Z");
  const endTx = await service.createTransaction({
    policyId: policy.id,
    type: "ENDORSEMENT",
    effectiveAt: endorsementDate,
    requestId: null,
    idempotencyKey: "end-tx-2",
  });
  await service.replaceTransactionRisks({
    transactionId: endTx.id,
    risks: [{ riskType: "VEHICLE", riskKey: "REG-2", attributes: { seats: 5 } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: endTx.id,
    coverages: [{ coverageCode: "TP", appliesToRiskKey: "REG-2", attributes: {} }],
  });
  await service.commitTransaction({ transactionId: endTx.id, idempotencyKey: "end-commit-2" });

  const before = await service.getPolicySnapshot(policy.id, new Date("2026-05-15T00:00:00.000Z"));
  const after = await service.getPolicySnapshot(policy.id, new Date("2026-06-15T00:00:00.000Z"));

  assert.equal(before.risks[0]?.riskKey, "REG-1");
  assert.equal(after.risks[0]?.riskKey, "REG-2");
});

test("as-of snapshot changes across endorsement", async () => {
  const service = new PolicyService(
    new InMemoryPolicyRepository(),
    {
      calculate: async () => ({
        requestId: randomUUID(),
        response: {
          schemaVersion: "v1",
          requestId: randomUUID(),
          resultVersion: "test",
          totals: { totalPremium: "100.00", currency: "SEK" },
          errors: [],
        },
      }),
    },
    new InMemoryEventPublisher(),
  );

  const policy = await service.createPolicy({
    policyNumber: "P-003",
    productId: randomUUID(),
    productVersionId: randomUUID(),
    termStart: new Date("2026-01-01T00:00:00.000Z"),
    termEnd: new Date("2027-01-01T00:00:00.000Z"),
    idempotencyKey: "create-policy-3",
  });

  const nb = await service.createTransaction({
    policyId: policy.id,
    type: "NEW_BUSINESS",
    effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    requestId: null,
    idempotencyKey: "nb-tx-3",
  });
  await service.replaceTransactionRisks({
    transactionId: nb.id,
    risks: [{ riskType: "PROPERTY", riskKey: "BLD-1", attributes: { area: 100 } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: nb.id,
    coverages: [{ coverageCode: "FIRE", appliesToRiskKey: "BLD-1", attributes: {} }],
  });
  await service.commitTransaction({ transactionId: nb.id, idempotencyKey: "nb-commit-3" });

  const endTx = await service.createTransaction({
    policyId: policy.id,
    type: "ENDORSEMENT",
    effectiveAt: new Date("2026-09-01T00:00:00.000Z"),
    requestId: null,
    idempotencyKey: "end-tx-3",
  });
  await service.replaceTransactionRisks({
    transactionId: endTx.id,
    risks: [{ riskType: "PROPERTY", riskKey: "BLD-2", attributes: { area: 140 } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: endTx.id,
    coverages: [{ coverageCode: "FIRE", appliesToRiskKey: "BLD-2", attributes: {} }],
  });
  await service.commitTransaction({ transactionId: endTx.id, idempotencyKey: "end-commit-3" });

  const before = await service.getPolicySnapshot(policy.id, new Date("2026-08-01T00:00:00.000Z"));
  const after = await service.getPolicySnapshot(policy.id, new Date("2026-10-01T00:00:00.000Z"));

  assert.equal(before.coverages[0]?.appliesToRiskId === null, false);
  assert.equal(before.risks[0]?.riskKey, "BLD-1");
  assert.equal(after.risks[0]?.riskKey, "BLD-2");
});

test("idempotent commit does not duplicate rows", async () => {
  const service = new PolicyService(
    new InMemoryPolicyRepository(),
    {
      calculate: async () => ({
        requestId: randomUUID(),
        response: {
          schemaVersion: "v1",
          requestId: randomUUID(),
          resultVersion: "test",
          totals: { totalPremium: "100.00", currency: "SEK" },
          errors: [],
        },
      }),
    },
    new InMemoryEventPublisher(),
  );

  const policy = await service.createPolicy({
    policyNumber: "P-004",
    productId: randomUUID(),
    productVersionId: randomUUID(),
    termStart: new Date("2026-01-01T00:00:00.000Z"),
    termEnd: new Date("2027-01-01T00:00:00.000Z"),
    idempotencyKey: "create-policy-4",
  });

  const tx = await service.createTransaction({
    policyId: policy.id,
    type: "NEW_BUSINESS",
    effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    requestId: null,
    idempotencyKey: "nb-tx-4",
  });

  await service.replaceTransactionRisks({
    transactionId: tx.id,
    risks: [{ riskType: "PERSON", riskKey: "PERS-1", attributes: { age: 32 } }],
  });
  await service.replaceTransactionCoverages({
    transactionId: tx.id,
    coverages: [{ coverageCode: "ACCIDENT", appliesToRiskKey: "PERS-1", attributes: {} }],
  });

  const first = await service.commitTransaction({ transactionId: tx.id, idempotencyKey: "commit-4" });
  const second = await service.commitTransaction({ transactionId: tx.id, idempotencyKey: "commit-4" });

  assert.equal(first.transactionId, second.transactionId);

  const snapshot = await service.getPolicySnapshot(policy.id, new Date("2026-02-01T00:00:00.000Z"));
  assert.equal(snapshot.risks.length, 1);
  assert.equal(snapshot.coverages.length, 1);
});

test("rating stores premium and commit creates effective-dated PolicyPremium row", async () => {
  const service = new PolicyService(
    new InMemoryPolicyRepository(),
    {
      calculate: async () => ({
        requestId: randomUUID(),
        response: {
          schemaVersion: "v1",
          requestId: randomUUID(),
          resultVersion: "ppv-1",
          totals: { totalPremium: "321.00", currency: "SEK" },
          errors: [],
        },
      }),
    },
    new InMemoryEventPublisher(),
  );

  const policy = await service.createPolicy({
    policyNumber: "P-005",
    productId: randomUUID(),
    productVersionId: randomUUID(),
    termStart: new Date("2026-01-01T00:00:00.000Z"),
    termEnd: new Date("2027-01-01T00:00:00.000Z"),
    idempotencyKey: "create-policy-5",
  });

  const tx = await service.createTransaction({
    policyId: policy.id,
    type: "NEW_BUSINESS",
    effectiveAt: new Date("2026-01-01T00:00:00.000Z"),
    requestId: randomUUID(),
    idempotencyKey: "nb-tx-5",
  });

  await service.replaceTransactionRisks({
    transactionId: tx.id,
    risks: [{ riskType: "VEHICLE", riskKey: "REG-5", attributes: {} }],
  });
  await service.replaceTransactionCoverages({
    transactionId: tx.id,
    coverages: [{ coverageCode: "CASCO", appliesToRiskKey: "REG-5", attributes: {} }],
  });

  const rated = await service.rateTransaction({ transactionId: tx.id, requestId: randomUUID() });
  assert.equal(rated.totalPremium, "321.00");

  await service.commitTransaction({ transactionId: tx.id, idempotencyKey: "commit-5" });

  const snapshot = await service.getPolicySnapshot(policy.id, new Date("2026-01-10T00:00:00.000Z"));
  assert.equal(snapshot.premiums.length, 1);
  assert.equal(snapshot.premiums[0]?.totalAmount, "321.00");
});
