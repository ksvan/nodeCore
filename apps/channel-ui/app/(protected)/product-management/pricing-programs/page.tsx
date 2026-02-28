"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type PricingProgramDto } from "@/lib/api/types";

export default function PricingProgramsPage() {
  const [programs, setPrograms] = useState<ReadonlyArray<PricingProgramDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ programCode: "", name: "", description: "" });

  const load = async () => {
    try {
      setPrograms(await productManagementApi.listPricingPrograms());
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await productManagementApi.createPricingProgram({
        programCode: form.programCode,
        name: form.name,
        description: form.description || null,
      });
      setForm({ programCode: "", name: "", description: "" });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create failed";
      setError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>Pricing Programs</h1>
        {error ? <div className="error-box">{error}</div> : null}
        <ul className="list">
          {programs.map((program) => (
            <li key={program.id}>
              <Link href={`/product-management/pricing-programs/${program.id}`}>
                <strong>{program.name}</strong>
              </Link>
              <div className="muted">{program.programCode}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create Pricing Program</h2>
        <form className="stack" onSubmit={onCreate}>
          <div className="stack">
            <label>Program Code</label>
            <input
              value={form.programCode}
              onChange={(event) => setForm((prev) => ({ ...prev, programCode: event.target.value }))}
              required
            />
          </div>
          <div className="stack">
            <label>Name</label>
            <input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              required
            />
          </div>
          <div className="stack">
            <label>Description</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </div>
          <button className="primary" type="submit">
            Create Program
          </button>
        </form>
      </section>
    </div>
  );
}
