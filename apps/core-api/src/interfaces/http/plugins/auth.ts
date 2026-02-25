import fastifyJwt from "@fastify/jwt";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export const registerAuthPlugin = async (app: FastifyInstance): Promise<void> => {
  const secret = process.env.JWT_SECRET ?? "unsafe-dev-secret";

  await app.register(fastifyJwt, {
    secret,
    sign: {
      expiresIn: "15m",
    },
  });

  app.decorate("authenticate", async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      reply.code(401).send({ message: "Unauthorized" });
    }
  });
};
