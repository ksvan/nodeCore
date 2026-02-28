"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { policyApi } from "@/lib/api/policy";
import {
  ApiClientError,
  type PolicyDto,
  type PolicySnapshotDto,
  type PolicyTransactionDto,
} from "@/lib/api/types";

const toIsoDay = (): string => new Date().toISOString();

export default function PolicyDetailPage() {
  const params = useParams<{ policyId: string }>();
  const router = useRouter();
  const policyId = useMemo(() => String(params.policyId), [params.policyId]);

  const [policy, setPolicy] = useState<PolicyDto | null>(null);
  const [transactions, setTransactions] = useState<ReadonlyArray<PolicyTransactionDto>>([]);
  const [snapshot, setSnapshot] = useState<PolicySnapshotDto | null>(null);
  const [asOf, setAsOf] = useState(toIsoDay());
  const [endorsementEffectiveAt, setEndorsementEffectiveAt] = useState(toIsoDay());
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const load = async () => {
    try {
      const [policyData, transactionsData] = await Promise.all([
        policyApi.getPolicy(policyId),
        policyApi.listTransactions(policyId),
      ]);
      setPolicy(policyData);
      setTransactions(transactionsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load policy"));
    }
  };

  useEffect(() => {
    void load();
  }, [policyId]);

  const fetchSnapshot = async () => {
    try {
      const data = await policyApi.getSnapshot(policyId, asOf);
      setSnapshot(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load snapshot"));
    }
  };

  const createEndorsement = async () => {
    try {
      const tx = await policyApi.createEndorsementTransaction(policyId, endorsementEffectiveAt);
      router.push(`/policy/transactions/${tx.id}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create endorsement"));
    }
  };

  return (
    <div className="grid">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>{policy?.policyNumber ?? "Policy"}</h1>
          {policy ? <StatusBadge status={policy.status} /> : null}
        </div>
        <div className="muted">policyId: {policyId}</div>
        <div className="muted">productId: {policy?.productId ?? "-"}</div>
        <div className="muted">productVersionId: {policy?.productVersionId ?? "-"}</div>
      </section>

      <ApiErrorPanel error={error} />

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Transactions</h2>
        <ul className="list">
          {transactions.map((tx) => (
            <li key={tx.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/policy/transactions/${tx.id}`}>
                  <strong>{tx.type}</strong>
                </Link>
                <div className="muted">effectiveAt: {new Date(tx.effectiveAt).toLocaleString()}</div>
              </div>
              <StatusBadge status={tx.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Snapshot as-of</h2>
        <div className="row">
          <input value={asOf} onChange={(event) => setAsOf(event.target.value)} />
          <button className="primary" onClick={() => void fetchSnapshot()}>
            Load Snapshot
          </button>
        </div>

        {snapshot ? (
          <div className="stack">
            <h3 style={{ marginBottom: 0 }}>Risks ({snapshot.risks.length})</h3>
            <pre>{JSON.stringify(snapshot.risks, null, 2)}</pre>
            <h3 style={{ marginBottom: 0 }}>Coverages ({snapshot.coverages.length})</h3>
            <pre>{JSON.stringify(snapshot.coverages, null, 2)}</pre>
            <h3 style={{ marginBottom: 0 }}>Premiums ({snapshot.premiums.length})</h3>
            <pre>{JSON.stringify(snapshot.premiums, null, 2)}</pre>
          </div>
        ) : (
          <p className="muted">Load snapshot to view risks, coverages, terms, and premiums.</p>
        )}
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Endorsement</h2>
        <div className="row">
          <input
            value={endorsementEffectiveAt}
            onChange={(event) => setEndorsementEffectiveAt(event.target.value)}
          />
          <button className="primary" onClick={() => void createEndorsement()}>
            Create Endorsement Draft
          </button>
        </div>
      </section>
    </div>
  );
}
