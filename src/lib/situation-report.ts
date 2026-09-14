import type { DrawnShape } from './draw';

export type SituationReportPriority = 'critical' | 'high' | 'medium' | 'low';
export type SituationReportGapSeverity = 'high' | 'medium' | 'low';
export type SituationReportNoticeKind = 'infrastructure' | 'traffic';

export interface SituationReportPeriodInput {
  start: string;
  end: string;
}

export interface SituationReportScopeInput {
  /** Human-readable region name. May be combined with a drawn AOI. */
  region?: string | null;
  /** Existing canonical AOI shape from src/lib/draw.ts. */
  aoi?: DrawnShape | null;
}

export interface SituationReportSourceInput {
  id: string;
  name: string;
  url?: string | null;
  retrievedAt?: string | null;
  /** Whether this source was active for the report input set. */
  active: boolean;
}

export interface SituationReportEventInput {
  id: string;
  title: string;
  occurredAt: string;
  priority: SituationReportPriority;
  summary?: string | null;
  location?: string | null;
  sourceIds?: readonly string[];
}

export interface SituationReportTimelineEntryInput {
  id: string;
  occurredAt: string;
  title: string;
  details?: string | null;
  sourceIds?: readonly string[];
}

export interface SituationReportOperationalNoticeInput {
  id: string;
  kind: SituationReportNoticeKind;
  title: string;
  observedAt?: string | null;
  details?: string | null;
  location?: string | null;
  sourceIds?: readonly string[];
}

export interface SituationReportDataGapInput {
  id: string;
  severity: SituationReportGapSeverity;
  title: string;
  details?: string | null;
  sourceIds?: readonly string[];
}

export interface SituationReportInput {
  title: string;
  /** Explicit input: report generation never reads the system clock. */
  createdAt: string;
  period: SituationReportPeriodInput;
  scope: SituationReportScopeInput;
  sources: readonly SituationReportSourceInput[];
  events: readonly SituationReportEventInput[];
  timeline: readonly SituationReportTimelineEntryInput[];
  operationalNotices: readonly SituationReportOperationalNoticeInput[];
  dataGaps: readonly SituationReportDataGapInput[];
  analystNotes?: readonly string[] | null;
}

export interface SituationReportAoi {
  id: string;
  name: string;
  kind: DrawnShape['kind'];
  geometry:
    | { type: 'Polygon'; coordinates: number[][][] }
    | { type: 'LineString'; coordinates: number[][] };
  areaKm2: number;
  perimeterKm: number;
}

export interface SituationReportSource {
  id: string;
  name: string;
  url: string | null;
  retrievedAt: string | null;
  active: boolean;
}

export interface SituationReportEvent {
  id: string;
  title: string;
  occurredAt: string;
  priority: SituationReportPriority;
  summary: string | null;
  location: string | null;
  sourceIds: string[];
}

export interface SituationReportTimelineEntry {
  id: string;
  occurredAt: string;
  title: string;
  details: string | null;
  sourceIds: string[];
}

export interface SituationReportOperationalNotice {
  id: string;
  kind: SituationReportNoticeKind;
  title: string;
  observedAt: string | null;
  details: string | null;
  location: string | null;
  sourceIds: string[];
}

export interface SituationReportDataGap {
  id: string;
  severity: SituationReportGapSeverity;
  title: string;
  details: string | null;
  sourceIds: string[];
}

export interface SituationReport {
  schemaVersion: 1;
  title: string;
  createdAt: string;
  period: {
    start: string;
    end: string;
  };
  scope: {
    region: string | null;
    aoi: SituationReportAoi | null;
  };
  activeDataSources: SituationReportSource[];
  prioritizedEvents: SituationReportEvent[];
  timeline: SituationReportTimelineEntry[];
  operationalNotices: SituationReportOperationalNotice[];
  dataGaps: SituationReportDataGap[];
  sources: SituationReportSource[];
  analystNotes: string[];
}

export interface SituationReportArtifacts {
  report: SituationReport;
  markdown: string;
  json: string;
}

const PRIORITY_RANK: Record<SituationReportPriority, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const GAP_RANK: Record<SituationReportGapSeverity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${field} must not be empty`);
  return normalized;
}

function optionalText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function isoTimestamp(value: string, field: string): string {
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new TypeError(`${field} must be a valid date-time`);
  }
  return timestamp.toISOString();
}

function optionalIsoTimestamp(value: string | null | undefined, field: string): string | null {
  return value == null || !value.trim() ? null : isoTimestamp(value, field);
}

function finiteNumber(value: number, field: string): number {
  if (!Number.isFinite(value)) throw new TypeError(`${field} must be finite`);
  return value;
}

function canonicalUrl(value: string | null | undefined): string | null {
  const trimmed = optionalText(value);
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    url.hash = '';
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return trimmed.replace(/\/+$/, '');
  }
}

function copyPosition(position: number[], field: string): number[] {
  return position.map((value, index) => finiteNumber(value, `${field}[${index}]`));
}

function normalizeAoi(shape: DrawnShape | null | undefined): SituationReportAoi | null {
  if (!shape) return null;

  const geometry = shape.geojson.geometry;
  const normalizedGeometry: SituationReportAoi['geometry'] = geometry.type === 'Polygon'
    ? {
        type: 'Polygon',
        coordinates: geometry.coordinates.map((ring, ringIndex) =>
          ring.map((position, positionIndex) =>
            copyPosition(position, `scope.aoi.geometry.coordinates[${ringIndex}][${positionIndex}]`),
          ),
        ),
      }
    : {
        type: 'LineString',
        coordinates: geometry.coordinates.map((position, positionIndex) =>
          copyPosition(position, `scope.aoi.geometry.coordinates[${positionIndex}]`),
        ),
      };

  return {
    id: requiredText(shape.id, 'scope.aoi.id'),
    name: requiredText(shape.name, 'scope.aoi.name'),
    kind: shape.kind,
    geometry: normalizedGeometry,
    areaKm2: finiteNumber(shape.areaKm2, 'scope.aoi.areaKm2'),
    perimeterKm: finiteNumber(shape.perimeterKm, 'scope.aoi.perimeterKm'),
  };
}

interface NormalizedSources {
  sources: SituationReportSource[];
  sourceAliases: Map<string, string>;
}

function normalizeSources(inputs: readonly SituationReportSourceInput[]): NormalizedSources {
  const candidates = inputs.map((input, index) => ({
    id: requiredText(input.id, `sources[${index}].id`),
    name: requiredText(input.name, `sources[${index}].name`),
    url: canonicalUrl(input.url),
    retrievedAt: optionalIsoTimestamp(input.retrievedAt, `sources[${index}].retrievedAt`),
    active: Boolean(input.active),
  }));

  const groups = new Map<string, SituationReportSource[]>();
  for (const candidate of candidates) {
    const key = candidate.url ? `url:${candidate.url}` : `id:${candidate.id.toLowerCase()}`;
    const group = groups.get(key);
    if (group) group.push(candidate);
    else groups.set(key, [candidate]);
  }

  const sourceAliases = new Map<string, string>();
  const sources: SituationReportSource[] = [];

  for (const group of groups.values()) {
    const ordered = [...group].sort((a, b) =>
      compareText(a.id, b.id) || compareText(a.name, b.name),
    );
    const canonicalId = ordered[0].id;
    for (const candidate of ordered) sourceAliases.set(candidate.id, canonicalId);

    const names = [...new Set(ordered.map((candidate) => candidate.name))].sort(compareText);
    const retrieved = ordered
      .map((candidate) => candidate.retrievedAt)
      .filter((value): value is string => value !== null)
      .sort(compareText);

    sources.push({
      id: canonicalId,
      name: names[0],
      url: ordered.find((candidate) => candidate.url)?.url ?? null,
      retrievedAt: retrieved.at(-1) ?? null,
      active: ordered.some((candidate) => candidate.active),
    });
  }

  sources.sort((a, b) => compareText(a.name, b.name) || compareText(a.id, b.id));
  return { sources, sourceAliases };
}

function normalizeSourceIds(
  values: readonly string[] | undefined,
  sourceAliases: Map<string, string>,
  field: string,
): string[] {
  const canonical = new Set<string>();
  for (const value of values ?? []) {
    const id = requiredText(value, field);
    const resolved = sourceAliases.get(id);
    if (!resolved) throw new TypeError(`${field} references unknown source "${id}"`);
    canonical.add(resolved);
  }
  return [...canonical].sort(compareText);
}

function normalizeEvents(
  inputs: readonly SituationReportEventInput[],
  sourceAliases: Map<string, string>,
): SituationReportEvent[] {
  return inputs
    .map((input, index) => ({
      id: requiredText(input.id, `events[${index}].id`),
      title: requiredText(input.title, `events[${index}].title`),
      occurredAt: isoTimestamp(input.occurredAt, `events[${index}].occurredAt`),
      priority: input.priority,
      summary: optionalText(input.summary),
      location: optionalText(input.location),
      sourceIds: normalizeSourceIds(input.sourceIds, sourceAliases, `events[${index}].sourceIds`),
    }))
    .sort((a, b) =>
      PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      || compareText(a.occurredAt, b.occurredAt)
      || compareText(a.title, b.title)
      || compareText(a.id, b.id),
    );
}

function normalizeTimeline(
  inputs: readonly SituationReportTimelineEntryInput[],
  sourceAliases: Map<string, string>,
): SituationReportTimelineEntry[] {
  return inputs
    .map((input, index) => ({
      id: requiredText(input.id, `timeline[${index}].id`),
      occurredAt: isoTimestamp(input.occurredAt, `timeline[${index}].occurredAt`),
      title: requiredText(input.title, `timeline[${index}].title`),
      details: optionalText(input.details),
      sourceIds: normalizeSourceIds(input.sourceIds, sourceAliases, `timeline[${index}].sourceIds`),
    }))
    .sort((a, b) =>
      compareText(a.occurredAt, b.occurredAt)
      || compareText(a.title, b.title)
      || compareText(a.id, b.id),
    );
}

function normalizeOperationalNotices(
  inputs: readonly SituationReportOperationalNoticeInput[],
  sourceAliases: Map<string, string>,
): SituationReportOperationalNotice[] {
  return inputs
    .map((input, index) => ({
      id: requiredText(input.id, `operationalNotices[${index}].id`),
      kind: input.kind,
      title: requiredText(input.title, `operationalNotices[${index}].title`),
      observedAt: optionalIsoTimestamp(input.observedAt, `operationalNotices[${index}].observedAt`),
      details: optionalText(input.details),
      location: optionalText(input.location),
      sourceIds: normalizeSourceIds(
        input.sourceIds,
        sourceAliases,
        `operationalNotices[${index}].sourceIds`,
      ),
    }))
    .sort((a, b) => {
      if (a.observedAt === null && b.observedAt !== null) return 1;
      if (a.observedAt !== null && b.observedAt === null) return -1;
      return compareText(a.observedAt ?? '', b.observedAt ?? '')
        || compareText(a.kind, b.kind)
        || compareText(a.title, b.title)
        || compareText(a.id, b.id);
    });
}

function normalizeDataGaps(
  inputs: readonly SituationReportDataGapInput[],
  sourceAliases: Map<string, string>,
): SituationReportDataGap[] {
  return inputs
    .map((input, index) => ({
      id: requiredText(input.id, `dataGaps[${index}].id`),
      severity: input.severity,
      title: requiredText(input.title, `dataGaps[${index}].title`),
      details: optionalText(input.details),
      sourceIds: normalizeSourceIds(input.sourceIds, sourceAliases, `dataGaps[${index}].sourceIds`),
    }))
    .sort((a, b) =>
      GAP_RANK[a.severity] - GAP_RANK[b.severity]
      || compareText(a.title, b.title)
      || compareText(a.id, b.id),
    );
}

export function buildSituationReport(input: SituationReportInput): SituationReport {
  const createdAt = isoTimestamp(input.createdAt, 'createdAt');
  const start = isoTimestamp(input.period.start, 'period.start');
  const end = isoTimestamp(input.period.end, 'period.end');
  if (start > end) throw new RangeError('period.start must be before or equal to period.end');

  const region = optionalText(input.scope.region);
  const aoi = normalizeAoi(input.scope.aoi);
  if (!region && !aoi) throw new TypeError('scope requires a region, an AOI, or both');

  const { sources, sourceAliases } = normalizeSources(input.sources);

  return {
    schemaVersion: 1,
    title: requiredText(input.title, 'title'),
    createdAt,
    period: { start, end },
    scope: { region, aoi },
    activeDataSources: sources.filter((source) => source.active),
    prioritizedEvents: normalizeEvents(input.events, sourceAliases),
    timeline: normalizeTimeline(input.timeline, sourceAliases),
    operationalNotices: normalizeOperationalNotices(input.operationalNotices, sourceAliases),
    dataGaps: normalizeDataGaps(input.dataGaps, sourceAliases),
    sources,
    analystNotes: (input.analystNotes ?? [])
      .map((note) => note.trim())
      .filter((note) => note.length > 0),
  };
}

function line(value: string | null): string {
  return value ?? 'Not provided';
}

function sourceSuffix(sourceIds: string[]): string {
  return sourceIds.length ? ` Sources: ${sourceIds.map((id) => `\`${id}\``).join(', ')}.` : '';
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function situationReportToMarkdown(report: SituationReport): string {
  const lines: string[] = [
    `# ${singleLine(report.title)}`,
    '',
    `- Created: \`${report.createdAt}\``,
    `- Period: \`${report.period.start}\` to \`${report.period.end}\``,
    `- Region: ${line(report.scope.region)}`,
    `- AOI: ${report.scope.aoi ? `${singleLine(report.scope.aoi.name)} (${report.scope.aoi.kind})` : 'Not provided'}`,
    '',
    '## Active data sources',
    '',
  ];

  if (report.activeDataSources.length === 0) {
    lines.push('No active data sources.', '');
  } else {
    for (const source of report.activeDataSources) {
      const url = source.url ? ` — ${source.url}` : '';
      const retrieved = source.retrievedAt ? ` — retrieved ${source.retrievedAt}` : '';
      lines.push(`- **${singleLine(source.name)}** (\`${source.id}\`)${url}${retrieved}`);
    }
    lines.push('');
  }

  lines.push('## Prioritized events', '');
  if (report.prioritizedEvents.length === 0) {
    lines.push('No prioritized events.', '');
  } else {
    for (const event of report.prioritizedEvents) {
      lines.push(
        `- **[${event.priority.toUpperCase()}] ${singleLine(event.title)}** — \`${event.occurredAt}\``,
        `  - Location: ${line(event.location)}`,
        `  - Summary: ${line(event.summary)}${sourceSuffix(event.sourceIds)}`,
      );
    }
    lines.push('');
  }

  lines.push('## Timeline', '');
  if (report.timeline.length === 0) {
    lines.push('No timeline entries.', '');
  } else {
    for (const entry of report.timeline) {
      lines.push(`- \`${entry.occurredAt}\` — **${singleLine(entry.title)}** — ${line(entry.details)}${sourceSuffix(entry.sourceIds)}`);
    }
    lines.push('');
  }

  lines.push('## Infrastructure and traffic', '');
  if (report.operationalNotices.length === 0) {
    lines.push('No infrastructure or traffic notices.', '');
  } else {
    for (const notice of report.operationalNotices) {
      const observed = notice.observedAt ? ` — \`${notice.observedAt}\`` : '';
      lines.push(
        `- **[${notice.kind.toUpperCase()}] ${singleLine(notice.title)}**${observed}`,
        `  - Location: ${line(notice.location)}`,
        `  - Details: ${line(notice.details)}${sourceSuffix(notice.sourceIds)}`,
      );
    }
    lines.push('');
  }

  lines.push('## Data gaps and uncertainties', '');
  if (report.dataGaps.length === 0) {
    lines.push('No known data gaps or uncertainties.', '');
  } else {
    for (const gap of report.dataGaps) {
      lines.push(`- **[${gap.severity.toUpperCase()}] ${singleLine(gap.title)}** — ${line(gap.details)}${sourceSuffix(gap.sourceIds)}`);
    }
    lines.push('');
  }

  lines.push('## Sources', '');
  if (report.sources.length === 0) {
    lines.push('No sources listed.', '');
  } else {
    report.sources.forEach((source, index) => {
      const url = source.url ? ` — ${source.url}` : '';
      const retrieved = source.retrievedAt ? ` — retrieved ${source.retrievedAt}` : '';
      lines.push(`${index + 1}. **${singleLine(source.name)}** (\`${source.id}\`)${url}${retrieved}`);
    });
    lines.push('');
  }

  if (report.analystNotes.length > 0) {
    lines.push('## Analyst notes', '');
    for (const note of report.analystNotes) lines.push(`- ${singleLine(note)}`);
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
}

export function situationReportToJson(report: SituationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function createSituationReportArtifacts(input: SituationReportInput): SituationReportArtifacts {
  const report = buildSituationReport(input);
  return {
    report,
    markdown: situationReportToMarkdown(report),
    json: situationReportToJson(report),
  };
}
