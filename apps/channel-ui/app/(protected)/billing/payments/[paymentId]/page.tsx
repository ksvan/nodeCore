"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { billingApi } from "@/lib/api/billing";
import { type ApiClientError, type BillingPaymentDto } from "@/lib/api/types";

export default function BillingPaymentDetailPage() {
  const params = useParams<{ paymentId: string }>();
  const paymentId = useMemo(() => String(params.paymentId), [params.paymentId]);

  const [payment, setPayment] = useState<BillingPaymentDto | null>(null);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const result = await billingApi.getPayment(paymentId);
        setPayment(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load payment"));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [paymentId]);

  return (
    <div className="grid">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Payment</h1>
          {payment ? <StatusBadge status={payment.status} /> : null}
        </div>
        <div className="muted">paymentId: {paymentId}</div>
        <div>
          <Link href={payment ? `/billing/accounts/${payment.billingAccountId}` : "/billing/accounts"}>Open billing account</Link>
        </div>
      </section>

      <ApiErrorPanel error={error} />
      {loading ? <p className="muted">Loading...</p> : null}

      {payment ? (
        <>
          <section className="panel stack">
            <h2 style={{ margin: 0 }}>Overview</h2>
            <div>Amount: {payment.amount} {payment.currency}</div>
            <div>Unallocated: {payment.paymentUnallocatedAmount}</div>
            <div>Provider ref: {payment.providerRef ?? "-"}</div>
            <div>Created: {new Date(payment.createdAt).toLocaleString()}</div>
          </section>

          <section className="panel stack">
            <h2 style={{ margin: 0 }}>Allocations</h2>
            <p className="muted" style={{ margin: 0 }}>
              TODO (API): payment allocation details are not exposed by current payment endpoints.
            </p>
            <p className="muted" style={{ margin: 0 }}>
              Current API returns computed unallocated amount only.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}
