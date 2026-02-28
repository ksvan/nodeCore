"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { StatusBadge } from "@/components/status-badge";
import { billingApi } from "@/lib/api/billing";
import {
  type ApiClientError,
  type BillingAccountDto,
  type BillingInvoiceListItemDto,
  type BillingPaymentListItemDto,
  type CurrencyCode,
} from "@/lib/api/types";

type InvoiceLineInput = {
  id: string;
  description: string;
  quantity: string;
  unitAmount: string;
};

const DECIMAL_PATTERN = /^-?\d+(\.\d{1,2})?$/;
const CURRENCIES: ReadonlyArray<CurrencyCode> = ["SEK", "DKK", "EUR", "GBP", "USD", "NOK"];

const createId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const isValidMoney = (value: string): boolean => DECIMAL_PATTERN.test(value.trim());

export default function BillingAccountDetailPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = useMemo(() => String(params.accountId), [params.accountId]);

  const [account, setAccount] = useState<BillingAccountDto | null>(null);
  const [invoices, setInvoices] = useState<ReadonlyArray<BillingInvoiceListItemDto>>([]);
  const [payments, setPayments] = useState<ReadonlyArray<BillingPaymentListItemDto>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const [invoiceDueDate, setInvoiceDueDate] = useState(new Date(Date.now() + 1209600000).toISOString());
  const [invoiceCurrency, setInvoiceCurrency] = useState<CurrencyCode>("SEK");
  const [invoiceLines, setInvoiceLines] = useState<ReadonlyArray<InvoiceLineInput>>([
    { id: createId(), description: "", quantity: "1.00", unitAmount: "0.00" },
  ]);

  const [paymentAmount, setPaymentAmount] = useState("0.00");
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>("SEK");
  const [providerRef, setProviderRef] = useState("");

  const [selectedPaymentId, setSelectedPaymentId] = useState("");
  const [allocationAmounts, setAllocationAmounts] = useState<Record<string, string>>({});

  const [obligationId, setObligationId] = useState("");
  const [obligationDueDate, setObligationDueDate] = useState(new Date(Date.now() + 1209600000).toISOString());

  const load = async () => {
    setLoading(true);
    try {
      const [accountData, invoiceData, paymentData] = await Promise.all([
        billingApi.getAccount(accountId),
        billingApi.listInvoices(accountId),
        billingApi.listPayments(accountId),
      ]);
      setAccount(accountData);
      setInvoices(invoiceData);
      setPayments(paymentData);
      if (!selectedPaymentId && paymentData[0]) {
        setSelectedPaymentId(paymentData[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load billing account"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [accountId]);

  const selectedPayment = payments.find((payment) => payment.id === selectedPaymentId) ?? null;
  const openInvoices = invoices.filter((invoice) => Number(invoice.amountDue) > 0);

  const createInvoice = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invoiceLines.length === 0) {
      setError(new Error("At least one invoice line is required"));
      return;
    }

    for (const line of invoiceLines) {
      if (!line.description.trim()) {
        setError(new Error("Invoice line description is required"));
        return;
      }
      if (!isValidMoney(line.quantity) || Number(line.quantity) <= 0) {
        setError(new Error("Invoice line quantity must be a positive decimal"));
        return;
      }
      if (!isValidMoney(line.unitAmount) || Number(line.unitAmount) <= 0) {
        setError(new Error("Invoice line unitAmount must be a positive decimal"));
        return;
      }
    }

    try {
      await billingApi.createInvoice(accountId, {
        dueDate: invoiceDueDate,
        currency: invoiceCurrency,
        lines: invoiceLines.map((line) => ({
          description: line.description.trim(),
          quantity: line.quantity.trim(),
          unitAmount: line.unitAmount.trim(),
        })),
      });
      setInvoiceLines([{ id: createId(), description: "", quantity: "1.00", unitAmount: "0.00" }]);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create invoice"));
    }
  };

  const recordPayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isValidMoney(paymentAmount) || Number(paymentAmount) <= 0) {
      setError(new Error("Payment amount must be a positive decimal"));
      return;
    }

    try {
      await billingApi.recordPayment({
        accountId,
        amount: paymentAmount.trim(),
        currency: paymentCurrency,
        providerRef: providerRef.trim() ? providerRef.trim() : null,
      });
      setPaymentAmount("0.00");
      setProviderRef("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to record payment"));
    }
  };

  const allocatePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedPaymentId) {
      setError(new Error("Select a payment first"));
      return;
    }

    const allocations = Object.entries(allocationAmounts)
      .map(([invoiceId, amount]) => ({ invoiceId, amount: amount.trim() }))
      .filter((entry) => entry.amount.length > 0);

    if (allocations.length === 0) {
      setError(new Error("Enter at least one allocation amount"));
      return;
    }

    for (const allocation of allocations) {
      if (!isValidMoney(allocation.amount) || Number(allocation.amount) <= 0) {
        setError(new Error("Allocation amounts must be positive decimals"));
        return;
      }
    }

    try {
      await billingApi.allocatePayment(selectedPaymentId, { allocations });
      setAllocationAmounts({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to allocate payment"));
    }
  };

  const generateFromObligation = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!obligationId.trim()) {
      setError(new Error("obligationId is required"));
      return;
    }
    try {
      await billingApi.generateInvoiceFromObligation(obligationId.trim(), {
        dueDate: obligationDueDate,
        billingAccountId: accountId,
      });
      setObligationId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to generate invoice from obligation"));
    }
  };

  return (
    <div className="grid">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Billing Account</h1>
          {account ? <StatusBadge status={account.status} /> : null}
        </div>
        <div className="muted">accountId: {accountId}</div>
        <div className="muted">partyId: {account?.partyId ?? "-"}</div>
        <div>
          <strong>Account Balance:</strong> {account?.accountBalance ?? "-"}
        </div>
      </section>

      <ApiErrorPanel error={error} />

      {loading ? <p className="muted">Loading...</p> : null}

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Invoices</h2>
        <ul className="list">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/billing/invoices/${invoice.id}`}>
                  <strong>{invoice.invoiceNumber}</strong>
                </Link>
                <div className="muted">status: {invoice.status}</div>
                <div className="muted">
                  total: {invoice.invoiceTotal} {invoice.currency} | paid: {invoice.amountPaid} | due: {invoice.amountDue}
                </div>
              </div>
              <div className="muted">due {new Date(invoice.dueDate).toLocaleDateString()}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Create/Post Invoice</h3>
        <form className="stack" onSubmit={createInvoice}>
          <div className="grid grid-2">
            <div className="stack">
              <label>Due Date (ISO datetime)</label>
              <input value={invoiceDueDate} onChange={(event) => setInvoiceDueDate(event.target.value)} required />
            </div>
            <div className="stack">
              <label>Currency</label>
              <select value={invoiceCurrency} onChange={(event) => setInvoiceCurrency(event.target.value as CurrencyCode)}>
                {CURRENCIES.map((code) => (
                  <option key={code} value={code}>
                    {code}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {invoiceLines.map((line, index) => (
            <div key={line.id} className="panel stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <strong>Line #{index + 1}</strong>
                <button
                  type="button"
                  onClick={() => setInvoiceLines((prev) => prev.filter((row) => row.id !== line.id))}
                  disabled={invoiceLines.length === 1}
                >
                  Remove
                </button>
              </div>
              <input
                placeholder="Description"
                value={line.description}
                onChange={(event) =>
                  setInvoiceLines((prev) =>
                    prev.map((row) => (row.id === line.id ? { ...row, description: event.target.value } : row)),
                  )
                }
              />
              <div className="grid grid-2">
                <input
                  placeholder="Quantity (e.g. 1.00)"
                  value={line.quantity}
                  onChange={(event) =>
                    setInvoiceLines((prev) =>
                      prev.map((row) => (row.id === line.id ? { ...row, quantity: event.target.value } : row)),
                    )
                  }
                />
                <input
                  placeholder="Unit amount (e.g. 1200.00)"
                  value={line.unitAmount}
                  onChange={(event) =>
                    setInvoiceLines((prev) =>
                      prev.map((row) => (row.id === line.id ? { ...row, unitAmount: event.target.value } : row)),
                    )
                  }
                />
              </div>
            </div>
          ))}

          <div className="row">
            <button
              type="button"
              onClick={() =>
                setInvoiceLines((prev) => [
                  ...prev,
                  { id: createId(), description: "", quantity: "1.00", unitAmount: "0.00" },
                ])
              }
            >
              Add Line
            </button>
            <button className="primary" type="submit">
              Create Invoice
            </button>
          </div>
        </form>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Generate Invoice from Obligation</h3>
        <form className="row" onSubmit={generateFromObligation}>
          <input
            placeholder="Obligation ID"
            value={obligationId}
            onChange={(event) => setObligationId(event.target.value)}
            required
          />
          <input
            placeholder="Due Date (ISO datetime)"
            value={obligationDueDate}
            onChange={(event) => setObligationDueDate(event.target.value)}
            required
          />
          <button className="primary" type="submit">
            Generate
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Payments</h2>
        <ul className="list">
          {payments.map((payment) => (
            <li key={payment.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/billing/payments/${payment.id}`}>
                  <strong>{payment.id.slice(0, 8)}...</strong>
                </Link>
                <div className="muted">status: {payment.status}</div>
                <div className="muted">
                  amount: {payment.amount} {payment.currency} | unallocated: {payment.paymentUnallocatedAmount}
                </div>
              </div>
              <div className="muted">{new Date(payment.createdAt).toLocaleString()}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Record Payment</h3>
        <form className="grid grid-2" onSubmit={recordPayment}>
          <input
            placeholder="Amount (e.g. 500.00)"
            value={paymentAmount}
            onChange={(event) => setPaymentAmount(event.target.value)}
            required
          />
          <select value={paymentCurrency} onChange={(event) => setPaymentCurrency(event.target.value as CurrencyCode)}>
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <input
            placeholder="Provider Ref (optional)"
            value={providerRef}
            onChange={(event) => setProviderRef(event.target.value)}
          />
          <button className="primary" type="submit">
            Record
          </button>
        </form>
      </section>

      <section className="panel stack">
        <h3 style={{ margin: 0 }}>Allocate Payment</h3>
        <form className="stack" onSubmit={allocatePayment}>
          <div className="stack">
            <label>Select Payment</label>
            <select
              value={selectedPaymentId}
              onChange={(event) => {
                setSelectedPaymentId(event.target.value);
                setAllocationAmounts({});
              }}
            >
              <option value="">Select...</option>
              {payments.map((payment) => (
                <option key={payment.id} value={payment.id}>
                  {payment.id.slice(0, 8)}... ({payment.amount} {payment.currency}, unallocated {payment.paymentUnallocatedAmount})
                </option>
              ))}
            </select>
          </div>

          {selectedPayment ? (
            <p className="muted" style={{ marginBottom: 0 }}>
              Selected payment currency is {selectedPayment.currency}. API will enforce currency match.
            </p>
          ) : null}

          {openInvoices.length === 0 ? <p className="muted">No open invoices to allocate.</p> : null}

          {openInvoices.map((invoice) => (
            <div key={invoice.id} className="row">
              <div style={{ flex: 1 }}>
                <Link href={`/billing/invoices/${invoice.id}`}>{invoice.invoiceNumber}</Link>
                <span className="muted"> due {invoice.amountDue} {invoice.currency}</span>
              </div>
              <input
                style={{ maxWidth: 220 }}
                placeholder="Allocation amount"
                value={allocationAmounts[invoice.id] ?? ""}
                onChange={(event) =>
                  setAllocationAmounts((prev) => ({
                    ...prev,
                    [invoice.id]: event.target.value,
                  }))
                }
              />
            </div>
          ))}

          <button className="primary" type="submit" disabled={!selectedPaymentId || openInvoices.length === 0}>
            Allocate
          </button>
        </form>
      </section>
    </div>
  );
}
