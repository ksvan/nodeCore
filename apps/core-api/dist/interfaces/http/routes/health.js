import { z } from "zod";
const HealthResponseSchema = z.object({
    status: z.literal("ok"),
    service: z.literal("core-api"),
    timestamp: z.string().datetime(),
});
export const registerHealthRoute = (app) => {
    app.get("/health", async () => {
        return HealthResponseSchema.parse({
            status: "ok",
            service: "core-api",
            timestamp: new Date().toISOString(),
        });
    });
};
