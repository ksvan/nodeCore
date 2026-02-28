"use client";

import { useMemo } from "react";

export function JsonTextarea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const error = useMemo(() => {
    try {
      JSON.parse(value || "{}");
      return null;
    } catch {
      return "Invalid JSON";
    }
  }, [value]);

  return (
    <div className="stack">
      <label>{label}</label>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={8} />
      {error ? <div className="error-box">{error}</div> : null}
    </div>
  );
}
