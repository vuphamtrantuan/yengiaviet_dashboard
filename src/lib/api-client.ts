/**
 * Typed fetch helpers shared by client components.
 * Centralizes timeout, JSON parsing, and error extraction.
 */

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fetch JSON with an AbortController timeout and typed error handling. */
export async function fetchJson<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
      headers: {
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers,
      },
    });

    const payload = (await response.json().catch(() => null)) as
      | ({ error?: string } & T)
      | null;

    if (!response.ok) {
      throw new ApiError(
        payload && typeof payload === "object" && "error" in payload
          ? payload.error ?? "Yêu cầu thất bại."
          : "Yêu cầu thất bại.",
        response.status
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new ApiError("Yêu cầu quá thời gian chờ.", 408);
    }
    throw new ApiError("Không thể kết nối đến máy chủ.", 0);
  } finally {
    clearTimeout(timeoutId);
  }
}
