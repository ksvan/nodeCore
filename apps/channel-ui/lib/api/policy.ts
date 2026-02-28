import { apiRequest } from "./client";
import type {
  CoverageTermValueType,
  PolicyDto,
  PolicyListItemDto,
  PolicyRiskType,
  PolicySnapshotDto,
  PolicyTransactionDto,
} from "./types";

const createId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

export const policyApi = {
  listPolicies: (query?: string) =>
    apiRequest<ReadonlyArray<PolicyListItemDto>>(`/v1/policies${query ? `?query=${encodeURIComponent(query)}` : ""}`),

  getPolicy: (policyId: string) => apiRequest<PolicyDto>(`/v1/policies/${policyId}`),

  createPolicy: (input: {
    policyNumber: string;
    productId: string;
    productVersionId: string;
    termStart: string;
    termEnd: string;
  }) =>
    apiRequest<{
      id: string;
      policyNumber: string;
      status: string;
      productId: string;
      productVersionId: string;
      termId: string;
      termStart: string;
      termEnd: string;
      createdAt: string;
    }>("/v1/policies", {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify(input),
    }),

  createNewBusinessTransaction: (policyId: string, effectiveAt: string) =>
    apiRequest<PolicyTransactionDto>(`/v1/policies/${policyId}/transactions/new-business`, {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify({ effectiveAt, requestId: createId() }),
    }),

  createEndorsementTransaction: (policyId: string, effectiveAt: string) =>
    apiRequest<PolicyTransactionDto>(`/v1/policies/${policyId}/transactions/endorsement`, {
      method: "POST",
      headers: { "idempotency-key": createId() },
      body: JSON.stringify({ effectiveAt, requestId: createId() }),
    }),

  listTransactions: (policyId: string) =>
    apiRequest<ReadonlyArray<PolicyTransactionDto>>(`/v1/policies/${policyId}/transactions`),

  getTransaction: (transactionId: string) =>
    apiRequest<PolicyTransactionDto>(`/v1/policy-transactions/${transactionId}`),

  replaceRisks: (
    transactionId: string,
    risks: ReadonlyArray<{ riskType: PolicyRiskType; riskKey: string | null; attributes: Record<string, unknown> }>,
  ) =>
    apiRequest<void>(`/v1/policy-transactions/${transactionId}/risks`, {
      method: "PUT",
      body: JSON.stringify({ risks }),
    }),

  replaceCoverages: (
    transactionId: string,
    coverages: ReadonlyArray<{
      coverageCode: string;
      appliesToRiskKey: string | null;
      attributes: Record<string, unknown>;
    }>,
  ) =>
    apiRequest<void>(`/v1/policy-transactions/${transactionId}/coverages`, {
      method: "PUT",
      body: JSON.stringify({ coverages }),
    }),

  replaceCoverageTerms: (
    transactionId: string,
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
    }>,
  ) =>
    apiRequest<void>(`/v1/policy-transactions/${transactionId}/coverage-terms`, {
      method: "PUT",
      body: JSON.stringify({ terms }),
    }),

  rateTransaction: (transactionId: string, currency?: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK") =>
    apiRequest<{ transactionId: string; requestId: string; totalPremium: string; currency: string }>(
      `/v1/policy-transactions/${transactionId}/rate`,
      {
        method: "POST",
        body: JSON.stringify({ requestId: createId(), ...(currency ? { currency } : {}) }),
      },
    ),

  validateTransaction: (transactionId: string) =>
    apiRequest<{ transactionId: string; valid: boolean; issues: ReadonlyArray<string> }>(
      `/v1/policy-transactions/${transactionId}/validate`,
      {
        method: "POST",
      },
    ),

  commitTransaction: (transactionId: string) =>
    apiRequest<{ policyId: string; transactionId: string; committedAt: string }>(
      `/v1/policy-transactions/${transactionId}/commit`,
      {
        method: "POST",
        headers: { "idempotency-key": createId() },
      },
    ),

  getSnapshot: (policyId: string, asOf: string) =>
    apiRequest<PolicySnapshotDto>(`/v1/policies/${policyId}/snapshot?asOf=${encodeURIComponent(asOf)}`),
};
