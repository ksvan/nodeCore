import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { PolicyApplicationError } from "../../../application/policy/services/errors.js";
import { PolicyService, mapPolicyError } from "../../../application/policy/services/policy-service.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { PrismaPolicyRepository } from "../../../infrastructure/policy/prisma-policy-repository.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const JsonObjectSchema = z.record(z.unknown());

const sendError = (reply: FastifyReply, error: unknown): void => {
  const mapped = mapPolicyError(error);
  if (mapped instanceof PolicyApplicationError) {
    void reply.code(mapped.statusCode).send({ message: mapped.message });
    return;
  }
  void reply.code(500).send({ message: "Internal policy error" });
};

export const registerPolicyRoutes = async (app: FastifyInstance): Promise<void> => {
  const repository = new PrismaPolicyRepository(getPrismaClient());

  const pricingGateway = {
    calculate: async (input: {
      productVersionId: string;
      ratingInput: {
        policy: Record<string, unknown>;
        exposures: ReadonlyArray<Record<string, unknown>>;
        coverages: ReadonlyArray<Record<string, unknown>>;
        context?: Record<string, unknown>;
      };
    }) => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/pricing/calculate",
        payload: {
          productVersionId: input.productVersionId,
          ratingInput: input.ratingInput,
        },
      });

      if (response.statusCode >= 300) {
        throw new PolicyApplicationError("Pricing calculation failed", 400);
      }

      const payload = response.json() as {
        requestId: string;
        pricingProgramVersionId: string;
        response: Record<string, unknown>;
      };

      return {
        requestId: payload.requestId,
        pricingProgramVersionId: payload.pricingProgramVersionId,
        response: payload.response,
        request: {
          productVersionId: input.productVersionId,
          ratingInput: input.ratingInput,
        } as Record<string, unknown>,
      };
    },
  };

  const service = new PolicyService(repository, pricingGateway, new WsDomainEventPublisher());

  app.post("/v1/policies/drafts", async (request, reply) => {
    const body = z
      .object({
        policyNumber: z.string().min(1),
        productVersionId: z.string().uuid(),
        effectiveFrom: z.string().datetime(),
        effectiveTo: z.string().datetime(),
      })
      .parse(request.body);

    try {
      const result = await service.createPolicyDraftNewBusiness({
        policyNumber: body.policyNumber,
        productVersionId: body.productVersionId,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: new Date(body.effectiveTo),
      });
      return reply.code(201).send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/policies/:policyId/transactions/endorsement", async (request, reply) => {
    const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        productVersionId: z.string().uuid(),
        effectiveFrom: z.string().datetime(),
      })
      .parse(request.body);
    try {
      const result = await service.createEndorsementDraft({
        policyId: params.policyId,
        productVersionId: body.productVersionId,
        effectiveFrom: new Date(body.effectiveFrom),
      });
      return reply.code(201).send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.put("/v1/policy-transactions/:txId/exposures", async (request, reply) => {
    const params = z.object({ txId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        exposures: z.array(
          z.object({
            exposureKey: z.string().min(1),
            data: JsonObjectSchema,
          }),
        ),
      })
      .parse(request.body);
    try {
      await service.setTransactionExposures(params.txId, body.exposures);
      return reply.code(204).send();
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.put("/v1/policy-transactions/:txId/coverages", async (request, reply) => {
    const params = z.object({ txId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        coverages: z.array(
          z.object({
            coverageKey: z.string().min(1),
            data: JsonObjectSchema,
          }),
        ),
      })
      .parse(request.body);
    try {
      await service.setTransactionCoverages(params.txId, body.coverages);
      return reply.code(204).send();
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/policy-transactions/:txId/rate", async (request, reply) => {
    const params = z.object({ txId: z.string().uuid() }).parse(request.params);
    try {
      const result = await service.rateTransaction(params.txId);
      return reply.send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/policy-transactions/:txId/issue", async (request, reply) => {
    const params = z.object({ txId: z.string().uuid() }).parse(request.params);
    try {
      const result = await service.issueTransaction(params.txId);
      return reply.send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get("/v1/policies/:policyId/snapshot", async (request, reply) => {
    const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
    const query = z.object({ asOfDate: z.string() }).parse(request.query);
    const asOfDate = new Date(query.asOfDate);
    if (Number.isNaN(asOfDate.getTime())) {
      return reply.code(400).send({ message: "Invalid asOfDate" });
    }

    try {
      const snapshot = await service.getPolicySnapshot(params.policyId, asOfDate);
      return reply.send(snapshot);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });
};
