import { describe, expect, it } from 'vitest';
import type { FeedHealth } from './feed-health';
import {
  correlateIncidents,
  normalizeObservation,
  type ObservationInput,
} from './incident-correlation';

const NOW = Date.UTC(2026, 8, 14, 12, 0, 0);

function observation(id: string, overrides: Partial<ObservationInput> = {}): ObservationInput {
  return {
    id,
    sourceId: 'weather-feed',
    observedAt: NOW,
    domain: 'weather',
    category: 'severe-storm',
    title: `Observation ${id}`,
    lat: 53.5511,
    lng: 9.9937,
    aoiIds: ['hamburg'],
    region: 'Hamburg',
    ...overrides,
  };
}

function health(status: FeedHealth['status'], sourceId = 'weather-feed'): FeedHealth {
  return {
    id: sourceId,
    name: sourceId,
    url: `https://example.test/${sourceId}`,
    trust: 'official',
    lastAttemptAt: NOW,
    lastSuccessAt: NOW,
    ageMs: status === 'stale' ? 300_000 : 5_000,
    status,
    latencyMs: 100,
    itemCount: 10,
    coverage: 1,
    thresholds: {
      staleAfterMs: 180_000,
      offlineAfterMs: 600_000,
    },
    explanation: `${sourceId} is ${status}`,
  };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

describe('normalization', () => {
  it('normalizes scalar metadata, coordinates, AOIs and timestamps deterministically', () => {
    const normalized = normalizeObservation(observation('a', {
      observedAt: new Date(NOW).toISOString(),
      category: '  Severe-Storm  ',
      aoiIds: ['hamburg', 'north', 'hamburg'],
      attributes: { z: 1, a: 'first', ignored: Number.NaN },
    }));

    expect(normalized.observedAt).toBe(NOW);
    expect(normalized.category).toBe('severe-storm');
    expect(normalized.aoiIds).toEqual(['hamburg', 'north']);
    expect(Object.keys(normalized.attributes)).toEqual(['a', 'z']);
  });
});

describe('incident correlation', () => {
  it('groups spatially and temporally matching observations', () => {
    const result = correlateIncidents({
      observations: [
        observation('warning', { sourceId: 'warning-feed', domain: 'civil-warning' }),
        observation('storm', {
          sourceId: 'weather-feed',
          observedAt: NOW + 5 * 60_000,
          lat: 53.56,
          lng: 10.01,
        }),
      ],
      feedHealth: [health('live', 'warning-feed'), health('live', 'weather-feed')],
    });

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].observations).toHaveLength(2);
    expect(result.incidents[0].connections).toHaveLength(1);
    expect(result.incidents[0].connections[0].reasons.join(' ')).toContain('Time gap');
    expect(result.incidents[0].connections[0].reasons.join(' ')).toContain('Shared AOI');
  });

  it('keeps spatially separated observations in separate incidents', () => {
    const result = correlateIncidents({ observations: [
      observation('hamburg'),
      observation('munich', { sourceId: 'other', lat: 48.1372, lng: 11.5756, aoiIds: ['munich'], region: 'Munich' }),
    ] });

    expect(result.incidents).toHaveLength(2);
  });

  it('keeps observations outside the time window separate', () => {
    const result = correlateIncidents({ observations: [
      observation('first'),
      observation('late', { sourceId: 'other', observedAt: NOW + 31 * 60_000 }),
    ] });

    expect(result.incidents).toHaveLength(2);
  });

  it('uses shared AOI membership when coordinates are missing', () => {
    const result = correlateIncidents({ observations: [
      observation('one', { lat: null, lng: null }),
      observation('two', { sourceId: 'other', lat: null, lng: null }),
    ] });

    expect(result.incidents).toHaveLength(1);
    expect(result.incidents[0].aoiIds).toEqual(['hamburg']);
    expect(result.incidents[0].uncertainties.join(' ')).toContain('no complete coordinates');
  });

  it('does not correlate coordinate-less observations without a shared AOI', () => {
    const result = correlateIncidents({ observations: [
      observation('one', { lat: null, lng: null, aoiIds: [] }),
      observation('two', { sourceId: 'other', lat: null, lng: null, aoiIds: [] }),
    ] });

    expect(result.incidents).toHaveLength(2);
  });

  it('reduces confidence and records a data gap for stale sources', () => {
    const live = correlateIncidents({
      observations: [
        observation('one'),
        observation('two', { sourceId: 'other' }),
      ],
      feedHealth: [health('live'), health('live', 'other')],
    });
    const stale = correlateIncidents({
      observations: [
        observation('one'),
        observation('two', { sourceId: 'other' }),
      ],
      feedHealth: [health('stale'), health('live', 'other')],
    });

    expect(stale.incidents).toHaveLength(1);
    expect(stale.incidents[0].confidence.score).toBeLessThan(live.incidents[0].confidence.score);
    expect(stale.incidents[0].dataGaps.join(' ')).toContain('stale');
  });

  it('deduplicates repeated source observations deterministically and keeps the newest copy', () => {
    const result = correlateIncidents({ observations: [
      observation('same', { observedAt: NOW, title: 'older' }),
      observation('same', { observedAt: NOW + 1_000, title: 'newer' }),
    ] });

    expect(result.stats.inputObservations).toBe(2);
    expect(result.stats.deduplicatedObservations).toBe(1);
    expect(result.observations[0].title).toBe('newer');
  });

  it('produces stable incident ids independent of input ordering', () => {
    const a = observation('a');
    const b = observation('b', { sourceId: 'other' });

    const first = correlateIncidents({ observations: [a, b] });
    const second = correlateIncidents({ observations: [b, a] });

    expect(first.incidents[0].id).toBe(second.incidents[0].id);
  });

  it('produces byte-stable ordering independent of input and feed-health ordering', () => {
    const a = observation('a');
    const b = observation('b', { sourceId: 'other', observedAt: NOW + 1_000 });
    const first = correlateIncidents({
      observations: [a, b],
      feedHealth: [health('live'), health('live', 'other')],
    });
    const second = correlateIncidents({
      observations: [b, a],
      feedHealth: [health('live', 'other'), health('live')],
    });

    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('never mutates observation, AOI, attribute or feed-health input objects', () => {
    const observations = deepFreeze([
      observation('a', { aoiIds: ['z', 'a'], attributes: { z: 1, a: true } }),
      observation('b', { sourceId: 'other' }),
    ]);
    const feeds = deepFreeze([health('live'), health('live', 'other')]);
    const beforeObservations = JSON.stringify(observations);
    const beforeFeeds = JSON.stringify(feeds);

    correlateIncidents({ observations, feedHealth: feeds });

    expect(JSON.stringify(observations)).toBe(beforeObservations);
    expect(JSON.stringify(feeds)).toBe(beforeFeeds);
  });

  it('enforces deterministic observation and pair-evaluation limits', () => {
    const observations = Array.from({ length: 20 }, (_, index) => observation(String(index), {
      observedAt: NOW + index * 100,
      sourceId: `source-${index}`,
    }));
    const limited = correlateIncidents(
      { observations },
      { maxObservations: 5, maxPairEvaluations: 2 },
    );

    expect(limited.observations).toHaveLength(5);
    expect(limited.stats.droppedByObservationLimit).toBe(15);
    expect(limited.stats.pairEvaluations).toBe(2);
    expect(limited.stats.pairEvaluationLimitReached).toBe(true);
    expect(limited.observations.map(item => item.sourceObservationId)).toEqual(['15', '16', '17', '18', '19']);
  });

  it('never links events on similar titles alone', () => {
    const result = correlateIncidents({ observations: [
      observation('one', { title: 'Major incident downtown', aoiIds: [], lat: 53.55, lng: 10 }),
      observation('two', { sourceId: 'other', title: 'Major incident downtown', aoiIds: [], lat: 48.13, lng: 11.57 }),
    ] });

    expect(result.incidents).toHaveLength(2);
  });
});
