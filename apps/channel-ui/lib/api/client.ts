import { ApiClientError, type ApiErrorPayload } from "./types";

const createCorrelationId = (): string => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const buildPath = (path: string): string => {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `/api/core/${normalized}`;
};

export const apiRequest = async <T>(
  path: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(buildPath(path), {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-correlation-id": createCorrelationId(),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;
    throw new ApiClientError(response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};
