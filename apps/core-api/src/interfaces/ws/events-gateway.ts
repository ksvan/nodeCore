import { randomUUID } from "node:crypto";
import websocket from "@fastify/websocket";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import {
  addBusinessEventSubscriber,
  addEventSubscriber,
  removeEventSubscriber,
  updateBusinessEventSubscriberFilter,
  type BusinessEventSubscriptionFilter,
} from "./event-bus.js";

const SubscribeMessageSchema = z.object({
  type: z.literal("subscribe"),
  filters: z
    .object({
      eventTypes: z.array(z.string().min(1)).optional(),
      entityTypes: z.array(z.string().min(1)).optional(),
      entityIds: z.array(z.string().min(1)).optional(),
      sinceOccurredAt: z.string().datetime().optional(),
    })
    .optional(),
});

const toSubscriptionFilter = (raw: unknown): BusinessEventSubscriptionFilter | undefined => {
  const parsed = SubscribeMessageSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  if (!parsed.data.filters) {
    return {};
  }
  return {
    ...(parsed.data.filters.eventTypes ? { eventTypes: parsed.data.filters.eventTypes } : {}),
    ...(parsed.data.filters.entityTypes ? { entityTypes: parsed.data.filters.entityTypes } : {}),
    ...(parsed.data.filters.entityIds ? { entityIds: parsed.data.filters.entityIds } : {}),
    ...(parsed.data.filters.sinceOccurredAt
      ? { sinceOccurredAt: parsed.data.filters.sinceOccurredAt }
      : {}),
  };
};

const parseCookieHeader = (cookieHeader: string | undefined): Record<string, string> => {
  if (!cookieHeader) {
    return {};
  }
  return cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .reduce<Record<string, string>>((acc, part) => {
      const equalsAt = part.indexOf("=");
      if (equalsAt <= 0) {
        return acc;
      }
      const key = part.slice(0, equalsAt).trim();
      const value = part.slice(equalsAt + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
};

const readAuthToken = (request: FastifyRequest): string | null => {
  const authorization = request.headers.authorization;
  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice("Bearer ".length).trim();
  }
  const cookies = parseCookieHeader(request.headers.cookie);
  return cookies.nodecore_access_token ?? null;
};

const authenticateBusinessEventsRequest = async (
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  const token = readAuthToken(request);
  if (!token) {
    reply.code(401).send({ message: "Unauthorized" });
    return;
  }

  try {
    await app.jwt.verify(token);
  } catch {
    reply.code(401).send({ message: "Unauthorized" });
  }
};

export const registerEventsGateway = async (app: FastifyInstance): Promise<void> => {
  await app.register(websocket);

  app.get("/ws/events", { websocket: true }, (socket) => {
    addEventSubscriber(socket);
    socket.send(
      JSON.stringify({
        type: "subscribed",
        subscriptionId: randomUUID(),
      }),
    );
    socket.on("close", () => {
      removeEventSubscriber(socket);
    });
  });

  app.get(
    "/ws/business-events",
    {
      websocket: true,
      preHandler: (request, reply) => authenticateBusinessEventsRequest(app, request, reply),
    },
    (socket) => {
    addBusinessEventSubscriber(socket, {});
    const subscriptionId = randomUUID();
    socket.send(
      JSON.stringify({
        type: "subscribed",
        stream: "business-events",
        subscriptionId,
      }),
    );

    socket.on("message", (message: unknown) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(String(message));
      } catch {
        socket.send(
          JSON.stringify({
            type: "error",
            message: "Invalid JSON message",
          }),
        );
        return;
      }

      const filter = toSubscriptionFilter(parsed);
      if (filter === undefined) {
        socket.send(
          JSON.stringify({
            type: "error",
            message:
              "Unsupported subscription message. Use { type: 'subscribe', filters: { ... } }",
          }),
        );
        return;
      }

      updateBusinessEventSubscriberFilter(socket, filter);
      socket.send(
        JSON.stringify({
          type: "subscribed",
          stream: "business-events",
          subscriptionId,
          filters: filter,
        }),
      );
    });

    socket.on("close", () => {
      removeEventSubscriber(socket);
    });
    },
  );
};
