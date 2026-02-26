export type JsonObject = Record<string, unknown>;

export interface PolicyRecord {
  id: string;
  policyNumber: string;
  status: "DRAFT" | "ACTIVE";
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyTermRecord {
  id: string;
  policyId: string;
  termNumber: number;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdAt: Date;
}

export interface PolicyTransactionRecord {
  id: string;
  policyId: string;
  policyTermId: string | null;
  transactionNumber: number;
  transactionType: "NEW_BUSINESS" | "ENDORSEMENT";
  status: "DRAFT" | "COMMITTED";
  effectiveFrom: Date;
  effectiveTo: Date;
  productVersionId: string;
  pricingProgramVersionId: string | null;
  draftPayload: JsonObject;
  ratingRequestJson: JsonObject | null;
  ratingResponseJson: JsonObject | null;
  ratedAt: Date | null;
  committedAt: Date | null;
  createdAt: Date;
}

export interface PolicyExposureRecord {
  id: string;
  policyId: string;
  exposureKey: string;
  data: JsonObject;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdAt: Date;
}

export interface PolicyCoverageRecord {
  id: string;
  policyId: string;
  coverageKey: string;
  data: JsonObject;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdAt: Date;
}

export interface PolicyRepository {
  createPolicyDraft(input: { policyNumber: string }): Promise<PolicyRecord>;
  getPolicyById(policyId: string): Promise<PolicyRecord | null>;
  updatePolicyStatus(policyId: string, status: "DRAFT" | "ACTIVE"): Promise<PolicyRecord>;

  createPolicyTransaction(input: {
    policyId: string;
    policyTermId: string | null;
    transactionNumber: number;
    transactionType: "NEW_BUSINESS" | "ENDORSEMENT";
    effectiveFrom: Date;
    effectiveTo: Date;
    productVersionId: string;
    draftPayload: JsonObject;
  }): Promise<PolicyTransactionRecord>;
  getPolicyTransactionById(transactionId: string): Promise<PolicyTransactionRecord | null>;
  getNextTransactionNumber(policyId: string): Promise<number>;
  updateTransactionDraftPayload(transactionId: string, draftPayload: JsonObject): Promise<PolicyTransactionRecord>;
  setTransactionRating(input: {
    transactionId: string;
    pricingProgramVersionId: string | null;
    requestJson: JsonObject;
    responseJson: JsonObject;
  }): Promise<PolicyTransactionRecord>;
  commitPolicyTransaction(transactionId: string, committedAt: Date): Promise<PolicyTransactionRecord>;

  createPolicyTerm(input: {
    policyId: string;
    termNumber: number;
    effectiveFrom: Date;
    effectiveTo: Date;
  }): Promise<PolicyTermRecord>;
  getLatestPolicyTerm(policyId: string): Promise<PolicyTermRecord | null>;

  closeExposureRecords(policyId: string, keys: ReadonlyArray<string>, effectiveTo: Date): Promise<void>;
  closeCoverageRecords(policyId: string, keys: ReadonlyArray<string>, effectiveTo: Date): Promise<void>;
  createExposureRecords(input: {
    policyId: string;
    policyTermId: string;
    policyTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    exposures: ReadonlyArray<{ exposureKey: string; data: JsonObject }>;
  }): Promise<void>;
  createCoverageRecords(input: {
    policyId: string;
    policyTermId: string;
    policyTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    coverages: ReadonlyArray<{ coverageKey: string; data: JsonObject }>;
  }): Promise<void>;

  getAsOfExposureRecords(policyId: string, asOfDate: Date): Promise<ReadonlyArray<PolicyExposureRecord>>;
  getAsOfCoverageRecords(policyId: string, asOfDate: Date): Promise<ReadonlyArray<PolicyCoverageRecord>>;
}

export interface PolicyPricingGateway {
  calculate(input: {
    productVersionId: string;
    ratingInput: {
      policy: JsonObject;
      exposures: ReadonlyArray<JsonObject>;
      coverages: ReadonlyArray<JsonObject>;
      context?: JsonObject;
    };
  }): Promise<{ requestId: string; pricingProgramVersionId: string; response: JsonObject; request: JsonObject }>;
}

export interface DomainEventPublisher {
  publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}
