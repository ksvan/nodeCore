"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { StatusBadge } from "@/components/status-badge";
import {
  pricingInputSchemaTemplate,
  pricingOutputSchemaTemplate,
  snippetInsertRule,
} from "@/lib/json-templates";
import { productManagementApi } from "@/lib/api/product-management";
import {
  ApiClientError,
  type PricingProgramDto,
  type PricingProgramVersionDto,
} from "@/lib/api/types";

export default function PricingProgramDetailPage() {
  const params = useParams<{ pricingProgramId: string }>();
  const pricingProgramId = useMemo(() => String(params.pricingProgramId), [params.pricingProgramId]);
  const [program, setProgram] = useState<PricingProgramDto | null>(null);
  const [versions, setVersions] = useState<ReadonlyArray<PricingProgramVersionDto>>([]);
  const [fileRef, setFileRef] = useState("");
  const [inputSchema, setInputSchema] = useState("{}");
  const [outputSchema, setOutputSchema] = useState("{}");
  const [metadata, setMetadata] = useState("{}");
  const [status, setStatus] = useState("DRAFT");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [programData, versionData] = await Promise.all([
        productManagementApi.getPricingProgram(pricingProgramId),
        productManagementApi.listPricingProgramVersions(pricingProgramId),
      ]);
      setProgram(programData);
      setVersions(versionData);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, [pricingProgramId]);

  const onCreateVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await productManagementApi.createPricingProgramVersion(pricingProgramId, {
        fileRef,
        inputSchema: JSON.parse(inputSchema || "{}") as Record<string, unknown>,
        outputSchema: JSON.parse(outputSchema || "{}") as Record<string, unknown>,
        metadata: JSON.parse(metadata || "{}") as Record<string, unknown>,
        status,
      });
      setFileRef("");
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create version failed";
      setError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>{program?.name ?? "Pricing Program"}</h1>
        <p className="muted">{program?.programCode}</p>
        {error ? <div className="error-box">{error}</div> : null}

        <h3>Versions</h3>
        <ul className="list">
          {versions.map((version) => (
            <li key={version.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <strong>v{version.version}</strong>
                <div className="muted">{version.fileRef}</div>
              </div>
              <StatusBadge status={version.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Program Version</h2>
        <form className="stack" onSubmit={onCreateVersion}>
          <div className="stack">
            <label>Status</label>
            <select value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="DRAFT">DRAFT</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="RETIRED">RETIRED</option>
            </select>
          </div>
          <div className="stack">
            <label>fileRef</label>
            <input value={fileRef} onChange={(event) => setFileRef(event.target.value)} required />
          </div>
          <JsonEditor
            label="Input Schema JSON"
            value={inputSchema}
            onChange={setInputSchema}
            templates={[pricingInputSchemaTemplate]}
            snippets={[snippetInsertRule]}
          />
          <JsonEditor
            label="Output Schema JSON"
            value={outputSchema}
            onChange={setOutputSchema}
            templates={[pricingOutputSchemaTemplate]}
          />
          <JsonEditor label="Metadata JSON" value={metadata} onChange={setMetadata} />
          <button className="primary" type="submit">
            Create Version
          </button>
        </form>
      </section>
    </div>
  );
}
