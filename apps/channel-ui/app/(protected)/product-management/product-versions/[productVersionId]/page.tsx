"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { StatusBadge } from "@/components/status-badge";
import { productManagementApi } from "@/lib/api/product-management";
import {
  ApiClientError,
  type ProductVersionComponentRefDto,
  type ProductVersionDto,
  type ProductVersionSnapshotDto,
} from "@/lib/api/types";

export default function ProductVersionPage() {
  const params = useParams<{ productVersionId: string }>();
  const productVersionId = useMemo(() => String(params.productVersionId), [params.productVersionId]);

  const [version, setVersion] = useState<ProductVersionDto | null>(null);
  const [refs, setRefs] = useState<ReadonlyArray<ProductVersionComponentRefDto>>([]);
  const [snapshot, setSnapshot] = useState<ProductVersionSnapshotDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [componentVersionId, setComponentVersionId] = useState("");
  const [configOverrides, setConfigOverrides] = useState("{}");

  const load = async () => {
    try {
      const [versionData, refsData, snapshotData] = await Promise.all([
        productManagementApi.getProductVersion(productVersionId),
        productManagementApi.listProductVersionComponentRefs(productVersionId),
        productManagementApi.getProductVersionSnapshot(productVersionId),
      ]);
      setVersion(versionData);
      setRefs(refsData);
      setSnapshot(snapshotData);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, [productVersionId]);

  const onAddReference = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await productManagementApi.addProductVersionComponentRef(productVersionId, {
        componentVersionId,
        configOverrides: JSON.parse(configOverrides || "{}") as Record<string, unknown>,
      });
      setComponentVersionId("");
      setConfigOverrides("{}");
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Add reference failed";
      setError(message);
    }
  };

  const onActivate = async () => {
    try {
      await productManagementApi.activateProductVersion(productVersionId);
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Activate failed";
      setError(message);
    }
  };

  const onRetire = async () => {
    try {
      await productManagementApi.retireProductVersion(productVersionId);
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Retire failed";
      setError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Product Version {version?.version ?? "-"}</h1>
          {version ? <StatusBadge status={version.status} /> : null}
        </div>

        {error ? <div className="error-box">{error}</div> : null}

        <div className="row">
          <button className="primary" disabled={version?.status !== "DRAFT"} onClick={onActivate}>
            Activate
          </button>
          <button disabled={version?.status !== "ACTIVE"} onClick={onRetire}>
            Retire
          </button>
        </div>

        <div className="stack">
          <h3 style={{ marginBottom: 0 }}>Component References</h3>
          <ul className="list">
            {refs.map((ref) => (
              <li key={ref.id} className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div>
                    <strong>{ref.componentVersion.component.type}</strong> v{ref.componentVersion.version}
                  </div>
                  <div className="muted">{ref.componentVersionId}</div>
                </div>
                <button
                  disabled={version?.status !== "DRAFT"}
                  onClick={async () => {
                    await productManagementApi.removeProductVersionComponentRef(
                      productVersionId,
                      ref.componentVersionId,
                    );
                    await load();
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Add Component Version Reference</h2>
        <form className="stack" onSubmit={onAddReference}>
          <div className="stack">
            <label>Component Version ID</label>
            <input
              value={componentVersionId}
              onChange={(event) => setComponentVersionId(event.target.value)}
              disabled={version?.status !== "DRAFT"}
              required
            />
          </div>
          <JsonEditor label="Config Overrides JSON" value={configOverrides} onChange={setConfigOverrides} />
          <button className="primary" type="submit" disabled={version?.status !== "DRAFT"}>
            Add Reference
          </button>
        </form>

        <h3>Resolved Snapshot</h3>
        {version?.status === "ACTIVE" && snapshot ? (
          <JsonEditor
            label="Resolved Snapshot JSON"
            value={JSON.stringify(snapshot.resolvedSnapshot, null, 2)}
            onChange={() => undefined}
            readOnly
            height="320px"
          />
        ) : (
          <p className="muted">Snapshot available after activation.</p>
        )}
      </section>
    </div>
  );
}
