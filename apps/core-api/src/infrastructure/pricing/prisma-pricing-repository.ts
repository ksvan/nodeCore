import type {
  CoverageTermDraft,
  CoverageTermValueType,
  PolicyCoverage,
  PolicyCoverageDraft,
  PolicyRisk,
  PolicyRiskDraft,
  PricingRun,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import type {
  JsonObject,
  PricingContext,
  PricingPolicyContext,
  PricingRepository,
  PricingRunRecord,
} from "../../application/pricing/ports/pricing.js";

const asJsonObject = (value: unknown): JsonObject => (value ?? {}) as JsonObject;
const asInputJson = (value: JsonObject): Prisma.InputJsonValue => value as Prisma.InputJsonValue;

const toPricingRunRecord = (record: PricingRun): PricingRunRecord => ({
  id: record.id,
  requestId: record.requestId,
  policyTransactionId: record.policyTransactionId,
  productVersionId: record.productVersionId,
  pricingProgramVersionId: record.pricingProgramVersionId,
  pricingProgramFileRef: record.pricingProgramFileRef,
  pricingProgramFileHash: record.pricingProgramFileHash,
  requestJson: asJsonObject(record.requestJson),
  responseJson: asJsonObject(record.responseJson),
  occurredAt: record.occurredAt,
  durationMs: record.durationMs,
  currency: record.currency,
  success: record.success,
  errorSummary: record.errorSummary,
});

const mapCoverageTermValue = (term: {
  valueType: CoverageTermValueType;
  moneyAmount: Prisma.Decimal | null;
  moneyCurrency: string | null;
  numberValue: Prisma.Decimal | null;
  stringValue: string | null;
  booleanValue: boolean | null;
}): {
  moneyAmount: string | null;
  moneyCurrency: string | null;
  numberValue: string | null;
  stringValue: string | null;
  booleanValue: boolean | null;
} => ({
  moneyAmount: term.moneyAmount ? term.moneyAmount.toFixed(2) : null,
  moneyCurrency: term.moneyCurrency,
  numberValue: term.numberValue ? term.numberValue.toFixed(4) : null,
  stringValue: term.stringValue,
  booleanValue: term.booleanValue,
});

const toCoverageFromDraft = (
  coverage: PolicyCoverageDraft,
  terms: ReadonlyArray<CoverageTermDraft>,
) => ({
  coverageCode: coverage.coverageCode,
  appliesToRiskKey: coverage.appliesToRiskKey,
  attributes: asJsonObject(coverage.attributes),
  terms: terms.map((term) => ({
    termCode: term.termCode,
    valueType: term.valueType,
    ...mapCoverageTermValue(term),
  })),
});

const toCoverageFromCommitted = (
  coverage: PolicyCoverage,
  riskById: ReadonlyMap<string, PolicyRisk>,
  terms: ReadonlyArray<{
    termCode: string;
    valueType: CoverageTermValueType;
    moneyAmount: Prisma.Decimal | null;
    moneyCurrency: string | null;
    numberValue: Prisma.Decimal | null;
    stringValue: string | null;
    booleanValue: boolean | null;
  }>,
) => ({
  coverageId: coverage.id,
  coverageCode: coverage.coverageCode,
  appliesToRiskId: coverage.appliesToRiskId,
  appliesToRiskKey: coverage.appliesToRiskId ? (riskById.get(coverage.appliesToRiskId)?.riskKey ?? null) : null,
  attributes: asJsonObject(coverage.attributes),
  terms: terms.map((term) => ({
    termCode: term.termCode,
    valueType: term.valueType,
    ...mapCoverageTermValue(term),
  })),
});

export class PrismaPricingRepository implements PricingRepository {
  public constructor(private readonly prisma: PrismaClient) {}

  public async getPricingContextByProductVersionId(productVersionId: string): Promise<PricingContext | null> {
    const productVersion = await this.prisma.productVersion.findUnique({
      where: { id: productVersionId },
      include: {
        product: true,
        pricingProgramVersion: true,
      },
    });

    if (!productVersion || !productVersion.pricingProgramVersion) {
      return null;
    }

    if (
      productVersion.status === "ACTIVE" &&
      productVersion.pricingProgramVersion.status !== "ACTIVE"
    ) {
      return null;
    }

    return {
      productId: productVersion.product.id,
      productVersionId: productVersion.id,
      productVersionVersion: String(productVersion.version),
      pricingProgramVersionId: productVersion.pricingProgramVersion.id,
      pricingProgramVersionStatus: productVersion.pricingProgramVersion.status,
      pricingProgramFileRef: productVersion.pricingProgramVersion.fileRef,
      pricingInputSchema: asJsonObject(productVersion.pricingInputSchema),
      pricingOutputSchema: asJsonObject(productVersion.pricingProgramVersion.outputSchema),
      defaultCurrency: productVersion.defaultCurrency,
      allowedCurrencies: [...productVersion.allowedCurrencies],
    };
  }

  public async getPricingPolicyContextByTransactionId(
    transactionId: string,
  ): Promise<PricingPolicyContext | null> {
    const tx = await this.prisma.policyTransaction.findUnique({
      where: { id: transactionId },
      include: {
        policy: true,
        term: true,
        riskDrafts: true,
        coverageDrafts: true,
        termDrafts: true,
      },
    });

    if (!tx) {
      return null;
    }

    const draftRisks = tx.riskDrafts;
    const draftCoverages = tx.coverageDrafts;
    const draftTerms = tx.termDrafts;

    let risks = draftRisks.map((risk: PolicyRiskDraft) => ({
      riskKey: risk.riskKey,
      riskType: risk.riskType,
      attributes: asJsonObject(risk.attributes),
    }));

    let coverages = draftCoverages.map((coverage: PolicyCoverageDraft) =>
      toCoverageFromDraft(
        coverage,
        draftTerms.filter((term) => term.policyCoverageDraftId === coverage.id),
      ),
    );

    if (risks.length === 0 && coverages.length === 0) {
      const committedRisks = await this.prisma.policyRisk.findMany({
        where: {
          policyId: tx.policyId,
          effectiveFrom: { lte: tx.effectiveAt },
          effectiveTo: { gt: tx.effectiveAt },
        },
      });

      const committedCoverages = await this.prisma.policyCoverage.findMany({
        where: {
          policyId: tx.policyId,
          effectiveFrom: { lte: tx.effectiveAt },
          effectiveTo: { gt: tx.effectiveAt },
        },
      });

      const coverageTerms = await this.prisma.coverageTerm.findMany({
        where: {
          policyCoverageId: { in: committedCoverages.map((coverage) => coverage.id) },
          effectiveFrom: { lte: tx.effectiveAt },
          effectiveTo: { gt: tx.effectiveAt },
        },
      });

      const riskById = new Map<string, PolicyRisk>(committedRisks.map((risk) => [risk.id, risk]));

      risks = committedRisks.map((risk) => ({
        riskId: risk.id,
        riskKey: risk.riskKey,
        riskType: risk.riskType,
        attributes: asJsonObject(risk.attributes),
      }));

      coverages = committedCoverages.map((coverage) =>
        toCoverageFromCommitted(
          coverage,
          riskById,
          coverageTerms.filter((term) => term.policyCoverageId === coverage.id),
        ),
      );
    }

    return {
      policyId: tx.policy.id,
      policyNumber: tx.policy.policyNumber,
      productId: tx.policy.productId,
      productVersionId: tx.policy.productVersionId,
      termId: tx.term.id,
      termStart: tx.term.termStart,
      termEnd: tx.term.termEnd,
      transactionId: tx.id,
      transactionType: tx.type,
      effectiveAt: tx.effectiveAt,
      risks,
      coverages,
    };
  }

  public async getPricingRunByRequestId(requestId: string): Promise<PricingRunRecord | null> {
    const row = await this.prisma.pricingRun.findUnique({ where: { requestId } });
    return row ? toPricingRunRecord(row) : null;
  }

  public async createPricingRun(input: {
    requestId: string;
    policyTransactionId: string | null;
    productVersionId: string;
    pricingProgramVersionId: string;
    pricingProgramFileRef: string;
    pricingProgramFileHash: string;
    requestJson: JsonObject;
    responseJson: JsonObject;
    durationMs: number;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    success: boolean;
    errorSummary: string | null;
  }): Promise<PricingRunRecord> {
    const created = await this.prisma.pricingRun.create({
      data: {
        requestId: input.requestId,
        policyTransactionId: input.policyTransactionId,
        productVersionId: input.productVersionId,
        pricingProgramVersionId: input.pricingProgramVersionId,
        pricingProgramFileRef: input.pricingProgramFileRef,
        pricingProgramFileHash: input.pricingProgramFileHash,
        requestJson: asInputJson(input.requestJson),
        responseJson: asInputJson(input.responseJson),
        durationMs: input.durationMs,
        currency: input.currency,
        success: input.success,
        errorSummary: input.errorSummary,
      },
    });
    return toPricingRunRecord(created);
  }
}
