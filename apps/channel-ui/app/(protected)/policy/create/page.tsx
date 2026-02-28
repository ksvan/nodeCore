"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { policyApi } from "@/lib/api/policy";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type ProductDto, type ProductVersionDto } from "@/lib/api/types";

interface ActiveVersionOption {
  productId: string;
  productName: string;
  productVersionId: string;
  version: number;
}

export default function PolicyCreatePage() {
  const router = useRouter();
  const [options, setOptions] = useState<ReadonlyArray<ActiveVersionOption>>([]);
  const [selectedProductVersionId, setSelectedProductVersionId] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [termStart, setTermStart] = useState(new Date().toISOString());
  const [termEnd, setTermEnd] = useState(new Date(Date.now() + 31536000000).toISOString());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const products = await productManagementApi.listProducts();
        const allVersions = await Promise.all(
          products.map(async (product: ProductDto) => {
            const versions = await productManagementApi.listProductVersions(product.id);
            return {
              product,
              versions,
            };
          }),
        );

        const activeOptions: ActiveVersionOption[] = allVersions.flatMap(
          (entry: { product: ProductDto; versions: ReadonlyArray<ProductVersionDto> }) =>
            entry.versions
              .filter((version) => version.status === "ACTIVE")
              .map((version) => ({
                productId: entry.product.id,
                productName: entry.product.name,
                productVersionId: version.id,
                version: version.version,
              })),
        );

        setOptions(activeOptions);
        if (activeOptions[0]) {
          setSelectedProductVersionId(activeOptions[0].productVersionId);
        }
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error("Failed to load active product versions"));
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const selected = useMemo(
    () => options.find((option) => option.productVersionId === selectedProductVersionId) ?? null,
    [options, selectedProductVersionId],
  );

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) {
      setError(new Error("Select an ACTIVE product version"));
      return;
    }

    try {
      const policy = await policyApi.createPolicy({
        policyNumber,
        productId: selected.productId,
        productVersionId: selected.productVersionId,
        termStart,
        termEnd,
      });

      const tx = await policyApi.createNewBusinessTransaction(policy.id, termStart);
      router.push(`/policy/transactions/${tx.id}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to create policy and transaction"));
    }
  };

  return (
    <div className="panel stack">
      <h1 style={{ margin: 0 }}>Create New Business</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        TODO (API): no single endpoint exists for global active product versions. UI currently fan-outs per product.
      </p>

      <ApiErrorPanel error={error} />

      {loading ? <p className="muted">Loading product versions...</p> : null}

      <form className="stack" onSubmit={onSubmit}>
        <div className="stack">
          <label>Active Product Version</label>
          <select
            value={selectedProductVersionId}
            onChange={(event) => setSelectedProductVersionId(event.target.value)}
            required
          >
            {options.map((option) => (
              <option key={option.productVersionId} value={option.productVersionId}>
                {option.productName} v{option.version}
              </option>
            ))}
          </select>
        </div>

        <div className="stack">
          <label>Policy Number</label>
          <input value={policyNumber} onChange={(event) => setPolicyNumber(event.target.value)} required />
        </div>

        <div className="stack">
          <label>Term Start (ISO datetime)</label>
          <input value={termStart} onChange={(event) => setTermStart(event.target.value)} required />
        </div>

        <div className="stack">
          <label>Term End (ISO datetime)</label>
          <input value={termEnd} onChange={(event) => setTermEnd(event.target.value)} required />
        </div>

        <button className="primary" type="submit" disabled={loading || !selected}>
          Create NB Draft
        </button>
      </form>
    </div>
  );
}
