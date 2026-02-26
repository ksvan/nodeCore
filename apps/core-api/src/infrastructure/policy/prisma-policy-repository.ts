import type {
  Policy,
  PolicyCoverageRecord,
  PolicyExposureRecord,
  PolicyTerm,
  PolicyTransaction,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type {
  JsonObject,
  PolicyCoverageRecord as PolicyCoverageRecordModel,
  PolicyExposureRecord as PolicyExposureRecordModel,
  PolicyRecord,
  PolicyRepository,
  PolicyTermRecord,
  PolicyTransactionRecord,
} from "../../application/policy/ports/policy.js";

const asJsonObject = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const toInputJson = (value: JsonObject): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const mapPolicy = (value: Policy): PolicyRecord => ({
  id: value.id,
  policyNumber: value.policyNumber,
  status: value.status,
  createdAt: value.createdAt,
  updatedAt: value.updatedAt,
});

const mapTerm = (value: PolicyTerm): PolicyTermRecord => ({
  id: value.id,
  policyId: value.policyId,
  termNumber: value.termNumber,
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdAt: value.createdAt,
});

const mapTx = (value: PolicyTransaction): PolicyTransactionRecord => ({
  id: value.id,
  policyId: value.policyId,
  policyTermId: value.policyTermId,
  transactionNumber: value.transactionNumber,
  transactionType: value.transactionType,
  status: value.status,
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  productVersionId: value.productVersionId,
  pricingProgramVersionId: value.pricingProgramVersionId,
  draftPayload: asJsonObject(value.draftPayload),
  ratingRequestJson: value.ratingRequestJson ? asJsonObject(value.ratingRequestJson) : null,
  ratingResponseJson: value.ratingResponseJson ? asJsonObject(value.ratingResponseJson) : null,
  ratedAt: value.ratedAt,
  committedAt: value.committedAt,
  createdAt: value.createdAt,
});

const mapExposure = (value: PolicyExposureRecord): PolicyExposureRecordModel => ({
  id: value.id,
  policyId: value.policyId,
  exposureKey: value.exposureKey,
  data: asJsonObject(value.data),
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdAt: value.createdAt,
});

const mapCoverage = (value: PolicyCoverageRecord): PolicyCoverageRecordModel => ({
  id: value.id,
  policyId: value.policyId,
  coverageKey: value.coverageKey,
  data: asJsonObject(value.data),
  effectiveFrom: value.effectiveFrom,
  effectiveTo: value.effectiveTo,
  createdAt: value.createdAt,
});

export class PrismaPolicyRepository implements PolicyRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async createPolicyDraft(input: { policyNumber: string }): Promise<PolicyRecord> {
    const created = await this.prisma.policy.create({ data: { policyNumber: input.policyNumber } });
    return mapPolicy(created);
  }

  public async getPolicyById(policyId: string): Promise<PolicyRecord | null> {
    const policy = await this.prisma.policy.findUnique({ where: { id: policyId } });
    return policy ? mapPolicy(policy) : null;
  }

  public async updatePolicyStatus(policyId: string, status: "DRAFT" | "ACTIVE"): Promise<PolicyRecord> {
    const updated = await this.prisma.policy.update({ where: { id: policyId }, data: { status } });
    return mapPolicy(updated);
  }

  public async createPolicyTransaction(input: {
    policyId: string;
    policyTermId: string | null;
    transactionNumber: number;
    transactionType: "NEW_BUSINESS" | "ENDORSEMENT";
    effectiveFrom: Date;
    effectiveTo: Date;
    productVersionId: string;
    draftPayload: JsonObject;
  }): Promise<PolicyTransactionRecord> {
    const created = await this.prisma.policyTransaction.create({
      data: {
        policyId: input.policyId,
        policyTermId: input.policyTermId,
        transactionNumber: input.transactionNumber,
        transactionType: input.transactionType,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        productVersionId: input.productVersionId,
        draftPayload: toInputJson(input.draftPayload),
      },
    });
    return mapTx(created);
  }

  public async getPolicyTransactionById(transactionId: string): Promise<PolicyTransactionRecord | null> {
    const tx = await this.prisma.policyTransaction.findUnique({ where: { id: transactionId } });
    return tx ? mapTx(tx) : null;
  }

  public async getNextTransactionNumber(policyId: string): Promise<number> {
    const latest = await this.prisma.policyTransaction.findFirst({
      where: { policyId },
      orderBy: { transactionNumber: "desc" },
    });
    return latest ? latest.transactionNumber + 1 : 1;
  }

  public async updateTransactionDraftPayload(
    transactionId: string,
    draftPayload: JsonObject,
  ): Promise<PolicyTransactionRecord> {
    const updated = await this.prisma.policyTransaction.update({
      where: { id: transactionId },
      data: { draftPayload: toInputJson(draftPayload) },
    });
    return mapTx(updated);
  }

  public async setTransactionRating(input: {
    transactionId: string;
    pricingProgramVersionId: string | null;
    requestJson: JsonObject;
    responseJson: JsonObject;
  }): Promise<PolicyTransactionRecord> {
    const updated = await this.prisma.policyTransaction.update({
      where: { id: input.transactionId },
      data: {
        pricingProgramVersionId: input.pricingProgramVersionId,
        ratingRequestJson: toInputJson(input.requestJson),
        ratingResponseJson: toInputJson(input.responseJson),
        ratedAt: new Date(),
      },
    });
    return mapTx(updated);
  }

  public async commitPolicyTransaction(
    transactionId: string,
    committedAt: Date,
  ): Promise<PolicyTransactionRecord> {
    const updated = await this.prisma.policyTransaction.update({
      where: { id: transactionId },
      data: {
        status: "COMMITTED",
        committedAt,
      },
    });
    return mapTx(updated);
  }

  public async createPolicyTerm(input: {
    policyId: string;
    termNumber: number;
    effectiveFrom: Date;
    effectiveTo: Date;
  }): Promise<PolicyTermRecord> {
    const created = await this.prisma.policyTerm.create({
      data: {
        policyId: input.policyId,
        termNumber: input.termNumber,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      },
    });
    return mapTerm(created);
  }

  public async getLatestPolicyTerm(policyId: string): Promise<PolicyTermRecord | null> {
    const term = await this.prisma.policyTerm.findFirst({
      where: { policyId },
      orderBy: { termNumber: "desc" },
    });
    return term ? mapTerm(term) : null;
  }

  public async closeExposureRecords(policyId: string, keys: ReadonlyArray<string>, effectiveTo: Date): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.prisma.policyExposureRecord.updateMany({
      where: {
        policyId,
        exposureKey: { in: [...keys] },
        effectiveTo: { gt: effectiveTo },
        effectiveFrom: { lt: effectiveTo },
      },
      data: { effectiveTo },
    });
  }

  public async closeCoverageRecords(policyId: string, keys: ReadonlyArray<string>, effectiveTo: Date): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    await this.prisma.policyCoverageRecord.updateMany({
      where: {
        policyId,
        coverageKey: { in: [...keys] },
        effectiveTo: { gt: effectiveTo },
        effectiveFrom: { lt: effectiveTo },
      },
      data: { effectiveTo },
    });
  }

  public async createExposureRecords(input: {
    policyId: string;
    policyTermId: string;
    policyTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    exposures: ReadonlyArray<{ exposureKey: string; data: JsonObject }>;
  }): Promise<void> {
    if (input.exposures.length === 0) {
      return;
    }
    await this.prisma.policyExposureRecord.createMany({
      data: input.exposures.map((item) => ({
        policyId: input.policyId,
        policyTermId: input.policyTermId,
        policyTransactionId: input.policyTransactionId,
        exposureKey: item.exposureKey,
        data: toInputJson(item.data),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      })),
    });
  }

  public async createCoverageRecords(input: {
    policyId: string;
    policyTermId: string;
    policyTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    coverages: ReadonlyArray<{ coverageKey: string; data: JsonObject }>;
  }): Promise<void> {
    if (input.coverages.length === 0) {
      return;
    }
    await this.prisma.policyCoverageRecord.createMany({
      data: input.coverages.map((item) => ({
        policyId: input.policyId,
        policyTermId: input.policyTermId,
        policyTransactionId: input.policyTransactionId,
        coverageKey: item.coverageKey,
        data: toInputJson(item.data),
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
      })),
    });
  }

  public async getAsOfExposureRecords(
    policyId: string,
    asOfDate: Date,
  ): Promise<ReadonlyArray<PolicyExposureRecordModel>> {
    const rows = await this.prisma.policyExposureRecord.findMany({
      where: {
        policyId,
        effectiveFrom: { lte: asOfDate },
        effectiveTo: { gt: asOfDate },
      },
      orderBy: [{ exposureKey: "asc" }, { createdAt: "desc" }],
    });

    const latestByKey = new Map<string, PolicyExposureRecord>();
    for (const row of rows) {
      if (!latestByKey.has(row.exposureKey)) {
        latestByKey.set(row.exposureKey, row);
      }
    }
    return [...latestByKey.values()].map((row) => mapExposure(row));
  }

  public async getAsOfCoverageRecords(
    policyId: string,
    asOfDate: Date,
  ): Promise<ReadonlyArray<PolicyCoverageRecordModel>> {
    const rows = await this.prisma.policyCoverageRecord.findMany({
      where: {
        policyId,
        effectiveFrom: { lte: asOfDate },
        effectiveTo: { gt: asOfDate },
      },
      orderBy: [{ coverageKey: "asc" }, { createdAt: "desc" }],
    });

    const latestByKey = new Map<string, PolicyCoverageRecord>();
    for (const row of rows) {
      if (!latestByKey.has(row.coverageKey)) {
        latestByKey.set(row.coverageKey, row);
      }
    }
    return [...latestByKey.values()].map((row) => mapCoverage(row));
  }
}
