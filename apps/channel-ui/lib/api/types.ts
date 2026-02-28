export interface ApiErrorPayload {
  code?: string;
  message?: string;
  errors?: ReadonlyArray<{ field?: string; message: string }>;
}

export class ApiClientError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly fieldErrors: ReadonlyArray<{ field?: string; message: string }>;

  public constructor(status: number, payload: ApiErrorPayload | null) {
    super(payload?.message ?? `Request failed with status ${status}`);
    this.status = status;
    this.code = payload?.code ?? "REQUEST_FAILED";
    this.fieldErrors = payload?.errors ?? [];
  }
}

export type ProductStatus = "DRAFT" | "ACTIVE" | "RETIRED";
export type ComponentType = "COVERAGE" | "EXPOSURE" | "RULE";
export type CurrencyCode = "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";

export interface ProductDto {
  id: string;
  productCode: string;
  name: string;
  description: string | null;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersionDto {
  id: string;
  productId: string;
  version: number;
  status: ProductStatus;
  effectiveFrom: string;
  effectiveTo: string | null;
  policySchema: Record<string, unknown>;
  exposureSchemas: Record<string, unknown>;
  pricingInputSchema: Record<string, unknown>;
  defaultCurrency: CurrencyCode;
  allowedCurrencies: ReadonlyArray<CurrencyCode>;
  pricingProgramVersionId: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVersionSnapshotDto {
  id: string;
  productVersionId: string;
  resolvedSnapshot: Record<string, unknown>;
  createdAt: string;
}

export interface ComponentDto {
  id: string;
  componentCode: string;
  type: ComponentType;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComponentVersionDto {
  id: string;
  componentId: string;
  version: number;
  status: ProductStatus;
  schema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  component: ComponentDto;
}

export interface ProductVersionComponentRefDto {
  id: string;
  productVersionId: string;
  componentVersionId: string;
  configOverrides: Record<string, unknown>;
  createdAt: string;
  componentVersion: ComponentVersionDto;
}

export interface PricingProgramDto {
  id: string;
  programCode: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PricingProgramVersionDto {
  id: string;
  pricingProgramId: string;
  version: number;
  status: ProductStatus;
  fileRef: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  metadata: Record<string, unknown>;
  releasedAt: string | null;
  createdAt: string;
  updatedAt: string;
  pricingProgram: PricingProgramDto;
}

export interface AuthLoginResponse {
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
  user: {
    id: string;
    email: string;
    roles: ReadonlyArray<string>;
  };
}

export type PolicyRiskType = "VEHICLE" | "PROPERTY" | "LOCATION" | "PERSON" | "OTHER";
export type CoverageTermValueType = "MONEY" | "NUMBER" | "STRING" | "BOOLEAN";
export type PolicyTransactionType = "NEW_BUSINESS" | "ENDORSEMENT";
export type PolicyTransactionStatus = "DRAFT" | "COMMITTED";

export interface PolicyListItemDto {
  id: string;
  policyNumber: string;
  status: string;
  productId: string;
  productVersionId: string;
  createdAt: string;
}

export interface PolicyDto {
  id: string;
  policyNumber: string;
  status: string;
  productId: string;
  productVersionId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PolicyTransactionDto {
  id: string;
  policyId: string;
  termId: string;
  type: PolicyTransactionType;
  status: PolicyTransactionStatus;
  effectiveAt: string;
  createdAt: string;
  committedAt: string | null;
}

export interface PolicySnapshotDto {
  policy: {
    id: string;
    policyNumber: string;
    status: string;
    productId: string;
    productVersionId: string;
  };
  term: {
    id: string;
    termStart: string;
    termEnd: string;
    status: string;
  } | null;
  asOf: string;
  risks: ReadonlyArray<{
    id: string;
    riskType: PolicyRiskType;
    riskKey: string | null;
    attributes: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo: string;
  }>;
  coverages: ReadonlyArray<{
    id: string;
    coverageCode: string;
    appliesToRiskId: string | null;
    attributes: Record<string, unknown>;
    effectiveFrom: string;
    effectiveTo: string;
    terms: ReadonlyArray<{
      id: string;
      termCode: string;
      valueType: CoverageTermValueType;
      moneyAmount: string | null;
      moneyCurrency: string | null;
      numberValue: string | null;
      stringValue: string | null;
      booleanValue: boolean | null;
      effectiveFrom: string;
      effectiveTo: string;
    }>;
  }>;
  premiums: ReadonlyArray<{
    id: string;
    coverageId: string | null;
    riskId: string | null;
    totalAmount: string;
    currency: string;
    breakdown: Record<string, unknown> | null;
    effectiveFrom: string;
    effectiveTo: string;
  }>;
  financials: {
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
  } | null;
}
