import type { CurrencyCode, PricingCoverage, PricingRequest, PricingResponse, PricingRisk } from "@nodecore/contracts/pricing";

export type JsonObject = Record<string, unknown>;

export interface PricingContext {
  readonly productId: string;
  readonly productVersionId: string;
  readonly productVersionVersion: string;
  readonly pricingProgramVersionId: string;
  readonly pricingProgramVersionStatus: "DRAFT" | "ACTIVE" | "RETIRED";
  readonly pricingProgramFileRef: string;
  readonly pricingInputSchema: JsonObject;
  readonly pricingOutputSchema: JsonObject;
  readonly defaultCurrency: CurrencyCode;
  readonly allowedCurrencies: ReadonlyArray<CurrencyCode>;
}

export interface PricingPolicyContext {
  readonly policyId: string;
  readonly policyNumber: string;
  readonly productId: string;
  readonly productVersionId: string;
  readonly termId: string;
  readonly termStart: Date;
  readonly termEnd: Date;
  readonly transactionId: string;
  readonly transactionType: "NEW_BUSINESS" | "ENDORSEMENT";
  readonly effectiveAt: Date;
  readonly risks: ReadonlyArray<PricingRisk>;
  readonly coverages: ReadonlyArray<PricingCoverage>;
}

export interface PricingRunRecord {
  readonly id: string;
  readonly requestId: string;
  readonly policyTransactionId: string | null;
  readonly productVersionId: string;
  readonly pricingProgramVersionId: string;
  readonly pricingProgramFileRef: string | null;
  readonly pricingProgramFileHash: string | null;
  readonly requestJson: JsonObject;
  readonly responseJson: JsonObject;
  readonly occurredAt: Date;
  readonly durationMs: number;
  readonly currency: CurrencyCode;
  readonly success: boolean;
  readonly errorSummary: string | null;
}

export interface PricingRepository {
  getPricingContextByProductVersionId(productVersionId: string): Promise<PricingContext | null>;
  getPricingPolicyContextByTransactionId(transactionId: string): Promise<PricingPolicyContext | null>;
  getPricingRunByRequestId(requestId: string): Promise<PricingRunRecord | null>;
  createPricingRun(input: {
    requestId: string;
    policyTransactionId: string | null;
    productVersionId: string;
    pricingProgramVersionId: string;
    pricingProgramFileRef: string;
    pricingProgramFileHash: string | null;
    requestJson: JsonObject;
    responseJson: JsonObject;
    durationMs: number;
    currency: CurrencyCode;
    success: boolean;
    errorSummary: string | null;
  }): Promise<PricingRunRecord>;
}

export interface PricingExecutionResult {
  readonly responseJson: JsonObject;
  readonly durationMs: number;
  readonly stderr: string;
}

export interface PricingRunner {
  execute(input: {
    fileRef: string;
    requestJson: PricingRequest;
    timeoutMs: number;
    maxOutputBytes: number;
  }): Promise<PricingExecutionResult>;
}

export interface PricingDomainEventPublisher {
  publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void>;
}

export interface CalculatePricingInput {
  readonly requestId?: string;
  readonly productVersionId: string;
  readonly policyTransactionId?: string;
  readonly effectiveAt?: Date;
  readonly transactionType?: "NEW_BUSINESS" | "ENDORSEMENT";
  readonly policy?: {
    policyId: string;
    policyNumber: string;
    termStart: Date;
    termEnd: Date;
  };
  readonly risks?: ReadonlyArray<PricingRisk>;
  readonly coverages?: ReadonlyArray<PricingCoverage>;
  readonly currency?: CurrencyCode;
}

export interface CalculatePricingResult {
  readonly requestId: string;
  readonly productVersionId: string;
  readonly policyTransactionId: string | null;
  readonly pricingProgramVersionId: string;
  readonly success: boolean;
  readonly durationMs: number;
  readonly response: PricingResponse;
}
