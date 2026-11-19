const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

type ApiError = { error?: { message?: string; code?: string } };

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  accessToken?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("Unable to reach the TestPilot API. Check that the API server is running.");
  }

  const payload = await response.json().catch(() => ({})) as ApiError;
  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Request failed with status ${response.status}`);
  }
  return payload as T;
}
