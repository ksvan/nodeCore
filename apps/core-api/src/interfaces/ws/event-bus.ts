import { randomUUID } from "node:crypto";
import type { EventEnvelope } from "../../contracts/events/event-envelope.js";
import { EventEnvelopeSchema } from "../../contracts/events/event-envelope.js";

interface EventSocketLike {
  readonly OPEN: number;
  readonly readyState: number;
  send(payload: string): void;
}

const subscribers = new Set<EventSocketLike>();
const businessSubscribers = new Map<EventSocketLike, BusinessEventSubscriptionFilter>();

export interface BusinessEventSubscriptionFilter {
  readonly eventTypes?: ReadonlyArray<string>;
  readonly entityTypes?: ReadonlyArray<string>;
  readonly entityIds?: ReadonlyArray<string>;
  readonly sinceOccurredAt?: string;
}

const BUSINESS_EVENT_TYPES = new Set<string>([
  "ProductCreated",
  "ProductVersionCreated",
  "ProductVersionActivated",
  "ComponentVersionReleased",
  "PricingProgramVersionReleased",
  "PolicyCreated",
  "PolicyTransactionCreated",
  "PolicyTransactionRated",
  "PolicyTransactionCommitted",
  "PolicySnapshotChanged",
  "PricingCalculated",
  "BillingAccountCreated",
  "InvoicePosted",
  "PaymentReceived",
  "PaymentAllocated",
  "InvoiceStatusChanged",
  "BillingObligationCreated",
  "InvoiceGeneratedFromPolicy",
  "PolicyFinancialPositionChanged",
]);

export const addEventSubscriber = (socket: EventSocketLike): void => {
  subscribers.add(socket);
};

export const removeEventSubscriber = (socket: EventSocketLike): void => {
  subscribers.delete(socket);
  businessSubscribers.delete(socket);
};

export const addBusinessEventSubscriber = (
  socket: EventSocketLike,
  filter?: BusinessEventSubscriptionFilter,
): void => {
  businessSubscribers.set(socket, filter ?? {});
};

export const updateBusinessEventSubscriberFilter = (
  socket: EventSocketLike,
  filter?: BusinessEventSubscriptionFilter,
): void => {
  if (!businessSubscribers.has(socket)) {
    return;
  }
  businessSubscribers.set(socket, filter ?? {});
};

const includes = (list: ReadonlyArray<string> | undefined, value: string): boolean =>
  !list || list.length === 0 || list.includes(value);

const matchesBusinessFilter = (
  envelope: EventEnvelope,
  filter: BusinessEventSubscriptionFilter,
): boolean => {
  if (!includes(filter.eventTypes, envelope.eventType)) {
    return false;
  }
  if (!includes(filter.entityTypes, envelope.entityType)) {
    return false;
  }
  if (!includes(filter.entityIds, envelope.entityId)) {
    return false;
  }
  if (filter.sinceOccurredAt) {
    const sinceMs = Date.parse(filter.sinceOccurredAt);
    const occurredMs = Date.parse(envelope.occurredAt);
    if (Number.isFinite(sinceMs) && Number.isFinite(occurredMs) && occurredMs < sinceMs) {
      return false;
    }
  }
  return true;
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

  if (BUSINESS_EVENT_TYPES.has(envelope.eventType)) {
    for (const [subscriber, filter] of businessSubscribers.entries()) {
      if (subscriber.readyState !== subscriber.OPEN) {
        continue;
      }
      if (matchesBusinessFilter(envelope, filter)) {
        subscriber.send(serialized);
      }
    }
  }

  return envelope;
};
