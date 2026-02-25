import type { DomainEventPublisher } from "../../application/product-management/ports/repositories.js";
import { publishEventToSubscribers } from "./event-bus.js";

export class WsDomainEventPublisher implements DomainEventPublisher {
  public async publish(input: {
    eventType: string;
    entityType: string;
    entityId: string;
    data: Record<string, unknown>;
  }): Promise<void> {
    publishEventToSubscribers(input);
  }
}
