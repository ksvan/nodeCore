"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ApiErrorPanel } from "@/components/api-error-panel";
import { JsonTextarea } from "@/components/json-textarea";
import { StatusBadge } from "@/components/status-badge";
import { policyApi } from "@/lib/api/policy";
import {
  ApiClientError,
  type CoverageTermValueType,
  type CurrencyCode,
  type PolicyRiskType,
  type PolicyTransactionDto,
} from "@/lib/api/types";

type RiskRow = {
  id: string;
  riskType: PolicyRiskType;
  riskKey: string;
  attributesText: string;
};

type CoverageRow = {
  id: string;
  coverageCode: string;
  appliesToRiskKey: string;
  attributesText: string;
};

type CoverageTermRow = {
  id: string;
  coverageCode: string;
  appliesToRiskKey: string;
  termCode: string;
  valueType: CoverageTermValueType;
  moneyAmount: string;
  moneyCurrency: string;
  numberValue: string;
  stringValue: string;
  booleanValue: "" | "true" | "false";
};

const RISK_TYPES: ReadonlyArray<PolicyRiskType> = ["VEHICLE", "PROPERTY", "LOCATION", "PERSON", "OTHER"];
const TERM_VALUE_TYPES: ReadonlyArray<CoverageTermValueType> = ["MONEY", "NUMBER", "STRING", "BOOLEAN"];
const CURRENCIES: ReadonlyArray<CurrencyCode> = ["SEK", "DKK", "EUR", "GBP", "USD", "NOK"];

const createRowId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const parseJsonObject = (value: string): Record<string, unknown> => {
  const parsed = JSON.parse(value || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Attributes must be a JSON object");
  }
  return parsed as Record<string, unknown>;
};

const isCommitted = (tx: PolicyTransactionDto | null): boolean => tx?.status === "COMMITTED";

export default function PolicyTransactionWorkspacePage() {
  const params = useParams<{ transactionId: string }>();
  const router = useRouter();
  const transactionId = useMemo(() => String(params.transactionId), [params.transactionId]);

  const [tx, setTx] = useState<PolicyTransactionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const [risks, setRisks] = useState<ReadonlyArray<RiskRow>>([
    { id: createRowId(), riskType: "VEHICLE", riskKey: "", attributesText: "{}" },
  ]);
  const [coverages, setCoverages] = useState<ReadonlyArray<CoverageRow>>([
    { id: createRowId(), coverageCode: "", appliesToRiskKey: "", attributesText: "{}" },
  ]);
  const [terms, setTerms] = useState<ReadonlyArray<CoverageTermRow>>([
    {
      id: createRowId(),
      coverageCode: "",
      appliesToRiskKey: "",
      termCode: "",
      valueType: "NUMBER",
      moneyAmount: "",
      moneyCurrency: "SEK",
      numberValue: "",
      stringValue: "",
      booleanValue: "",
    },
  ]);

  const [validIssues, setValidIssues] = useState<ReadonlyArray<string>>([]);
  const [rateCurrency, setRateCurrency] = useState<CurrencyCode>("SEK");
  const [rateResult, setRateResult] = useState<{
    requestId: string;
    totalPremium: string;
    currency: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await policyApi.getTransaction(transactionId);
      setTx(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to load transaction"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [transactionId]);

  const saveRisks = async () => {
    try {
      await policyApi.replaceRisks(
        transactionId,
        risks.map((row) => ({
          riskType: row.riskType,
          riskKey: row.riskKey.trim() ? row.riskKey.trim() : null,
          attributes: parseJsonObject(row.attributesText),
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save risks"));
    }
  };

  const saveCoverages = async () => {
    try {
      await policyApi.replaceCoverages(
        transactionId,
        coverages.map((row) => ({
          coverageCode: row.coverageCode.trim(),
          appliesToRiskKey: row.appliesToRiskKey.trim() ? row.appliesToRiskKey.trim() : null,
          attributes: parseJsonObject(row.attributesText),
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save coverages"));
    }
  };

  const saveTerms = async () => {
    try {
      await policyApi.replaceCoverageTerms(
        transactionId,
        terms.map((row) => ({
          coverageCode: row.coverageCode.trim(),
          appliesToRiskKey: row.appliesToRiskKey.trim() ? row.appliesToRiskKey.trim() : null,
          termCode: row.termCode.trim(),
          valueType: row.valueType,
          moneyAmount: row.valueType === "MONEY" && row.moneyAmount.trim() ? row.moneyAmount.trim() : null,
          moneyCurrency: row.valueType === "MONEY" && row.moneyCurrency.trim() ? row.moneyCurrency.trim() : null,
          numberValue: row.valueType === "NUMBER" && row.numberValue.trim() ? row.numberValue.trim() : null,
          stringValue: row.valueType === "STRING" && row.stringValue.trim() ? row.stringValue.trim() : null,
          booleanValue:
            row.valueType === "BOOLEAN"
              ? row.booleanValue === "true"
                ? true
                : row.booleanValue === "false"
                  ? false
                  : null
              : null,
        })),
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Failed to save coverage terms"));
    }
  };

  const validate = async () => {
    try {
      const result = await policyApi.validateTransaction(transactionId);
      setValidIssues(result.issues);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Validation failed"));
    }
  };

  const rate = async () => {
    try {
      const result = await policyApi.rateTransaction(transactionId, rateCurrency);
      setRateResult(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Rating failed"));
    }
  };

  const commit = async () => {
    try {
      const result = await policyApi.commitTransaction(transactionId);
      setError(null);
      router.push(`/policy/policies/${result.policyId}`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Commit failed"));
    }
  };

  const riskKeyOptions = risks
    .map((row) => row.riskKey.trim())
    .filter((value, index, arr) => value.length > 0 && arr.indexOf(value) === index);

  return (
    <div className="grid">
      <section className="panel stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h1 style={{ margin: 0 }}>Transaction Workspace</h1>
          {tx ? <StatusBadge status={tx.status} /> : null}
        </div>
        <div className="muted">transactionId: {transactionId}</div>
        {tx ? (
          <>
            <div className="muted">type: {tx.type}</div>
            <div className="muted">effectiveAt: {new Date(tx.effectiveAt).toLocaleString()}</div>
            <div className="muted">createdAt: {new Date(tx.createdAt).toLocaleString()}</div>
            <div>
              <Link href={`/policy/policies/${tx.policyId}`}>Open policy</Link>
            </div>
          </>
        ) : null}
        <p className="muted" style={{ marginBottom: 0 }}>
          TODO (API): no read-draft endpoint exists for risks/coverages/terms yet. This UI edits and replaces draft
          lists, but cannot prefill server draft state on reload.
        </p>
      </section>

      <ApiErrorPanel error={error} />

      {loading ? <p className="muted">Loading transaction...</p> : null}

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Risks</h2>
        {risks.map((row, index) => (
          <div key={row.id} className="panel stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Risk #{index + 1}</strong>
              <button
                onClick={() => setRisks((prev) => prev.filter((item) => item.id !== row.id))}
                disabled={isCommitted(tx) || risks.length === 1}
              >
                Remove
              </button>
            </div>
            <div className="grid grid-2">
              <div className="stack">
                <label>Risk Type</label>
                <select
                  value={row.riskType}
                  onChange={(event) =>
                    setRisks((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, riskType: event.target.value as PolicyRiskType } : item)),
                    )
                  }
                  disabled={isCommitted(tx)}
                >
                  {RISK_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="stack">
                <label>Risk Key</label>
                <input
                  value={row.riskKey}
                  onChange={(event) =>
                    setRisks((prev) => prev.map((item) => (item.id === row.id ? { ...item, riskKey: event.target.value } : item)))
                  }
                  disabled={isCommitted(tx)}
                  placeholder="VIN-123 / building-7 / optional"
                />
              </div>
            </div>
            <JsonTextarea
              label="Attributes JSON"
              value={row.attributesText}
              onChange={(next) =>
                setRisks((prev) => prev.map((item) => (item.id === row.id ? { ...item, attributesText: next } : item)))
              }
            />
          </div>
        ))}

        <div className="row">
          <button
            onClick={() =>
              setRisks((prev) => [
                ...prev,
                { id: createRowId(), riskType: "VEHICLE", riskKey: "", attributesText: "{}" },
              ])
            }
            disabled={isCommitted(tx)}
          >
            Add Risk
          </button>
          <button className="primary" onClick={() => void saveRisks()} disabled={isCommitted(tx)}>
            Save Risks
          </button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Coverages</h2>
        {coverages.map((row, index) => (
          <div key={row.id} className="panel stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Coverage #{index + 1}</strong>
              <button
                onClick={() => setCoverages((prev) => prev.filter((item) => item.id !== row.id))}
                disabled={isCommitted(tx) || coverages.length === 1}
              >
                Remove
              </button>
            </div>
            <div className="grid grid-2">
              <div className="stack">
                <label>Coverage Code</label>
                <input
                  value={row.coverageCode}
                  onChange={(event) =>
                    setCoverages((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, coverageCode: event.target.value } : item)),
                    )
                  }
                  disabled={isCommitted(tx)}
                />
              </div>
              <div className="stack">
                <label>Applies To Risk Key (optional)</label>
                <select
                  value={row.appliesToRiskKey}
                  onChange={(event) =>
                    setCoverages((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, appliesToRiskKey: event.target.value } : item,
                      ),
                    )
                  }
                  disabled={isCommitted(tx)}
                >
                  <option value="">(policy-level)</option>
                  {riskKeyOptions.map((riskKey) => (
                    <option key={riskKey} value={riskKey}>
                      {riskKey}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <JsonTextarea
              label="Attributes JSON"
              value={row.attributesText}
              onChange={(next) =>
                setCoverages((prev) => prev.map((item) => (item.id === row.id ? { ...item, attributesText: next } : item)))
              }
            />
          </div>
        ))}

        <div className="row">
          <button
            onClick={() =>
              setCoverages((prev) => [
                ...prev,
                { id: createRowId(), coverageCode: "", appliesToRiskKey: "", attributesText: "{}" },
              ])
            }
            disabled={isCommitted(tx)}
          >
            Add Coverage
          </button>
          <button className="primary" onClick={() => void saveCoverages()} disabled={isCommitted(tx)}>
            Save Coverages
          </button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Coverage Terms</h2>
        {terms.map((row, index) => (
          <div key={row.id} className="panel stack">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <strong>Term #{index + 1}</strong>
              <button
                onClick={() => setTerms((prev) => prev.filter((item) => item.id !== row.id))}
                disabled={isCommitted(tx) || terms.length === 1}
              >
                Remove
              </button>
            </div>

            <div className="grid grid-2">
              <div className="stack">
                <label>Coverage Code</label>
                <input
                  value={row.coverageCode}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, coverageCode: event.target.value } : item)),
                    )
                  }
                  disabled={isCommitted(tx)}
                />
              </div>
              <div className="stack">
                <label>Applies To Risk Key (optional)</label>
                <select
                  value={row.appliesToRiskKey}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, appliesToRiskKey: event.target.value } : item,
                      ),
                    )
                  }
                  disabled={isCommitted(tx)}
                >
                  <option value="">(policy-level)</option>
                  {riskKeyOptions.map((riskKey) => (
                    <option key={riskKey} value={riskKey}>
                      {riskKey}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-2">
              <div className="stack">
                <label>Term Code</label>
                <input
                  value={row.termCode}
                  onChange={(event) =>
                    setTerms((prev) => prev.map((item) => (item.id === row.id ? { ...item, termCode: event.target.value } : item)))
                  }
                  disabled={isCommitted(tx)}
                />
              </div>
              <div className="stack">
                <label>Value Type</label>
                <select
                  value={row.valueType}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) =>
                        item.id === row.id ? { ...item, valueType: event.target.value as CoverageTermValueType } : item,
                      ),
                    )
                  }
                  disabled={isCommitted(tx)}
                >
                  {TERM_VALUE_TYPES.map((valueType) => (
                    <option key={valueType} value={valueType}>
                      {valueType}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {row.valueType === "MONEY" ? (
              <div className="grid grid-2">
                <div className="stack">
                  <label>Money Amount</label>
                  <input
                    value={row.moneyAmount}
                    onChange={(event) =>
                      setTerms((prev) =>
                        prev.map((item) => (item.id === row.id ? { ...item, moneyAmount: event.target.value } : item)),
                      )
                    }
                    disabled={isCommitted(tx)}
                  />
                </div>
                <div className="stack">
                  <label>Currency</label>
                  <select
                    value={row.moneyCurrency}
                    onChange={(event) =>
                      setTerms((prev) =>
                        prev.map((item) => (item.id === row.id ? { ...item, moneyCurrency: event.target.value } : item)),
                      )
                    }
                    disabled={isCommitted(tx)}
                  >
                    {CURRENCIES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {row.valueType === "NUMBER" ? (
              <div className="stack">
                <label>Number Value</label>
                <input
                  value={row.numberValue}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, numberValue: event.target.value } : item)),
                    )
                  }
                  disabled={isCommitted(tx)}
                />
              </div>
            ) : null}

            {row.valueType === "STRING" ? (
              <div className="stack">
                <label>String Value</label>
                <input
                  value={row.stringValue}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) => (item.id === row.id ? { ...item, stringValue: event.target.value } : item)),
                    )
                  }
                  disabled={isCommitted(tx)}
                />
              </div>
            ) : null}

            {row.valueType === "BOOLEAN" ? (
              <div className="stack">
                <label>Boolean Value</label>
                <select
                  value={row.booleanValue}
                  onChange={(event) =>
                    setTerms((prev) =>
                      prev.map((item) =>
                        item.id === row.id
                          ? { ...item, booleanValue: event.target.value as "" | "true" | "false" }
                          : item,
                      ),
                    )
                  }
                  disabled={isCommitted(tx)}
                >
                  <option value="">(unset)</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              </div>
            ) : null}
          </div>
        ))}

        <div className="row">
          <button
            onClick={() =>
              setTerms((prev) => [
                ...prev,
                {
                  id: createRowId(),
                  coverageCode: "",
                  appliesToRiskKey: "",
                  termCode: "",
                  valueType: "NUMBER",
                  moneyAmount: "",
                  moneyCurrency: "SEK",
                  numberValue: "",
                  stringValue: "",
                  booleanValue: "",
                },
              ])
            }
            disabled={isCommitted(tx)}
          >
            Add Term
          </button>
          <button className="primary" onClick={() => void saveTerms()} disabled={isCommitted(tx)}>
            Save Terms
          </button>
        </div>
      </section>

      <section className="panel stack">
        <h2 style={{ margin: 0 }}>Validate + Rate + Commit</h2>

        <div className="row">
          <button onClick={() => void validate()} disabled={isCommitted(tx)}>
            Validate Transaction
          </button>
          <button className="primary" onClick={() => void rate()} disabled={isCommitted(tx)}>
            Rate Transaction
          </button>
          <select
            value={rateCurrency}
            onChange={(event) => setRateCurrency(event.target.value as CurrencyCode)}
            disabled={isCommitted(tx)}
          >
            {CURRENCIES.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
          <button className="primary" onClick={() => void commit()} disabled={isCommitted(tx)}>
            Commit Transaction
          </button>
        </div>

        {validIssues.length > 0 ? (
          <div className="error-box">
            <strong>Validation issues</strong>
            <ul>
              {validIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {rateResult ? (
          <div className="panel stack">
            <div>
              <strong>Premium Total:</strong> {rateResult.totalPremium} {rateResult.currency}
            </div>
            <div className="muted">requestId: {rateResult.requestId}</div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
