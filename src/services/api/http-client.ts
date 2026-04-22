import { getAuthToken, refreshAuthSession } from "@/app/auth/auth-store";
import { resolveApiErrorMessage, resolvePlainErrorMessage, type ApiErrorLocale } from "@/services/api/api-error-resolver";

type RuntimeConfig = Partial<Record<string, string | boolean | null | undefined>>;

declare global {
  interface Window {
    __MSC_RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export type ApiFieldError = {
  field: string;
  code: string;
  message: string;
};

export type ApiErrorPayload = {
  ok?: boolean;
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
  fieldErrors?: ApiFieldError[];
};

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Record<string, unknown>;
  fieldErrors?: ApiFieldError[];

  constructor(status: number, payload?: ApiErrorPayload) {
    super(payload?.message || `API request failed (${status})`);
    this.name = "ApiError";
    this.status = status;
    this.code = payload?.code;
    this.details = payload?.details;
    this.fieldErrors = payload?.fieldErrors;
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  auth?: boolean;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  headers?: Record<string, string>;
};

function readConfigValue(envKey: string, runtimeKey: string, fallback = ""): string {
  const runtimeConfig = window.__MSC_RUNTIME_CONFIG__;
  const runtimeValue = runtimeConfig?.[runtimeKey] ?? runtimeConfig?.[envKey];
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return String(runtimeValue).trim();
  }
  const envValue = (import.meta.env as Record<string, unknown>)[envKey];
  if (envValue !== undefined && envValue !== null) {
    return String(envValue).trim();
  }
  return fallback;
}

function resolveBaseUrl(): string {
  const runtimeConfig = window.__MSC_RUNTIME_CONFIG__;
  const runtimeValue = runtimeConfig?.apiBaseUrl ?? runtimeConfig?.VITE_API_BASE_URL;
  if (runtimeValue !== undefined && runtimeValue !== null) {
    return String(runtimeValue).trim().replace(/\/$/, "");
  }

  const env = import.meta.env as Record<string, unknown>;
  const proxyTarget = env.VITE_API_PROXY_TARGET;
  if (import.meta.env.DEV && proxyTarget !== undefined && proxyTarget !== null && String(proxyTarget).trim()) {
    return "/api";
  }

  const envValue = env.VITE_API_BASE_URL;
  if (envValue !== undefined && envValue !== null) {
    return String(envValue).trim().replace(/\/$/, "");
  }

  return "";
}

const baseUrl = resolveBaseUrl();

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const url = new URL(`${baseUrl}${normalizedPath}`, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return baseUrl ? url.toString() : `${normalizedPath}${url.search}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const raw = await response.text().catch(() => "");
  const text = raw.trim();
  if (!text) {
    return null;
  }

  const looksLikeJson = text.startsWith("{") || text.startsWith("[");
  if (!contentType.includes("json") && !looksLikeJson) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const sendRequest = async (token: string | null) => {
    const headers: Record<string, string> = {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {})
    };

    return fetch(buildUrl(path, options.query), {
      method: options.method || "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined
    });
  };

  const token = options.auth === false ? null : getAuthToken();
  let response = await sendRequest(token);

  if (options.auth !== false && response.status === 401 && token) {
    const refreshed = await refreshAuthSession();
    const refreshedToken = refreshed?.apiToken ?? getAuthToken();
    if (refreshedToken && refreshedToken !== token) {
      response = await sendRequest(refreshedToken);
    }
  }

  const parsed = (await parseResponseBody(response)) as ApiErrorPayload | T | null;
  if (!response.ok) {
    throw new ApiError(response.status, (parsed as ApiErrorPayload | null) ?? undefined);
  }

  return (parsed ?? ({} as T)) as T;
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "Ein unerwarteter Fehler ist aufgetreten.",
  locale: ApiErrorLocale = "de"
) {
  if (error instanceof ApiError) {
    return resolveApiErrorMessage({ status: error.status, code: error.code, message: error.message }, fallback, locale);
  }
  if (error instanceof Error && error.message) {
    return resolvePlainErrorMessage(error.message, fallback, locale);
  }
  return fallback;
}
