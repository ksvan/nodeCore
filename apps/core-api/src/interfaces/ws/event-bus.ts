import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "../../contracts/events/event-envelope.js";
import { EventEnvelopeSchema } from "../../contracts/events/event-envelope.js";

interface EventSocketLike {
  readonly OPEN: number;
  readonly readyState: number;
  send(payload: string): void;
}

const subscribers = new Set<EventSocketLike>();

export const addEventSubscriber = (socket: EventSocketLike): void => {
  subscribers.add(socket);
};

export const removeEventSubscriber = (socket: EventSocketLike): void => {
  subscribers.delete(socket);
};

export const publishEventToSubscribers = (input: {
  eventType: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
}): EventEnvelope => {
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
