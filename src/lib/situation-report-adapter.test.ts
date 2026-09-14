import { describe, expect, it } from 'vitest';
import { buildDashboardSituationReportInput } from './situation-report-adapter';
import { buildSituationReport, createSituationReportArtifacts } from './situation-report';
import type { DrawnShape } from './draw';
import type { FeedHealth } from './feed-health';
import type { WatchEvent } from './watch';
import type { RuleNotification } from './alert-rules';

const sampleAoi: DrawnShape = {
  id: 'aoi-blacksea',
  name: 'Black Sea Surveillance Zone',
  kind: 'polygon',
  areaKm2: 436400,
  perimeterKm: 4340,
  color: '#D4AF37',
  createdAt: 1700000000000,
  geojson: {
    type: 'Feature',
    properties: { id: 'aoi-blacksea', name: 'Black Sea Surveillance Zone', kind: 'polygon', color: '#D4AF37' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[28, 41], [41, 41], [41, 46], [28, 46], [28, 41]],
      ],
    },
  },
};

const sampleFeeds: FeedHealth[] = [
  {
    id: 'flights',
    name: 'OpenSky Network',
    url: 'https://opensky-network.org',
    trust: 'primary',
    lastAttemptAt: 1700000000000,
    lastSuccessAt: 1700000000000,
    ageMs: 5000,
    status: 'live',
    latencyMs: 120,
    itemCount: 4500,
    coverage: 1,
    thresholds: { staleAfterMs: 15000, offlineAfterMs: 60000, minimumCoverage: 0, minimumItemCount: 0 },
    explanation: 'Live: usable data is fresh.',
  },
  {
    id: 'cctv',
    name: 'CCTV Feeds',
    url: 'https://example.com/cctv',
    trust: 'curated',
    lastAttemptAt: 1700000000000,
    lastSuccessAt: null,
    ageMs: null,
    status: 'offline',
    latencyMs: null,
    itemCount: 0,
    coverage: null,
    thresholds: { staleAfterMs: 15000, offlineAfterMs: 60000, minimumCoverage: 0, minimumItemCount: 0 },
    explanation: 'Offline: no usable data received.',
  },
  {
    id: 'ais',
    name: 'Maritime AIS',
    url: 'https://example.com/ais',
    trust: 'aggregated',
    lastAttemptAt: 1700000000000,
    lastSuccessAt: 1699990000000,
    ageMs: 10000000,
    status: 'stale',
    latencyMs: 400,
    itemCount: 300,
    coverage: 0.8,
    thresholds: { staleAfterMs: 15000, offlineAfterMs: 60000, minimumCoverage: 0, minimumItemCount: 0 },
    explanation: 'Stale: data age exceeded limit.',
  },
];

const sampleWatchEvents: WatchEvent[] = [
  {
    id: 'w1',
    kind: 'enter',
    aoiId: 'aoi-blacksea',
    layer: 'military_flights',
    layerLabel: 'Military Aviation',
    color: '#FF1744',
    label: 'FORTE10',
    at: 1700000000000,
  },
];

const sampleNotifications: RuleNotification[] = [
  {
    id: 'r1:1700000000000',
    ruleId: 'r1',
    ruleName: 'Military Aviation · Black Sea Surveillance Zone',
    aoiId: 'aoi-blacksea',
    layer: 'military_flights',
    trigger: 'enter',
    message: '1 entity entered the AOI: FORTE10',
    at: 1700000000000,
  },
];

describe('situation-report-adapter', () => {
  it('builds a valid situation report input with defaults', () => {
    const now = 1700000000000;
    const input = buildDashboardSituationReportInput({ now });
    expect(input.title).toBe('LiveWorld Tactical Situation Report');
    expect(input.scope.region).toBe('Global / Tactical Display');
    expect(input.scope.aoi).toBeNull();
    expect(input.sources.length).toBeGreaterThan(0);

    const report = buildSituationReport(input);
    expect(report.schemaVersion).toBe(1);
    expect(report.activeDataSources.length).toBe(1);
  });

  it('correctly adapts AOI, feeds, watch events and alert notifications', () => {
    const now = 1700000000000;
    const input = buildDashboardSituationReportInput({
      now,
      aoi: sampleAoi,
      feeds: sampleFeeds,
      watchEvents: sampleWatchEvents,
      ruleNotifications: sampleNotifications,
    });

    expect(input.title).toContain('Black Sea Surveillance Zone');
    expect(input.scope.aoi?.id).toBe('aoi-blacksea');
    expect(input.sources.length).toBe(3);
    expect(input.dataGaps.length).toBe(2); // offline + stale
    expect(input.events.length).toBe(1);
    expect(input.events[0].summary).toContain('FORTE10');
    expect(input.timeline.length).toBe(1);

    // Full validation & artifact generation
    const artifacts = createSituationReportArtifacts(input);
    expect(artifacts.markdown).toContain('# Tactical Situation Report — Black Sea Surveillance Zone');
    expect(artifacts.markdown).toContain('FORTE10');
    expect(artifacts.json).toContain('aoi-blacksea');
  });

  it('maps data gaps according to feed status severity', () => {
    const now = 1700000000000;
    const input = buildDashboardSituationReportInput({ now, feeds: sampleFeeds });
    const offlineGap = input.dataGaps.find(g => g.id.includes('offline'));
    const staleGap = input.dataGaps.find(g => g.id.includes('stale'));

    expect(offlineGap?.severity).toBe('high');
    expect(staleGap?.severity).toBe('medium');
  });
});
