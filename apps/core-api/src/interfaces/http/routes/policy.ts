import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { PolicyApplicationError } from "../../../application/policy/services/errors.js";
import { PolicyService, mapPolicyError } from "../../../application/policy/services/policy-service.js";
import { PricingService } from "../../../application/pricing/services/pricing-service.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { PrismaPolicyRepository } from "../../../infrastructure/policy/prisma-policy-repository.js";
import { PrismaPricingRepository } from "../../../infrastructure/pricing/prisma-pricing-repository.js";
import { PythonPricingRunner } from "../../../infrastructure/pricing/python-pricing-runner.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const JsonObjectSchema = z.record(z.unknown());
const PolicyRiskTypeSchema = z.enum(["VEHICLE", "PROPERTY", "LOCATION", "PERSON", "OTHER"]);
const CoverageTermValueTypeSchema = z.enum(["MONEY", "NUMBER", "STRING", "BOOLEAN"]);

const requireIdempotencyKey = (value: unknown): string => {
  const parsed = z.string().min(1).safeParse(value);
  if (!parsed.success) {
    throw new PolicyApplicationError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required",
      400,
    );
  }
  return parsed.data;
};

const sendError = (reply: FastifyReply, error: unknown): void => {
  const mapped = mapPolicyError(error);
  if (mapped instanceof PolicyApplicationError) {
    void reply.code(mapped.statusCode).send({
      code: mapped.code,
      message: mapped.message,
    });
    return;
  }
  void reply.code(500).send({
    code: "INTERNAL_POLICY_ERROR",
    message: "Internal policy error",
  });
};

export const registerPolicyRoutes = async (app: FastifyInstance): Promise<void> => {
  const repository = new PrismaPolicyRepository(getPrismaClient());
  const pricingService = new PricingService(
    new PrismaPricingRepository(getPrismaClient()),
    new PythonPricingRunner(),
    new WsDomainEventPublisher(),
  );
  const pricingGateway = {
    calculate: async (input: {
      requestId?: string;
      productVersionId: string;
      policyTransactionId: string;
      currency?: "SEK" | "DKK" | "EUR" | "GBP" | "USD" | "NOK";
    }) => {
      const result = await pricingService.calculate(input);
      return {
        requestId: result.requestId,
        response: {
          schemaVersion: result.response.schemaVersion,
          requestId: result.response.requestId,
          resultVersion: result.response.resultVersion,
          totals: result.response.totals,
          errors: [...result.response.errors],
          ...(result.response.breakdown ? { breakdown: [...result.response.breakdown] } : {}),
        },
      };
    },
  };
  const service = new PolicyService(repository, pricingGateway, new WsDomainEventPublisher());

  app.post(
    "/v1/policies",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const body = z
        .object({
          policyNumber: z.string().min(1),
          productId: z.string().uuid(),
          productVersionId: z.string().uuid(),
          termStart: z.string().datetime(),
          termEnd: z.string().datetime(),
        })
        .parse(request.body);

      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.createPolicy({
          policyNumber: body.policyNumber,
          productId: body.productId,
          productVersionId: body.productVersionId,
          termStart: new Date(body.termStart),
          termEnd: new Date(body.termEnd),
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/policies",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const query = z.object({ query: z.string().optional() }).parse(request.query);
      const result = await service.listPolicies(query.query);
      return reply.send(result);
    },
  );

  app.get(
    "/v1/policies/:policyId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.getPolicy(params.policyId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/policies/:policyId/transactions/new-business",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          effectiveAt: z.string().datetime(),
          requestId: z.string().uuid().optional(),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.createTransaction({
          policyId: params.policyId,
          type: "NEW_BUSINESS",
          effectiveAt: new Date(body.effectiveAt),
          requestId: body.requestId ?? null,
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/policies/:policyId/transactions/endorsement",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          effectiveAt: z.string().datetime(),
          requestId: z.string().uuid().optional(),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.createTransaction({
          policyId: params.policyId,
          type: "ENDORSEMENT",
          effectiveAt: new Date(body.effectiveAt),
          requestId: body.requestId ?? null,
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/policies/:policyId/transactions",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
      const result = await service.listTransactions(params.policyId);
      return reply.send(result);
    },
  );

  app.get(
    "/v1/policy-transactions/:transactionId",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.getTransaction(params.transactionId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.put(
    "/v1/policy-transactions/:transactionId/risks",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          risks: z.array(
            z.object({
              riskType: PolicyRiskTypeSchema,
              riskKey: z.string().min(1).nullable().optional(),
              attributes: JsonObjectSchema,
            }),
          ),
        })
        .parse(request.body);
      try {
        await service.replaceTransactionRisks({
          transactionId: params.transactionId,
          risks: body.risks.map((risk) => ({
            riskType: risk.riskType,
            riskKey: risk.riskKey ?? null,
            attributes: risk.attributes,
          })),
        });
        return reply.code(204).send();
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.put(
    "/v1/policy-transactions/:transactionId/coverages",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          coverages: z.array(
            z.object({
              coverageCode: z.string().min(1),
              appliesToRiskKey: z.string().min(1).nullable().optional(),
              attributes: JsonObjectSchema,
            }),
          ),
        })
        .parse(request.body);
      try {
        await service.replaceTransactionCoverages({
          transactionId: params.transactionId,
          coverages: body.coverages.map((coverage) => ({
            coverageCode: coverage.coverageCode,
            appliesToRiskKey: coverage.appliesToRiskKey ?? null,
            attributes: coverage.attributes,
          })),
        });
        return reply.code(204).send();
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.put(
    "/v1/policy-transactions/:transactionId/coverage-terms",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          terms: z.array(
            z.object({
              coverageCode: z.string().min(1),
              appliesToRiskKey: z.string().min(1).nullable().optional(),
              termCode: z.string().min(1),
              valueType: CoverageTermValueTypeSchema,
              moneyAmount: z.string().min(1).nullable().optional(),
              moneyCurrency: z.string().length(3).nullable().optional(),
              numberValue: z.string().min(1).nullable().optional(),
              stringValue: z.string().min(1).nullable().optional(),
              booleanValue: z.boolean().nullable().optional(),
            }),
          ),
        })
        .parse(request.body);

      try {
        await service.replaceTransactionCoverageTerms({
          transactionId: params.transactionId,
          terms: body.terms.map((term) => ({
            coverageCode: term.coverageCode,
            appliesToRiskKey: term.appliesToRiskKey ?? null,
            termCode: term.termCode,
            valueType: term.valueType,
            moneyAmount: term.moneyAmount ?? null,
            moneyCurrency: term.moneyCurrency ?? null,
            numberValue: term.numberValue ?? null,
            stringValue: term.stringValue ?? null,
            booleanValue: term.booleanValue ?? null,
          })),
        });
        return reply.code(204).send();
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/policy-transactions/:transactionId/rate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          requestId: z.string().uuid().optional(),
          currency: z.enum(["SEK", "DKK", "EUR", "GBP", "USD", "NOK"]).optional(),
        })
        .default({})
        .parse(request.body ?? {});
      try {
        const result = await service.rateTransaction({
          transactionId: params.transactionId,
          ...(body.requestId ? { requestId: body.requestId } : {}),
          ...(body.currency ? { currency: body.currency } : {}),
        });
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/policy-transactions/:transactionId/validate",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.validateTransaction(params.transactionId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/policy-transactions/:transactionId/commit",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ transactionId: z.string().uuid() }).parse(request.params);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.commitTransaction({
          transactionId: params.transactionId,
          idempotencyKey,
        });
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/policies/:policyId/snapshot",
    { preHandler: app.authenticate },
    async (request, reply) => {
      const params = z.object({ policyId: z.string().uuid() }).parse(request.params);
      const query = z.object({ asOf: z.string() }).parse(request.query);
      const asOf = new Date(query.asOf);
      if (Number.isNaN(asOf.getTime())) {
        return reply.code(400).send({ code: "INVALID_AS_OF", message: "Invalid asOf date" });
      }
      try {
        const result = await service.getPolicySnapshot(params.policyId, asOf);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );
};
