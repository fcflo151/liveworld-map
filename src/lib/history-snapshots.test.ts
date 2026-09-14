import { describe, expect, it } from 'vitest';
import {
  HISTORY_STORAGE_KEY,
  activeLayerKeys,
  compareHistorySnapshots,
  createHistorySnapshot,
  deleteHistorySnapshot,
  deserializeHistorySnapshotStore,
  loadHistorySnapshots,
  pruneHistorySnapshots,
  saveHistorySnapshot,
  validateHistorySnapshot,
  type HistorySnapshot,
  type StorageLike,
} from './history-snapshots';

const NOW = Date.UTC(2026, 8, 14, 16, 30, 0);

class MemoryStorage implements StorageLike {
  values = new Map<string, string>();
  throwOnGet = false;
  throwOnSet = false;
  throwOnRemove = false;

  getItem(key: string): string | null {
    if (this.throwOnGet) throw new Error('read blocked');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.throwOnSet) throw new Error('quota exceeded');
    this.values.set(key, value);
  }
  removeItem(key: string): void {
    if (this.throwOnRemove) throw new Error('remove blocked');
    this.values.delete(key);
  }
}

function snapshot(id: string, capturedAt = NOW, overrides: Partial<Parameters<typeof createHistorySnapshot>[0]> = {}): HistorySnapshot {
  return createHistorySnapshot({
    map: { latitude: 53.55, longitude: 9.99, zoom: 8, bearing: 0, pitch: 0 },
    activeLayers: ['flights', 'earthquakes'],
    entities: {
      flights: { count: 2, ids: ['abc', 'def'] },
      earthquakes: { count: 1, ids: ['eq-1'] },
    },
    events: { selected: ['evt-1'], highlighted: [] },
    aoiRefs: ['aoi-1'],
    ...overrides,
  }, { id, capturedAt });
}

describe('createHistorySnapshot and validation', () => {
  it('creates a normalized versioned snapshot and de-duplicates string sets', () => {
    const created = createHistorySnapshot({
      map: { latitude: 1, longitude: 2, zoom: 3 },
      activeLayers: ['z', 'a', 'z'],
      entities: { flights: { count: 2.9, ids: ['b', 'a', 'a'] } },
      events: { selected: ['x', 'x'], highlighted: ['y'] },
      aoiRefs: ['zone', 'zone'],
    }, { id: 's1', capturedAt: NOW });

    expect(created.version).toBe(1);
    expect(created.activeLayers).toEqual(['a', 'z']);
    expect(created.entities.flights).toEqual({ count: 2, ids: ['a', 'b'] });
    expect(created.events.selected).toEqual(['x']);
    expect(created.aoiRefs).toEqual(['zone']);
    expect(validateHistorySnapshot(created).valid).toBe(true);
  });

  it('rejects unsupported versions and invalid map/entity data', () => {
    const bad = {
      ...snapshot('bad'),
      version: 2,
      map: { latitude: 200, longitude: 0, zoom: 4 },
      entities: { flights: { count: -1 } },
    };
    const result = validateHistorySnapshot(bad);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some(error => error.includes('version'))).toBe(true);
      expect(result.errors.some(error => error.includes('map'))).toBe(true);
      expect(result.errors.some(error => error.includes('entities'))).toBe(true);
    }
  });

  it('rejects missing event arrays rather than trusting malformed localStorage', () => {
    const bad = { ...snapshot('bad-events'), events: { selected: [] } };
    expect(validateHistorySnapshot(bad).valid).toBe(false);
  });

  it('extracts only enabled layer keys in stable order', () => {
    expect(activeLayerKeys({ z: true, a: true, hidden: false })).toEqual(['a', 'z']);
  });
});

describe('pruning and store decoding', () => {
  it('sorts newest first, expires old snapshots and enforces max count', () => {
    const result = pruneHistorySnapshots([
      snapshot('old', NOW - 10_000),
      snapshot('new', NOW - 100),
      snapshot('mid', NOW - 500),
    ], { now: NOW, retentionMs: 2_000, maxSnapshots: 1 });
    expect(result.snapshots.map(item => item.id)).toEqual(['new']);
    expect(result.removedExpired).toBe(1);
    expect(result.removedOverflow).toBe(1);
  });

  it('keeps the newest duplicate id', () => {
    const result = pruneHistorySnapshots([
      snapshot('same', NOW - 500),
      snapshot('same', NOW - 100),
    ], { now: NOW, retentionMs: 10_000, maxSnapshots: 10 });
    expect(result.snapshots).toHaveLength(1);
    expect(result.snapshots[0].capturedAt).toBe(NOW - 100);
    expect(result.removedDuplicates).toBe(1);
  });

  it('drops malformed entries but keeps valid snapshots', () => {
    const raw = JSON.stringify({
      version: 1,
      snapshots: [snapshot('good'), { id: 'broken' }, null],
    });
    const result = deserializeHistorySnapshotStore(raw, { now: NOW, retentionMs: 10_000 });
    expect(result.snapshots.map(item => item.id)).toEqual(['good']);
    expect(result.removedInvalid).toBe(2);
    expect(result.changed).toBe(true);
    expect(result.resetCorruptStore).toBe(false);
  });

  it('marks invalid JSON and unsupported envelopes for complete reset', () => {
    expect(deserializeHistorySnapshotStore('{bad', { now: NOW }).resetCorruptStore).toBe(true);
    expect(deserializeHistorySnapshotStore(JSON.stringify({ version: 99, snapshots: [] }), { now: NOW }).resetCorruptStore).toBe(true);
    expect(deserializeHistorySnapshotStore(JSON.stringify([]), { now: NOW }).resetCorruptStore).toBe(true);
  });
});

describe('localStorage adapter', () => {
  it('round-trips snapshots through injected storage', () => {
    const storage = new MemoryStorage();
    const saved = saveHistorySnapshot(snapshot('one'), { storage, now: NOW, retentionMs: 10_000 });
    expect(saved.ok).toBe(true);
    const loaded = loadHistorySnapshots({ storage, now: NOW, retentionMs: 10_000 });
    expect(loaded.snapshots.map(item => item.id)).toEqual(['one']);
    expect(loaded.storageAvailable).toBe(true);
  });

  it('replaces the same id instead of creating duplicates', () => {
    const storage = new MemoryStorage();
    saveHistorySnapshot(snapshot('same', NOW - 1_000), { storage, now: NOW, retentionMs: 10_000 });
    const newer = snapshot('same', NOW - 100, {
      map: { latitude: 1, longitude: 2, zoom: 3 },
    });
    const saved = saveHistorySnapshot(newer, { storage, now: NOW, retentionMs: 10_000 });
    expect(saved.ok).toBe(true);
    expect(saved.snapshots).toHaveLength(1);
    expect(saved.snapshots[0].capturedAt).toBe(NOW - 100);
  });

  it('cleans invalid and expired rows during load', () => {
    const storage = new MemoryStorage();
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({
      version: 1,
      snapshots: [snapshot('good', NOW - 100), snapshot('expired', NOW - 20_000), { nope: true }],
    }));
    const loaded = loadHistorySnapshots({ storage, now: NOW, retentionMs: 5_000, maxSnapshots: 10 });
    expect(loaded.snapshots.map(item => item.id)).toEqual(['good']);
    expect(loaded.removedInvalid).toBe(1);
    expect(loaded.removedExpired).toBe(1);
    expect(loaded.cleanedStorage).toBe(true);
    const stored = JSON.parse(storage.getItem(HISTORY_STORAGE_KEY)!);
    expect(stored.snapshots).toHaveLength(1);
  });

  it('removes a fully corrupt store rather than throwing', () => {
    const storage = new MemoryStorage();
    storage.setItem(HISTORY_STORAGE_KEY, 'not-json');
    const loaded = loadHistorySnapshots({ storage, now: NOW });
    expect(loaded.snapshots).toEqual([]);
    expect(loaded.resetCorruptStore).toBe(true);
    expect(loaded.cleanedStorage).toBe(true);
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it('reports storage unavailable when no storage implementation exists', () => {
    const loaded = loadHistorySnapshots({ storage: null, now: NOW });
    expect(loaded.storageAvailable).toBe(false);
    expect(loaded.error).toBe('unavailable');
  });

  it('contains read failures', () => {
    const storage = new MemoryStorage();
    storage.throwOnGet = true;
    const loaded = loadHistorySnapshots({ storage, now: NOW });
    expect(loaded.storageAvailable).toBe(true);
    expect(loaded.error).toBe('read-failed');
  });

  it('contains quota/write failures while saving', () => {
    const storage = new MemoryStorage();
    storage.throwOnSet = true;
    const saved = saveHistorySnapshot(snapshot('quota'), { storage, now: NOW });
    expect(saved.ok).toBe(false);
    expect(saved.error).toBe('write-failed');
  });

  it('rejects an invalid snapshot before writing', () => {
    const storage = new MemoryStorage();
    const bad = { ...snapshot('invalid'), map: { latitude: 999, longitude: 0, zoom: 1 } } as HistorySnapshot;
    const result = saveHistorySnapshot(bad, { storage, now: NOW });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('validation-failed');
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it('deletes by id and removes the key when history becomes empty', () => {
    const storage = new MemoryStorage();
    saveHistorySnapshot(snapshot('one'), { storage, now: NOW, retentionMs: 10_000 });
    const deleted = deleteHistorySnapshot('one', { storage, now: NOW, retentionMs: 10_000 });
    expect(deleted.ok).toBe(true);
    expect(deleted.snapshots).toEqual([]);
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it('contains cleanup write failures on corrupt data', () => {
    const storage = new MemoryStorage();
    storage.setItem(HISTORY_STORAGE_KEY, 'bad-json');
    storage.throwOnRemove = true;
    const loaded = loadHistorySnapshots({ storage, now: NOW });
    expect(loaded.error).toBe('write-failed');
    expect(loaded.cleanedStorage).toBe(false);
  });
});

describe('compareHistorySnapshots', () => {
  it('finds layer, AOI, event, count and exact identity changes', () => {
    const before = snapshot('before', NOW - 5_000, {
      activeLayers: ['flights', 'earthquakes'],
      entities: {
        flights: { count: 2, ids: ['a', 'b'] },
        earthquakes: { count: 1, ids: ['q1'] },
      },
      events: { selected: ['e1'], highlighted: ['h1'] },
      aoiRefs: ['aoi-1'],
    });
    const after = snapshot('after', NOW, {
      map: { latitude: 54, longitude: 10, zoom: 9, bearing: 5, pitch: 10 },
      activeLayers: ['flights', 'fires'],
      entities: {
        flights: { count: 2, ids: ['b', 'c'] },
        earthquakes: { count: 0, ids: [] },
      },
      events: { selected: ['e2'], highlighted: ['h1', 'h2'] },
      aoiRefs: ['aoi-2'],
    });

    const diff = compareHistorySnapshots(before, after);
    expect(diff.layers).toEqual({ added: ['fires'], removed: ['earthquakes'] });
    expect(diff.entities.flights).toMatchObject({ delta: 0, identityComparable: true, addedIds: ['c'], removedIds: ['a'] });
    expect(diff.entities.earthquakes).toMatchObject({ delta: -1, removedIds: ['q1'] });
    expect(diff.events.selectedAdded).toEqual(['e2']);
    expect(diff.events.selectedRemoved).toEqual(['e1']);
    expect(diff.events.highlightedAdded).toEqual(['h2']);
    expect(diff.aois).toEqual({ added: ['aoi-2'], removed: ['aoi-1'] });
    expect(diff.map.changed).toBe(true);
    expect(diff.elapsedMs).toBe(5_000);
  });

  it('still reports count deltas when stable identities were not captured', () => {
    const before = snapshot('before', NOW - 1_000, { entities: { fires: { count: 3 } } });
    const after = snapshot('after', NOW, { entities: { fires: { count: 5 } } });
    const diff = compareHistorySnapshots(before, after);
    expect(diff.entities.fires).toEqual({
      beforeCount: 3,
      afterCount: 5,
      delta: 2,
      identityComparable: false,
      addedIds: [],
      removedIds: [],
    });
  });
});
