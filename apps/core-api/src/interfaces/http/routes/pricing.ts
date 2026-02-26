import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { RatingInputSchema } from "@nodecore/contracts/pricing";
import { PricingService } from "../../../application/pricing/services/pricing-service.js";
import { PricingApplicationError } from "../../../application/pricing/services/errors.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { PrismaPricingRepository } from "../../../infrastructure/pricing/prisma-pricing-repository.js";
import { PythonPricingRunner } from "../../../infrastructure/pricing/python-pricing-runner.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const CalculatePricingBodySchema = z
  .object({
    requestId: z.string().uuid().optional(),
    productVersionId: z.string().uuid().optional(),
    resolvedSnapshotId: z.string().uuid().optional(),
    ratingInput: RatingInputSchema,
  })
  .superRefine((value, ctx) => {
    const a = value.productVersionId !== undefined;
    const b = value.resolvedSnapshotId !== undefined;
    if (a === b) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either productVersionId or resolvedSnapshotId",
      });
    }
  });

const service = new PricingService(
  new PrismaPricingRepository(getPrismaClient()),
  new PythonPricingRunner(),
  new WsDomainEventPublisher(),
);

const sendError = (reply: FastifyReply, error: unknown): void => {
  if (error instanceof PricingApplicationError) {
    void reply.code(error.statusCode).send({ message: error.message });
    return;
  }
  void reply.code(500).send({ message: "Pricing execution failed" });
};

export const registerPricingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/v1/pricing/calculate", async (request, reply) => {
    const body = CalculatePricingBodySchema.parse(request.body);
    try {
      const result = await service.calculate({
        ...(body.requestId ? { requestId: body.requestId } : {}),
        ...(body.productVersionId ? { productVersionId: body.productVersionId } : {}),
        ...(body.resolvedSnapshotId ? { resolvedSnapshotId: body.resolvedSnapshotId } : {}),
        ratingInput: body.ratingInput,
      });
      return reply.code(200).send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });
};
