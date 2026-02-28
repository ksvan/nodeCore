"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { policyApi } from "@/lib/api/policy";
import { ApiClientError, type PolicyListItemDto } from "@/lib/api/types";

export default function PoliciesPage() {
  const [query, setQuery] = useState("");
  const [policies, setPolicies] = useState<ReadonlyArray<PolicyListItemDto>>([]);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async (value?: string) => {
    setLoading(true);
    try {
      const rows = await policyApi.listPolicies(value && value.length > 0 ? value : undefined);
      setPolicies(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load policies"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="panel stack">
      <h1 style={{ margin: 0 }}>Policies</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Search by policy number or policy ID. Term dates are not included in list API yet.
      </p>

      <div className="row">
        <input
          placeholder="Search by policy number or ID"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button className="primary" onClick={() => void load(query)}>
          Search
        </button>
        <button onClick={() => void load()}>Reset</button>
      </div>

      <ApiErrorPanel error={error} />

      {loading ? <p className="muted">Loading...</p> : null}

      <ul className="list">
        {policies.map((policy) => (
          <li key={policy.id} className="row" style={{ justifyContent: "space-between" }}>
            <div>
              <Link href={`/policy/policies/${policy.id}`}>
                <strong>{policy.policyNumber}</strong>
              </Link>
              <div className="muted" style={{ fontSize: 13 }}>
                {policy.id}
              </div>
              <div className="muted" style={{ fontSize: 13 }}>
                productId: {policy.productId} | productVersionId: {policy.productVersionId}
              </div>
            </div>
            <StatusBadge status={policy.status} />
          </li>
        ))}
      </ul>
    </div>
  );
}
