import axios from "axios";
import type { ApiError } from "@/api/types";

export function parseApiError(error: unknown): ApiError | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data;
    if (data && typeof data === "object" && "message" in data && "code" in data) {
      return data as ApiError;
    }
  }
  return null;
}

export function getErrorMessage(error: unknown, fallback = "Unbekannter Fehler") {
  const apiError = parseApiError(error);
  if (apiError?.message) {
    return apiError.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return fallback;
}
