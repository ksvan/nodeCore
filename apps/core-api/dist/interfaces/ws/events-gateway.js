import { randomUUID } from "node:crypto";
import websocket from "@fastify/websocket";
import { addEventSubscriber, removeEventSubscriber } from "./event-bus.js";
export const registerEventsGateway = async (app) => {
    await app.register(websocket);
    app.get("/ws/events", { websocket: true }, (socket) => {
        addEventSubscriber(socket);
        socket.send(JSON.stringify({
            type: "subscribed",
            subscriptionId: randomUUID(),
        }));
        socket.on("close", () => {
            removeEventSubscriber(socket);
        });
    });
};
