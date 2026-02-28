import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { BillingService } from "../../../application/billing/services/billing-service.js";
import { BillingApplicationError } from "../../../application/billing/services/errors.js";
import { BillingDomainError } from "../../../domain/billing/errors.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { PrismaBillingRepository } from "../../../infrastructure/billing/prisma-billing-repository.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const CurrencyCodeSchema = z.enum(["SEK", "DKK", "EUR", "GBP", "USD", "NOK"]);

const service = new BillingService(
  new PrismaBillingRepository(getPrismaClient()),
  new WsDomainEventPublisher(),
);

const sendError = (reply: FastifyReply, error: unknown): void => {
  if (error instanceof BillingApplicationError) {
    void reply.code(error.statusCode).send({
      code: error.code,
      message: error.message,
    });
    return;
  }
  if (error instanceof BillingDomainError) {
    void reply.code(400).send({
      code: "BILLING_DOMAIN_ERROR",
      message: error.message,
    });
    return;
  }
  void reply.code(500).send({
    code: "INTERNAL_ERROR",
    message: "Billing operation failed",
  });
};

const requireIdempotencyKey = (value: unknown): string => {
  const parsed = z.string().min(1).safeParse(value);
  if (!parsed.success) {
    throw new BillingApplicationError(
      "IDEMPOTENCY_KEY_REQUIRED",
      "Idempotency-Key header is required",
      400,
    );
  }
  return parsed.data;
};

export const registerBillingRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    "/v1/billing/accounts",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const body = z.object({ partyId: z.string().uuid() }).parse(request.body);
      try {
        const result = await service.createBillingAccount({ partyId: body.partyId });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/billing/accounts",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const query = z
        .object({
          query: z.string().min(1).optional(),
        })
        .parse(request.query);
      const result = await service.listBillingAccounts(query.query);
      return reply.send(result);
    },
  );

  app.get(
    "/v1/billing/accounts/:accountId",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ accountId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.getBillingAccount(params.accountId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/billing/accounts/:accountId/invoices",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ accountId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          dueDate: z.string().datetime(),
          currency: CurrencyCodeSchema,
          lines: z
            .array(
              z.object({
                description: z.string().min(1),
                quantity: z.string().min(1),
                unitAmount: z.string().min(1),
              }),
            )
            .min(1),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.createAndPostInvoice({
          accountId: params.accountId,
          dueDate: new Date(body.dueDate),
          currency: body.currency,
          lines: body.lines,
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/billing/accounts/:accountId/invoices",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ accountId: z.string().uuid() }).parse(request.params);
      const result = await service.listInvoices(params.accountId);
      return reply.send(result);
    },
  );

  app.get(
    "/v1/billing/invoices/:invoiceId",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ invoiceId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.getInvoice(params.invoiceId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/billing/obligations/:obligationId/invoice",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ obligationId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          dueDate: z.string().datetime(),
          billingAccountId: z.string().uuid().nullable().optional(),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.generateInvoiceFromObligation({
          obligationId: params.obligationId,
          dueDate: new Date(body.dueDate),
          billingAccountId: body.billingAccountId ?? null,
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/billing/payments",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const body = z
        .object({
          accountId: z.string().uuid(),
          amount: z.string().min(1),
          currency: CurrencyCodeSchema,
          providerRef: z.string().nullable().optional(),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.recordPayment({
          accountId: body.accountId,
          amount: body.amount,
          currency: body.currency,
          providerRef: body.providerRef ?? null,
          idempotencyKey,
        });
        return reply.code(201).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/billing/accounts/:accountId/payments",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ accountId: z.string().uuid() }).parse(request.params);
      const result = await service.listPayments(params.accountId);
      return reply.send(result);
    },
  );

  app.get(
    "/v1/billing/payments/:paymentId",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ paymentId: z.string().uuid() }).parse(request.params);
      try {
        const result = await service.getPayment(params.paymentId);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/billing/payments/:paymentId/allocate",
    {
      preHandler: app.authenticate,
    },
    async (request, reply) => {
      const params = z.object({ paymentId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          allocations: z
            .array(
              z.object({
                invoiceId: z.string().uuid(),
                amount: z.string().min(1),
              }),
            )
            .min(1),
        })
        .parse(request.body);
      try {
        const idempotencyKey = requireIdempotencyKey(request.headers["idempotency-key"]);
        const result = await service.allocatePayment({
          paymentId: params.paymentId,
          allocations: body.allocations,
          idempotencyKey,
        });
        return reply.code(200).send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );
};
