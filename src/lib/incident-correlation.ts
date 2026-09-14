import type { FeedHealth, FeedStatus, FeedTrustClass } from './feed-health';
import type { WatchEvent } from './watch';

/** Broad domains intentionally stay stable even if individual feed schemas change. */
export type ObservationDomain =
  | 'aoi-watch'
  | 'civil-warning'
  | 'earthquake'
  | 'weather'
  | 'fire'
  | 'aviation'
  | 'maritime'
  | 'infrastructure'
  | 'news'
  | 'other';

export type ObservationTimestamp = number | string | Date;
export type IncidentConfidenceLevel = 'low' | 'medium' | 'high';
export type IncidentSourceStatus = FeedStatus | 'unknown';
export type ObservationAttribute = string | number | boolean | null;

export interface ObservationInput {
  /** Stable identifier supplied by the source. */
  id: string;
  sourceId: string;
  observedAt: ObservationTimestamp;
  domain: ObservationDomain;
  /** A feed-specific category such as flood, wildfire, M4+, military_flights. */
  category?: string | null;
  title?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** One observation can belong to more than one stored/drawn AOI. */
  aoiIds?: readonly string[] | null;
  region?: string | null;
  /** Small scalar attributes only; keys are canonicalized for byte-stable output. */
  attributes?: Readonly<Record<string, ObservationAttribute>> | null;
}

export interface NormalizedObservation {
  /** sourceId + source observation id; stable across input ordering. */
  id: string;
  sourceObservationId: string;
  sourceId: string;
  observedAt: number;
  observedAtIso: string;
  domain: ObservationDomain;
  category: string | null;
  title: string | null;
  lat: number | null;
  lng: number | null;
  aoiIds: string[];
  region: string | null;
  attributes: Record<string, ObservationAttribute>;
}

export interface IncidentConnection {
  fromObservationId: string;
  toObservationId: string;
  confidence: number;
  reasons: string[];
}

export interface IncidentSourceSummary {
  id: string;
  name: string;
  url: string | null;
  trust: FeedTrustClass | null;
  status: IncidentSourceStatus;
  ageMs: number | null;
  explanation: string;
}

export interface IncidentConfidence {
  score: number;
  level: IncidentConfidenceLevel;
  reasons: string[];
}

export interface Incident {
  id: string;
  title: string;
  startAt: number;
  endAt: number;
  startAtIso: string;
  endAtIso: string;
  confidence: IncidentConfidence;
  region: string | null;
  aoiIds: string[];
  centroid: { lat: number; lng: number } | null;
  domains: ObservationDomain[];
  observations: NormalizedObservation[];
  connections: IncidentConnection[];
  sources: IncidentSourceSummary[];
  uncertainties: string[];
  dataGaps: string[];
}

export interface IncidentCorrelationInput {
  observations?: readonly ObservationInput[];
  /** Existing src/lib/watch.ts events can be supplied directly. */
  watchEvents?: readonly WatchEvent[];
  /** Evaluated feed health from src/lib/feed-health.ts. */
  feedHealth?: readonly FeedHealth[];
}

export interface IncidentCorrelationOptions {
  /** Hard temporal gate for any candidate pair. */
  timeWindowMs?: number;
  /** Hard geographic gate when both observations have coordinates. */
  maxDistanceKm?: number;
  /** Minimum deterministic pair score required to create a link. */
  minimumLinkConfidence?: number;
  /** Hard cap after deterministic deduplication. Newest observations are retained. */
  maxObservations?: number;
  /** Additional CPU guard for dense same-time input sets. */
  maxPairEvaluations?: number;
  /** Keep uncorrelated observations as single-observation incidents. */
  includeSingletons?: boolean;
  /** Synthetic source id used when normalizing AOI Watch Events. */
  watchSourceId?: string;
}

export interface IncidentCorrelationStats {
  inputObservations: number;
  normalizedObservations: number;
  deduplicatedObservations: number;
  droppedByObservationLimit: number;
  pairEvaluations: number;
  pairEvaluationLimitReached: boolean;
  incidents: number;
}

export interface IncidentCorrelationResult {
  incidents: Incident[];
  observations: NormalizedObservation[];
  dataGaps: string[];
  stats: IncidentCorrelationStats;
}

export const DEFAULT_INCIDENT_CORRELATION_OPTIONS = Object.freeze({
  timeWindowMs: 30 * 60 * 1000,
  maxDistanceKm: 75,
  minimumLinkConfidence: 0.5,
  maxObservations: 2_000,
  maxPairEvaluations: 1_000_000,
  includeSingletons: true,
  watchSourceId: 'aoi-watch',
});

const MAX_CONFIGURED_OBSERVATIONS = 10_000;
const MAX_CONFIGURED_PAIR_EVALUATIONS = 5_000_000;

const SOURCE_STATUS_SEVERITY: Record<IncidentSourceStatus, number> = {
  live: 0,
  degraded: 1,
  stale: 2,
  offline: 3,
  unknown: 4,
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 3): number {
  const scale = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * scale) / scale;
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

function normalizeCategory(value: string | null | undefined): string | null {
  const normalized = optionalText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function epochMs(value: ObservationTimestamp, field: string): number {
  const parsed = typeof value === 'number'
    ? value
    : value instanceof Date
      ? value.getTime()
      : Date.parse(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new TypeError(`${field} must be a valid timestamp`);
  return parsed;
}

function coordinate(value: number | null | undefined, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function uniqueSorted(values: readonly string[] | null | undefined): string[] {
  if (!values) return [];
  return [...new Set(values.map(value => value.trim()).filter(Boolean))].sort(compareText);
}

function normalizeAttributes(
  attributes: Readonly<Record<string, ObservationAttribute>> | null | undefined,
): Record<string, ObservationAttribute> {
  if (!attributes) return {};
  const result: Record<string, ObservationAttribute> = {};
  for (const key of Object.keys(attributes).sort(compareText)) {
    const value = attributes[key];
    if (value === null || typeof value === 'string' || typeof value === 'boolean') result[key] = value;
    else if (typeof value === 'number' && Number.isFinite(value)) result[key] = value;
  }
  return result;
}

function normalizeDomain(value: ObservationDomain): ObservationDomain {
  const allowed: readonly ObservationDomain[] = [
    'aoi-watch', 'civil-warning', 'earthquake', 'weather', 'fire',
    'aviation', 'maritime', 'infrastructure', 'news', 'other',
  ];
  if (!allowed.includes(value)) throw new TypeError(`unsupported observation domain: ${String(value)}`);
  return value;
}

export function normalizeObservation(input: ObservationInput): NormalizedObservation {
  const sourceObservationId = requiredText(input.id, 'observation.id');
  const sourceId = requiredText(input.sourceId, 'observation.sourceId');
  const observedAt = epochMs(input.observedAt, 'observation.observedAt');
  return {
    id: `${sourceId}:${sourceObservationId}`,
    sourceObservationId,
    sourceId,
    observedAt,
    observedAtIso: new Date(observedAt).toISOString(),
    domain: normalizeDomain(input.domain),
    category: normalizeCategory(input.category),
    title: optionalText(input.title),
    lat: coordinate(input.lat, -90, 90),
    lng: coordinate(input.lng, -180, 180),
    aoiIds: uniqueSorted(input.aoiIds),
    region: optionalText(input.region),
    attributes: normalizeAttributes(input.attributes),
  };
}

export function normalizeWatchEvent(event: WatchEvent, sourceId = 'aoi-watch'): NormalizedObservation {
  return normalizeObservation({
    id: event.id,
    sourceId,
    observedAt: event.at,
    domain: 'aoi-watch',
    category: `${event.kind}:${event.layer}`,
    title: `${event.label} ${event.kind === 'enter' ? 'entered' : 'left'} ${event.layerLabel}`,
    aoiIds: [event.aoiId],
    attributes: {
      kind: event.kind,
      layer: event.layer,
      layerLabel: event.layerLabel,
    },
  });
}

function observationSort(a: NormalizedObservation, b: NormalizedObservation): number {
  return a.observedAt - b.observedAt
    || compareText(a.sourceId, b.sourceId)
    || compareText(a.sourceObservationId, b.sourceObservationId)
    || compareText(a.domain, b.domain)
    || compareText(a.category ?? '', b.category ?? '');
}

function stableObservationString(value: NormalizedObservation): string {
  return JSON.stringify(value);
}

/**
 * Source + source observation id is the dedupe key. If the same source emits an
 * updated copy, the newest timestamp wins; exact-time conflicts use canonical
 * JSON ordering so input order can never decide the result.
 */
function deduplicateObservations(values: readonly NormalizedObservation[]): NormalizedObservation[] {
  const byId = new Map<string, NormalizedObservation>();
  for (const value of values) {
    const previous = byId.get(value.id);
    if (!previous
        || value.observedAt > previous.observedAt
        || (value.observedAt === previous.observedAt
          && compareText(stableObservationString(value), stableObservationString(previous)) < 0)) {
      byId.set(value.id, value);
    }
  }
  return [...byId.values()].sort(observationSort);
}

function sharedAoiIds(a: NormalizedObservation, b: NormalizedObservation): string[] {
  if (!a.aoiIds.length || !b.aoiIds.length) return [];
  const bIds = new Set(b.aoiIds);
  return a.aoiIds.filter(id => bIds.has(id));
}

export function distanceKm(
  a: Pick<NormalizedObservation, 'lat' | 'lng'>,
  b: Pick<NormalizedObservation, 'lat' | 'lng'>,
): number | null {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371.0088;
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface ResolvedOptions {
  timeWindowMs: number;
  maxDistanceKm: number;
  minimumLinkConfidence: number;
  maxObservations: number;
  maxPairEvaluations: number;
  includeSingletons: boolean;
  watchSourceId: string;
}

function positiveFinite(value: number | undefined, fallback: number, maximum: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(value, maximum)
    : fallback;
}

function resolveOptions(options: IncidentCorrelationOptions): ResolvedOptions {
  return {
    timeWindowMs: positiveFinite(options.timeWindowMs, DEFAULT_INCIDENT_CORRELATION_OPTIONS.timeWindowMs, 7 * 24 * 60 * 60 * 1000),
    maxDistanceKm: positiveFinite(options.maxDistanceKm, DEFAULT_INCIDENT_CORRELATION_OPTIONS.maxDistanceKm, 20_000),
    minimumLinkConfidence: typeof options.minimumLinkConfidence === 'number' && Number.isFinite(options.minimumLinkConfidence)
      ? clamp(options.minimumLinkConfidence, 0.05, 1)
      : DEFAULT_INCIDENT_CORRELATION_OPTIONS.minimumLinkConfidence,
    maxObservations: Math.floor(positiveFinite(options.maxObservations, DEFAULT_INCIDENT_CORRELATION_OPTIONS.maxObservations, MAX_CONFIGURED_OBSERVATIONS)),
    maxPairEvaluations: Math.floor(positiveFinite(options.maxPairEvaluations, DEFAULT_INCIDENT_CORRELATION_OPTIONS.maxPairEvaluations, MAX_CONFIGURED_PAIR_EVALUATIONS)),
    includeSingletons: options.includeSingletons ?? DEFAULT_INCIDENT_CORRELATION_OPTIONS.includeSingletons,
    watchSourceId: optionalText(options.watchSourceId) ?? DEFAULT_INCIDENT_CORRELATION_OPTIONS.watchSourceId,
  };
}

function canonicalFeedHealth(feeds: readonly FeedHealth[]): Map<string, FeedHealth> {
  const ordered = [...feeds].sort((a, b) =>
    compareText(a.id, b.id)
    || SOURCE_STATUS_SEVERITY[a.status] - SOURCE_STATUS_SEVERITY[b.status]
    || (b.lastSuccessAt ?? -1) - (a.lastSuccessAt ?? -1)
    || compareText(a.name, b.name),
  );
  const result = new Map<string, FeedHealth>();
  for (const feed of ordered) if (!result.has(feed.id)) result.set(feed.id, feed);
  return result;
}

function sourcePenalty(sourceId: string, health: ReadonlyMap<string, FeedHealth>): number {
  const status = health.get(sourceId)?.status;
  if (status === 'offline') return 0.16;
  if (status === 'stale') return 0.09;
  if (status === 'degraded') return 0.04;
  if (status === 'live') return 0;
  return 0.02;
}

interface PairEvaluation {
  linked: boolean;
  confidence: number;
  reasons: string[];
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${round(minutes / 60, 1)}h`;
}

function evaluatePair(
  a: NormalizedObservation,
  b: NormalizedObservation,
  options: ResolvedOptions,
  health: ReadonlyMap<string, FeedHealth>,
): PairEvaluation {
  const timeGapMs = Math.abs(b.observedAt - a.observedAt);
  if (timeGapMs > options.timeWindowMs) return { linked: false, confidence: 0, reasons: [] };

  const commonAois = sharedAoiIds(a, b);
  const distance = distanceKm(a, b);
  const insideDistance = distance != null && distance <= options.maxDistanceKm;
  if (commonAois.length === 0 && !insideDistance) {
    return { linked: false, confidence: 0, reasons: [] };
  }

  const temporalScore = 0.1 + 0.2 * (1 - timeGapMs / options.timeWindowMs);
  const aoiScore = commonAois.length ? 0.3 : 0;
  const distanceScore = insideDistance && distance != null
    ? 0.15 + 0.2 * (1 - distance / options.maxDistanceKm)
    : 0;
  const spatialScore = Math.max(aoiScore, distanceScore);
  const sameCategory = a.category != null && a.category === b.category;
  const sameDomain = a.domain === b.domain;
  const categoryScore = sameCategory ? 0.15 : 0;
  const domainScore = sameDomain ? 0.1 : 0;
  const independentSourceScore = a.sourceId !== b.sourceId ? 0.05 : 0;
  const healthPenalty = (sourcePenalty(a.sourceId, health) + sourcePenalty(b.sourceId, health)) / 2;
  const confidence = round(clamp(
    temporalScore + spatialScore + categoryScore + domainScore + independentSourceScore - healthPenalty,
    0,
    1,
  ));

  const reasons = [`Time gap ${formatDuration(timeGapMs)} within ${formatDuration(options.timeWindowMs)} window.`];
  if (commonAois.length) reasons.push(`Shared AOI: ${commonAois.join(', ')}.`);
  if (insideDistance && distance != null) reasons.push(`Locations are ${round(distance, 1)} km apart (limit ${round(options.maxDistanceKm, 1)} km).`);
  if (sameCategory) reasons.push(`Same category: ${a.category}.`);
  else if (sameDomain) reasons.push(`Same domain: ${a.domain}.`);
  else reasons.push(`Cross-domain link: ${a.domain} + ${b.domain}; text similarity was not used.`);
  if (a.sourceId !== b.sourceId) reasons.push(`Independent source IDs: ${a.sourceId}, ${b.sourceId}.`);

  const impaired = [a.sourceId, b.sourceId]
    .map(id => ({ id, status: health.get(id)?.status }))
    .filter((item): item is { id: string; status: FeedStatus } => item.status !== undefined && item.status !== 'live')
    .sort((x, y) => compareText(x.id, y.id));
  for (const item of impaired) reasons.push(`Source ${item.id} is ${item.status}; confidence reduced.`);

  return { linked: confidence >= options.minimumLinkConfidence, confidence, reasons };
}

class DisjointSet {
  private readonly parent: number[];
  private readonly rank: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
    this.rank = Array(size).fill(0);
  }

  find(value: number): number {
    let root = value;
    while (this.parent[root] !== root) root = this.parent[root];
    while (this.parent[value] !== value) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }
    return root;
  }

  union(a: number, b: number): void {
    let rootA = this.find(a);
    let rootB = this.find(b);
    if (rootA === rootB) return;
    if (this.rank[rootA] < this.rank[rootB]) [rootA, rootB] = [rootB, rootA];
    this.parent[rootB] = rootA;
    if (this.rank[rootA] === this.rank[rootB]) this.rank[rootA]++;
  }
}

function fnv1a(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index++) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function djb2(value: string): number {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) hash = Math.imul(hash, 33) ^ value.charCodeAt(index);
  return hash >>> 0;
}

function incidentId(observations: readonly NormalizedObservation[]): string {
  const canonical = observations
    .map(value => `${value.id}@${value.observedAt}`)
    .sort(compareText)
    .join('|');
  return `inc-${fnv1a(canonical).toString(36)}-${djb2(canonical).toString(36)}`;
}

function confidenceLevel(score: number): IncidentConfidenceLevel {
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function dominantText(values: readonly (string | null)[]): string | null {
  const counts = new Map<string, number>();
  for (const value of values) if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .at(0)?.[0] ?? null;
}

function centroid(observations: readonly NormalizedObservation[]): Incident['centroid'] {
  const points = observations.filter(
    (value): value is NormalizedObservation & { lat: number; lng: number } => value.lat != null && value.lng != null,
  );
  if (!points.length) return null;
  return {
    lat: round(points.reduce((sum, value) => sum + value.lat, 0) / points.length, 6),
    lng: round(points.reduce((sum, value) => sum + value.lng, 0) / points.length, 6),
  };
}

function sourceSummary(sourceId: string, health: ReadonlyMap<string, FeedHealth>): IncidentSourceSummary {
  const feed = health.get(sourceId);
  if (!feed) {
    return {
      id: sourceId,
      name: sourceId,
      url: null,
      trust: null,
      status: 'unknown',
      ageMs: null,
      explanation: 'No feed-health record was supplied for this source.',
    };
  }
  return {
    id: feed.id,
    name: feed.name,
    url: feed.url || null,
    trust: feed.trust,
    status: feed.status,
    ageMs: feed.ageMs,
    explanation: feed.explanation,
  };
}

function buildIncident(
  observations: NormalizedObservation[],
  connections: IncidentConnection[],
  health: ReadonlyMap<string, FeedHealth>,
): Incident {
  const orderedObservations = [...observations].sort(observationSort);
  const orderedConnections = [...connections].sort((a, b) =>
    compareText(a.fromObservationId, b.fromObservationId)
    || compareText(a.toObservationId, b.toObservationId),
  );
  const sourceIds = [...new Set(orderedObservations.map(value => value.sourceId))].sort(compareText);
  const sources = sourceIds.map(id => sourceSummary(id, health));
  const aoiIds = uniqueSorted(orderedObservations.flatMap(value => value.aoiIds));
  const domains = [...new Set(orderedObservations.map(value => value.domain))].sort(compareText);
  const region = dominantText(orderedObservations.map(value => value.region));
  const firstTitle = orderedObservations.find(value => value.title)?.title;
  const titleBase = firstTitle ?? `${domains[0] ?? 'other'} incident`;
  const title = orderedObservations.length > 1 ? `${titleBase} +${orderedObservations.length - 1} related` : titleBase;

  const missingCoordinates = orderedObservations.filter(value => value.lat == null || value.lng == null).length;
  const missingAoiAndCoordinates = orderedObservations.filter(
    value => (value.lat == null || value.lng == null) && value.aoiIds.length === 0,
  ).length;
  const uncertainties: string[] = [];
  if (missingCoordinates > 0) uncertainties.push(`${missingCoordinates} observation(s) have no complete coordinates.`);
  if (domains.length > 1) uncertainties.push(`Incident spans ${domains.length} domains; cross-domain links rely on time and location/AOI, not text.`);
  if (sourceIds.length === 1 && orderedObservations.length > 1) uncertainties.push('All observations come from one source ID; independent corroboration is absent.');

  const dataGaps: string[] = [];
  if (missingAoiAndCoordinates > 0) dataGaps.push(`${missingAoiAndCoordinates} observation(s) lack both coordinates and AOI membership.`);
  for (const source of sources) {
    if (source.status === 'offline' || source.status === 'stale' || source.status === 'degraded') {
      dataGaps.push(`Source ${source.id} is ${source.status}: ${source.explanation}`);
    } else if (source.status === 'unknown') {
      dataGaps.push(`Source ${source.id} has no supplied health record.`);
    }
  }
  uncertainties.sort(compareText);
  dataGaps.sort(compareText);

  let score: number;
  const confidenceReasons: string[] = [];
  if (orderedConnections.length) {
    const mean = orderedConnections.reduce((sum, connection) => sum + connection.confidence, 0) / orderedConnections.length;
    const sourceBonus = sourceIds.length > 1 ? 0.04 : 0;
    const gapPenalty = Math.min(0.2, dataGaps.length * 0.03);
    score = round(clamp(mean + sourceBonus - gapPenalty, 0, 1));
    confidenceReasons.push(`Mean of ${orderedConnections.length} qualifying connection score(s): ${round(mean, 3)}.`);
    if (sourceBonus) confidenceReasons.push('Multiple source IDs provide limited corroboration bonus.');
    if (gapPenalty) confidenceReasons.push(`Data-quality gaps reduce confidence by ${round(gapPenalty, 3)}.`);
  } else {
    score = round(clamp(0.3 - sourcePenalty(sourceIds[0] ?? '', health) - Math.min(0.1, dataGaps.length * 0.02), 0, 1));
    confidenceReasons.push('Single observation: no automatic cross-observation correlation is claimed.');
  }

  const startAt = orderedObservations[0].observedAt;
  const endAt = orderedObservations.at(-1)!.observedAt;
  return {
    id: incidentId(orderedObservations),
    title,
    startAt,
    endAt,
    startAtIso: new Date(startAt).toISOString(),
    endAtIso: new Date(endAt).toISOString(),
    confidence: {
      score,
      level: confidenceLevel(score),
      reasons: confidenceReasons,
    },
    region: region ?? (aoiIds.length === 1 ? `AOI ${aoiIds[0]}` : null),
    aoiIds,
    centroid: centroid(orderedObservations),
    domains,
    observations: orderedObservations,
    connections: orderedConnections,
    sources,
    uncertainties,
    dataGaps,
  };
}

function globalDataGaps(feeds: ReadonlyMap<string, FeedHealth>): string[] {
  const gaps: string[] = [];
  for (const feed of [...feeds.values()].sort((a, b) => compareText(a.id, b.id))) {
    if (feed.status === 'offline' || feed.status === 'stale' || feed.status === 'degraded') {
      gaps.push(`Source ${feed.id} is ${feed.status}: ${feed.explanation}`);
    }
  }
  return gaps;
}

/**
 * Pure deterministic correlation engine.
 *
 * Pair linkage requires temporal proximity plus either geographic proximity or
 * shared AOI membership. Categories/domains adjust confidence but are never the
 * sole reason for a link. Titles and free text are deliberately ignored by the
 * algorithm.
 */
export function correlateIncidents(
  input: IncidentCorrelationInput,
  options: IncidentCorrelationOptions = {},
): IncidentCorrelationResult {
  const resolved = resolveOptions(options);
  const feedHealth = canonicalFeedHealth(input.feedHealth ?? []);
  const ordinary = (input.observations ?? []).map(normalizeObservation);
  const watched = (input.watchEvents ?? []).map(event => normalizeWatchEvent(event, resolved.watchSourceId));
  const inputCount = ordinary.length + watched.length;
  const deduplicated = deduplicateObservations([...ordinary, ...watched]);

  const retainedNewest = [...deduplicated]
    .sort((a, b) => b.observedAt - a.observedAt || observationSort(a, b))
    .slice(0, resolved.maxObservations)
    .sort(observationSort);
  const droppedByObservationLimit = deduplicated.length - retainedNewest.length;

  const set = new DisjointSet(retainedNewest.length);
  const qualifyingConnections: IncidentConnection[] = [];
  let pairEvaluations = 0;
  let pairEvaluationLimitReached = false;

  outer: for (let i = 0; i < retainedNewest.length; i++) {
    for (let j = i + 1; j < retainedNewest.length; j++) {
      const timeGap = retainedNewest[j].observedAt - retainedNewest[i].observedAt;
      if (timeGap > resolved.timeWindowMs) break;
      if (pairEvaluations >= resolved.maxPairEvaluations) {
        pairEvaluationLimitReached = true;
        break outer;
      }
      pairEvaluations++;
      const evaluation = evaluatePair(retainedNewest[i], retainedNewest[j], resolved, feedHealth);
      if (!evaluation.linked) continue;
      set.union(i, j);
      const leftId = retainedNewest[i].id;
      const rightId = retainedNewest[j].id;
      qualifyingConnections.push({
        fromObservationId: compareText(leftId, rightId) <= 0 ? leftId : rightId,
        toObservationId: compareText(leftId, rightId) <= 0 ? rightId : leftId,
        confidence: evaluation.confidence,
        reasons: evaluation.reasons,
      });
    }
  }

  const groups = new Map<number, NormalizedObservation[]>();
  for (let index = 0; index < retainedNewest.length; index++) {
    const root = set.find(index);
    const group = groups.get(root);
    if (group) group.push(retainedNewest[index]);
    else groups.set(root, [retainedNewest[index]]);
  }

  const observationRoot = new Map<string, number>();
  for (let index = 0; index < retainedNewest.length; index++) observationRoot.set(retainedNewest[index].id, set.find(index));
  const connectionsByRoot = new Map<number, IncidentConnection[]>();
  for (const connection of qualifyingConnections) {
    const root = observationRoot.get(connection.fromObservationId);
    if (root == null) continue;
    const list = connectionsByRoot.get(root);
    if (list) list.push(connection);
    else connectionsByRoot.set(root, [connection]);
  }

  const incidents = [...groups.entries()]
    .filter(([, group]) => resolved.includeSingletons || group.length > 1)
    .map(([root, group]) => buildIncident(group, connectionsByRoot.get(root) ?? [], feedHealth))
    .sort((a, b) => a.startAt - b.startAt || a.endAt - b.endAt || compareText(a.id, b.id));

  return {
    incidents,
    observations: retainedNewest,
    dataGaps: globalDataGaps(feedHealth),
    stats: {
      inputObservations: inputCount,
      normalizedObservations: ordinary.length + watched.length,
      deduplicatedObservations: deduplicated.length,
      droppedByObservationLimit,
      pairEvaluations,
      pairEvaluationLimitReached,
      incidents: incidents.length,
    },
  };
}
