import { z } from "zod";

export const RatingInputSchema = z.object({
  policy: z.record(z.unknown()),
  exposures: z.array(z.record(z.unknown())).default([]),
  coverages: z.array(z.record(z.unknown())).default([]),
  context: z.record(z.unknown()).optional(),
});

export const PricingRequestSchema = z.object({
  requestId: z.string().uuid(),
  productVersionId: z.string().uuid(),
  pricingProgramVersionId: z.string().uuid(),
  input: z.record(z.unknown()),
  ratingInput: RatingInputSchema,
  occurredAt: z.string().datetime(),
});

export const PricingResponseSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  totalPremium: z.number(),
  currency: z.string().min(1).default("USD"),
  breakdown: z.record(z.number()).default({}),
  details: z.record(z.unknown()).default({}),
});

export type RatingInput = z.infer<typeof RatingInputSchema>;
export type PricingRequest = z.infer<typeof PricingRequestSchema>;
export type PricingResponse = z.infer<typeof PricingResponseSchema>;
