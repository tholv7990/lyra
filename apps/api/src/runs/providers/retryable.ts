// True when a provider error is transient enough that retrying on ANOTHER provider
// could succeed: rate limits (429), server/overload errors (5xx incl Anthropic 529),
// network/timeouts, and quota markers. A client error (400/401/403/404/422 — a
// malformed prompt or a bad key) is NOT retryable; falling back would only mask a
// config error. Unknown shapes default to non-retryable (conservative — don't fan a
// mystery error across every provider's key).
// ponytail: substring heuristic on the message when no status is present; upgrade
// path is typed errors from the provider clients if this proves too loose.
export function isRetryableProviderError(err: unknown): boolean {
  const status = httpStatus(err);
  if (status !== undefined) return status === 429 || status >= 500;

  const msg = (err instanceof Error ? err.message : String(err ?? '')).toLowerCase();
  if (!msg) return false;
  return (
    /\b(429|529)\b/.test(msg) ||
    /rate.?limit|too many requests|overloaded|insufficient_quota|\bquota\b/.test(msg) ||
    /timeout|timed out|etimedout|econnreset|econnrefused|enotfound|socket hang up|fetch failed|network error/.test(msg) ||
    /internal server error|bad gateway|service unavailable|gateway timeout|\b50[0-9]\b/.test(msg)
  );
}

// Pull an HTTP status off the common error shapes: a Nest HttpException
// (getStatus()), a plain { status } / { statusCode }, or { response.status }.
function httpStatus(err: unknown): number | undefined {
  if (!err || typeof err !== 'object') return undefined;
  const e = err as Record<string, unknown>;
  const get = (e as { getStatus?: () => number }).getStatus;
  if (typeof get === 'function') {
    try { return get.call(e); } catch { /* fall through to plain fields */ }
  }
  if (typeof e.status === 'number') return e.status;
  if (typeof e.statusCode === 'number') return e.statusCode;
  const resp = e.response as { status?: unknown } | undefined;
  if (resp && typeof resp.status === 'number') return resp.status;
  return undefined;
}
