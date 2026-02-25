import { z } from "zod";
export const EventEnvelopeSchema = z.object({
    eventId: z.string().uuid(),
    eventType: z.string().min(1),
    entityType: z.string().min(1),
    entityId: z.string().uuid(),
    occurredAt: z.string().datetime(),
    data: z.record(z.unknown()),
});
