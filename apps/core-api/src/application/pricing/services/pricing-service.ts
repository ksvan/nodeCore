import { randomUUID } from "node:crypto";
import {
  CurrencyCodeSchema,
  PricingRequestSchema,
  PricingResponseSchema,
  type PricingResponse,
} from "@nodecore/contracts/pricing";
import type {
  CalculatePricingInput,
  JsonObject,
  PricingRepository,
  PricingDomainEventPublisher,
  PricingRunner,
} from "../ports/pricing.js";
import { PricingDomainError } from "../../../domain/pricing/errors.js";
import { validateWithJsonSchema } from "../../../infrastructure/pricing/json-schema-validator.js";
import { PricingApplicationError } from "./errors.js";

interface PricingCalculationResult {
  requestId: string;
  productVersionId: string;
  pricingProgramVersionId: string;
  currency: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
  success: boolean;
  durationMs: number;
  response: PricingResponse;
}

const toJsonObject = (value: unknown): JsonObject => structuredClone(value) as JsonObject;
const nowIso = (): string => new Date().toISOString();

export class PricingService {
  public constructor(
    private readonly repository: PricingRepository,
    private readonly runner: PricingRunner,
    private readonly eventPublisher: PricingDomainEventPublisher,
  ) {}

  public async calculate(input: CalculatePricingInput): Promise<PricingCalculationResult> {
    const hasProductVersionId = Boolean(input.productVersionId);
    const hasSnapshotId = Boolean(input.resolvedSnapshotId);
    if (hasProductVersionId === hasSnapshotId) {
      throw new PricingApplicationError(
        "Provide either productVersionId or resolvedSnapshotId",
        400,
      );
    }

    const context = hasProductVersionId
      ? await this.repository.getPricingContextByProductVersionId(input.productVersionId as string)
      : await this.repository.getPricingContextBySnapshotId(input.resolvedSnapshotId as string);

    if (!context) {
      throw new PricingApplicationError(
        "Active ProductVersion snapshot with PricingProgramVersion not found",
        404,
      );
    }

    const requestId = input.requestId ?? randomUUID();
    const requestedCurrency = CurrencyCodeSchema.parse(input.currency ?? context.defaultCurrency);
    if (!context.allowedCurrencies.includes(requestedCurrency)) {
      throw new PricingApplicationError(
        `Currency ${requestedCurrency} is not allowed for this product version`,
        400,
      );
    }

    const pricingInputPayload = {
      resolvedSnapshot: context.resolvedSnapshot,
      currency: requestedCurrency,
      ratingInput: input.ratingInput,
    };

    const requestSchemaValidation = validateWithJsonSchema(
      context.pricingInputSchema,
      pricingInputPayload,
    );
    if (!requestSchemaValidation.ok) {
      throw new PricingDomainError(
        `Pricing input validation failed: ${requestSchemaValidation.error}`,
      );
    }

    const pricingRequest = PricingRequestSchema.parse({
      requestId,
      productVersionId: context.productVersionId,
      pricingProgramVersionId: context.pricingProgramVersionId,
      currency: requestedCurrency,
      input: pricingInputPayload,
      ratingInput: input.ratingInput,
      occurredAt: nowIso(),
    });

    let success = false;
    let durationMs = 0;
    let responseForPersistence: JsonObject = {};
    let failureReason: string | null = null;

    try {
      const execution = await this.runner.execute({
        fileRef: context.pricingProgramFileRef,
        requestJson: toJsonObject(pricingRequest),
        timeoutMs: 5000,
        maxOutputBytes: 1024 * 256,
      });
      durationMs = execution.durationMs;

      const outputValidation = validateWithJsonSchema(
        context.pricingOutputSchema,
        execution.responseJson,
      );
      if (!outputValidation.ok) {
        throw new PricingDomainError(
          `Pricing output validation failed: ${outputValidation.error}`,
        );
      }

      const parsedResponse = PricingResponseSchema.parse(execution.responseJson);
      if (parsedResponse.currency !== requestedCurrency) {
        throw new PricingDomainError(
          `Pricing response currency mismatch: expected ${requestedCurrency}, got ${parsedResponse.currency}`,
        );
      }

      success = true;
      responseForPersistence = toJsonObject(parsedResponse);

      await this.repository.createPricingRun({
        requestId,
        productVersionId: context.productVersionId,
        pricingProgramVersionId: context.pricingProgramVersionId,
        requestJson: toJsonObject(pricingRequest),
        responseJson: responseForPersistence,
        durationMs,
        currency: requestedCurrency,
        success,
        failureReason: null,
      });

      await this.eventPublisher.publish({
        eventType: "PricingCalculated",
        entityType: "PricingRun",
        entityId: requestId,
        data: {
          requestId,
          productVersionId: context.productVersionId,
          pricingProgramVersionId: context.pricingProgramVersionId,
          currency: requestedCurrency,
          success: true,
          durationMs,
          totalPremium: parsedResponse.totalPremium,
          occurredAt: nowIso(),
        },
      });

      return {
        requestId,
        productVersionId: context.productVersionId,
        pricingProgramVersionId: context.pricingProgramVersionId,
        currency: requestedCurrency,
        success: true,
        durationMs,
        response: parsedResponse,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pricing execution failed";
      failureReason = message;
      responseForPersistence = { error: "Pricing execution failed" };
      durationMs = durationMs || 0;

      await this.repository.createPricingRun({
        requestId,
        productVersionId: context.productVersionId,
        pricingProgramVersionId: context.pricingProgramVersionId,
        requestJson: toJsonObject(pricingRequest),
        responseJson: responseForPersistence,
        durationMs,
        currency: requestedCurrency,
        success,
        failureReason,
      });

      await this.eventPublisher.publish({
        eventType: "PricingCalculated",
        entityType: "PricingRun",
        entityId: requestId,
        data: {
          requestId,
          productVersionId: context.productVersionId,
          pricingProgramVersionId: context.pricingProgramVersionId,
          currency: requestedCurrency,
          success: false,
          durationMs,
          occurredAt: nowIso(),
        },
      });

      if (error instanceof PricingDomainError) {
        throw new PricingApplicationError(error.message, 400);
      }
      throw new PricingApplicationError("Pricing execution failed", 500);
    }
  }
}
