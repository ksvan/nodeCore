import { z } from "zod";

export const CurrencyCodeSchema = z.enum(["SEK", "DKK", "EUR", "GBP", "USD", "NOK"]);
export const PricingSchemaVersionSchema = z.literal("v1");

export const PricingRiskSchema = z.object({
  riskId: z.string().uuid().optional(),
  riskKey: z.string().nullable().optional(),
  riskType: z.enum(["VEHICLE", "PROPERTY", "LOCATION", "PERSON", "OTHER"]),
  attributes: z.record(z.unknown()),
});

export const PricingCoverageTermSchema = z.object({
  termCode: z.string().min(1),
  valueType: z.enum(["MONEY", "NUMBER", "STRING", "BOOLEAN"]),
  moneyAmount: z.string().nullable().optional(),
  moneyCurrency: z.string().length(3).nullable().optional(),
  numberValue: z.string().nullable().optional(),
  stringValue: z.string().nullable().optional(),
  booleanValue: z.boolean().nullable().optional(),
});

export const PricingCoverageSchema = z.object({
  coverageId: z.string().uuid().optional(),
  coverageCode: z.string().min(1),
  appliesToRiskId: z.string().uuid().nullable().optional(),
  appliesToRiskKey: z.string().nullable().optional(),
  attributes: z.record(z.unknown()),
  terms: z.array(PricingCoverageTermSchema).default([]),
});

export const PricingRequestSchema = z.object({
  schemaVersion: PricingSchemaVersionSchema.default("v1"),
  requestId: z.string().uuid(),
  productId: z.string().uuid(),
  productVersionId: z.string().uuid(),
  productVersionVersion: z.string(),
  pricingProgramVersionId: z.string().uuid(),
  transaction: z.object({
    transactionId: z.string().uuid(),
    type: z.enum(["NEW_BUSINESS", "ENDORSEMENT"]),
    effectiveAt: z.string().datetime(),
  }),
  policy: z.object({
    policyId: z.string().uuid(),
    policyNumber: z.string().min(1),
    termStart: z.string().datetime(),
    termEnd: z.string().datetime(),
  }),
  parties: z.array(z.object({ partyId: z.string().uuid(), role: z.string().min(1).optional() })).default([]),
  risks: z.array(PricingRiskSchema).default([]),
  coverages: z.array(PricingCoverageSchema).default([]),
  currency: CurrencyCodeSchema,
});

export const PricingErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  path: z.string().optional(),
});

export const PricingBreakdownEntrySchema = z.object({
  coverageCode: z.string().optional(),
  riskKey: z.string().nullable().optional(),
  amount: z.string(),
  currency: CurrencyCodeSchema,
  details: z.record(z.unknown()).optional(),
});

export const PricingResponseSchema = z.object({
  schemaVersion: PricingSchemaVersionSchema.default("v1"),
  requestId: z.string().uuid(),
  resultVersion: z.string().min(1),
  totals: z.object({
    totalPremium: z.string(),
    currency: CurrencyCodeSchema,
  }),
  breakdown: z.array(PricingBreakdownEntrySchema).optional(),
  errors: z.array(PricingErrorSchema).default([]),
});

export type CurrencyCode = z.infer<typeof CurrencyCodeSchema>;
export type PricingRequest = z.infer<typeof PricingRequestSchema>;
export type PricingResponse = z.infer<typeof PricingResponseSchema>;
export type PricingRisk = z.infer<typeof PricingRiskSchema>;
export type PricingCoverage = z.infer<typeof PricingCoverageSchema>;
export type PricingCoverageTerm = z.infer<typeof PricingCoverageTermSchema>;
