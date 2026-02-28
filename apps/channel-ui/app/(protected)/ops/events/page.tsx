"use client";

import { useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { JsonViewerModal } from "@/components/json-viewer-modal";
import { useEffect } from "react";

type EventEnvelope = {
  eventId: string;
  eventType: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  data?: Record<string, unknown>;
};

const summarize = (event: EventEnvelope): string => {
  if (!event.data) {
    return "-";
  }
  const json = JSON.stringify(event.data);
  if (json.length <= 120) {
    return json;
  }
  return `${json.slice(0, 117)}...`;
};

export default function OpsEventsPage() {
  const [events, setEvents] = useState<ReadonlyArray<EventEnvelope>>([]);
  const [paused, setPaused] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventEnvelope | null>(null);

  const wsUrl = process.env.NEXT_PUBLIC_CORE_WS_URL;

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    ws.onmessage = (message) => {
      if (paused) {
        return;
      }
      try {
        const payload = JSON.parse(message.data as string) as EventEnvelope;
        if (!payload.eventType) {
          return;
        }
        setEvents((prev) => [payload, ...prev].slice(0, 100));
      } catch {
        // ignore non-envelope messages
      }
    };

    return () => ws.close();
  }, [paused, wsUrl]);

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const byType = eventTypeFilter.trim()
          ? event.eventType.toLowerCase().includes(eventTypeFilter.toLowerCase())
          : true;
        const byEntity = entityIdFilter.trim() ? event.entityId.includes(entityIdFilter.trim()) : true;
        return byType && byEntity;
      }),
    [entityIdFilter, eventTypeFilter, events],
  );

  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Events Viewer</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Live WebSocket events stream from <code>/ws/events</code>.
        </p>

        {!wsUrl ? (
          <div className="error-box">
            Set <code>NEXT_PUBLIC_CORE_WS_URL</code> to connect, for example
            <code> ws://localhost:4000/ws/events</code>.
          </div>
        ) : null}

        <div className="row">
          <input
            placeholder="Filter eventType"
            value={eventTypeFilter}
            onChange={(event) => setEventTypeFilter(event.target.value)}
          />
          <input
            placeholder="Filter entityId"
            value={entityIdFilter}
            onChange={(event) => setEntityIdFilter(event.target.value)}
          />
          <button onClick={() => setPaused((current) => !current)}>{paused ? "Resume" : "Pause"}</button>
          <button onClick={() => setEvents([])}>Clear</button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Events ({filtered.length})</h2>
        <DataTable headers={["Occurred At", "Type", "Entity", "Entity ID", "Summary", "Actions"]}>
          {filtered.map((event) => (
            <tr key={event.eventId}>
              <td>{new Date(event.occurredAt).toLocaleString()}</td>
              <td>{event.eventType}</td>
              <td>{event.entityType}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{event.entityId}</td>
              <td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {summarize(event)}
              </td>
              <td>
                <div className="row" style={{ gap: 6 }}>
                  <button onClick={() => setSelectedEvent(event)}>View JSON</button>
                  <button
                    onClick={() => {
                      void navigator.clipboard.writeText(JSON.stringify(event, null, 2));
                    }}
                  >
                    Copy JSON
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </section>

      <JsonViewerModal
        title="Event JSON"
        open={Boolean(selectedEvent)}
        value={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}
