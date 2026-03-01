import type {
  CoverageTerm,
  CoverageTermDraft,
  Policy,
  PolicyCoverage,
  PolicyCoverageDraft,
  PolicyIdempotencyKey,
  PolicyPremium,
  PolicyRisk,
  PolicyRiskDraft,
  PolicyTerm,
  PolicyTransaction,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import type {
  CoverageTermDraftRecord,
  CoverageTermRecord,
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
} from "../../application/policy/ports/policy.js";

const asJsonObject = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const toInputJson = (value: JsonObject): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const mapPolicy = (value: Policy): PolicyRecord => ({
  id: value.id,
  policyNumber: value.policyNumber,
  status: value.status,
  productId: value.productId,
  productVersionId: value.productVersionId,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const mapPolicyTerm = (value: PolicyTerm): PolicyTermRecord => ({
  id: value.id,
  policyId: value.policyId,
  termStart: value.termStart,
  termEnd: value.termEnd,
  status: value.status,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const mapPolicyTransaction = (value: PolicyTransaction): PolicyTransactionRecord => ({
  id: value.id,
  policyId: value.policyId,
  termId: value.termId,
  type: value.type,
  status: value.status,
  effectiveAt: value.effectiveAt,
  requestId: value.requestId,
  idempotencyKey: value.idempotencyKey,
  ratingRequestJson: value.ratingRequestJson ? asJsonObject(value.ratingRequestJson) : null,
  ratingResponseJson: value.ratingResponseJson ? asJsonObject(value.ratingResponseJson) : null,
  ratedAt: value.ratedAt,
  createdAt: value.createdAt,
  committedAt: value.committedAt,
});

const mapPolicyRisk = (value: PolicyRisk): PolicyRiskRecord => ({
  id: value.id,
  policyId: value.policyId,
  termId: value.termId,
  riskType: value.riskType,
  riskKey: value.riskKey,
  attributes: asJsonObject(value.attributes),
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdByTransactionId: value.createdByTransactionId,
  createdAt: value.createdAt,
});

const mapPolicyCoverage = (value: PolicyCoverage): PolicyCoverageRecord => ({
  id: value.id,
  policyId: value.policyId,
  termId: value.termId,
  coverageCode: value.coverageCode,
  appliesToRiskId: value.appliesToRiskId,
  attributes: asJsonObject(value.attributes),
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdByTransactionId: value.createdByTransactionId,
  createdAt: value.createdAt,
});

const mapCoverageTerm = (value: CoverageTerm): CoverageTermRecord => ({
  id: value.id,
  policyCoverageId: value.policyCoverageId,
  termCode: value.termCode,
  valueType: value.valueType,
  moneyAmount: value.moneyAmount?.toFixed(2) ?? null,
  moneyCurrency: value.moneyCurrency,
  numberValue: value.numberValue?.toFixed(4) ?? null,
  stringValue: value.stringValue,
  booleanValue: value.booleanValue,
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdByTransactionId: value.createdByTransactionId,
  createdAt: value.createdAt,
});

const mapPolicyPremium = (value: PolicyPremium): PolicyPremiumRecord => ({
  id: value.id,
  policyId: value.policyId,
  termId: value.termId,
  coverageId: value.coverageId,
  riskId: value.riskId,
  totalAmount: value.totalAmount.toFixed(2),
  currency: value.currency,
  breakdown: value.breakdown ? asJsonObject(value.breakdown) : null,
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdByTransactionId: value.createdByTransactionId,
  createdAt: value.createdAt,
});

const mapPolicyRiskDraft = (value: PolicyRiskDraft): PolicyRiskDraftRecord => ({
  id: value.id,
  policyId: value.policyId,
  transactionId: value.transactionId,
  riskType: value.riskType,
  riskKey: value.riskKey,
  attributes: asJsonObject(value.attributes),
  createdAt: value.createdAt,
});

const mapPolicyCoverageDraft = (value: PolicyCoverageDraft): PolicyCoverageDraftRecord => ({
  id: value.id,
  policyId: value.policyId,
  transactionId: value.transactionId,
  coverageCode: value.coverageCode,
  appliesToRiskKey: value.appliesToRiskKey,
  attributes: asJsonObject(value.attributes),
  createdAt: value.createdAt,
});

const mapCoverageTermDraft = (value: CoverageTermDraft): CoverageTermDraftRecord => ({
  id: value.id,
  policyId: value.policyId,
  transactionId: value.transactionId,
  policyCoverageDraftId: value.policyCoverageDraftId,
  termCode: value.termCode,
  valueType: value.valueType,
  moneyAmount: value.moneyAmount?.toFixed(2) ?? null,
  moneyCurrency: value.moneyCurrency,
  numberValue: value.numberValue?.toFixed(4) ?? null,
  stringValue: value.stringValue,
  booleanValue: value.booleanValue,
  createdAt: value.createdAt,
});

const coverageRef = (coverageCode: string, appliesToRiskKey: string | null): string =>
  `${coverageCode}::${appliesToRiskKey ?? ""}`;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class PrismaPolicyRepository implements PolicyRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createPolicy(input: {
    policyNumber: string;
    productId: string;
    productVersionId: string;
  }): Promise<PolicyRecord> {
    const created = await this.prisma.policy.create({
      data: {
        policyNumber: input.policyNumber,
        productId: input.productId,
        productVersionId: input.productVersionId,
      },
    });
    return mapPolicy(created);
  }

  public async listPolicies(query?: string): Promise<ReadonlyArray<PolicyRecord>> {
    const trimmedQuery = query?.trim() ?? "";
    const where =
      trimmedQuery.length > 0
        ? {
            OR: [
              ...(UUID_PATTERN.test(trimmedQuery) ? [{ id: trimmedQuery }] : []),
              { policyNumber: { contains: trimmedQuery, mode: "insensitive" as const } },
            ],
          }
        : undefined;
    const rows = await this.prisma.policy.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapPolicy(row));
  }

  public async getPolicyById(policyId: string): Promise<PolicyRecord | null> {
    const row = await this.prisma.policy.findUnique({ where: { id: policyId } });
    return row ? mapPolicy(row) : null;
  }

  public async updatePolicyStatus(policyId: string, status: PolicyRecord["status"]): Promise<PolicyRecord> {
    const row = await this.prisma.policy.update({ where: { id: policyId }, data: { status } });
    return mapPolicy(row);
  }

  public async createPolicyTerm(input: {
    policyId: string;
    termStart: Date;
    termEnd: Date;
    status: PolicyTermRecord["status"];
  }): Promise<PolicyTermRecord> {
    const row = await this.prisma.policyTerm.create({
      data: {
        policyId: input.policyId,
        termStart: input.termStart,
        termEnd: input.termEnd,
        status: input.status,
      },
    });
    return mapPolicyTerm(row);
  }

  public async updatePolicyTermStatus(
    termId: string,
    status: PolicyTermRecord["status"],
  ): Promise<PolicyTermRecord> {
    const row = await this.prisma.policyTerm.update({ where: { id: termId }, data: { status } });
    return mapPolicyTerm(row);
  }

  public async getPolicyTermById(termId: string): Promise<PolicyTermRecord | null> {
    const row = await this.prisma.policyTerm.findUnique({ where: { id: termId } });
    return row ? mapPolicyTerm(row) : null;
  }

  public async getLatestPolicyTerm(policyId: string): Promise<PolicyTermRecord | null> {
    const row = await this.prisma.policyTerm.findFirst({
      where: { policyId },
      orderBy: [{ createdAt: "desc" }],
    });
    return row ? mapPolicyTerm(row) : null;
  }

  public async createPolicyTransaction(input: {
    policyId: string;
    termId: string;
    type: "NEW_BUSINESS" | "ENDORSEMENT";
    effectiveAt: Date;
    requestId: string | null;
    idempotencyKey: string | null;
  }): Promise<PolicyTransactionRecord> {
    const row = await this.prisma.policyTransaction.create({
      data: {
        policyId: input.policyId,
        termId: input.termId,
        type: input.type,
        effectiveAt: input.effectiveAt,
        requestId: input.requestId,
        idempotencyKey: input.idempotencyKey,
      },
    });
    return mapPolicyTransaction(row);
  }

  public async listPolicyTransactions(policyId: string): Promise<ReadonlyArray<PolicyTransactionRecord>> {
    const rows = await this.prisma.policyTransaction.findMany({
      where: { policyId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => mapPolicyTransaction(row));
  }

  public async getPolicyTransactionById(transactionId: string): Promise<PolicyTransactionRecord | null> {
    const row = await this.prisma.policyTransaction.findUnique({ where: { id: transactionId } });
    return row ? mapPolicyTransaction(row) : null;
  }

  public async commitPolicyTransaction(
    transactionId: string,
    committedAt: Date,
  ): Promise<PolicyTransactionRecord> {
    const row = await this.prisma.policyTransaction.update({
      where: { id: transactionId },
      data: { status: "COMMITTED", committedAt },
    });
    return mapPolicyTransaction(row);
  }

  public async setPolicyTransactionRating(input: {
    transactionId: string;
    ratingRequestJson: JsonObject;
    ratingResponseJson: JsonObject;
    ratedAt: Date;
  }): Promise<PolicyTransactionRecord> {
    const row = await this.prisma.policyTransaction.update({
      where: { id: input.transactionId },
      data: {
        ratingRequestJson: toInputJson(input.ratingRequestJson),
        ratingResponseJson: toInputJson(input.ratingResponseJson),
        ratedAt: input.ratedAt,
      },
    });
    return mapPolicyTransaction(row);
  }

  public async replaceRiskDrafts(input: {
    policyId: string;
    transactionId: string;
    risks: ReadonlyArray<{
      riskType: "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
      riskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.policyRiskDraft.deleteMany({ where: { transactionId: input.transactionId } });
      if (input.risks.length > 0) {
        await tx.policyRiskDraft.createMany({
          data: input.risks.map((risk) => ({
            policyId: input.policyId,
            transactionId: input.transactionId,
            riskType: risk.riskType,
            riskKey: risk.riskKey,
            attributes: toInputJson(risk.attributes),
          })),
        });
      }
    });
  }

  public async listRiskDrafts(transactionId: string): Promise<ReadonlyArray<PolicyRiskDraftRecord>> {
    const rows = await this.prisma.policyRiskDraft.findMany({
      where: { transactionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapPolicyRiskDraft(row));
  }

  public async replaceCoverageDrafts(input: {
    policyId: string;
    transactionId: string;
    coverages: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.coverageTermDraft.deleteMany({ where: { transactionId: input.transactionId } });
      await tx.policyCoverageDraft.deleteMany({ where: { transactionId: input.transactionId } });
      if (input.coverages.length > 0) {
        await tx.policyCoverageDraft.createMany({
          data: input.coverages.map((coverage) => ({
            policyId: input.policyId,
            transactionId: input.transactionId,
            coverageCode: coverage.coverageCode,
            appliesToRiskKey: coverage.appliesToRiskKey,
            attributes: toInputJson(coverage.attributes),
          })),
        });
      }
    });
  }

  public async listCoverageDrafts(transactionId: string): Promise<ReadonlyArray<PolicyCoverageDraftRecord>> {
    const rows = await this.prisma.policyCoverageDraft.findMany({
      where: { transactionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapPolicyCoverageDraft(row));
  }

  public async replaceCoverageTermDrafts(input: {
    policyId: string;
    transactionId: string;
    terms: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      termCode: string;
      valueType: "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }>;
  }): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.coverageTermDraft.deleteMany({ where: { transactionId: input.transactionId } });
      if (input.terms.length === 0) {
        return;
      }

      const coverageDrafts = await tx.policyCoverageDraft.findMany({
        where: { transactionId: input.transactionId },
      });
      const coverageByRef = new Map<string, PolicyCoverageDraft>();
      for (const draft of coverageDrafts) {
        coverageByRef.set(coverageRef(draft.coverageCode, draft.appliesToRiskKey), draft);
      }

      await tx.coverageTermDraft.createMany({
        data: input.terms.map((term) => {
          const coverageDraft = coverageByRef.get(coverageRef(term.coverageCode, term.appliesToRiskKey));
          if (!coverageDraft) {
            throw new Error(`Missing draft coverage for ${term.coverageCode}`);
          }
          return {
            policyId: input.policyId,
            transactionId: input.transactionId,
            policyCoverageDraftId: coverageDraft.id,
            termCode: term.termCode,
            valueType: term.valueType,
            moneyAmount: term.moneyAmount ? new PrismaNamespace.Decimal(term.moneyAmount) : null,
            moneyCurrency: term.moneyCurrency,
            numberValue: term.numberValue ? new PrismaNamespace.Decimal(term.numberValue) : null,
            stringValue: term.stringValue,
            booleanValue: term.booleanValue,
          };
        }),
      });
    });
  }

  public async listCoverageTermDrafts(transactionId: string): Promise<ReadonlyArray<CoverageTermDraftRecord>> {
    const rows = await this.prisma.coverageTermDraft.findMany({
      where: { transactionId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapCoverageTermDraft(row));
  }

  public async closeActiveRisks(policyId: string, effectiveAt: Date): Promise<void> {
    await this.prisma.policyRisk.updateMany({
      where: {
        policyId,
        effectiveFrom: { lt: effectiveAt },
        effectiveTo: { gt: effectiveAt },
      },
      data: { effectiveTo: effectiveAt },
    });
  }

  public async closeActiveCoverages(policyId: string, effectiveAt: Date): Promise<void> {
    await this.prisma.policyCoverage.updateMany({
      where: {
        policyId,
        effectiveFrom: { lt: effectiveAt },
        effectiveTo: { gt: effectiveAt },
      },
      data: { effectiveTo: effectiveAt },
    });
  }

  public async closeActiveCoverageTerms(policyId: string, effectiveAt: Date): Promise<void> {
    await this.prisma.coverageTerm.updateMany({
      where: {
        policyCoverage: { policyId },
        effectiveFrom: { lt: effectiveAt },
        effectiveTo: { gt: effectiveAt },
      },
      data: { effectiveTo: effectiveAt },
    });
  }

  public async closeActivePremiums(policyId: string, effectiveAt: Date): Promise<void> {
    await this.prisma.policyPremium.updateMany({
      where: {
        policyId,
        effectiveFrom: { lt: effectiveAt },
        effectiveTo: { gt: effectiveAt },
      },
      data: { effectiveTo: effectiveAt },
    });
  }

  public async createPolicyRisks(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    risks: ReadonlyArray<{
      riskType: "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
      riskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<ReadonlyArray<PolicyRiskRecord>> {
    const created = await Promise.all(
      input.risks.map((risk) =>
        this.prisma.policyRisk.create({
          data: {
            policyId: input.policyId,
            termId: input.termId,
            riskType: risk.riskType,
            riskKey: risk.riskKey,
            attributes: toInputJson(risk.attributes),
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo,
            createdByTransactionId: input.createdByTransactionId,
          },
        }),
      ),
    );

    return created.map((row) => mapPolicyRisk(row));
  }

  public async createPolicyCoverages(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    coverages: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskId: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<ReadonlyArray<PolicyCoverageRecord>> {
    const created = await Promise.all(
      input.coverages.map((coverage) =>
        this.prisma.policyCoverage.create({
          data: {
            policyId: input.policyId,
            termId: input.termId,
            coverageCode: coverage.coverageCode,
            appliesToRiskId: coverage.appliesToRiskId,
            attributes: toInputJson(coverage.attributes),
            effectiveFrom: input.effectiveFrom,
            effectiveTo: input.effectiveTo,
            createdByTransactionId: input.createdByTransactionId,
          },
        }),
      ),
    );

    return created.map((row) => mapPolicyCoverage(row));
  }

  public async createCoverageTerms(input: {
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    terms: ReadonlyArray<{
      policyCoverageId: string;
      termCode: string;
      valueType: "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }>;
  }): Promise<void> {
    if (input.terms.length === 0) {
      return;
    }

    await this.prisma.coverageTerm.createMany({
      data: input.terms.map((term) => ({
        policyCoverageId: term.policyCoverageId,
        termCode: term.termCode,
        valueType: term.valueType,
        moneyAmount: term.moneyAmount ? new PrismaNamespace.Decimal(term.moneyAmount) : null,
        moneyCurrency: term.moneyCurrency,
        numberValue: term.numberValue ? new PrismaNamespace.Decimal(term.numberValue) : null,
        stringValue: term.stringValue,
        booleanValue: term.booleanValue,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
      })),
    });
  }

  public async createPolicyPremiums(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    premiums: ReadonlyArray<{
      coverageId: string | null;
      riskId: string | null;
      totalAmount: string;
      currency: string;
      breakdown: JsonObject | null;
    }>;
  }): Promise<void> {
    if (input.premiums.length === 0) {
      return;
    }

    await this.prisma.policyPremium.createMany({
      data: input.premiums.map((premium) => ({
        policyId: input.policyId,
        termId: input.termId,
        coverageId: premium.coverageId,
        riskId: premium.riskId,
        totalAmount: new PrismaNamespace.Decimal(premium.totalAmount),
        currency: premium.currency,
        ...(premium.breakdown ? { breakdown: toInputJson(premium.breakdown) } : {}),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdByTransactionId: input.createdByTransactionId,
      })),
    });
  }

  public async getAsOfRisks(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyRiskRecord>> {
    const rows = await this.prisma.policyRisk.findMany({
      where: {
        policyId,
        effectiveFrom: { lte: asOf },
        effectiveTo: { gt: asOf },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapPolicyRisk(row));
  }

  public async getAsOfCoverages(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyCoverageRecord>> {
    const rows = await this.prisma.policyCoverage.findMany({
      where: {
        policyId,
        effectiveFrom: { lte: asOf },
        effectiveTo: { gt: asOf },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapPolicyCoverage(row));
  }

  public async getAsOfCoverageTermsByCoverageIds(
    coverageIds: ReadonlyArray<string>,
    asOf: Date,
  ): Promise<ReadonlyArray<CoverageTermRecord>> {
    if (coverageIds.length === 0) {
      return [];
    }
    const rows = await this.prisma.coverageTerm.findMany({
      where: {
        policyCoverageId: { in: [...coverageIds] },
        effectiveFrom: { lte: asOf },
        effectiveTo: { gt: asOf },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapCoverageTerm(row));
  }

  public async getAsOfPremiums(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyPremiumRecord>> {
    const rows = await this.prisma.policyPremium.findMany({
      where: {
        policyId,
        effectiveFrom: { lte: asOf },
        effectiveTo: { gt: asOf },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map((row) => mapPolicyPremium(row));
  }

  public async getIdempotency(scope: string, key: string): Promise<JsonObject | null> {
    const row: PolicyIdempotencyKey | null = await this.prisma.policyIdempotencyKey.findUnique({
      where: { commandScope_idempotencyKey: { commandScope: scope, idempotencyKey: key } },
    });
    return row ? asJsonObject(row.responseJson) : null;
  }

  public async saveIdempotency(input: {
    policyId: string | null;
    scope: string;
    key: string;
    responseJson: JsonObject;
  }): Promise<void> {
    await this.prisma.policyIdempotencyKey.create({
      data: {
        policyId: input.policyId,
        commandScope: input.scope,
        idempotencyKey: input.key,
        responseJson: toInputJson(input.responseJson),
      },
    });
  }
}
