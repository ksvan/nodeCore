import fastifyJwt from "@fastify/jwt";
export const registerAuthPlugin = async (app) => {
    const secret = process.env.JWT_SECRET ?? "unsafe-dev-secret";
    await app.register(fastifyJwt, {
        secret,
        sign: {
            expiresIn: "15m",
        },
    });
    app.decorate("authenticate", async (request, reply) => {
        try {
            await request.jwtVerify();
        }
        catch {
            reply.code(401).send({ message: "Unauthorized" });
        }
    });
};
