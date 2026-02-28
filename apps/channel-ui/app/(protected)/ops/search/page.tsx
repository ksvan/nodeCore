"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { billingApi } from "@/lib/api/billing";
import { policyApi } from "@/lib/api/policy";
import { productManagementApi } from "@/lib/api/product-management";
import type { ApiClientError } from "@/lib/api/types";

type SearchType =
  | "ALL"
  | "POLICY"
  | "TRANSACTION"
  | "BILLING_ACCOUNT"
  | "INVOICE"
  | "PAYMENT"
  | "PRODUCT"
  | "PRODUCT_VERSION"
  | "COMPONENT"
  | "PRICING_PROGRAM";

interface SearchResult {
  entityType: string;
  displayName: string;
  id: string;
  status: string;
  timestamp: string;
  href: string;
}

const SEARCH_TYPES: ReadonlyArray<{ value: SearchType; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "POLICY", label: "Policy" },
  { value: "TRANSACTION", label: "Transaction" },
  { value: "BILLING_ACCOUNT", label: "BillingAccount" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PAYMENT", label: "Payment" },
  { value: "PRODUCT", label: "Product" },
  { value: "PRODUCT_VERSION", label: "ProductVersion" },
  { value: "COMPONENT", label: "Component" },
  { value: "PRICING_PROGRAM", label: "PricingProgram" },
];

const LIMIT_PER_TYPE = 10;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const contains = (value: string, query: string): boolean =>
  value.toLowerCase().includes(query.toLowerCase());

const byTimestampDesc = (a: SearchResult, b: SearchResult): number =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

export default function OpsSearchPage() {
  const [query, setQuery] = useState("");
  const [searchType, setSearchType] = useState<SearchType>("ALL");
  const [results, setResults] = useState<ReadonlyArray<SearchResult>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const runSearch = async () => {
    const input = query.trim();
    if (!input) {
      setResults([]);
      setHint("Enter a search term or UUID.");
      return;
    }

    setLoading(true);
    setHint(null);

    try {
      const searchFns: Array<() => Promise<ReadonlyArray<SearchResult>>> = [];
      const needsUuid = ["TRANSACTION", "INVOICE", "PAYMENT", "PRODUCT_VERSION"] as const;
      if (needsUuid.includes(searchType as (typeof needsUuid)[number]) && !UUID_PATTERN.test(input)) {
        setResults([]);
        setHint(`${searchType} search requires a UUID input.`);
        setLoading(false);
        return;
      }

      if (searchType === "ALL" || searchType === "POLICY") {
        searchFns.push(async () => {
          const rows = await policyApi.listPolicies(input);
          return rows.slice(0, LIMIT_PER_TYPE).map((row) => ({
            entityType: "Policy",
            displayName: row.policyNumber,
            id: row.id,
            status: row.status,
            timestamp: row.createdAt,
            href: `/policy/policies/${row.id}`,
          }));
        });
      }

      if (searchType === "ALL" || searchType === "TRANSACTION") {
        searchFns.push(async () => {
          if (!UUID_PATTERN.test(input)) {
            return [];
          }
          try {
            const tx = await policyApi.getTransaction(input);
            return [
              {
                entityType: "Transaction",
                displayName: tx.type,
                id: tx.id,
                status: tx.status,
                timestamp: tx.createdAt,
                href: `/policy/transactions/${tx.id}`,
              },
            ];
          } catch {
            return [];
          }
        });
      }

      if (searchType === "ALL" || searchType === "BILLING_ACCOUNT") {
        searchFns.push(async () => {
          const rows = await billingApi.listAccounts(input);
          return rows.slice(0, LIMIT_PER_TYPE).map((row) => ({
            entityType: "BillingAccount",
            displayName: row.partyId,
            id: row.id,
            status: row.status,
            timestamp: row.updatedAt,
            href: `/billing/accounts/${row.id}`,
          }));
        });
      }

      if (searchType === "ALL" || searchType === "INVOICE") {
        searchFns.push(async () => {
          if (!UUID_PATTERN.test(input)) {
            return [];
          }
          try {
            const invoice = await billingApi.getInvoice(input);
            return [
              {
                entityType: "Invoice",
                displayName: invoice.invoiceNumber,
                id: invoice.id,
                status: invoice.status,
                timestamp: invoice.dueDate,
                href: `/billing/invoices/${invoice.id}`,
              },
            ];
          } catch {
            return [];
          }
        });
      }

      if (searchType === "ALL" || searchType === "PAYMENT") {
        searchFns.push(async () => {
          if (!UUID_PATTERN.test(input)) {
            return [];
          }
          try {
            const payment = await billingApi.getPayment(input);
            return [
              {
                entityType: "Payment",
                displayName: payment.providerRef ?? payment.id,
                id: payment.id,
                status: payment.status,
                timestamp: payment.createdAt,
                href: `/billing/payments/${payment.id}`,
              },
            ];
          } catch {
            return [];
          }
        });
      }

      if (searchType === "ALL" || searchType === "PRODUCT") {
        searchFns.push(async () => {
          const rows = await productManagementApi.listProducts();
          return rows
            .filter(
              (row) => contains(row.id, input) || contains(row.productCode, input) || contains(row.name, input),
            )
            .slice(0, LIMIT_PER_TYPE)
            .map((row) => ({
              entityType: "Product",
              displayName: `${row.productCode} - ${row.name}`,
              id: row.id,
              status: row.status,
              timestamp: row.updatedAt,
              href: `/product-management/products/${row.id}`,
            }));
        });
      }

      if (searchType === "ALL" || searchType === "PRODUCT_VERSION") {
        searchFns.push(async () => {
          if (!UUID_PATTERN.test(input)) {
            return [];
          }
          try {
            const row = await productManagementApi.getProductVersion(input);
            return [
              {
                entityType: "ProductVersion",
                displayName: `Product ${row.productId} v${row.version}`,
                id: row.id,
                status: row.status,
                timestamp: row.updatedAt,
                href: `/product-management/product-versions/${row.id}`,
              },
            ];
          } catch {
            return [];
          }
        });
      }

      if (searchType === "ALL" || searchType === "COMPONENT") {
        searchFns.push(async () => {
          const all = await Promise.all([
            productManagementApi.listComponents("COVERAGE"),
            productManagementApi.listComponents("EXPOSURE"),
            productManagementApi.listComponents("RULE"),
          ]);
          return all
            .flat()
            .filter(
              (row) => contains(row.id, input) || contains(row.componentCode, input) || contains(row.name, input),
            )
            .slice(0, LIMIT_PER_TYPE)
            .map((row) => ({
              entityType: "Component",
              displayName: `${row.componentCode} - ${row.name}`,
              id: row.id,
              status: row.type,
              timestamp: row.updatedAt,
              href: `/product-management/components/${row.id}`,
            }));
        });
      }

      if (searchType === "ALL" || searchType === "PRICING_PROGRAM") {
        searchFns.push(async () => {
          const rows = await productManagementApi.listPricingPrograms();
          return rows
            .filter(
              (row) => contains(row.id, input) || contains(row.programCode, input) || contains(row.name, input),
            )
            .slice(0, LIMIT_PER_TYPE)
            .map((row) => ({
              entityType: "PricingProgram",
              displayName: `${row.programCode} - ${row.name}`,
              id: row.id,
              status: "-",
              timestamp: row.updatedAt,
              href: `/product-management/pricing-programs/${row.id}`,
            }));
        });
      }

      const chunks = await Promise.all(searchFns.map((searchFn) => searchFn()));
      const merged = chunks.flat().sort(byTimestampDesc);

      setResults(merged);
      if (merged.length === 0) {
        setHint("No matches found for this search.");
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Search failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Global Search</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Search across policy, billing, and product entities using existing APIs.
        </p>

        <div className="row">
          <select value={searchType} onChange={(event) => setSearchType(event.target.value as SearchType)}>
            {SEARCH_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <input
            placeholder="Search text or UUID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <button className="primary" onClick={() => void runSearch()} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </section>

      <ApiErrorPanel error={error} />

      {hint ? <div className="panel muted">{hint}</div> : null}

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Results ({results.length})</h2>
        <DataTable headers={["Type", "Display", "ID", "Status", "Created/Updated", "Open"]}>
          {results.map((row) => (
            <tr key={`${row.entityType}-${row.id}`}>
              <td>{row.entityType}</td>
              <td>{row.displayName}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12 }}>{row.id}</td>
              <td>
                {row.status === "-" ? <span className="muted">-</span> : <StatusBadge status={row.status} />}
              </td>
              <td>{new Date(row.timestamp).toLocaleString()}</td>
              <td>
                <Link href={row.href}>Open</Link>
              </td>
            </tr>
          ))}
        </DataTable>
      </section>
    </div>
  );
}
