"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { productManagementApi } from "@/lib/api/product-management";
import { ApiClientError, type ComponentDto, type ComponentType } from "@/lib/api/types";

const componentTypes: ReadonlyArray<ComponentType> = ["COVERAGE", "EXPOSURE", "RULE"];

export default function ComponentsPage() {
  const [selectedType, setSelectedType] = useState<ComponentType>("COVERAGE");
  const type = useMemo<ComponentType>(
    () => (componentTypes.includes(selectedType) ? selectedType : "COVERAGE"),
    [selectedType],
  );

  const [components, setComponents] = useState<ReadonlyArray<ComponentDto>>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ componentCode: "", name: "", description: "" });

  const load = async () => {
    try {
      setComponents(await productManagementApi.listComponents(type));
      setError(null);
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Load failed";
      setError(message);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const raw = new URLSearchParams(window.location.search).get("type");
      if (raw && componentTypes.includes(raw as ComponentType)) {
        setSelectedType(raw as ComponentType);
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [type]);

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await productManagementApi.createComponent({
        componentCode: form.componentCode,
        type,
        name: form.name,
        description: form.description || null,
      });
      setForm({ componentCode: "", name: "", description: "" });
      await load();
    } catch (err) {
      const message = err instanceof ApiClientError ? `${err.code}: ${err.message}` : "Create failed";
      setError(message);
    }
  };

  return (
    <div className="grid grid-2">
      <section className="panel stack">
        <h1 style={{ margin: 0 }}>{type} Components</h1>
        {error ? <div className="error-box">{error}</div> : null}
        <ul className="list">
          {components.map((component) => (
            <li key={component.id}>
              <Link href={`/product-management/components/${component.id}`}>
                <strong>{component.name}</strong>
              </Link>
              <div className="muted">{component.componentCode}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Create {type} Component</h2>
        <form className="stack" onSubmit={onCreate}>
          <div className="stack">
            <label>Component Code</label>
            <input
              value={form.componentCode}
              onChange={(e) => setForm((prev) => ({ ...prev, componentCode: e.target.value }))}
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
              rows={4}
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <button className="primary" type="submit">
            Create Component
          </button>
        </form>
      </section>
    </div>
  );
}
