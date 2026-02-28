"use client";

import { useEffect, useState } from "react";

type EventEnvelope = {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
};

export function EventsPanel() {
  const [events, setEvents] = useState<ReadonlyArray<EventEnvelope>>([]);
  const wsUrl = process.env.NEXT_PUBLIC_CORE_WS_URL;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !wsUrl) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data as string) as EventEnvelope;
        if (!payload.eventType) {
          return;
        }
        setEvents((prev) => [payload, ...prev].slice(0, 20));
      } catch {
        // ignore non-envelope messages
      }
    };
    return () => ws.close();
  }, [wsUrl]);

  if (process.env.NODE_ENV !== "development") {
    return null;
  }

  return (
    <div className="panel" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>Events (dev)</h3>
      <ul className="list">
        {events.map((event) => (
          <li key={event.eventId}>
            <strong>{event.eventType}</strong> <span className="muted">{event.entityType}</span>
          </li>
        ))}
      </ul>
      {events.length === 0 ? <p className="muted">No events yet.</p> : null}
    </div>
  );
}
