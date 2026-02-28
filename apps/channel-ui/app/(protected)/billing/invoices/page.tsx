"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BillingInvoiceLookupPage() {
  const router = useRouter();
  const [invoiceId, setInvoiceId] = useState("");

  return (
    <div className="panel stack">
      <h1 style={{ margin: 0 }}>Invoice Lookup</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Open an invoice by ID.
      </p>
      <form
        className="row"
        onSubmit={(event) => {
          event.preventDefault();
          if (!invoiceId.trim()) {
            return;
          }
          router.push(`/billing/invoices/${invoiceId.trim()}`);
        }}
      >
        <input
          placeholder="Invoice ID"
          value={invoiceId}
          onChange={(event) => setInvoiceId(event.target.value)}
          required
        />
        <button className="primary" type="submit">
          Open
        </button>
      </form>
    </div>
  );
}
