import type { DrawnShape } from './draw';
import type { WatchEvent } from './watch';
import type { RuleNotification } from './alert-rules';
import type { FeedHealth } from './feed-health';
import type {
  SituationReportDataGapInput,
  SituationReportEventInput,
  SituationReportInput,
  SituationReportNoticeKind,
  SituationReportOperationalNoticeInput,
  SituationReportPriority,
  SituationReportSourceInput,
  SituationReportTimelineEntryInput,
} from './situation-report';

export interface DashboardReportAdapterParams {
  now?: number;
  periodMs?: number;
  title?: string;
  region?: string | null;
  aoi?: DrawnShape | null;
  aois?: readonly DrawnShape[];
  feeds?: readonly FeedHealth[];
  watchEvents?: readonly WatchEvent[];
  ruleNotifications?: readonly RuleNotification[];
  data?: Record<string, unknown>;
  analystNotes?: readonly string[];
}

export function buildDashboardSituationReportInput(params: DashboardReportAdapterParams = {}): SituationReportInput {
  const now = typeof params.now === 'number' && Number.isFinite(params.now) ? params.now : Date.now();
  const periodMs = typeof params.periodMs === 'number' && Number.isFinite(params.periodMs) && params.periodMs > 0
    ? params.periodMs
    : 60 * 60_000; // default 1 hour
  const startEpoch = Math.max(0, now - periodMs);

  const createdAt = new Date(now).toISOString();
  const period = {
    start: new Date(startEpoch).toISOString(),
    end: new Date(now).toISOString(),
  };

  // 1. Scope: chosen AOI or primary region
  const selectedAoi = params.aoi ?? (params.aois && params.aois.length > 0 ? params.aois[0] : null);
  const scopeRegion = params.region || (selectedAoi ? null : 'Global / Tactical Display');

  // 2. Sources: from evaluated FeedHealth feeds
  const sources: SituationReportSourceInput[] = (params.feeds ?? []).map(feed => ({
    id: feed.id,
    name: feed.name,
    url: feed.url,
    retrievedAt: feed.lastSuccessAt ? new Date(feed.lastSuccessAt).toISOString() : null,
    active: feed.status !== 'offline',
  }));

  // Fallback source if no feeds provided
  if (sources.length === 0) {
    sources.push({
      id: 'liveworld-core',
      name: 'LiveWorld Tactical Telemetry',
      url: 'https://liveworld-map.vercel.app',
      retrievedAt: createdAt,
      active: true,
    });
  }

  const primarySourceId = sources[0]?.id ?? 'liveworld-core';

  // 3. Prioritized Events: derived from RuleNotifications + critical watch events
  const events: SituationReportEventInput[] = [];

  for (const [index, note] of (params.ruleNotifications ?? []).entries()) {
    let priority: SituationReportPriority = 'high';
    if (note.trigger === 'count-above' || note.trigger === 'count-below') {
      priority = 'critical';
    } else if (note.trigger === 'enter') {
      priority = 'high';
    } else {
      priority = 'medium';
    }

    events.push({
      id: `alert-${note.id || index}-${note.at}`,
      title: `AOI Alert: ${note.ruleName}`,
      occurredAt: new Date(note.at).toISOString(),
      priority,
      summary: note.message,
      location: selectedAoi?.name ?? note.aoiId,
      sourceIds: [primarySourceId],
    });
  }

  // 4. Timeline: chronological events from watch tripwires and alert triggers
  const timeline: SituationReportTimelineEntryInput[] = [];

  for (const [index, ev] of (params.watchEvents ?? []).entries()) {
    timeline.push({
      id: `watch-${ev.id || index}-${ev.at}`,
      occurredAt: new Date(ev.at).toISOString(),
      title: `${ev.kind === 'enter' ? 'Entry' : 'Exit'}: ${ev.label}`,
      details: `${ev.layerLabel} (${ev.layer}) ${ev.kind === 'enter' ? 'entered' : 'exited'} AOI ${ev.aoiId}`,
      sourceIds: [primarySourceId],
    });
  }

  // If no watch events, add an operational baseline timeline entry
  if (timeline.length === 0) {
    timeline.push({
      id: `baseline-${now}`,
      occurredAt: period.start,
      title: 'Operational Baseline Initialized',
      details: 'Monitoring active across all subscribed sensory domains.',
      sourceIds: [primarySourceId],
    });
  }

  // 5. Operational Notices: from live data items (civil alerts, notams, waterways)
  const operationalNotices: SituationReportOperationalNoticeInput[] = [];
  const data = params.data ?? {};

  // Check civil alerts if present
  if (Array.isArray(data.civil_alerts)) {
    for (const [index, item] of data.civil_alerts.slice(0, 10).entries()) {
      const notice = item as Record<string, any>;
      operationalNotices.push({
        id: `civil-${notice.id ?? index}`,
        kind: 'infrastructure' as SituationReportNoticeKind,
        title: notice.title || notice.headline || 'Civil Protection Alert',
        observedAt: notice.sent || notice.time ? new Date(notice.sent || notice.time).toISOString() : createdAt,
        details: notice.description || notice.event || 'Civil alert broadcast active.',
        location: notice.area || notice.country || null,
        sourceIds: [primarySourceId],
      });
    }
  }

  // Check notams / waterways / traffic
  if (Array.isArray(data.waterway_gauges)) {
    const alertGauges = data.waterway_gauges.filter((g: any) => g.status === 'alert' || g.status === 'warning');
    for (const [index, item] of alertGauges.slice(0, 5).entries()) {
      const gauge = item as Record<string, any>;
      operationalNotices.push({
        id: `waterway-${gauge.id ?? index}`,
        kind: 'infrastructure' as SituationReportNoticeKind,
        title: `Waterway Alert: ${gauge.name || gauge.station}`,
        observedAt: createdAt,
        details: `Gauge water level reading: ${gauge.value ?? 'abnormal'} ${gauge.unit ?? ''}`,
        location: gauge.river || gauge.name || null,
        sourceIds: [primarySourceId],
      });
    }
  }

  // 6. Data Gaps: derived from offline, stale, or degraded feeds
  const dataGaps: SituationReportDataGapInput[] = [];

  for (const [index, feed] of (params.feeds ?? []).entries()) {
    if (feed.status === 'offline') {
      dataGaps.push({
        id: `gap-offline-${feed.id || index}`,
        severity: 'high',
        title: `${feed.name}: Signal Offline`,
        details: feed.explanation || 'No usable data received beyond offline threshold limit.',
        sourceIds: [feed.id],
      });
    } else if (feed.status === 'stale') {
      dataGaps.push({
        id: `gap-stale-${feed.id || index}`,
        severity: 'medium',
        title: `${feed.name}: Stale Telemetry`,
        details: feed.explanation || 'Feed data age exceeded configured freshness limit.',
        sourceIds: [feed.id],
      });
    } else if (feed.status === 'degraded') {
      dataGaps.push({
        id: `gap-degraded-${feed.id || index}`,
        severity: 'low',
        title: `${feed.name}: Telemetry Impaired`,
        details: feed.explanation || 'Feed quality metrics degraded.',
        sourceIds: [feed.id],
      });
    }
  }

  // 7. Analyst Notes
  const analystNotes: string[] = [
    `Synthesized automatically from LiveWorld Map operational state at ${createdAt}.`,
    ...(params.analystNotes ?? []),
  ];

  const title = params.title || (selectedAoi
    ? `Tactical Situation Report — ${selectedAoi.name}`
    : 'LiveWorld Tactical Situation Report');

  return {
    title,
    createdAt,
    period,
    scope: {
      region: scopeRegion,
      aoi: selectedAoi,
    },
    sources,
    events,
    timeline,
    operationalNotices,
    dataGaps,
    analystNotes,
  };
}
