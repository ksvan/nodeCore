"use client";

import { useEffect, useMemo, useState } from "react";
import { DataTable } from "@/components/data-table";
import { JsonViewerModal } from "@/components/json-viewer-modal";

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
  return json.length <= 120 ? json : `${json.slice(0, 117)}...`;
};

const parseList = (raw: string): ReadonlyArray<string> =>
  raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

export function EventStreamViewer({
  title,
  description,
  wsUrl,
  wsEndpointHint,
  supportsSubscribeFilters = false,
}: {
  title: string;
  description: string;
  wsUrl: string | undefined;
  wsEndpointHint: string;
  supportsSubscribeFilters?: boolean;
}) {
  const [events, setEvents] = useState<ReadonlyArray<EventEnvelope>>([]);
  const [paused, setPaused] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState("");
  const [entityTypeFilter, setEntityTypeFilter] = useState("");
  const [entityIdFilter, setEntityIdFilter] = useState("");
  const [sinceOccurredAt, setSinceOccurredAt] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventEnvelope | null>(null);

  useEffect(() => {
    if (!wsUrl) {
      return;
    }

    const ws = new WebSocket(wsUrl);
    ws.onopen = () => {
      if (!supportsSubscribeFilters) {
        return;
      }
      ws.send(
        JSON.stringify({
          type: "subscribe",
          filters: {
            eventTypes: parseList(eventTypeFilter),
            entityTypes: parseList(entityTypeFilter),
            entityIds: parseList(entityIdFilter),
            ...(sinceOccurredAt.trim() ? { sinceOccurredAt: sinceOccurredAt.trim() } : {}),
          },
        }),
      );
    };

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
  }, [
    entityIdFilter,
    entityTypeFilter,
    eventTypeFilter,
    paused,
    sinceOccurredAt,
    supportsSubscribeFilters,
    wsUrl,
  ]);

  const filtered = useMemo(
    () =>
      events.filter((event) => {
        const byEventType = eventTypeFilter.trim()
          ? event.eventType.toLowerCase().includes(eventTypeFilter.toLowerCase())
          : true;
        const byEntityType = entityTypeFilter.trim()
          ? event.entityType.toLowerCase().includes(entityTypeFilter.toLowerCase())
          : true;
        const byEntityId = entityIdFilter.trim() ? event.entityId.includes(entityIdFilter.trim()) : true;
        return byEventType && byEntityType && byEntityId;
      }),
    [entityIdFilter, entityTypeFilter, eventTypeFilter, events],
  );

  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>{title}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          {description}
        </p>

        {!wsUrl ? (
          <div className="error-box">
            WebSocket URL is not set for this stream. Expected endpoint: <code>{wsEndpointHint}</code>
          </div>
        ) : null}

        <div className="row">
          <input
            placeholder="eventType filter (or comma list)"
            value={eventTypeFilter}
            onChange={(event) => setEventTypeFilter(event.target.value)}
          />
          <input
            placeholder="entityType filter (or comma list)"
            value={entityTypeFilter}
            onChange={(event) => setEntityTypeFilter(event.target.value)}
          />
          <input
            placeholder="entityId filter (or comma list)"
            value={entityIdFilter}
            onChange={(event) => setEntityIdFilter(event.target.value)}
          />
        </div>

        {supportsSubscribeFilters ? (
          <div className="row">
            <input
              placeholder="sinceOccurredAt (ISO datetime, optional)"
              value={sinceOccurredAt}
              onChange={(event) => setSinceOccurredAt(event.target.value)}
            />
            <span className="muted">Server best-effort subscribe filtering enabled.</span>
          </div>
        ) : null}

        <div className="row">
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
