# Feed health and historical snapshots

This document describes the reusable building blocks in:

- `src/lib/feed-health.ts`
- `src/components/FeedHealthPanel.tsx`
- `src/lib/history-snapshots.ts`
- `src/components/HistoryTimeline.tsx`

They are intentionally not wired into `page.tsx`, `LiveWorldMap.tsx`, existing API routes, or `LayerPanel.tsx`. The modules provide typed integration seams so the dashboard can adopt them without coupling status policy or replay persistence to a specific feed.

## 1. Feed health

### Data contract

Each source is normalized into `FeedHealthInput`:

| Field | Meaning |
| --- | --- |
| `id` | Stable source identifier. |
| `name` | Operator-facing display name. |
| `url` | Canonical source/provider URL. |
| `lastAttemptAt` | Most recent refresh attempt. Number, ISO string, or `Date`. |
| `lastSuccessAt` | Most recent usable update. |
| `attemptSucceeded` | Optional result of the latest known attempt. |
| `error` | Optional human-readable failure reason. |
| `latencyMs` | Optional source/request latency. |
| `itemCount` | Number of delivered entries. |
| `coverage` | Optional coverage ratio from `0` to `1`. |
| `trust` | `official`, `primary`, `curated`, or `aggregated`. |
| `expectedIntervalMs` | Expected refresh cadence used to derive age thresholds. |
| `thresholds` | Optional per-source overrides. |

The evaluated `FeedHealth` adds normalized timestamps, `ageMs`, the deterministic status, resolved thresholds, and a plain-language `explanation`.

### Deterministic status policy

`evaluateFeedHealth(input, now)` evaluates status in this order:

1. **offline** — no successful update has ever been recorded, or the last success reached `offlineAfterMs`.
2. **stale** — usable data exists but its age reached `staleAfterMs`.
3. **degraded** — data is still fresh, but the latest refresh failed, latency is above the configured ceiling, coverage is below its configured minimum, or the item count is below its configured minimum.
4. **live** — data is fresh and no configured degradation signal is active.

Age has precedence over quality signals so an old feed never appears merely `degraded`. By default, stale begins after **3 expected refresh intervals** and offline after **10 intervals**. If no cadence is supplied, the base interval is one minute. Absolute thresholds can be overridden per source.

Examples for current dashboard polling cadences:

```ts
const flights = evaluateFeedHealth({
  id: 'flights',
  name: 'Flight tracking',
  url: 'https://opensky-network.org/',
  trust: 'aggregated',
  lastAttemptAt: flightAttemptAt,
  lastSuccessAt: flightPayload?.timestamp,
  attemptSucceeded: flightRequestOk,
  itemCount: flightPayload?.total ?? 0,
  expectedIntervalMs: 5 * 60_000,
}, now);

const maritime = evaluateFeedHealth({
  id: 'maritime',
  name: 'Maritime tracking',
  url: 'https://aisstream.io/',
  trust: 'primary',
  lastAttemptAt: maritimeAttemptAt,
  lastSuccessAt: maritimePayload?.timestamp,
  attemptSucceeded: maritimeRequestOk,
  itemCount: maritimePayload?.total_ships ?? 0,
  expectedIntervalMs: 10_000,
}, now);
```

The current flight response already exposes a response timestamp, aggregate count, source string, and per-provider fields including OpenSky snapshot age. The maritime response exposes a timestamp and total counts. Other routes expose different shapes, so the health layer intentionally normalizes metadata at the client boundary instead of requiring every route to change at once.

### Trust classes

- **official** — responsible authority/operator publishes the data, for example USGS or an official civil-protection authority.
- **primary** — direct first-party telemetry/provider, for example a direct AIS or receiver feed.
- **curated** — selected/maintained catalogue whose value comes from curation.
- **aggregated** — combined or transformed result built from multiple upstream providers.

Trust is provenance, not a health score. An `official` source can still be stale or offline; an `aggregated` source can be live.

### Panel integration

`FeedHealthPanel` accepts already-evaluated `FeedHealth[]`. It groups rows by status and provides an accessible status filter. Each source expands with timestamps, age, latency, count, coverage, trust class, source URL, and the exact status explanation.

```tsx
<FeedHealthPanel feeds={evaluatedFeeds} />
```

Keeping evaluation outside the component means all feeds can be calculated against one `now` value and unit-tested without React.

## 2. Historical snapshots and replay

### Versioned snapshot format

`HistorySnapshotV1` records:

```ts
{
  version: 1,
  id: string,
  capturedAt: number,
  map: {
    latitude: number,
    longitude: number,
    zoom: number,
    bearing?: number,
    pitch?: number
  },
  activeLayers: string[],
  entities: {
    [domain: string]: {
      count: number,
      ids?: string[]
    }
  },
  events: {
    selected: string[],
    highlighted: string[]
  },
  aoiRefs?: string[]
}
```

The localStorage envelope is versioned independently as `{ version: 1, snapshots: [...] }`. This lets a future migration distinguish a store-format change from an individual snapshot-format change.

### Stable entity identity

Counts are always useful, but exact arrivals/departures require stable IDs in both snapshots. Recommended identities for existing data are:

- aircraft: `icao24`
- vessels: MMSI
- earthquakes: upstream event `id`
- alerts/events: the upstream stable ID when available
- AOI/watch entities: the same stable IDs already used by the AOI tripwire logic

Do **not** use coordinates as identity. A moving aircraft or vessel would otherwise appear to disappear and reappear on every refresh.

If IDs are absent for a domain, `compareHistorySnapshots()` still returns `beforeCount`, `afterCount`, and `delta`, but sets `identityComparable: false` and leaves `addedIds`/`removedIds` empty.

### Creating and saving

```ts
const current = createHistorySnapshot({
  map: { latitude, longitude, zoom, bearing, pitch },
  activeLayers: activeLayerKeys(activeLayers),
  entities: {
    flights: {
      count: allFlights.length,
      ids: allFlights.map(f => f.icao24).filter(Boolean),
    },
    earthquakes: {
      count: data.earthquakes?.length ?? 0,
      ids: (data.earthquakes ?? []).map(eq => eq.id).filter(Boolean),
    },
  },
  events: {
    selected: selectedEventIds,
    highlighted: highlightedEventIds,
  },
  aoiRefs: activeAoiIds,
});

saveHistorySnapshot(current, {
  maxSnapshots: 50,
  retentionMs: 7 * 24 * 60 * 60 * 1000,
});
```

`saveHistorySnapshot` defaults to browser `localStorage`; tests and non-browser callers can inject a `StorageLike` object. Storage access, quota failures, and blocked/private-mode storage are contained and returned as typed errors instead of escaping as exceptions.

### Loading and cleanup

```ts
const result = loadHistorySnapshots({
  maxSnapshots: 50,
  retentionMs: 7 * 24 * 60 * 60 * 1000,
});
```

Loading performs all of the following before returning data:

- validates the store version;
- validates every snapshot and its nested map/entity/event fields;
- keeps valid snapshots when only some records are malformed;
- removes expired entries;
- removes duplicate IDs, retaining the newest copy;
- enforces the maximum count newest-first;
- rewrites a partially dirty store with only clean entries;
- removes the storage key when the entire envelope is corrupt.

The defaults are **50 snapshots** and **7 days** of retention. Both are configurable.

### Comparing snapshots

```ts
const comparison = compareHistorySnapshots(older, newer);
```

The result contains:

- elapsed time;
- map deltas and whether the view changed;
- activated/deactivated layers;
- per-domain count deltas;
- exact added and removed entity IDs where comparable;
- selected/highlighted event changes;
- added/removed AOI references.

### Timeline / replay UI

`HistoryTimeline` receives snapshots and delegates actual replay to its parent:

```tsx
<HistoryTimeline
  snapshots={snapshots}
  activeSnapshotId={replayedId}
  onReplay={(snapshot) => {
    // caller applies snapshot.map, snapshot.activeLayers and event/AOI state
  }}
  onDelete={(snapshot) => {
    deleteHistorySnapshot(snapshot.id);
  }}
/>
```

The component sorts newest-first, offers two-snapshot comparison, shows a compact comparison summary, and supports keyboard traversal of replay buttons with Arrow Up/Down, Home, and End. Native buttons and `aria-*` state are used throughout.

## 3. Integration boundaries with the existing dashboard

The new files deliberately do not modify existing application wiring. A future integration should do the following in the dashboard layer:

1. Track request attempt/success timestamps beside the existing `fetchEndpoint` calls and adapt each route's response into `FeedHealthInput`.
2. Evaluate all health records against one clock tick and pass them to `FeedHealthPanel`.
3. Build a `HistorySnapshotInput` from the current full map camera state, active layer keys, domain counts/IDs, selected events, and AOIs.
4. Load/save snapshots through the history module and render `HistoryTimeline` wherever replay controls belong.
5. On replay, apply the captured map camera, layer state, selections/highlights, and AOI references through existing dashboard setters or future dedicated replay hooks.

One integration detail to preserve: a full replay snapshot requires both latitude **and longitude** plus zoom. Any caller that currently exposes only partial view state must capture the full map center before creating the snapshot rather than inventing the missing coordinate.

## 4. Testing

The two library test files cover deterministic status thresholds, precedence and explanations, timestamp normalization, version validation, malformed localStorage records, whole-store corruption, expiry, maximum-count pruning, duplicate IDs, blocked/quota storage failures, save/load/delete behavior, layer/event/AOI diffs, count deltas, and identity-level arrivals/departures.

Run with the repository's existing command:

```bash
npm test
```

No additional npm dependency is required.
