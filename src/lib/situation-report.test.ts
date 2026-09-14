import { describe, expect, it } from 'vitest';
import type { DrawnShape } from './draw';
import {
  buildSituationReport,
  createSituationReportArtifacts,
  type SituationReportInput,
} from './situation-report';

function aoi(): DrawnShape {
  return {
    id: 'aoi-hamburg',
    name: 'Hamburg AOI',
    kind: 'polygon',
    geojson: {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [[[9.8, 53.4], [10.2, 53.4], [10.2, 53.7], [9.8, 53.4]]],
      },
    },
    areaKm2: 120,
    perimeterKm: 48,
    color: '#00E5FF',
    createdAt: 1_789_400_000_000,
  };
}

function baseInput(): SituationReportInput {
  return {
    title: 'Hamburg situation report',
    createdAt: '2026-09-14T15:00:00+02:00',
    period: {
      start: '2026-09-14T08:00:00+02:00',
      end: '2026-09-14T14:00:00+02:00',
    },
    scope: { region: 'Hamburg', aoi: aoi() },
    sources: [
      {
        id: 'traffic',
        name: 'Traffic feed',
        url: 'https://example.test/traffic',
        retrievedAt: '2026-09-14T14:55:00+02:00',
        active: true,
      },
      {
        id: 'alerts',
        name: 'Alert feed',
        url: 'https://example.test/alerts',
        retrievedAt: '2026-09-14T14:50:00+02:00',
        active: true,
      },
    ],
    events: [],
    timeline: [],
    operationalNotices: [],
    dataGaps: [],
  };
}

describe('buildSituationReport', () => {
  it('sorts prioritized events and the timeline deterministically', () => {
    const input = baseInput();
    input.events = [
      {
        id: 'low',
        title: 'Low priority',
        occurredAt: '2026-09-14T08:00:00Z',
        priority: 'low',
        sourceIds: ['alerts'],
      },
      {
        id: 'critical-late',
        title: 'Critical later',
        occurredAt: '2026-09-14T09:00:00Z',
        priority: 'critical',
        sourceIds: ['alerts'],
      },
      {
        id: 'critical-early',
        title: 'Critical earlier',
        occurredAt: '2026-09-14T07:00:00Z',
        priority: 'critical',
        sourceIds: ['alerts'],
      },
    ];
    input.timeline = [
      { id: 'three', title: 'Third', occurredAt: '2026-09-14T12:00:00Z' },
      { id: 'one', title: 'First', occurredAt: '2026-09-14T10:00:00Z' },
      { id: 'two', title: 'Second', occurredAt: '2026-09-14T11:00:00Z' },
    ];

    const report = buildSituationReport(input);

    expect(report.prioritizedEvents.map((event) => event.id)).toEqual([
      'critical-early',
      'critical-late',
      'low',
    ]);
    expect(report.timeline.map((entry) => entry.id)).toEqual(['one', 'two', 'three']);
  });

  it('normalizes time ranges and rejects an inverted period', () => {
    const input = baseInput();
    const report = buildSituationReport(input);

    expect(report.createdAt).toBe('2026-09-14T13:00:00.000Z');
    expect(report.period).toEqual({
      start: '2026-09-14T06:00:00.000Z',
      end: '2026-09-14T12:00:00.000Z',
    });

    expect(() => buildSituationReport({
      ...input,
      period: { start: '2026-09-14T15:00:00Z', end: '2026-09-14T14:00:00Z' },
    })).toThrow(RangeError);
  });

  it('normalizes missing optional values without inventing data', () => {
    const input = baseInput();
    input.scope = { region: 'Hamburg' };
    input.sources = [{ id: 'source', name: 'Source', active: false }];
    input.events = [{
      id: 'event',
      title: 'Event',
      occurredAt: '2026-09-14T10:00:00Z',
      priority: 'medium',
    }];
    input.operationalNotices = [{
      id: 'notice',
      kind: 'traffic',
      title: 'Traffic notice',
    }];

    const { report, markdown } = createSituationReportArtifacts(input);

    expect(report.scope.aoi).toBeNull();
    expect(report.sources[0].url).toBeNull();
    expect(report.sources[0].retrievedAt).toBeNull();
    expect(report.prioritizedEvents[0].summary).toBeNull();
    expect(report.prioritizedEvents[0].location).toBeNull();
    expect(report.operationalNotices[0].observedAt).toBeNull();
    expect(report.analystNotes).toEqual([]);
    expect(markdown).toContain('AOI: Not provided');
    expect(markdown).toContain('Summary: Not provided');
  });

  it('deduplicates sources by canonical URL and rewrites references', () => {
    const input = baseInput();
    input.sources = [
      {
        id: 'z-source',
        name: 'Zulu source',
        url: 'https://example.test/feed/',
        retrievedAt: '2026-09-14T11:00:00Z',
        active: false,
      },
      {
        id: 'a-source',
        name: 'Alpha source',
        url: 'https://example.test/feed',
        retrievedAt: '2026-09-14T12:00:00Z',
        active: true,
      },
    ];
    input.events = [{
      id: 'event',
      title: 'Event',
      occurredAt: '2026-09-14T10:00:00Z',
      priority: 'high',
      sourceIds: ['z-source', 'a-source'],
    }];

    const report = buildSituationReport(input);

    expect(report.sources).toHaveLength(1);
    expect(report.sources[0]).toMatchObject({
      id: 'a-source',
      active: true,
      url: 'https://example.test/feed',
      retrievedAt: '2026-09-14T12:00:00.000Z',
    });
    expect(report.activeDataSources.map((source) => source.id)).toEqual(['a-source']);
    expect(report.prioritizedEvents[0].sourceIds).toEqual(['a-source']);
  });

  it('produces byte-identical Markdown and JSON for equivalent input ordering', () => {
    const first = baseInput();
    first.events = [
      {
        id: 'b',
        title: 'Beta',
        occurredAt: '2026-09-14T11:00:00Z',
        priority: 'medium',
        sourceIds: ['traffic'],
      },
      {
        id: 'a',
        title: 'Alpha',
        occurredAt: '2026-09-14T10:00:00Z',
        priority: 'high',
        sourceIds: ['alerts'],
      },
    ];
    first.dataGaps = [
      { id: 'low-gap', severity: 'low', title: 'Minor gap' },
      { id: 'high-gap', severity: 'high', title: 'Major gap' },
    ];

    const second: SituationReportInput = {
      ...first,
      sources: [...first.sources].reverse(),
      events: [...first.events].reverse(),
      dataGaps: [...first.dataGaps].reverse(),
    };

    const a = createSituationReportArtifacts(first);
    const b = createSituationReportArtifacts(second);

    expect(a.json).toBe(b.json);
    expect(a.markdown).toBe(b.markdown);
  });
});
