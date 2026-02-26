import {
  assertDraftTransactionCommittable,
  assertDraftTransactionEditable,
  assertEffectiveRange,
  assertSupportedTransactionType,
} from "../../../domain/policy/invariants.js";
import { PolicyDomainError } from "../../../domain/policy/errors.js";
import type { DomainEventPublisher, JsonObject, PolicyPricingGateway, PolicyRepository } from "../ports/policy.js";
import { PolicyApplicationError } from "./errors.js";

interface ExposureDraftItem {
  exposureKey: string;
  data: JsonObject;
}

interface CoverageDraftItem {
  coverageKey: string;
  data: JsonObject;
}

interface TransactionDraftPayload {
  policy: JsonObject;
  exposures: ExposureDraftItem[];
  coverages: CoverageDraftItem[];
}

const emptyDraftPayload = (): TransactionDraftPayload => ({
  policy: {},
  exposures: [],
  coverages: [],
});

const parseDraftPayload = (value: JsonObject): TransactionDraftPayload => {
  const source = value as Partial<TransactionDraftPayload>;
  return {
    policy: (source.policy ?? {}) as JsonObject,
    exposures: Array.isArray(source.exposures) ? source.exposures : [],
    coverages: Array.isArray(source.coverages) ? source.coverages : [],
  };
};

const toEventData = (value: unknown): Record<string, unknown> =>
  structuredClone(value) as Record<string, unknown>;

export class PolicyService {
  public constructor(
    private readonly repository: PolicyRepository,
    private readonly pricingGateway: PolicyPricingGateway,
    private readonly eventPublisher: DomainEventPublisher,
  ) {}

  public async createPolicyDraftNewBusiness(input: {
    policyNumber: string;
    productVersionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
  }): Promise<{ policyId: string; transactionId: string }> {
    assertEffectiveRange(input.effectiveFrom, input.effectiveTo);

    const policy = await this.repository.createPolicyDraft({ policyNumber: input.policyNumber });
    const transactionNumber = await this.repository.getNextTransactionNumber(policy.id);
    const tx = await this.repository.createPolicyTransaction({
      policyId: policy.id,
      policyTermId: null,
      transactionNumber,
      transactionType: "NEW_BUSINESS",
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      productVersionId: input.productVersionId,
      draftPayload: emptyDraftPayload() as unknown as JsonObject,
    });

    return { policyId: policy.id, transactionId: tx.id };
  }

  public async createEndorsementDraft(input: {
    policyId: string;
    productVersionId: string;
    effectiveFrom: Date;
  }): Promise<{ policyId: string; transactionId: string }> {
    const policy = await this.repository.getPolicyById(input.policyId);
    if (!policy) {
      throw new PolicyApplicationError("Policy not found", 404);
    }
    const latestTerm = await this.repository.getLatestPolicyTerm(input.policyId);
    if (!latestTerm) {
      throw new PolicyApplicationError("No policy term found for endorsement", 400);
    }

    if (input.effectiveFrom <= latestTerm.effectiveFrom || input.effectiveFrom >= latestTerm.effectiveTo) {
      throw new PolicyApplicationError("Endorsement effectiveFrom must be within current term", 400);
    }

    const transactionNumber = await this.repository.getNextTransactionNumber(input.policyId);
    const tx = await this.repository.createPolicyTransaction({
      policyId: input.policyId,
      policyTermId: latestTerm.id,
      transactionNumber,
      transactionType: "ENDORSEMENT",
      effectiveFrom: input.effectiveFrom,
      effectiveTo: latestTerm.effectiveTo,
      productVersionId: input.productVersionId,
      draftPayload: emptyDraftPayload() as unknown as JsonObject,
    });

    return { policyId: input.policyId, transactionId: tx.id };
  }

  public async setTransactionExposures(transactionId: string, exposures: ExposureDraftItem[]): Promise<void> {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("PolicyTransaction not found", 404);
    }
    assertDraftTransactionEditable(tx.status);

    const current = parseDraftPayload(tx.draftPayload);
    const updated: TransactionDraftPayload = {
      ...current,
      exposures: exposures.map((item) => ({
        exposureKey: item.exposureKey,
        data: structuredClone(item.data),
      })),
    };
    await this.repository.updateTransactionDraftPayload(transactionId, updated as unknown as JsonObject);
  }

  public async setTransactionCoverages(transactionId: string, coverages: CoverageDraftItem[]): Promise<void> {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("PolicyTransaction not found", 404);
    }
    assertDraftTransactionEditable(tx.status);

    const current = parseDraftPayload(tx.draftPayload);
    const updated: TransactionDraftPayload = {
      ...current,
      coverages: coverages.map((item) => ({
        coverageKey: item.coverageKey,
        data: structuredClone(item.data),
      })),
    };
    await this.repository.updateTransactionDraftPayload(transactionId, updated as unknown as JsonObject);
  }

  public async rateTransaction(transactionId: string): Promise<{ requestId: string; response: JsonObject }> {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("PolicyTransaction not found", 404);
    }
    assertDraftTransactionEditable(tx.status);
    assertSupportedTransactionType(tx.transactionType);

    const payload = parseDraftPayload(tx.draftPayload);
    const pricingResult = await this.pricingGateway.calculate({
      productVersionId: tx.productVersionId,
      ratingInput: {
        policy: payload.policy,
        exposures: payload.exposures.map((item) => item.data),
        coverages: payload.coverages.map((item) => item.data),
        context: {
          policyId: tx.policyId,
          transactionId: tx.id,
          transactionType: tx.transactionType,
        },
      },
    });

    await this.repository.setTransactionRating({
      transactionId: tx.id,
      pricingProgramVersionId: pricingResult.pricingProgramVersionId,
      requestJson: pricingResult.request,
      responseJson: pricingResult.response,
    });

    return { requestId: pricingResult.requestId, response: pricingResult.response };
  }

  public async issueTransaction(transactionId: string): Promise<{ policyId: string; transactionId: string }> {
    const tx = await this.repository.getPolicyTransactionById(transactionId);
    if (!tx) {
      throw new PolicyApplicationError("PolicyTransaction not found", 404);
    }

    assertDraftTransactionCommittable(tx.status);
    if (!tx.ratingResponseJson) {
      throw new PolicyApplicationError("Transaction must be rated before issue", 400);
    }

    const payload = parseDraftPayload(tx.draftPayload);
    const now = new Date();
    let termId = tx.policyTermId;

    if (tx.transactionType === "NEW_BUSINESS") {
      const latest = await this.repository.getLatestPolicyTerm(tx.policyId);
      const termNumber = latest ? latest.termNumber + 1 : 1;
      const term = await this.repository.createPolicyTerm({
        policyId: tx.policyId,
        termNumber,
        effectiveFrom: tx.effectiveFrom,
        effectiveTo: tx.effectiveTo,
      });
      termId = term.id;
      await this.repository.updatePolicyStatus(tx.policyId, "ACTIVE");
    } else if (!termId) {
      throw new PolicyApplicationError("Endorsement requires existing policy term", 400);
    }

    await this.repository.closeExposureRecords(
      tx.policyId,
      payload.exposures.map((item) => item.exposureKey),
      tx.effectiveFrom,
    );
    await this.repository.closeCoverageRecords(
      tx.policyId,
      payload.coverages.map((item) => item.coverageKey),
      tx.effectiveFrom,
    );

    await this.repository.createExposureRecords({
      policyId: tx.policyId,
      policyTermId: termId,
      policyTransactionId: tx.id,
      effectiveFrom: tx.effectiveFrom,
      effectiveTo: tx.effectiveTo,
      exposures: payload.exposures,
    });
    await this.repository.createCoverageRecords({
      policyId: tx.policyId,
      policyTermId: termId,
      policyTransactionId: tx.id,
      effectiveFrom: tx.effectiveFrom,
      effectiveTo: tx.effectiveTo,
      coverages: payload.coverages,
    });

    const committed = await this.repository.commitPolicyTransaction(tx.id, now);

    await this.eventPublisher.publish({
      eventType: "PolicyTransactionCommitted",
      entityType: "PolicyTransaction",
      entityId: committed.id,
      data: toEventData({
        policyId: committed.policyId,
        transactionId: committed.id,
        transactionType: committed.transactionType,
        committedAt: now.toISOString(),
      }),
    });

    if (committed.transactionType === "NEW_BUSINESS") {
      await this.eventPublisher.publish({
        eventType: "PolicyIssued",
        entityType: "Policy",
        entityId: committed.policyId,
        data: toEventData({
          policyId: committed.policyId,
          transactionId: committed.id,
          committedAt: now.toISOString(),
        }),
      });
    }

    return { policyId: committed.policyId, transactionId: committed.id };
  }

  public async getPolicySnapshot(policyId: string, asOfDate: Date): Promise<{
    policyId: string;
    asOfDate: string;
    exposures: ExposureDraftItem[];
    coverages: CoverageDraftItem[];
  }> {
    const policy = await this.repository.getPolicyById(policyId);
    if (!policy) {
      throw new PolicyApplicationError("Policy not found", 404);
    }

    const exposures = await this.repository.getAsOfExposureRecords(policyId, asOfDate);
    const coverages = await this.repository.getAsOfCoverageRecords(policyId, asOfDate);

    return {
      policyId,
      asOfDate: asOfDate.toISOString(),
      exposures: exposures.map((item) => ({
        exposureKey: item.exposureKey,
        data: structuredClone(item.data),
      })),
      coverages: coverages.map((item) => ({
        coverageKey: item.coverageKey,
        data: structuredClone(item.data),
      })),
    };
  }
}

export const mapPolicyError = (error: unknown): PolicyApplicationError => {
  if (error instanceof PolicyApplicationError) {
    return error;
  }
  if (error instanceof PolicyDomainError) {
    return new PolicyApplicationError(error.message, 400);
  }
  return new PolicyApplicationError("Internal policy error", 500);
};
