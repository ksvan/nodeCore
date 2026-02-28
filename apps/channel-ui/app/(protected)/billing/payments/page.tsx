"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BillingPaymentLookupPage() {
  const router = useRouter();
  const [paymentId, setPaymentId] = useState("");

  return (
    <div className="panel stack">
      <h1 style={{ margin: 0 }}>Payment Lookup</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Open a payment by ID.
      </p>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!paymentId.trim()) {
            return;
          }
          router.push(`/billing/payments/${paymentId.trim()}`);
        }}
      >
        <input
          placeholder="Payment ID"
          value={paymentId}
          onChange={(event) => setPaymentId(event.target.value)}
          required
        />
        <button className="primary" type="submit">
          Open
        </button>
      </form>
    </div>
  );
}
