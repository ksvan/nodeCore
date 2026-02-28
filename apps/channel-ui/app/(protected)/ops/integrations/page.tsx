export default function OpsIntegrationsPage() {
  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Integration Failures & Retries</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Operational overview for outbox/integration delivery health.
        </p>
      </section>

      <section className="grid grid-2">
        <article className="panel stack">
          <h3 style={{ margin: 0 }}>Outbox Backlog</h3>
          <p className="muted" style={{ margin: 0 }}>
            Backend endpoint required.
          </p>
        </article>
        <article className="panel stack">
          <h3 style={{ margin: 0 }}>Failed Deliveries</h3>
          <p className="muted" style={{ margin: 0 }}>
            Backend endpoint required.
          </p>
        </article>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>TODO (core-api)</h2>
        <p className="muted" style={{ margin: 0 }}>
          Add endpoints for integration operations, for example:
        </p>
        <p className="muted" style={{ margin: 0 }}>
          <code>GET /v1/ops/integrations/outbox</code>, <code>GET /v1/ops/integrations/failures</code>, and
          <code> POST /v1/ops/integrations/retry</code>.
        </p>
      </section>
    </div>
  );
}
