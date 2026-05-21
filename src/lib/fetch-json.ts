/**
 * Parse a fetch Response as JSON; surface readable errors when the body is HTML/plain text.
 */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  let body: unknown;
  try {
    body = text.length > 0 ? JSON.parse(text) : {};
  } catch {
    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 120);
    if (!res.ok) {
      throw new Error(
        snippet
          ? `Server error (${res.status}): ${snippet}`
          : `Server error (${res.status})`,
      );
    }
    throw new Error("Invalid response from server (not JSON)");
  }

  const record = body as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof record.error === "string"
        ? record.error
        : `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return body as T;
}
