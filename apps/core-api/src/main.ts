import { buildApp } from "./app.js";

const start = async (): Promise<void> => {
  const app = await buildApp();
  const port = Number(process.env.PORT ?? 4000);
  const host = process.env.HOST ?? "0.0.0.0";

  await app.listen({ port, host });
};

start().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
