"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { JsonEditor } from "@/components/JsonEditor";
import { StatusBadge } from "@/components/status-badge";
import {
  componentSnippets,
  pricingInputSchemaTemplate,
  snippetInsertRule,
  snippetInsertTerm,
} from "@/lib/json-templates";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type ProductDto, type ProductVersionDto } from "@/lib/api/types";

const toIsoNow = () => new Date().toISOString();

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const productId = useMemo(() => String(params.productId), [params.productId]);
  const [product, setProduct] = useState<ProductDto | null>(null);
  const [versions, setVersions] = useState<ReadonlyArray<ProductVersionDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState(toIsoNow());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [pricingProgramVersionId, setPricingProgramVersionId] = useState("");
  const [policySchema, setPolicySchema] = useState("{}");
  const [exposureSchemas, setExposureSchemas] = useState("{}");
  const [pricingInputSchema, setPricingInputSchema] = useState("{}");

  const load = async () => {
    try {
      const [productData, versionsData] = await Promise.all([
        productManagementApi.getProduct(productId),
        productManagementApi.listProductVersions(productId),
      ]);
      setProduct(productData);
      setVersions(versionsData);
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, [productId]);

  const onCreateVersion = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      await productManagementApi.createProductVersion(productId, {
        effectiveFrom,
        effectiveTo: effectiveTo || null,
        policySchema: JSON.parse(policySchema || "{}") as Record<string, unknown>,
        exposureSchemas: JSON.parse(exposureSchemas || "{}") as Record<string, unknown>,
        pricingInputSchema: JSON.parse(pricingInputSchema || "{}") as Record<string, unknown>,
        pricingProgramVersionId: pricingProgramVersionId || null,
      });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create version failed";
      setCreateError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>{product?.name ?? "Product"}</h1>
          {product ? <StatusBadge status={product.status} /> : null}
        </div>
        <p className="muted">{product?.productCode}</p>
        {error ? <div className="error-box">{error}</div> : null}

        <h3>Versions</h3>
        <ul className="list">
          {versions.map((version) => (
            <li key={version.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/product-management/product-versions/${version.id}`}>
                  <strong>Version {version.version}</strong>
                </Link>
                <div className="muted">{new Date(version.effectiveFrom).toLocaleString()}</div>
              </div>
              <StatusBadge status={version.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Draft Version</h2>
        <form className="stack" onSubmit={onCreateVersion}>
          <div className="stack">
            <label>Effective From (ISO datetime)</label>
            <input value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </div>
          <div className="stack">
            <label>Effective To (optional ISO datetime)</label>
            <input value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
          </div>
          <div className="stack">
            <label>Pricing Program Version ID (optional)</label>
            <input
              value={pricingProgramVersionId}
              onChange={(e) => setPricingProgramVersionId(e.target.value)}
              placeholder="uuid"
            />
          </div>
          <JsonEditor label="Policy Schema JSON" value={policySchema} onChange={setPolicySchema} />
          <JsonEditor label="Exposure Schemas JSON" value={exposureSchemas} onChange={setExposureSchemas} />
          <JsonEditor
            label="Pricing Input Schema JSON"
            value={pricingInputSchema}
            onChange={setPricingInputSchema}
            templates={[pricingInputSchemaTemplate]}
            snippets={[snippetInsertTerm, snippetInsertRule, ...componentSnippets]}
          />
          {createError ? <div className="error-box">{createError}</div> : null}
          <button className="primary" type="submit">
            Create Version
          </button>
        </form>
      </section>
    </div>
  );
}
