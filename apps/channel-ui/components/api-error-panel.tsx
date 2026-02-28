import type { ApiClientError } from "@/lib/api/types";

export function ApiErrorPanel({ error }: { error: ApiClientError | Error | null }) {
  if (!error) {
    return null;
  }

  if ("code" in error) {
    const apiError = error as ApiClientError;
    return (
      <div className="error-box">
        <div>
          <strong>{apiError.code}</strong>: {apiError.message}
        </div>
        {apiError.fieldErrors.length > 0 ? (
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {apiError.fieldErrors.map((fieldError, index) => (
              <li key={`${fieldError.field ?? "field"}-${index}`}>
                {fieldError.field ? `${fieldError.field}: ` : ""}
                {fieldError.message}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return <div className="error-box">{error.message}</div>;
}
