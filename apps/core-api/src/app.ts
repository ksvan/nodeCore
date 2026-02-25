import Fastify from "fastify";
import { registerAuthPlugin } from "./interfaces/http/plugins/auth.js";
import { registerRequestLogging } from "./interfaces/http/plugins/request-logging.js";
import { registerHealthRoute } from "./interfaces/http/routes/health.js";
import { registerProductManagementRoutes } from "./interfaces/http/routes/product-management.js";
import { registerEventsGateway } from "./interfaces/ws/events-gateway.js";
import { getPrismaClient } from "./infrastructure/persistence/prisma/client.js";

export const buildApp = async () => {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? "info",
      base: {
        service: "core-api",
      },
    },
  });

  await registerAuthPlugin(app);
  await registerRequestLogging(app);
  await registerEventsGateway(app);
  await registerHealthRoute(app);
  await registerProductManagementRoutes(app);

  app.addHook("onReady", async () => {
    const prisma = getPrismaClient();
    await prisma.$connect();
  });

  app.addHook("onClose", async () => {
    const prisma = getPrismaClient();
    await prisma.$disconnect();
  });

  return app;
};
