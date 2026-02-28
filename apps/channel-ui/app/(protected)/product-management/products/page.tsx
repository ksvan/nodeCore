"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type ProductDto } from "@/lib/api/types";
import { StatusBadge } from "@/components/status-badge";

export default function ProductsPage() {
  const [products, setProducts] = useState<ReadonlyArray<ProductDto>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({ productCode: "", name: "", description: "" });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setProducts(await productManagementApi.listProducts());
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Failed to load products";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreateError(null);
    try {
      await productManagementApi.createProduct({
        productCode: form.productCode,
        name: form.name,
        description: form.description || null,
      });
      setForm({ productCode: "", name: "", description: "" });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create failed";
      setCreateError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Products</h1>
        {loading ? <p className="muted">Loading...</p> : null}
        {error ? <div className="error-box">{error}</div> : null}
        <ul className="list">
          {products.map((product) => (
            <li key={product.id} className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <Link href={`/product-management/products/${product.id}`}>
                  <strong>{product.name}</strong>
                </Link>
                <div className="muted">{product.productCode}</div>
              </div>
              <StatusBadge status={product.status} />
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Product</h2>
        <form className="stack" onSubmit={onCreate}>
          <div className="stack">
            <label>Product Code</label>
            <input
              value={form.productCode}
              onChange={(e) => setForm((prev) => ({ ...prev, productCode: e.target.value }))}
              required
            />
          </div>
          <div className="stack">
            <label>Name</label>
            <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
          </div>
          <div className="stack">
            <label>Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
            />
          </div>
          {createError ? <div className="error-box">{createError}</div> : null}
          <button className="primary" type="submit">
            Create
          </button>
        </form>
      </section>
    </div>
  );
}
