import { randomUUID } from "node:crypto";
import { EventEnvelopeSchema } from "../../contracts/events/event-envelope.js";
const subscribers = new Set();
export const addEventSubscriber = (socket) => {
    subscribers.add(socket);
};
export const removeEventSubscriber = (socket) => {
    subscribers.delete(socket);
};
export const publishEventToSubscribers = (input) => {
    const envelope = EventEnvelopeSchema.parse({
        eventId: randomUUID(),
        eventType: input.eventType,
        entityType: input.entityType,
        entityId: input.entityId,
        occurredAt: new Date().toISOString(),
        data: input.data,
    });
    const serialized = JSON.stringify(envelope);
    for (const subscriber of subscribers) {
        if (subscriber.readyState === subscriber.OPEN) {
            subscriber.send(serialized);
        }
    }
    return envelope;
};
