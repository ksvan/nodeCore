"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { billingApi } from "@/lib/api/billing";
import { type ApiClientError, type BillingAccountListItemDto } from "@/lib/api/types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default function BillingAccountsPage() {
  const [query, setQuery] = useState("");
  const [partyId, setPartyId] = useState("");
  const [accounts, setAccounts] = useState<ReadonlyArray<BillingAccountListItemDto>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const load = async (search?: string) => {
    setLoading(true);
    try {
      const rows = await billingApi.listAccounts(search?.trim() ? search.trim() : undefined);
      setAccounts(rows);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load billing accounts"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = partyId.trim();
    if (!UUID_PATTERN.test(trimmed)) {
      setError(new Error("partyId must be a valid UUID"));
      return;
    }
    try {
      await billingApi.createAccount({ partyId: trimmed });
      setPartyId("");
      await load(query);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create billing account"));
    }
  };

  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Billing Accounts</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Search by account ID or party ID using the backend query endpoint.
        </p>

        <div className="row">
          <input
            placeholder="Search query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="primary" onClick={() => void load(query)}>
            Search
          </button>
          <button onClick={() => void load()}>Reset</button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Account</h2>
        <form className="row" onSubmit={onCreateAccount}>
          <input
            placeholder="partyId (UUID)"
            value={partyId}
            onChange={(event) => setPartyId(event.target.value)}
            required
          />
          <button className="primary" type="submit">
            Create
          </button>
        </form>
      </section>

      <ApiErrorPanel error={error} />

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Results</h2>
        {loading ? <p className="muted">Loading...</p> : null}
        <ul className="list">
          {accounts.map((account) => (
            <li key={account.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/billing/accounts/${account.id}`}>
                  <strong>{account.id}</strong>
                </Link>
                <div className="muted">partyId: {account.partyId}</div>
                <div className="muted">created: {new Date(account.createdAt).toLocaleString()}</div>
              </div>
              <StatusBadge status={account.status} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
