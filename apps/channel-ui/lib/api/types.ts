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
