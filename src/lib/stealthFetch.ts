/**
 * LiveWorld Map — public source fetch utility.
 *
 * Public providers should see a stable, truthful application identity. This
 * helper intentionally does not spoof browser fingerprints, client IP headers,
 * or proxy-related headers. Callers remain responsible for each provider's
 * terms, attribution, caching and rate limits.
 */

const APP_USER_AGENT = 'LiveWorldMap/1.0 (+https://github.com/fcflo151/liveworld-map)';
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Stable headers for requests to documented public data sources.
 * Explicit caller headers win, except that no forwarding/IP-spoofing headers
 * are added automatically. Headers is used for merging so names are normalized
 * case-insensitively and a caller cannot accidentally create duplicate fields.
 */
export function publicSourceHeaders(extraHeaders?: HeadersInit): Record<string, string> {
  const headers = new Headers({
    'User-Agent': APP_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.8',
  });
  if (extraHeaders) {
    new Headers(extraHeaders).forEach((value, name) => headers.set(name, value));
  }
  return Object.fromEntries(headers.entries());
}

/**
 * Fetch a documented public source with a stable application identity and a
 * bounded timeout. The caller's AbortSignal is honored without replacing it.
 */
export async function publicSourceFetch(
  url: string | URL | Request,
  init?: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = init?.signal;
  const abortFromCaller = () => controller.abort(externalSignal?.reason);

  if (externalSignal?.aborted) {
    abortFromCaller();
  } else {
    externalSignal?.addEventListener('abort', abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(
    () => controller.abort(new Error('Public source fetch timed out')),
    Math.max(1, timeoutMs),
  );

  try {
    return await fetch(url, {
      ...init,
      headers: publicSourceHeaders(init?.headers),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', abortFromCaller);
  }
}

/**
 * @deprecated Kept as a compatibility alias while existing call sites migrate
 * to the accurately named publicSourceHeaders helper.
 */
export function stealthHeaders(extraHeaders?: Record<string, string>): Record<string, string> {
  return publicSourceHeaders(extraHeaders);
}

/**
 * @deprecated Kept as a compatibility alias. It no longer performs any
 * fingerprint or IP spoofing; use publicSourceFetch for new code.
 */
export async function stealthFetch(
  url: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  return publicSourceFetch(url, init);
}
