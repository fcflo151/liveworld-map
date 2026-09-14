import { describe, expect, it } from 'vitest';
import {
  evaluateFeedHealth,
  evaluateFeedHealthMany,
  formatFeedAge,
  groupFeedHealthByStatus,
  resolveFeedHealthThresholds,
  toFeedEpochMs,
  type FeedHealthInput,
} from './feed-health';

const NOW = Date.UTC(2026, 8, 14, 16, 0, 0);

function source(overrides: Partial<FeedHealthInput> = {}): FeedHealthInput {
  return {
    id: 'usgs-earthquakes',
    name: 'USGS Earthquakes',
    url: 'https://earthquake.usgs.gov/',
    trust: 'official',
    lastAttemptAt: NOW - 5_000,
    lastSuccessAt: NOW - 5_000,
    attemptSucceeded: true,
    latencyMs: 180,
    itemCount: 42,
    expectedIntervalMs: 60_000,
    ...overrides,
  };
}

describe('feed timestamp and policy helpers', () => {
  it('accepts epoch, ISO string and Date timestamps and rejects invalid values', () => {
    expect(toFeedEpochMs(NOW)).toBe(NOW);
    expect(toFeedEpochMs(new Date(NOW))).toBe(NOW);
    expect(toFeedEpochMs(new Date(NOW).toISOString())).toBe(NOW);
    expect(toFeedEpochMs('not-a-date')).toBeNull();
    expect(toFeedEpochMs(Number.NaN)).toBeNull();
    expect(toFeedEpochMs(null)).toBeNull();
  });

  it('derives stale/offline limits from expected cadence and honors overrides', () => {
    expect(resolveFeedHealthThresholds({ expectedIntervalMs: 10_000 }).staleAfterMs).toBe(30_000);
    expect(resolveFeedHealthThresholds({ expectedIntervalMs: 10_000 }).offlineAfterMs).toBe(100_000);
    expect(resolveFeedHealthThresholds({
      expectedIntervalMs: 10_000,
      thresholds: { staleAfterMs: 12_000, offlineAfterMs: 11_000 },
    })).toMatchObject({ staleAfterMs: 12_000, offlineAfterMs: 12_000 });
  });

  it('formats compact ages', () => {
    expect(formatFeedAge(null)).toBe('unknown');
    expect(formatFeedAge(12_999)).toBe('12s');
    expect(formatFeedAge(90_000)).toBe('1m');
    expect(formatFeedAge(7_200_000)).toBe('2h');
    expect(formatFeedAge(3 * 86_400_000)).toBe('3d');
  });
});

describe('evaluateFeedHealth', () => {
  it('marks fresh healthy data live', () => {
    const health = evaluateFeedHealth(source(), NOW);
    expect(health.status).toBe('live');
    expect(health.ageMs).toBe(5_000);
    expect(health.explanation).toContain('Live:');
  });

  it('uses the exact stale boundary deterministically', () => {
    const health = evaluateFeedHealth(source({ lastSuccessAt: NOW - 180_000 }), NOW);
    expect(health.status).toBe('stale');
    expect(health.explanation).toContain('freshness limit');
  });

  it('uses the exact offline boundary and gives it precedence over other faults', () => {
    const health = evaluateFeedHealth(source({
      lastSuccessAt: NOW - 600_000,
      attemptSucceeded: false,
      error: 'HTTP 503',
      latencyMs: 20_000,
    }), NOW);
    expect(health.status).toBe('offline');
    expect(health.explanation).toContain('offline limit');
  });

  it('marks a source with no successful payload offline', () => {
    const health = evaluateFeedHealth(source({ lastSuccessAt: null, attemptSucceeded: false }), NOW);
    expect(health.status).toBe('offline');
    expect(health.ageMs).toBeNull();
    expect(health.explanation).toContain('no usable update');
  });

  it('marks fresh data degraded when the most recent refresh failed', () => {
    const health = evaluateFeedHealth(source({
      lastSuccessAt: NOW - 20_000,
      lastAttemptAt: NOW - 2_000,
      attemptSucceeded: false,
      error: 'timeout',
    }), NOW);
    expect(health.status).toBe('degraded');
    expect(health.explanation).toContain('timeout');
  });

  it('does not keep an older failure degraded after a newer success', () => {
    const health = evaluateFeedHealth(source({
      lastAttemptAt: NOW - 60_000,
      lastSuccessAt: NOW - 5_000,
      attemptSucceeded: false,
      error: 'old timeout',
    }), NOW);
    expect(health.status).toBe('live');
  });

  it('marks fresh high-latency data degraded', () => {
    const health = evaluateFeedHealth(source({
      latencyMs: 5_001,
      thresholds: { degradedLatencyMs: 5_000 },
    }), NOW);
    expect(health.status).toBe('degraded');
    expect(health.explanation).toContain('latency');
  });

  it('marks fresh low-coverage data degraded only when a coverage floor is configured', () => {
    expect(evaluateFeedHealth(source({ coverage: 0.3 }), NOW).status).toBe('live');
    const health = evaluateFeedHealth(source({
      coverage: 0.3,
      thresholds: { minimumCoverage: 0.5 },
    }), NOW);
    expect(health.status).toBe('degraded');
    expect(health.explanation).toContain('coverage 30%');
  });

  it('marks unexpectedly empty fresh data degraded when a minimum count is configured', () => {
    const health = evaluateFeedHealth(source({
      itemCount: 0,
      thresholds: { minimumItemCount: 1 },
    }), NOW);
    expect(health.status).toBe('degraded');
    expect(health.explanation).toContain('expected minimum');
  });

  it('clamps future-success age to zero rather than producing a negative age', () => {
    const health = evaluateFeedHealth(source({ lastSuccessAt: NOW + 10_000 }), NOW);
    expect(health.ageMs).toBe(0);
    expect(health.status).toBe('live');
  });

  it('normalizes negative/non-finite metrics safely', () => {
    const health = evaluateFeedHealth(source({
      itemCount: -9,
      latencyMs: Number.NaN,
      coverage: 9,
    }), NOW);
    expect(health.itemCount).toBe(0);
    expect(health.latencyMs).toBeNull();
    expect(health.coverage).toBe(1);
  });
});

describe('collections', () => {
  it('evaluates every feed against the same supplied clock', () => {
    const health = evaluateFeedHealthMany([
      source({ id: 'a', name: 'A' }),
      source({ id: 'b', name: 'B', lastSuccessAt: NOW - 180_000 }),
    ], NOW);
    expect(health.map(h => h.status)).toEqual(['live', 'stale']);
  });

  it('groups and sorts without mutating the input', () => {
    const feeds = evaluateFeedHealthMany([
      source({ id: 'z', name: 'Zulu' }),
      source({ id: 'a', name: 'Alpha' }),
      source({ id: 'off', name: 'Offline', lastSuccessAt: null }),
    ], NOW);
    const original = feeds.map(f => f.id);
    const grouped = groupFeedHealthByStatus(feeds);
    expect(grouped.live.map(f => f.id)).toEqual(['a', 'z']);
    expect(grouped.offline.map(f => f.id)).toEqual(['off']);
    expect(feeds.map(f => f.id)).toEqual(original);
  });
});
