import { z } from "zod";
import type { FastifyInstance } from "fastify";

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("core-api"),
  timestamp: z.string().datetime(),
});

export const registerHealthRoute = (app: FastifyInstance): void => {
  app.get("/health", async () => {
    return HealthResponseSchema.parse({
      status: "ok",
      service: "core-api",
      timestamp: new Date().toISOString(),
    });
  });
};
