"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { StatusBadge } from "@/components/status-badge";
import {
  componentSnippets,
  coverageComponentTemplate,
  exposureComponentTemplate,
  ruleComponentTemplate,
} from "@/lib/json-templates";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type ComponentDto, type ComponentVersionDto } from "@/lib/api/types";

export default function ComponentDetailPage() {
  const params = useParams<{ componentId: string }>();
  const componentId = useMemo(() => String(params.componentId), [params.componentId]);
  const [component, setComponent] = useState<ComponentDto | null>(null);
  const [versions, setVersions] = useState<ReadonlyArray<ComponentVersionDto>>([]);
  const [schemaText, setSchemaText] = useState("{}");
  const [metadataText, setMetadataText] = useState("{}");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [componentData, versionData] = await Promise.all([
        productManagementApi.getComponent(componentId),
        productManagementApi.listComponentVersions(componentId),
      ]);
      setComponent(componentData);
      setVersions(versionData);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, [componentId]);

  const onCreateVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await productManagementApi.createComponentVersion(componentId, {
        schema: JSON.parse(schemaText || "{}") as Record<string, unknown>,
        metadata: JSON.parse(metadataText || "{}") as Record<string, unknown>,
        status,
      });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create version failed";
      setError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>{component?.name ?? "Component"}</h1>
        <p className="muted">{component?.componentCode}</p>
        {error ? <div className="error-box">{error}</div> : null}

        <h3>Versions</h3>
        <ul className="list">
          {versions.map((version) => (
            <li key={version.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>v{version.version}</strong>
                <div className="muted">{new Date(version.createdAt).toLocaleString()}</div>
              </div>
              <StatusBadge status={version.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Version</h2>
        <form className="stack" onSubmit={onCreateVersion}>
          <div className="stack">
            <label>Status</label>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RETIRED">RETIRED</option>
            </select>
          </div>
          <JsonEditor
            label="Definition Schema JSON"
            value={schemaText}
            onChange={setSchemaText}
            templates={
              component?.type === "COVERAGE"
                ? [coverageComponentTemplate]
                : component?.type === "EXPOSURE"
                  ? [exposureComponentTemplate]
                  : component?.type === "RULE"
                    ? [ruleComponentTemplate]
                    : []
            }
            snippets={componentSnippets}
          />
          <JsonEditor label="Metadata JSON" value={metadataText} onChange={setMetadataText} />
          <button className="primary" type="submit">
            Create Version
          </button>
        </form>
      </section>
    </div>
  );
}
