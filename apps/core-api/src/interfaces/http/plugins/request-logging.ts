import type { FastifyInstance } from "fastify";

export const registerRequestLogging = (app: FastifyInstance): void => {
  app.addHook("onRequest", (request, _reply, done) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      "request.start",
    );
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    request.log.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
      },
      "request.end",
    );
    done();
  });
};
