"use client";

import { useState } from "react";

export default function OpsAuditPage() {
  const [entityId, setEntityId] = useState("");
  const [entityType, setEntityType] = useState("");

  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Audit Viewer</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Search audit records by entity ID and optional entity type.
        </p>

        <div className="row">
          <input
            placeholder="Entity ID"
            value={entityId}
            onChange={(event) => setEntityId(event.target.value)}
          />
          <input
            placeholder="Entity Type (optional)"
            value={entityType}
            onChange={(event) => setEntityType(event.target.value)}
          />
          <button disabled>Search</button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Backend Endpoint Required</h2>
        <p className="muted" style={{ margin: 0 }}>
          Audit viewer UI is ready, but the backend endpoint is not implemented yet.
        </p>
        <p className="muted" style={{ margin: 0 }}>
          Required API: <code>GET /v1/ops/audit?entityId=...&entityType=...</code>
        </p>
        <p className="muted" style={{ margin: 0 }}>
          TODO (core-api): expose audit-log query endpoint with fields: occurredAt, actor, action, correlationId,
          summary/data.
        </p>
      </section>
    </div>
  );
}
