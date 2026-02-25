import { publishEventToSubscribers } from "./event-bus.js";
export class WsDomainEventPublisher {
    async publish(input) {
        publishEventToSubscribers(input);
    }
}
