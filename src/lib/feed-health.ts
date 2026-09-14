/**
 * Feed health primitives for LiveWorld Map.
 *
 * This module intentionally contains no React or network code. Callers adapt an
 * API response into FeedHealthInput, then evaluate it against an explicit clock.
 * Supplying `now` makes the result deterministic and straightforward to test.
 */

export type FeedStatus = 'live' | 'stale' | 'degraded' | 'offline';
export type FeedTrustClass = 'official' | 'primary' | 'curated' | 'aggregated';
export type FeedTimestamp = number | string | Date | null | undefined;

export interface FeedHealthThresholds {
  /** Data becomes stale at or after this age. */
  staleAfterMs: number;
  /** Data is considered offline at or after this age. Must be >= staleAfterMs. */
  offlineAfterMs: number;
  /** Optional latency ceiling. Exceeding it marks otherwise-fresh data degraded. */
  degradedLatencyMs?: number;
  /** Optional minimum coverage expressed as 0..1. */
  minimumCoverage?: number;
  /** Optional minimum number of entries expected from a successful response. */
  minimumItemCount?: number;
}

export interface FeedHealthInput {
  id: string;
  name: string;
  url: string;
  trust: FeedTrustClass;
  /** Time the application most recently tried to refresh this source. */
  lastAttemptAt?: FeedTimestamp;
  /** Time the source most recently produced usable data. */
  lastSuccessAt?: FeedTimestamp;
  /** Outcome of the latest known attempt, when the caller can determine it. */
  attemptSucceeded?: boolean | null;
  /** Error detail from the latest attempt. Kept intentionally human-readable. */
  error?: string | null;
  latencyMs?: number | null;
  itemCount: number;
  /** Optional measured coverage ratio, 0..1. */
  coverage?: number | null;
  /** Expected refresh cadence. Used to derive age thresholds when provided. */
  expectedIntervalMs?: number;
  /** Per-source policy overrides. */
  thresholds?: Partial<FeedHealthThresholds>;
}

export interface FeedHealth {
  id: string;
  name: string;
  url: string;
  trust: FeedTrustClass;
  lastAttemptAt: number | null;
  lastSuccessAt: number | null;
  ageMs: number | null;
  status: FeedStatus;
  latencyMs: number | null;
  itemCount: number;
  coverage: number | null;
  thresholds: FeedHealthThresholds;
  /** One concise sentence explaining the deterministic status decision. */
  explanation: string;
}

export const DEFAULT_EXPECTED_INTERVAL_MS = 60_000;

export const DEFAULT_FEED_HEALTH_THRESHOLDS: FeedHealthThresholds = Object.freeze({
  staleAfterMs: DEFAULT_EXPECTED_INTERVAL_MS * 3,
  offlineAfterMs: DEFAULT_EXPECTED_INTERVAL_MS * 10,
  degradedLatencyMs: 5_000,
  minimumCoverage: 0,
  minimumItemCount: 0,
});

export const FEED_STATUS_ORDER: readonly FeedStatus[] = Object.freeze([
  'live',
  'degraded',
  'stale',
  'offline',
]);

function finiteNonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

/** Convert common timestamp representations to epoch milliseconds. */
export function toFeedEpochMs(value: FeedTimestamp): number | null {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : null;
  }
  return null;
}

/**
 * Resolve source-specific thresholds.
 *
 * By default stale = 3 expected refresh intervals and offline = 10 intervals.
 * Absolute threshold overrides always win, which is useful for feeds whose
 * upstream publication cadence differs from the application's poll cadence.
 */
export function resolveFeedHealthThresholds(input: Pick<FeedHealthInput, 'expectedIntervalMs' | 'thresholds'>): FeedHealthThresholds {
  const interval = finiteNonNegative(input.expectedIntervalMs) || DEFAULT_EXPECTED_INTERVAL_MS;
  const staleCandidate = finiteNonNegative(input.thresholds?.staleAfterMs) ?? interval * 3;
  const offlineCandidate = finiteNonNegative(input.thresholds?.offlineAfterMs) ?? interval * 10;
  const staleAfterMs = Math.max(1, staleCandidate);
  const offlineAfterMs = Math.max(staleAfterMs, offlineCandidate);

  const degradedLatencyMs = finiteNonNegative(input.thresholds?.degradedLatencyMs)
    ?? DEFAULT_FEED_HEALTH_THRESHOLDS.degradedLatencyMs;
  const minimumCoverageRaw = finiteNonNegative(input.thresholds?.minimumCoverage)
    ?? DEFAULT_FEED_HEALTH_THRESHOLDS.minimumCoverage;
  const minimumCoverage = Math.min(1, minimumCoverageRaw ?? 0);
  const minimumItemCount = Math.floor(
    finiteNonNegative(input.thresholds?.minimumItemCount)
      ?? DEFAULT_FEED_HEALTH_THRESHOLDS.minimumItemCount
      ?? 0,
  );

  return {
    staleAfterMs,
    offlineAfterMs,
    degradedLatencyMs: degradedLatencyMs ?? undefined,
    minimumCoverage,
    minimumItemCount,
  };
}

/** Human-readable compact age for panels and explanations. */
export function formatFeedAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return 'unknown';
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function latestAttemptFailed(
  attemptSucceeded: boolean | null | undefined,
  error: string | null | undefined,
  lastAttemptAt: number | null,
  lastSuccessAt: number,
): boolean {
  const explicitFailure = attemptSucceeded === false || Boolean(error?.trim());
  if (!explicitFailure) return false;
  // If the failure has a timestamp, only count it when it happened at or after
  // the last success. A later success means the source recovered.
  return lastAttemptAt == null || lastAttemptAt >= lastSuccessAt;
}

/**
 * Deterministically classify one source at `now`.
 *
 * Severity precedence is offline -> stale -> degraded -> live. This keeps an
 * old dataset labelled stale/offline even when it also has a latency or
 * coverage problem; degraded is reserved for fresh-but-impaired data.
 */
export function evaluateFeedHealth(input: FeedHealthInput, now: number = Date.now()): FeedHealth {
  const safeNow = Number.isFinite(now) ? now : Date.now();
  const thresholds = resolveFeedHealthThresholds(input);
  const lastAttemptAt = toFeedEpochMs(input.lastAttemptAt);
  const lastSuccessAt = toFeedEpochMs(input.lastSuccessAt);
  const ageMs = lastSuccessAt == null ? null : Math.max(0, safeNow - lastSuccessAt);
  const latencyMs = finiteNonNegative(input.latencyMs);
  const itemCount = Math.max(0, Math.floor(finiteNonNegative(input.itemCount) ?? 0));
  const coverageValue = finiteNonNegative(input.coverage);
  const coverage = coverageValue == null ? null : Math.min(1, coverageValue);

  let status: FeedStatus;
  let explanation: string;

  if (lastSuccessAt == null) {
    status = 'offline';
    if (lastAttemptAt != null) {
      explanation = `Offline: no usable update has succeeded; last attempt was ${formatFeedAge(Math.max(0, safeNow - lastAttemptAt))} ago.`;
    } else {
      explanation = 'Offline: no successful update has been recorded yet.';
    }
  } else if ((ageMs ?? 0) >= thresholds.offlineAfterMs) {
    status = 'offline';
    explanation = `Offline: last usable data is ${formatFeedAge(ageMs)} old, beyond the ${formatFeedAge(thresholds.offlineAfterMs)} offline limit.`;
  } else if ((ageMs ?? 0) >= thresholds.staleAfterMs) {
    status = 'stale';
    explanation = `Stale: last usable data is ${formatFeedAge(ageMs)} old, beyond the ${formatFeedAge(thresholds.staleAfterMs)} freshness limit.`;
  } else {
    const degradedReasons: string[] = [];
    if (latestAttemptFailed(input.attemptSucceeded, input.error, lastAttemptAt, lastSuccessAt)) {
      degradedReasons.push(input.error?.trim() ? `latest refresh failed (${input.error.trim()})` : 'latest refresh failed');
    }
    if (latencyMs != null && thresholds.degradedLatencyMs != null && latencyMs > thresholds.degradedLatencyMs) {
      degradedReasons.push(`latency ${Math.round(latencyMs)}ms exceeds ${Math.round(thresholds.degradedLatencyMs)}ms`);
    }
    if (coverage != null && thresholds.minimumCoverage != null && coverage < thresholds.minimumCoverage) {
      degradedReasons.push(`coverage ${Math.round(coverage * 100)}% is below ${Math.round(thresholds.minimumCoverage * 100)}%`);
    }
    if (thresholds.minimumItemCount != null && itemCount < thresholds.minimumItemCount) {
      degradedReasons.push(`${itemCount} entries is below the expected minimum of ${thresholds.minimumItemCount}`);
    }

    if (degradedReasons.length) {
      status = 'degraded';
      explanation = `Degraded: data is fresh (${formatFeedAge(ageMs)} old), but ${degradedReasons.join('; ')}.`;
    } else {
      status = 'live';
      explanation = `Live: usable data is ${formatFeedAge(ageMs)} old and no degradation threshold is exceeded.`;
    }
  }

  return {
    id: input.id,
    name: input.name,
    url: input.url,
    trust: input.trust,
    lastAttemptAt,
    lastSuccessAt,
    ageMs,
    status,
    latencyMs,
    itemCount,
    coverage,
    thresholds,
    explanation,
  };
}

/** Evaluate several sources against the exact same clock tick. */
export function evaluateFeedHealthMany(inputs: readonly FeedHealthInput[], now: number = Date.now()): FeedHealth[] {
  return inputs.map(input => evaluateFeedHealth(input, now));
}

/** Group evaluated sources in stable UI order without mutating the input. */
export function groupFeedHealthByStatus(feeds: readonly FeedHealth[]): Record<FeedStatus, FeedHealth[]> {
  const grouped: Record<FeedStatus, FeedHealth[]> = {
    live: [],
    degraded: [],
    stale: [],
    offline: [],
  };
  for (const feed of feeds) grouped[feed.status].push(feed);
  for (const status of FEED_STATUS_ORDER) {
    grouped[status].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }
  return grouped;
}
