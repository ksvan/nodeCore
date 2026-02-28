import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import {
  CurrencyCodeSchema,
  PricingCoverageSchema,
  PricingRiskSchema,
} from "@nodecore/contracts/pricing";
import { PricingService } from "../../../application/pricing/services/pricing-service.js";
import { PricingApplicationError } from "../../../application/pricing/services/errors.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { PrismaPricingRepository } from "../../../infrastructure/pricing/prisma-pricing-repository.js";
import { PythonPricingRunner } from "../../../infrastructure/pricing/python-pricing-runner.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const CalculatePricingBodySchema = z
  .object({
    requestId: z.string().uuid().optional(),
    productVersionId: z.string().uuid(),
    policyTransactionId: z.string().uuid().optional(),
    effectiveAt: z.string().datetime().optional(),
    transactionType: z.enum(["NEW_BUSINESS", "ENDORSEMENT"]).optional(),
    policy: z
      .object({
        policyId: z.string().uuid(),
        policyNumber: z.string().min(1),
        termStart: z.string().datetime(),
        termEnd: z.string().datetime(),
      })
      .optional(),
    risks: z.array(PricingRiskSchema).optional(),
    coverages: z.array(PricingCoverageSchema).optional(),
    currency: CurrencyCodeSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.policyTransactionId) {
      if (!value.policy || !value.effectiveAt || !value.transactionType) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "When policyTransactionId is omitted, provide policy + effectiveAt + transactionType",
        });
      }
    }
  });

const service = new PricingService(
  new PrismaPricingRepository(getPrismaClient()),
  new PythonPricingRunner(),
  new WsDomainEventPublisher(),
);

const sendError = (reply: FastifyReply, error: unknown): void => {
  if (error instanceof PricingApplicationError) {
    void reply.code(error.statusCode).send({
      code: "PRICING_ERROR",
      message: error.message,
    });
    return;
  }
  void reply.code(500).send({ code: "INTERNAL_ERROR", message: "Pricing execution failed" });
};

export const registerPricingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    "/v1/pricing/calculate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = CalculatePricingBodySchema.parse(request.body);
      try {
        const result = await service.calculate({
          ...(body.requestId ? { requestId: body.requestId } : {}),
          productVersionId: body.productVersionId,
          ...(body.policyTransactionId ? { policyTransactionId: body.policyTransactionId } : {}),
          ...(body.effectiveAt ? { effectiveAt: new Date(body.effectiveAt) } : {}),
          ...(body.transactionType ? { transactionType: body.transactionType } : {}),
          ...(body.policy
            ? {
                policy: {
                  policyId: body.policy.policyId,
                  policyNumber: body.policy.policyNumber,
                  termStart: new Date(body.policy.termStart),
                  termEnd: new Date(body.policy.termEnd),
                },
              }
            : {}),
          ...(body.risks ? { risks: body.risks } : {}),
          ...(body.coverages ? { coverages: body.coverages } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
        });
        return reply.code(200).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );
};
