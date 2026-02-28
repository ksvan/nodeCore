import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import { CurrencyCodeSchema } from "@nodecore/contracts/pricing";
import { ProductManagementApplicationError } from "../../../application/product-management/services/errors.js";
import { ProductManagementService } from "../../../application/product-management/services/product-management-service.js";
import { ProductManagementDomainError } from "../../../domain/product-management/errors.js";
import { PrismaProductManagementRepository } from "../../../infrastructure/product-management/prisma-product-management-repository.js";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";
import { WsDomainEventPublisher } from "../../ws/ws-domain-event-publisher.js";

const ProductStatusSchema = z.enum(["DRAFT", "ACTIVE", "RETIRED"]);
const ComponentVersionStatusSchema = z.enum(["DRAFT", "ACTIVE", "RETIRED"]);
const PricingProgramVersionStatusSchema = z.enum(["DRAFT", "ACTIVE", "RETIRED"]);
const ComponentTypeSchema = z.enum(["COVERAGE", "EXPOSURE", "RULE"]);

const JsonObjectSchema = z.record(z.unknown());

const service = new ProductManagementService(
  new PrismaProductManagementRepository(getPrismaClient()),
  new WsDomainEventPublisher(),
);

const sendError = (reply: FastifyReply, error: unknown): void => {
  if (error instanceof ProductManagementApplicationError) {
    void reply.code(error.statusCode).send({ message: error.message });
    return;
  }
  if (error instanceof ProductManagementDomainError) {
    void reply.code(400).send({ message: error.message });
    return;
  }
  void reply.code(500).send({ message: "Internal server error" });
};

export const registerProductManagementRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/v1/product-management/products", async (request, reply) => {
    const body = z
      .object({
        productCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        status: ProductStatusSchema.optional(),
      })
      .parse(request.body);

    try {
      const product = await service.createProduct({
        productCode: body.productCode,
        name: body.name,
        description: body.description ?? null,
        ...(body.status ? { status: body.status } : {}),
      });
      return reply.code(201).send(product);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get("/v1/product-management/products", async (_request, reply) => {
    const products = await service.listProducts();
    return reply.send(products);
  });

  app.get("/v1/product-management/products/:productId", async (request, reply) => {
    const params = z.object({ productId: z.string().uuid() }).parse(request.params);
    try {
      const product = await service.getProductById(params.productId);
      return reply.send(product);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.patch("/v1/product-management/products/:productId", async (request, reply) => {
    const params = z.object({ productId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        name: z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        status: ProductStatusSchema.optional(),
      })
      .parse(request.body);

    try {
      const patch: Partial<{ name: string; description: string | null; status: "DRAFT" | "ACTIVE" | "RETIRED" }> = {};
      if (body.name !== undefined) {
        patch.name = body.name;
      }
      if (body.description !== undefined) {
        patch.description = body.description;
      }
      if (body.status !== undefined) {
        patch.status = body.status;
      }

      const product = await service.updateProduct(params.productId, patch);
      return reply.send(product);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.delete("/v1/product-management/products/:productId", async (request, reply) => {
    const params = z.object({ productId: z.string().uuid() }).parse(request.params);
    const result = await service.deleteProduct(params.productId);
    return reply.send(result);
  });

  app.post("/v1/product-management/products/:productId/versions", async (request, reply) => {
    const params = z.object({ productId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        effectiveFrom: z.string().datetime(),
        effectiveTo: z.string().datetime().nullable().optional(),
        policySchema: JsonObjectSchema.optional(),
        exposureSchemas: JsonObjectSchema.optional(),
        pricingInputSchema: JsonObjectSchema.optional(),
        defaultCurrency: CurrencyCodeSchema.optional(),
        allowedCurrencies: z.array(CurrencyCodeSchema).optional(),
        pricingProgramVersionId: z.string().uuid().nullable().optional(),
      })
      .parse(request.body);

    try {
      const productVersion = await service.createProductVersionDraft({
        productId: params.productId,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : null,
        policySchema: body.policySchema ?? {},
        exposureSchemas: body.exposureSchemas ?? {},
        pricingInputSchema: body.pricingInputSchema ?? {},
        ...(body.defaultCurrency ? { defaultCurrency: body.defaultCurrency } : {}),
        ...(body.allowedCurrencies ? { allowedCurrencies: body.allowedCurrencies } : {}),
        pricingProgramVersionId: body.pricingProgramVersionId ?? null,
      });
      return reply.code(201).send(productVersion);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get("/v1/product-management/products/:productId/versions", async (request, reply) => {
    const params = z.object({ productId: z.string().uuid() }).parse(request.params);
    try {
      const rows = await service.listProductVersions(params.productId);
      return reply.send(rows);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get("/v1/product-management/product-versions/:productVersionId", async (request, reply) => {
    const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
    try {
      const row = await service.getProductVersion(params.productVersionId);
      return reply.send(row);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get(
    "/v1/product-management/product-versions/:productVersionId/components",
    async (request, reply) => {
      const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
      try {
        const rows = await service.listProductVersionComponentRefs(params.productVersionId);
        return reply.send(rows);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/product-management/product-versions/:productVersionId/snapshot",
    async (request, reply) => {
      const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
      try {
        const snapshot = await service.getProductVersionSnapshot(params.productVersionId);
        return reply.send(snapshot);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post("/v1/product-management/product-versions/:productVersionId/components", async (request, reply) => {
    const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        componentVersionId: z.string().uuid(),
        configOverrides: JsonObjectSchema.optional(),
      })
      .parse(request.body);
    try {
      const ref = await service.addComponentVersionReference({
        productVersionId: params.productVersionId,
        componentVersionId: body.componentVersionId,
        configOverrides: body.configOverrides ?? {},
      });
      return reply.code(201).send(ref);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.delete(
    "/v1/product-management/product-versions/:productVersionId/components/:componentVersionId",
    async (request, reply) => {
      const params = z
        .object({
          productVersionId: z.string().uuid(),
          componentVersionId: z.string().uuid(),
        })
        .parse(request.params);
      try {
        const result = await service.removeComponentVersionReference(params);
        return reply.send(result);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post("/v1/product-management/product-versions/:productVersionId/activate", async (request, reply) => {
    const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
    try {
      const result = await service.activateProductVersion(params.productVersionId);
      return reply.send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/product-management/product-versions/:productVersionId/retire", async (request, reply) => {
    const params = z.object({ productVersionId: z.string().uuid() }).parse(request.params);
    try {
      const result = await service.retireProductVersion(params.productVersionId);
      return reply.send(result);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/product-management/components", async (request, reply) => {
    const body = z
      .object({
        componentCode: z.string().min(1),
        type: ComponentTypeSchema,
        name: z.string().min(1),
        description: z.string().nullable().optional(),
      })
      .parse(request.body);

    const component = await service.createComponent({
      componentCode: body.componentCode,
      type: body.type,
      name: body.name,
      description: body.description ?? null,
    });
    return reply.code(201).send(component);
  });

  app.get("/v1/product-management/components", async (request, reply) => {
    const query = z
      .object({
        type: ComponentTypeSchema.optional(),
      })
      .parse(request.query);

    const components = await service.listComponents(query.type);
    return reply.send(components);
  });

  app.get("/v1/product-management/components/:componentId", async (request, reply) => {
    const params = z.object({ componentId: z.string().uuid() }).parse(request.params);
    try {
      const row = await service.getComponent(params.componentId);
      return reply.send(row);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get("/v1/product-management/components/:componentId/versions", async (request, reply) => {
    const params = z.object({ componentId: z.string().uuid() }).parse(request.params);
    try {
      const rows = await service.listComponentVersions(params.componentId);
      return reply.send(rows);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.post("/v1/product-management/components/:componentId/versions", async (request, reply) => {
    const params = z.object({ componentId: z.string().uuid() }).parse(request.params);
    const body = z
      .object({
        schema: JsonObjectSchema,
        metadata: JsonObjectSchema.optional(),
        status: ComponentVersionStatusSchema.optional(),
      })
      .parse(request.body);

    try {
      const componentVersion = await service.createComponentVersion({
        componentId: params.componentId,
        schema: body.schema,
        metadata: body.metadata ?? {},
        ...(body.status ? { status: body.status } : {}),
      });
      return reply.code(201).send(componentVersion);
    } catch (error: unknown) {
      sendError(reply, error);
    }
  });

  app.get(
    "/v1/product-management/components/:componentId/versions/:version",
    async (request, reply) => {
      const params = z
        .object({
          componentId: z.string().uuid(),
          version: z.coerce.number().int().positive(),
        })
        .parse(request.params);
      try {
        const componentVersion = await service.getComponentVersionByCompositeKey(
          params.componentId,
          params.version,
        );
        return reply.send(componentVersion);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post("/v1/product-management/pricing-programs", async (request, reply) => {
    const body = z
      .object({
        programCode: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
      })
      .parse(request.body);

    const pricingProgram = await service.createPricingProgram({
      programCode: body.programCode,
      name: body.name,
      description: body.description ?? null,
    });
    return reply.code(201).send(pricingProgram);
  });

  app.get("/v1/product-management/pricing-programs", async (_request, reply) => {
    const rows = await service.listPricingPrograms();
    return reply.send(rows);
  });

  app.get(
    "/v1/product-management/pricing-programs/:pricingProgramId",
    async (request, reply) => {
      const params = z.object({ pricingProgramId: z.string().uuid() }).parse(request.params);
      try {
        const row = await service.getPricingProgram(params.pricingProgramId);
        return reply.send(row);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.get(
    "/v1/product-management/pricing-programs/:pricingProgramId/versions",
    async (request, reply) => {
      const params = z.object({ pricingProgramId: z.string().uuid() }).parse(request.params);
      try {
        const rows = await service.listPricingProgramVersions(params.pricingProgramId);
        return reply.send(rows);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );

  app.post(
    "/v1/product-management/pricing-programs/:pricingProgramId/versions",
    async (request, reply) => {
      const params = z.object({ pricingProgramId: z.string().uuid() }).parse(request.params);
      const body = z
        .object({
          fileRef: z.string().min(1),
          inputSchema: JsonObjectSchema.optional(),
          outputSchema: JsonObjectSchema.optional(),
          metadata: JsonObjectSchema.optional(),
          status: PricingProgramVersionStatusSchema.optional(),
        })
        .parse(request.body);

      try {
        const pricingProgramVersion = await service.createPricingProgramVersion({
          pricingProgramId: params.pricingProgramId,
          fileRef: body.fileRef,
          inputSchema: body.inputSchema ?? {},
          outputSchema: body.outputSchema ?? {},
          metadata: body.metadata ?? {},
          ...(body.status ? { status: body.status } : {}),
        });
        return reply.code(201).send(pricingProgramVersion);
      } catch (error: unknown) {
        sendError(reply, error);
      }
    },
  );
};
