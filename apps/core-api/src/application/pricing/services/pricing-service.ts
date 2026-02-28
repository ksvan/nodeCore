import { createHash, randomUUID } from "node:crypto";
import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CurrencyCodeSchema,
  PricingRequestSchema,
  PricingResponseSchema,
  type PricingRequest,
} from "@nodecore/contracts/pricing";
import type {
  CalculatePricingInput,
  CalculatePricingResult,
  JsonObject,
  PricingDomainEventPublisher,
  PricingRepository,
  PricingRunner,
} from "../ports/pricing.js";
import { PricingDomainError } from "../../../domain/pricing/errors.js";
import { validateWithJsonSchema } from "../../../infrastructure/pricing/json-schema-validator.js";
import { PricingApplicationError } from "./errors.js";

const toJsonObject = (value: unknown): JsonObject => structuredClone(value) as JsonObject;

const defaultPricingProgramRoot = (): string => {
  if (process.env.PRICING_PROGRAMS_DIR) {
    return resolve(process.env.PRICING_PROGRAMS_DIR);
  }
  return resolve(process.cwd(), "pricing-programs");
};

const resolveProgramFilePath = (fileRef: string): string => {
  if (fileRef.startsWith("/")) {
    return fileRef;
  }
  return resolve(defaultPricingProgramRoot(), fileRef);
};

const sanitizeError = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return "Pricing execution failed";
  }
  const firstLine = error.message.split("\n").at(0) ?? "Pricing execution failed";
  return firstLine.slice(0, 400);
};

const ensureFileAndHash = async (filePath: string): Promise<string> => {
  try {
    await access(filePath);
  } catch {
    throw new PricingApplicationError("Pricing program file does not exist", 404);
  }
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
};

export class PricingService {
  public constructor(
    private readonly repository: PricingRepository,
    private readonly runner: PricingRunner,
    private readonly eventPublisher: PricingDomainEventPublisher,
  ) {}

  public async calculate(input: CalculatePricingInput): Promise<CalculatePricingResult> {
    const requestId = input.requestId ?? randomUUID();
    const existing = await this.repository.getPricingRunByRequestId(requestId);
    if (existing) {
      const parsedResponse = PricingResponseSchema.parse(existing.responseJson);
      return {
        requestId: existing.requestId,
        productVersionId: existing.productVersionId,
        policyTransactionId: existing.policyTransactionId,
        pricingProgramVersionId: existing.pricingProgramVersionId,
        success: existing.success,
        durationMs: existing.durationMs,
        response: parsedResponse,
      };
    }

    const context = await this.repository.getPricingContextByProductVersionId(input.productVersionId);
    if (!context) {
      throw new PricingApplicationError("ProductVersion pricing context not found", 404);
    }

    if (context.pricingProgramVersionStatus !== "ACTIVE") {
      throw new PricingApplicationError("PricingProgramVersion must be ACTIVE for rating", 400);
    }

    const currency = CurrencyCodeSchema.parse(input.currency ?? context.defaultCurrency);
    if (!context.allowedCurrencies.includes(currency)) {
      throw new PricingApplicationError(`Currency ${currency} is not allowed for this product version`, 400);
    }

    const source = await this.resolvePricingSource(input);
    const request: PricingRequest = PricingRequestSchema.parse({
      schemaVersion: "v1",
      requestId,
      productId: context.productId,
      productVersionId: context.productVersionId,
      productVersionVersion: context.productVersionVersion,
      pricingProgramVersionId: context.pricingProgramVersionId,
      transaction: {
        transactionId: source.transactionId,
        type: source.transactionType,
        effectiveAt: source.effectiveAt.toISOString(),
      },
      policy: {
        policyId: source.policyId,
        policyNumber: source.policyNumber,
        termStart: source.termStart.toISOString(),
        termEnd: source.termEnd.toISOString(),
      },
      parties: [],
      risks: source.risks,
      coverages: source.coverages,
      currency,
    });

    const inputValidation = validateWithJsonSchema(context.pricingInputSchema, request);
    if (!inputValidation.ok) {
      throw new PricingDomainError(`Pricing input schema validation failed: ${inputValidation.error}`);
    }

    const filePath = resolveProgramFilePath(context.pricingProgramFileRef);
    const fileHash = await ensureFileAndHash(filePath);

    const timeoutMs = Number.parseInt(process.env.PRICING_TIMEOUT_MS ?? "3000", 10);
    const maxOutputBytes = Number.parseInt(process.env.PRICING_MAX_STDOUT_BYTES ?? `${1024 * 1024}`, 10);

    let success = false;
    let durationMs = 0;
    let response: JsonObject = {};
    let errorSummary: string | null = null;

    try {
      const execution = await this.runner.execute({
        fileRef: filePath,
        requestJson: request,
        timeoutMs,
        maxOutputBytes,
      });
      durationMs = execution.durationMs;

      const outputValidation = validateWithJsonSchema(context.pricingOutputSchema, execution.responseJson);
      if (!outputValidation.ok) {
        throw new PricingDomainError(`Pricing output schema validation failed: ${outputValidation.error}`);
      }

      const parsed = PricingResponseSchema.parse(execution.responseJson);
      if (parsed.requestId !== requestId) {
        throw new PricingDomainError("Pricing response requestId mismatch");
      }
      if (parsed.totals.currency !== currency) {
        throw new PricingDomainError("Pricing response currency mismatch");
      }

      success = true;
      response = toJsonObject(parsed);

      const run = await this.repository.createPricingRun({
        requestId,
        policyTransactionId: input.policyTransactionId ?? null,
        productVersionId: context.productVersionId,
        pricingProgramVersionId: context.pricingProgramVersionId,
        pricingProgramFileRef: context.pricingProgramFileRef,
        pricingProgramFileHash: fileHash,
        requestJson: toJsonObject(request),
        responseJson: response,
        durationMs,
        currency,
        success,
        errorSummary: null,
      });

      await this.eventPublisher.publish({
        eventType: "PricingCalculated",
        entityType: "PricingRun",
        entityId: run.id,
        data: {
          requestId,
          policyTransactionId: input.policyTransactionId ?? null,
          productVersionId: context.productVersionId,
          pricingProgramVersionId: context.pricingProgramVersionId,
          totalPremium: parsed.totals.totalPremium,
          currency: parsed.totals.currency,
          success: true,
          durationMs,
        },
      });

      return {
        requestId,
        productVersionId: context.productVersionId,
        policyTransactionId: input.policyTransactionId ?? null,
        pricingProgramVersionId: context.pricingProgramVersionId,
        success,
        durationMs,
        response: parsed,
      };
    } catch (error: unknown) {
      errorSummary = sanitizeError(error);
      const fallbackResponse = PricingResponseSchema.parse({
        schemaVersion: "v1",
        requestId,
        resultVersion: context.pricingProgramVersionId,
        totals: {
          totalPremium: "0.00",
          currency,
        },
        errors: [{ code: "PRICING_EXECUTION_FAILED", message: errorSummary }],
      });
      response = toJsonObject(fallbackResponse);

      await this.repository.createPricingRun({
        requestId,
        policyTransactionId: input.policyTransactionId ?? null,
        productVersionId: context.productVersionId,
        pricingProgramVersionId: context.pricingProgramVersionId,
        pricingProgramFileRef: context.pricingProgramFileRef,
        pricingProgramFileHash: fileHash,
        requestJson: toJsonObject(request),
        responseJson: response,
        durationMs,
        currency,
        success,
        errorSummary,
      });

      await this.eventPublisher.publish({
        eventType: "PricingCalculated",
        entityType: "PricingRun",
        entityId: requestId,
        data: {
          requestId,
          policyTransactionId: input.policyTransactionId ?? null,
          productVersionId: context.productVersionId,
          pricingProgramVersionId: context.pricingProgramVersionId,
          totalPremium: "0.00",
          currency,
          success: false,
          durationMs,
          errorSummary,
        },
      });

      if (error instanceof PricingDomainError) {
        throw new PricingApplicationError(error.message, 400);
      }
      throw new PricingApplicationError("Pricing execution failed", 500);
    }
  }

  private async resolvePricingSource(input: CalculatePricingInput): Promise<{
    policyId: string;
    policyNumber: string;
    termStart: Date;
    termEnd: Date;
    transactionId: string;
    transactionType: "NEW_BUSINESS" | "ENDORSEMENT";
    effectiveAt: Date;
    risks: PricingRequest["risks"];
    coverages: PricingRequest["coverages"];
  }> {
    if (input.policyTransactionId) {
      const context = await this.repository.getPricingPolicyContextByTransactionId(input.policyTransactionId);
      if (!context) {
        throw new PricingApplicationError("Policy transaction not found for pricing", 404);
      }
      return {
        policyId: context.policyId,
        policyNumber: context.policyNumber,
        termStart: context.termStart,
        termEnd: context.termEnd,
        transactionId: context.transactionId,
        transactionType: context.transactionType,
        effectiveAt: context.effectiveAt,
        risks: [...context.risks],
        coverages: [...context.coverages],
      };
    }

    if (!input.policy || !input.effectiveAt || !input.transactionType) {
      throw new PricingApplicationError(
        "For explicit pricing, provide policy + effectiveAt + transactionType when policyTransactionId is missing",
        400,
      );
    }

    return {
      policyId: input.policy.policyId,
      policyNumber: input.policy.policyNumber,
      termStart: input.policy.termStart,
      termEnd: input.policy.termEnd,
      transactionId: input.requestId ?? randomUUID(),
      transactionType: input.transactionType,
      effectiveAt: input.effectiveAt,
      risks: [...(input.risks ?? [])],
      coverages: [...(input.coverages ?? [])],
    };
  }
}
