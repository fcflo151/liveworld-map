/**
 * Client-side history snapshots for LiveWorld Map.
 *
 * The storage and comparison logic is deliberately framework-independent. React
 * components consume the types/results from this module, while tests can inject
 * a tiny StorageLike implementation without a browser or jsdom.
 */

export const HISTORY_SNAPSHOT_VERSION = 1 as const;
export const HISTORY_STORE_VERSION = 1 as const;
export const HISTORY_STORAGE_KEY = 'liveworld.history.snapshots.v1';
export const DEFAULT_MAX_SNAPSHOTS = 50;
export const DEFAULT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

export interface SnapshotMapView {
  latitude: number;
  longitude: number;
  zoom: number;
  bearing?: number;
  pitch?: number;
}

export interface SnapshotEntityDomain {
  /** Count is always recorded, even when stable identities are unavailable. */
  count: number;
  /** Stable IDs enable exact added/disappeared detection during comparison. */
  ids?: string[];
}

export interface SnapshotEventState {
  selected: string[];
  highlighted: string[];
}

export interface HistorySnapshotV1 {
  version: typeof HISTORY_SNAPSHOT_VERSION;
  id: string;
  capturedAt: number;
  map: SnapshotMapView;
  activeLayers: string[];
  entities: Record<string, SnapshotEntityDomain>;
  events: SnapshotEventState;
  aoiRefs?: string[];
}

export type HistorySnapshot = HistorySnapshotV1;

export interface HistorySnapshotInput {
  map: SnapshotMapView;
  activeLayers: readonly string[];
  entities: Record<string, { count: number; ids?: readonly string[] }>;
  events?: {
    selected?: readonly string[];
    highlighted?: readonly string[];
  };
  aoiRefs?: readonly string[];
}

export interface CreateHistorySnapshotOptions {
  id?: string;
  capturedAt?: number;
}

export interface SnapshotValidationSuccess {
  valid: true;
  snapshot: HistorySnapshot;
  errors: [];
}

export interface SnapshotValidationFailure {
  valid: false;
  errors: string[];
}

export type SnapshotValidationResult = SnapshotValidationSuccess | SnapshotValidationFailure;

export interface SnapshotRetentionPolicy {
  maxSnapshots?: number;
  retentionMs?: number;
  now?: number;
}

export interface ResolvedSnapshotRetentionPolicy {
  maxSnapshots: number;
  retentionMs: number;
  now: number;
}

export interface SnapshotPruneResult {
  snapshots: HistorySnapshot[];
  removedExpired: number;
  removedOverflow: number;
  removedDuplicates: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface SnapshotStorageOptions extends SnapshotRetentionPolicy {
  storage?: StorageLike | null;
  key?: string;
}

export type SnapshotStorageError = 'unavailable' | 'read-failed' | 'write-failed' | 'validation-failed';

export interface SnapshotLoadResult extends SnapshotPruneResult {
  storageAvailable: boolean;
  removedInvalid: number;
  cleanedStorage: boolean;
  resetCorruptStore: boolean;
  error?: SnapshotStorageError;
}

export interface SnapshotMutationResult extends SnapshotLoadResult {
  ok: boolean;
  validationErrors?: string[];
}

export interface SnapshotEntityComparison {
  beforeCount: number;
  afterCount: number;
  delta: number;
  /** True only when stable IDs were captured on both compared sides. */
  identityComparable: boolean;
  addedIds: string[];
  removedIds: string[];
}

export interface SnapshotComparison {
  beforeId: string;
  afterId: string;
  elapsedMs: number;
  map: {
    changed: boolean;
    latitudeDelta: number;
    longitudeDelta: number;
    zoomDelta: number;
    bearingDelta: number;
    pitchDelta: number;
  };
  layers: { added: string[]; removed: string[] };
  entities: Record<string, SnapshotEntityComparison>;
  events: {
    selectedAdded: string[];
    selectedRemoved: string[];
    highlightedAdded: string[];
    highlightedRemoved: string[];
  };
  aois: { added: string[]; removed: string[] };
}

interface HistorySnapshotStoreV1 {
  version: typeof HISTORY_STORE_VERSION;
  snapshots: unknown[];
}

interface DecodedStore extends SnapshotPruneResult {
  removedInvalid: number;
  resetCorruptStore: boolean;
  changed: boolean;
}

let generatedIdSequence = 0;

function uniqueStrings(values: readonly string[] | undefined): string[] {
  if (!values) return [];
  return [...new Set(values.filter(value => typeof value === 'string' && value.trim()).map(value => value.trim()))].sort();
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return finite(value) && Number.isInteger(value) && value >= 0;
}

function optionalFinite(value: unknown): value is number | undefined {
  return value === undefined || finite(value);
}

function validMapView(map: unknown): map is SnapshotMapView {
  if (!map || typeof map !== 'object') return false;
  const candidate = map as Record<string, unknown>;
  return finite(candidate.latitude)
    && candidate.latitude >= -90
    && candidate.latitude <= 90
    && finite(candidate.longitude)
    && candidate.longitude >= -180
    && candidate.longitude <= 180
    && finite(candidate.zoom)
    && candidate.zoom >= 0
    && candidate.zoom <= 24
    && optionalFinite(candidate.bearing)
    && optionalFinite(candidate.pitch);
}

function validStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' && item.trim().length > 0);
}

function validEntityDomains(value: unknown): value is Record<string, SnapshotEntityDomain> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  for (const [key, domain] of Object.entries(value)) {
    if (!key.trim() || !domain || typeof domain !== 'object' || Array.isArray(domain)) return false;
    const record = domain as Record<string, unknown>;
    if (!nonNegativeInteger(record.count)) return false;
    if (record.ids !== undefined && !validStringArray(record.ids)) return false;
  }
  return true;
}

function normalizeMapView(map: SnapshotMapView): SnapshotMapView {
  return {
    latitude: map.latitude,
    longitude: map.longitude,
    zoom: map.zoom,
    ...(map.bearing !== undefined ? { bearing: map.bearing } : {}),
    ...(map.pitch !== undefined ? { pitch: map.pitch } : {}),
  };
}

function normalizeEntityDomains(input: HistorySnapshotInput['entities']): Record<string, SnapshotEntityDomain> {
  const entities: Record<string, SnapshotEntityDomain> = {};
  for (const key of Object.keys(input).sort()) {
    const domain = input[key];
    const count = Number.isFinite(domain.count) ? Math.max(0, Math.floor(domain.count)) : 0;
    const ids = domain.ids ? uniqueStrings(domain.ids) : undefined;
    entities[key] = { count, ...(ids ? { ids } : {}) };
  }
  return entities;
}

function generateSnapshotId(capturedAt: number): string {
  generatedIdSequence = (generatedIdSequence + 1) % 1_000_000;
  return `snapshot-${capturedAt.toString(36)}-${generatedIdSequence.toString(36)}`;
}

/** Build a normalized version-1 snapshot. Pass id/capturedAt for deterministic tests. */
export function createHistorySnapshot(
  input: HistorySnapshotInput,
  options: CreateHistorySnapshotOptions = {},
): HistorySnapshot {
  const capturedAt = finite(options.capturedAt) ? options.capturedAt : Date.now();
  const id = options.id?.trim() || generateSnapshotId(capturedAt);
  return {
    version: HISTORY_SNAPSHOT_VERSION,
    id,
    capturedAt,
    map: normalizeMapView(input.map),
    activeLayers: uniqueStrings(input.activeLayers),
    entities: normalizeEntityDomains(input.entities),
    events: {
      selected: uniqueStrings(input.events?.selected),
      highlighted: uniqueStrings(input.events?.highlighted),
    },
    ...(input.aoiRefs ? { aoiRefs: uniqueStrings(input.aoiRefs) } : {}),
  };
}

/** Strict runtime validation for untrusted localStorage data. */
export function validateHistorySnapshot(value: unknown): SnapshotValidationResult {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['snapshot must be an object'] };
  }
  const snapshot = value as Record<string, unknown>;
  if (snapshot.version !== HISTORY_SNAPSHOT_VERSION) errors.push(`unsupported snapshot version: ${String(snapshot.version)}`);
  if (typeof snapshot.id !== 'string' || !snapshot.id.trim()) errors.push('id must be a non-empty string');
  if (!finite(snapshot.capturedAt) || snapshot.capturedAt < 0) errors.push('capturedAt must be a non-negative finite epoch');
  if (!validMapView(snapshot.map)) errors.push('map view is invalid');
  if (!validStringArray(snapshot.activeLayers)) errors.push('activeLayers must contain non-empty strings');
  if (!validEntityDomains(snapshot.entities)) errors.push('entities must contain non-negative integer counts and optional string ids');

  const events = snapshot.events as Record<string, unknown> | undefined;
  if (!events || typeof events !== 'object' || Array.isArray(events)
      || !validStringArray(events.selected) || !validStringArray(events.highlighted)) {
    errors.push('events.selected and events.highlighted must be string arrays');
  }
  if (snapshot.aoiRefs !== undefined && !validStringArray(snapshot.aoiRefs)) errors.push('aoiRefs must be a string array when present');

  if (errors.length) return { valid: false, errors };

  // Re-normalize valid external data so duplicate IDs/layers cannot leak into
  // comparison logic merely because localStorage was hand-edited.
  const typed = snapshot as unknown as HistorySnapshot;
  const normalized: HistorySnapshot = {
    version: HISTORY_SNAPSHOT_VERSION,
    id: typed.id.trim(),
    capturedAt: typed.capturedAt,
    map: normalizeMapView(typed.map),
    activeLayers: uniqueStrings(typed.activeLayers),
    entities: Object.fromEntries(Object.entries(typed.entities).sort().map(([key, domain]) => [
      key,
      { count: domain.count, ...(domain.ids ? { ids: uniqueStrings(domain.ids) } : {}) },
    ])),
    events: {
      selected: uniqueStrings(typed.events.selected),
      highlighted: uniqueStrings(typed.events.highlighted),
    },
    ...(typed.aoiRefs ? { aoiRefs: uniqueStrings(typed.aoiRefs) } : {}),
  };
  return { valid: true, snapshot: normalized, errors: [] };
}

export function resolveSnapshotRetentionPolicy(policy: SnapshotRetentionPolicy = {}): ResolvedSnapshotRetentionPolicy {
  const now = finite(policy.now) ? policy.now : Date.now();
  const maxSnapshots = finite(policy.maxSnapshots) && policy.maxSnapshots >= 1
    ? Math.max(1, Math.floor(policy.maxSnapshots))
    : DEFAULT_MAX_SNAPSHOTS;
  const retentionMs = finite(policy.retentionMs) && policy.retentionMs >= 0
    ? policy.retentionMs
    : DEFAULT_RETENTION_MS;
  return { now, maxSnapshots, retentionMs };
}

/** Sort newest-first, remove duplicate IDs, expire old rows and enforce the cap. */
export function pruneHistorySnapshots(
  snapshots: readonly HistorySnapshot[],
  policy: SnapshotRetentionPolicy = {},
): SnapshotPruneResult {
  const resolved = resolveSnapshotRetentionPolicy(policy);
  const sorted = [...snapshots].sort((a, b) => b.capturedAt - a.capturedAt || a.id.localeCompare(b.id));
  const unique: HistorySnapshot[] = [];
  const seen = new Set<string>();
  let removedDuplicates = 0;
  for (const snapshot of sorted) {
    if (seen.has(snapshot.id)) {
      removedDuplicates++;
      continue;
    }
    seen.add(snapshot.id);
    unique.push(snapshot);
  }

  const cutoff = resolved.now - resolved.retentionMs;
  const retained = unique.filter(snapshot => snapshot.capturedAt >= cutoff);
  const removedExpired = unique.length - retained.length;
  const snapshotsWithinLimit = retained.slice(0, resolved.maxSnapshots);
  const removedOverflow = retained.length - snapshotsWithinLimit.length;
  return { snapshots: snapshotsWithinLimit, removedExpired, removedOverflow, removedDuplicates };
}

function encodeStore(snapshots: readonly HistorySnapshot[]): string {
  return JSON.stringify({ version: HISTORY_STORE_VERSION, snapshots });
}

/** Pure decode/validate/prune step used by the localStorage adapter and tests. */
export function deserializeHistorySnapshotStore(
  raw: string | null,
  policy: SnapshotRetentionPolicy = {},
): DecodedStore {
  if (raw == null || raw === '') {
    return {
      snapshots: [], removedInvalid: 0, removedExpired: 0,
      removedOverflow: 0, removedDuplicates: 0,
      resetCorruptStore: false, changed: false,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {
      snapshots: [], removedInvalid: 1, removedExpired: 0,
      removedOverflow: 0, removedDuplicates: 0,
      resetCorruptStore: true, changed: true,
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      snapshots: [], removedInvalid: 1, removedExpired: 0,
      removedOverflow: 0, removedDuplicates: 0,
      resetCorruptStore: true, changed: true,
    };
  }
  const store = parsed as Partial<HistorySnapshotStoreV1>;
  if (store.version !== HISTORY_STORE_VERSION || !Array.isArray(store.snapshots)) {
    return {
      snapshots: [], removedInvalid: 1, removedExpired: 0,
      removedOverflow: 0, removedDuplicates: 0,
      resetCorruptStore: true, changed: true,
    };
  }

  const valid: HistorySnapshot[] = [];
  let removedInvalid = 0;
  for (const candidate of store.snapshots) {
    const validation = validateHistorySnapshot(candidate);
    if (validation.valid) valid.push(validation.snapshot);
    else removedInvalid++;
  }
  const pruned = pruneHistorySnapshots(valid, policy);
  const changed = removedInvalid > 0
    || pruned.removedExpired > 0
    || pruned.removedOverflow > 0
    || pruned.removedDuplicates > 0
    || valid.length !== store.snapshots.length;
  return { ...pruned, removedInvalid, resetCorruptStore: false, changed };
}

function browserStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {
    // Access itself can throw in hardened/private browser environments.
  }
  return null;
}

function resolveStorage(storage: StorageLike | null | undefined): StorageLike | null {
  return storage === undefined ? browserStorage() : storage;
}

function emptyLoad(error: SnapshotStorageError = 'unavailable'): SnapshotLoadResult {
  return {
    snapshots: [], storageAvailable: false, removedInvalid: 0,
    removedExpired: 0, removedOverflow: 0, removedDuplicates: 0,
    cleanedStorage: false, resetCorruptStore: false, error,
  };
}

/**
 * Read, validate and opportunistically clean localStorage.
 * Malformed individual snapshots are removed without discarding valid history.
 */
export function loadHistorySnapshots(options: SnapshotStorageOptions = {}): SnapshotLoadResult {
  const storage = resolveStorage(options.storage);
  if (!storage) return emptyLoad('unavailable');
  const key = options.key ?? HISTORY_STORAGE_KEY;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { ...emptyLoad('read-failed'), storageAvailable: true };
  }

  const decoded = deserializeHistorySnapshotStore(raw, options);
  let cleanedStorage = false;
  let error: SnapshotStorageError | undefined;

  if (raw != null && decoded.changed) {
    try {
      if (decoded.resetCorruptStore) storage.removeItem(key);
      else storage.setItem(key, encodeStore(decoded.snapshots));
      cleanedStorage = true;
    } catch {
      error = 'write-failed';
    }
  }

  return {
    snapshots: decoded.snapshots,
    storageAvailable: true,
    removedInvalid: decoded.removedInvalid,
    removedExpired: decoded.removedExpired,
    removedOverflow: decoded.removedOverflow,
    removedDuplicates: decoded.removedDuplicates,
    cleanedStorage,
    resetCorruptStore: decoded.resetCorruptStore,
    ...(error ? { error } : {}),
  };
}

/** Validate and append/replace one snapshot, then apply retention/cap policy. */
export function saveHistorySnapshot(
  snapshot: HistorySnapshot,
  options: SnapshotStorageOptions = {},
): SnapshotMutationResult {
  const validation = validateHistorySnapshot(snapshot);
  if (!validation.valid) {
    return {
      ...emptyLoad('validation-failed'), ok: false,
      removedInvalid: 1,
      validationErrors: validation.errors,
    };
  }

  const storage = resolveStorage(options.storage);
  if (!storage) return { ...emptyLoad('unavailable'), ok: false };
  const key = options.key ?? HISTORY_STORAGE_KEY;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { ...emptyLoad('read-failed'), storageAvailable: true, ok: false };
  }

  const decoded = deserializeHistorySnapshotStore(raw, options);
  const withoutSameId = decoded.snapshots.filter(item => item.id !== validation.snapshot.id);
  const pruned = pruneHistorySnapshots([validation.snapshot, ...withoutSameId], options);

  try {
    storage.setItem(key, encodeStore(pruned.snapshots));
  } catch {
    return {
      ...decoded,
      storageAvailable: true,
      cleanedStorage: false,
      error: 'write-failed',
      ok: false,
    };
  }

  return {
    snapshots: pruned.snapshots,
    storageAvailable: true,
    removedInvalid: decoded.removedInvalid,
    removedExpired: decoded.removedExpired + pruned.removedExpired,
    removedOverflow: decoded.removedOverflow + pruned.removedOverflow,
    removedDuplicates: decoded.removedDuplicates + pruned.removedDuplicates,
    cleanedStorage: true,
    resetCorruptStore: decoded.resetCorruptStore,
    ok: true,
  };
}

/** Delete one snapshot by id. Invalid/expired rows are cleaned in the same pass. */
export function deleteHistorySnapshot(id: string, options: SnapshotStorageOptions = {}): SnapshotMutationResult {
  const storage = resolveStorage(options.storage);
  if (!storage) return { ...emptyLoad('unavailable'), ok: false };
  const key = options.key ?? HISTORY_STORAGE_KEY;

  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return { ...emptyLoad('read-failed'), storageAvailable: true, ok: false };
  }

  const decoded = deserializeHistorySnapshotStore(raw, options);
  const next = decoded.snapshots.filter(snapshot => snapshot.id !== id);
  try {
    if (next.length === 0) storage.removeItem(key);
    else storage.setItem(key, encodeStore(next));
  } catch {
    return {
      ...decoded,
      storageAvailable: true,
      cleanedStorage: false,
      error: 'write-failed',
      ok: false,
    };
  }

  return {
    ...decoded,
    snapshots: next,
    storageAvailable: true,
    cleanedStorage: true,
    ok: true,
  };
}

function setDifference(after: readonly string[], before: readonly string[]): string[] {
  const beforeSet = new Set(before);
  return [...new Set(after)].filter(value => !beforeSet.has(value)).sort();
}

function numericOrZero(value: number | undefined): number {
  return finite(value) ? value : 0;
}

/**
 * Compare two snapshots. Entity arrivals/departures are exact when stable IDs
 * were recorded on both sides; otherwise the count delta remains available and
 * `identityComparable` is false.
 */
export function compareHistorySnapshots(before: HistorySnapshot, after: HistorySnapshot): SnapshotComparison {
  const entityKeys = [...new Set([...Object.keys(before.entities), ...Object.keys(after.entities)])].sort();
  const entities: Record<string, SnapshotEntityComparison> = {};

  for (const key of entityKeys) {
    const previous = before.entities[key];
    const current = after.entities[key];
    const beforeCount = previous?.count ?? 0;
    const afterCount = current?.count ?? 0;
    const beforeIds = previous?.ids;
    const afterIds = current?.ids;
    const identityComparable = Array.isArray(beforeIds) && Array.isArray(afterIds);
    entities[key] = {
      beforeCount,
      afterCount,
      delta: afterCount - beforeCount,
      identityComparable,
      addedIds: identityComparable ? setDifference(afterIds!, beforeIds!) : [],
      removedIds: identityComparable ? setDifference(beforeIds!, afterIds!) : [],
    };
  }

  const bearingBefore = numericOrZero(before.map.bearing);
  const bearingAfter = numericOrZero(after.map.bearing);
  const pitchBefore = numericOrZero(before.map.pitch);
  const pitchAfter = numericOrZero(after.map.pitch);
  const latitudeDelta = after.map.latitude - before.map.latitude;
  const longitudeDelta = after.map.longitude - before.map.longitude;
  const zoomDelta = after.map.zoom - before.map.zoom;
  const bearingDelta = bearingAfter - bearingBefore;
  const pitchDelta = pitchAfter - pitchBefore;

  return {
    beforeId: before.id,
    afterId: after.id,
    elapsedMs: after.capturedAt - before.capturedAt,
    map: {
      changed: [latitudeDelta, longitudeDelta, zoomDelta, bearingDelta, pitchDelta].some(delta => delta !== 0),
      latitudeDelta,
      longitudeDelta,
      zoomDelta,
      bearingDelta,
      pitchDelta,
    },
    layers: {
      added: setDifference(after.activeLayers, before.activeLayers),
      removed: setDifference(before.activeLayers, after.activeLayers),
    },
    entities,
    events: {
      selectedAdded: setDifference(after.events.selected, before.events.selected),
      selectedRemoved: setDifference(before.events.selected, after.events.selected),
      highlightedAdded: setDifference(after.events.highlighted, before.events.highlighted),
      highlightedRemoved: setDifference(before.events.highlighted, after.events.highlighted),
    },
    aois: {
      added: setDifference(after.aoiRefs ?? [], before.aoiRefs ?? []),
      removed: setDifference(before.aoiRefs ?? [], after.aoiRefs ?? []),
    },
  };
}

/** Convenience helper for turning Record<layer, boolean> into snapshot layer IDs. */
export function activeLayerKeys(activeLayers: Readonly<Record<string, boolean>>): string[] {
  return Object.entries(activeLayers)
    .filter(([, active]) => active)
    .map(([key]) => key)
    .sort();
}
