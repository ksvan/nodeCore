import { z } from "zod";
import type { FastifyInstance } from "fastify";

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("core-api"),
  timestamp: z.string().datetime(),
});

const RootResponseSchema = z.object({
  service: z.literal("core-api"),
  message: z.string().min(1),
  health: z.literal("/health"),
  channelUi: z.string().url(),
});

export const registerHealthRoute = (app: FastifyInstance): void => {
  app.get("/", async () =>
    RootResponseSchema.parse({
      service: "core-api",
      message:
        "core-api is running. This is an API service. Open the channel UI for pages.",
      health: "/health",
      channelUi: process.env.CHANNEL_UI_URL ?? "http://localhost:3000",
    }),
  );

  app.get("/health", async () => {
    return HealthResponseSchema.parse({
      status: "ok",
      service: "core-api",
      timestamp: new Date().toISOString(),
    });
  });
};
