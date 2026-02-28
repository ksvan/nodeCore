import { timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { getPrismaClient } from "../../../infrastructure/persistence/prisma/client.js";

const LoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const normalize = (value: string): Buffer => Buffer.from(value.normalize("NFKC"));

const safeEquals = (a: string, b: string): boolean => {
  const left = normalize(a);
  const right = normalize(b);
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};

const verifyPassword = async (password: string, storedHash: string): Promise<boolean> => {
  if (storedHash.startsWith("plain:")) {
    return safeEquals(password, storedHash.slice("plain:".length));
  }
  return safeEquals(password, storedHash);
};

export const registerAuthRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post("/auth/login", async (request, reply) => {
    const body = LoginBodySchema.parse(request.body);
    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!user) {
      return reply.code(401).send({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
    }

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) {
      return reply.code(401).send({ code: "INVALID_CREDENTIALS", message: "Invalid credentials" });
    }

    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 60 * 15;
    const token = await reply.jwtSign(
      {
        sub: user.id,
        iss: process.env.JWT_ISSUER ?? "nodecore-local",
        aud: process.env.JWT_AUDIENCE ?? "nodecore-ui",
        roles: user.roles,
        iat: now,
      },
      {
        expiresIn,
      },
    );

    return reply.send({
      accessToken: token,
      tokenType: "Bearer",
      expiresIn,
      user: {
        id: user.id,
        email: user.email,
        roles: user.roles,
      },
    });
  });
};
