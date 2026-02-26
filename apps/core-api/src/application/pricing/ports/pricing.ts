import type { CurrencyCode, RatingInput } from "@nodecore/contracts/pricing";

export type JsonObject = Record<string, unknown>;

export interface PricingContext {
  readonly productVersionId: string;
  readonly pricingProgramVersionId: string;
  readonly pricingProgramFileRef: string;
  readonly pricingInputSchema: JsonObject;
  readonly pricingOutputSchema: JsonObject;
  readonly defaultCurrency: CurrencyCode;
  readonly allowedCurrencies: ReadonlyArray<CurrencyCode>;
  readonly resolvedSnapshot: JsonObject;
}

export interface PricingRunRecord {
  readonly id: string;
  readonly requestId: string;
  readonly productVersionId: string;
  readonly pricingProgramVersionId: string;
  readonly requestJson: JsonObject;
  readonly responseJson: JsonObject;
  readonly occurredAt: Date;
  readonly durationMs: number;
  readonly currency: CurrencyCode;
  readonly success: boolean;
  readonly failureReason: string | null;
}

export interface PricingRepository {
  getPricingContextByProductVersionId(productVersionId: string): Promise<PricingContext | null>;
  getPricingContextBySnapshotId(snapshotId: string): Promise<PricingContext | null>;
  createPricingRun(input: {
    requestId: string;
    productVersionId: string;
    pricingProgramVersionId: string;
    requestJson: JsonObject;
    responseJson: JsonObject;
    durationMs: number;
    currency: CurrencyCode;
    success: boolean;
    failureReason: string | null;
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
    requestJson: JsonObject;
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
  readonly productVersionId?: string;
  readonly resolvedSnapshotId?: string;
  readonly currency?: CurrencyCode;
  readonly ratingInput: RatingInput;
  readonly requestId?: string;
}
