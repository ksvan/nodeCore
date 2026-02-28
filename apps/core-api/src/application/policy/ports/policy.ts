import type { PricingResponse } from "@nodecore/contracts/pricing";
export type JsonObject = Record<string, unknown>;

export type PolicyStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type PolicyTermStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type PolicyTransactionType = "NEW_BUSINESS" | "ENDORSEMENT";
export type PolicyTransactionStatus = "DRAFT" | "COMMITTED";
export type PolicyRiskType = "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
export type CoverageTermValueType = "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";

export interface PolicyRecord {
  id: string;
  policyNumber: string;
  status: PolicyStatus;
  productId: string;
  productVersionId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyTermRecord {
  id: string;
  policyId: string;
  termStart: Date;
  termEnd: Date;
  status: PolicyTermStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyTransactionRecord {
  id: string;
  policyId: string;
  termId: string;
  type: PolicyTransactionType;
  status: PolicyTransactionStatus;
  effectiveAt: Date;
  requestId: string | null;
  idempotencyKey: string | null;
  ratingRequestJson: JsonObject | null;
  ratingResponseJson: JsonObject | null;
  ratedAt: Date | null;
  createdAt: Date;
  committedAt: Date | null;
}

export interface PolicyRiskRecord {
  id: string;
  policyId: string;
  termId: string;
  riskType: PolicyRiskType;
  riskKey: string | null;
  attributes: JsonObject;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdByTransactionId: string;
  createdAt: Date;
}

export interface PolicyCoverageRecord {
  id: string;
  policyId: string;
  termId: string;
  coverageCode: string;
  appliesToRiskId: string | null;
  attributes: JsonObject;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdByTransactionId: string;
  createdAt: Date;
}

export interface CoverageTermRecord {
  id: string;
  policyCoverageId: string;
  termCode: string;
  valueType: CoverageTermValueType;
  moneyAmount: string | null;
  moneyCurrency: string | null;
  numberValue: string | null;
  stringValue: string | null;
  booleanValue: boolean | null;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdByTransactionId: string;
  createdAt: Date;
}

export interface PolicyPremiumRecord {
  id: string;
  policyId: string;
  termId: string;
  coverageId: string | null;
  riskId: string | null;
  totalAmount: string;
  currency: string;
  breakdown: JsonObject | null;
  effectiveFrom: Date;
  effectiveTo: Date;
  createdByTransactionId: string;
  createdAt: Date;
}

export interface PolicyRiskDraftRecord {
  id: string;
  policyId: string;
  transactionId: string;
  riskType: PolicyRiskType;
  riskKey: string | null;
  attributes: JsonObject;
  createdAt: Date;
}

export interface PolicyCoverageDraftRecord {
  id: string;
  policyId: string;
  transactionId: string;
  coverageCode: string;
  appliesToRiskKey: string | null;
  attributes: JsonObject;
  createdAt: Date;
}

export interface CoverageTermDraftRecord {
  id: string;
  policyId: string;
  transactionId: string;
  policyCoverageDraftId: string;
  termCode: string;
  valueType: CoverageTermValueType;
  moneyAmount: string | null;
  moneyCurrency: string | null;
  numberValue: string | null;
  stringValue: string | null;
  booleanValue: boolean | null;
  createdAt: Date;
}

export interface PolicyRepository {
  createPolicy(input: {
    policyNumber: string;
    productId: string;
    productVersionId: string;
  }): Promise<PolicyRecord>;
  listPolicies(query?: string): Promise<ReadonlyArray<PolicyRecord>>;
  getPolicyById(policyId: string): Promise<PolicyRecord | null>;
  updatePolicyStatus(policyId: string, status: PolicyStatus): Promise<PolicyRecord>;

  createPolicyTerm(input: {
    policyId: string;
    termStart: Date;
    termEnd: Date;
    status: PolicyTermStatus;
  }): Promise<PolicyTermRecord>;
  updatePolicyTermStatus(termId: string, status: PolicyTermStatus): Promise<PolicyTermRecord>;
  getPolicyTermById(termId: string): Promise<PolicyTermRecord | null>;
  getLatestPolicyTerm(policyId: string): Promise<PolicyTermRecord | null>;

  createPolicyTransaction(input: {
    policyId: string;
    termId: string;
    type: PolicyTransactionType;
    effectiveAt: Date;
    requestId: string | null;
    idempotencyKey: string | null;
  }): Promise<PolicyTransactionRecord>;
  listPolicyTransactions(policyId: string): Promise<ReadonlyArray<PolicyTransactionRecord>>;
  getPolicyTransactionById(transactionId: string): Promise<PolicyTransactionRecord | null>;
  commitPolicyTransaction(transactionId: string, committedAt: Date): Promise<PolicyTransactionRecord>;
  setPolicyTransactionRating(input: {
    transactionId: string;
    ratingRequestJson: JsonObject;
    ratingResponseJson: JsonObject;
    ratedAt: Date;
  }): Promise<PolicyTransactionRecord>;

  replaceRiskDrafts(input: {
    policyId: string;
    transactionId: string;
    risks: ReadonlyArray<{
      riskType: PolicyRiskType;
      riskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void>;
  listRiskDrafts(transactionId: string): Promise<ReadonlyArray<PolicyRiskDraftRecord>>;

  replaceCoverageDrafts(input: {
    policyId: string;
    transactionId: string;
    coverages: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<void>;
  listCoverageDrafts(transactionId: string): Promise<ReadonlyArray<PolicyCoverageDraftRecord>>;

  replaceCoverageTermDrafts(input: {
    policyId: string;
    transactionId: string;
    terms: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      termCode: string;
      valueType: CoverageTermValueType;
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }>;
  }): Promise<void>;
  listCoverageTermDrafts(transactionId: string): Promise<ReadonlyArray<CoverageTermDraftRecord>>;

  closeActiveRisks(policyId: string, effectiveAt: Date): Promise<void>;
  closeActiveCoverages(policyId: string, effectiveAt: Date): Promise<void>;
  closeActiveCoverageTerms(policyId: string, effectiveAt: Date): Promise<void>;
  closeActivePremiums(policyId: string, effectiveAt: Date): Promise<void>;

  createPolicyRisks(input: {
    policyId: string;
    termId: string;
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    risks: ReadonlyArray<{
      riskType: PolicyRiskType;
      riskKey: string | null;
      attributes: JsonObject;
    }>;
  }): Promise<ReadonlyArray<PolicyRiskRecord>>;

  createPolicyCoverages(input: {
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
  }): Promise<ReadonlyArray<PolicyCoverageRecord>>;

  createCoverageTerms(input: {
    createdByTransactionId: string;
    effectiveFrom: Date;
    effectiveTo: Date;
    terms: ReadonlyArray<{
      policyCoverageId: string;
      termCode: string;
      valueType: CoverageTermValueType;
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
    }>;
  }): Promise<void>;

  createPolicyPremiums(input: {
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
  }): Promise<void>;

  getAsOfRisks(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyRiskRecord>>;
  getAsOfCoverages(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyCoverageRecord>>;
  getAsOfCoverageTermsByCoverageIds(
    coverageIds: ReadonlyArray<string>,
    asOf: Date,
  ): Promise<ReadonlyArray<CoverageTermRecord>>;
  getAsOfPremiums(policyId: string, asOf: Date): Promise<ReadonlyArray<PolicyPremiumRecord>>;

  getIdempotency(scope: string, key: string): Promise<JsonObject | null>;
  saveIdempotency(input: {
    policyId: string | null;
    scope: string;
    key: string;
    responseJson: JsonObject;
  }): Promise<void>;
}

export interface DomainEventPublisher {
  publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface PolicyPricingGateway {
  calculate(input: {
    requestId?: string;
    productVersionId: string;
    policyTransactionId: string;
    currency?: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
  }): Promise<{
    requestId: string;
    response: PricingResponse;
  }>;
}

export interface PolicyBillingGateway {
  createObligationFromPremiumDelta(input: {
    policyId: string;
    policyTransactionId: string;
    termId: string;
    amount: string;
    currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    dueDate: Date;
  }): Promise<void>;
  getFinancialPosition(input: {
    policyId: string;
    asOf: Date;
  }): Promise<{
    policyId: string;
    asOf: string;
    outstandingObligations: ReadonlyArray<{
      id: string;
      policyTransactionId: string;
      termId: string;
      billingAccountId: string | null;
      amount: string;
      currency: string;
      dueDate: string;
      status: string;
    }>;
    linkedInvoices: ReadonlyArray<{
      obligationId: string;
      invoiceId: string;
      invoiceNumber: string;
      status: string;
      invoiceTotal: string;
      amountPaid: string;
    }>;
    paidAmount: string;
  }>;
}
