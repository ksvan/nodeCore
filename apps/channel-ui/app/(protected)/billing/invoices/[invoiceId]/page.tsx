"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { billingApi } from "@/lib/api/billing";
import { type ApiClientError, type BillingInvoiceDto } from "@/lib/api/types";

export default function BillingInvoiceDetailPage() {
  const params = useParams<{ invoiceId: string }>();
  const invoiceId = useMemo(() => String(params.invoiceId), [params.invoiceId]);

  const [invoice, setInvoice] = useState<BillingInvoiceDto | null>(null);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await billingApi.getInvoice(invoiceId);
        setInvoice(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load invoice"));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [invoiceId]);

  return (
    <div className="grid">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Invoice {invoice?.invoiceNumber ?? ""}</h1>
          {invoice ? <StatusBadge status={invoice.status} /> : null}
        </div>
        <div className="muted">invoiceId: {invoiceId}</div>
        <div>
          <Link href={invoice ? `/billing/accounts/${invoice.billingAccountId}` : "/billing/accounts"}>Open billing account</Link>
        </div>
      </section>

      <ApiErrorPanel error={error} />
      {loading ? <p className="muted">Loading...</p> : null}

      {invoice ? (
        <>
          <section className="panel stack">
            <h2 style={{ margin: 0 }}>Totals</h2>
            <div>Invoice total: {invoice.invoiceTotal} {invoice.currency}</div>
            <div>Amount paid: {invoice.amountPaid}</div>
            <div>Amount due: {invoice.amountDue}</div>
            <div>Due date: {new Date(invoice.dueDate).toLocaleString()}</div>
          </section>

          <section className="panel stack">
            <h2 style={{ margin: 0 }}>Line Items</h2>
            <ul className="list">
              {invoice.lines.map((line) => (
                <li key={line.id} className="row" style={{ justifyContent: "space-between" }}>
                  <div>
                    <strong>{line.description}</strong>
                    <div className="muted">qty: {line.quantity} | unit: {line.unitAmount}</div>
                  </div>
                  <div>{line.lineTotal}</div>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel stack">
            <h2 style={{ margin: 0 }}>Allocations</h2>
            <p className="muted" style={{ margin: 0 }}>
              TODO (API): invoice allocation details are not exposed by current invoice endpoints.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Current API returns computed totals only (amountPaid/amountDue).
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
