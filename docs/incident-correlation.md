# Incident correlation foundation

`src/lib/incident-correlation.ts` provides a pure, deterministic foundation for grouping independent observations into incident dossiers. It has no React, network, storage, or clock dependency and does not mutate caller-owned objects.

## Design goals

The engine deliberately treats correlation as **evidence aggregation**, not text matching. Titles and free text are preserved for display but never contribute to a link score. Two observations can only be linked when they pass a hard time gate and also share spatial evidence: either coordinates within the configured distance or at least one AOI id.

Supported observation domains are:

- AOI Watch Events
- civil warnings
- earthquakes
- weather
- fires
- aviation
- maritime
- infrastructure
- news
- other normalized observations

Evaluated `FeedHealth` records are optional auxiliary input. They do not create incidents by themselves; they reduce confidence and create explicit data-gap messages for stale, degraded, or offline sources.

## API

The primary entry point is:

```ts
correlateIncidents(
  input: IncidentCorrelationInput,
  options?: IncidentCorrelationOptions,
): IncidentCorrelationResult
```

`input.observations` accepts the canonical `ObservationInput` shape. Existing `WatchEvent` objects from `src/lib/watch.ts` may be passed through `input.watchEvents`; they are normalized as `aoi-watch` observations and retain their AOI id, layer, kind, source id, and timestamp.

For feed-specific adapters, map raw source data into `ObservationInput` before calling the engine. Keep source-provided identifiers in `id`, the feed identifier in `sourceId`, the source timestamp in `observedAt`, and populate coordinates/AOI membership whenever available.

Example:

```ts
const result = correlateIncidents({
  observations: [
    {
      id: warning.id,
      sourceId: 'dwd-warnings',
      observedAt: warning.sentAt,
      domain: 'civil-warning',
      category: warning.kind,
      title: warning.title,
      lat: warning.lat,
      lng: warning.lng,
      aoiIds: warning.aoiIds,
      region: warning.region,
    },
    {
      id: quake.id,
      sourceId: 'usgs-earthquakes',
      observedAt: quake.time,
      domain: 'earthquake',
      category: 'earthquake',
      title: quake.place,
      lat: quake.lat,
      lng: quake.lng,
    },
  ],
  watchEvents,
  feedHealth,
});
```

## Normalization and deduplication

`normalizeObservation()` performs deterministic normalization:

- timestamps become epoch milliseconds plus ISO strings;
- categories are trimmed and lower-cased;
- AOI ids are trimmed, deduplicated, and sorted;
- invalid/out-of-range coordinates become `null`;
- scalar `attributes` keys are sorted and non-finite numbers are dropped;
- source id and source observation id are preserved separately;
- the canonical observation id is `sourceId:sourceObservationId`.

Deduplication uses that canonical id. If a source emits multiple copies of the same observation, the newest timestamp wins. Equal-timestamp conflicts are resolved by canonical JSON ordering, never by input order.

## Correlation rules

Default policy:

| Setting | Default |
| --- | ---: |
| Time window | 30 minutes |
| Distance limit | 75 km |
| Minimum link confidence | 0.50 |
| Maximum retained observations | 2,000 |
| Maximum pair evaluations | 1,000,000 |
| Singleton incidents | included |

A candidate pair must first pass both hard gates:

1. the time difference is at most `timeWindowMs`;
2. the pair either shares an AOI or has two valid coordinate pairs no farther apart than `maxDistanceKm`.

Only after those gates pass is a score calculated. The score uses:

- temporal closeness;
- shared AOI or geographic closeness;
- same category;
- same broad domain;
- independent source ids;
- feed-health penalties for degraded, stale, or offline sources.

Category/domain agreement can strengthen a link, but it cannot create one without time plus spatial/AOI evidence. Similar titles, descriptions, or other free text are never inspected.

Every accepted edge is retained as an `IncidentConnection` containing both observation ids, the numeric confidence, and human-readable reasons. This makes each automatic connection auditable in the dossier UI.

## Clustering

Accepted pair links are joined with a deterministic disjoint-set clustering pass. Transitive links are allowed: if A links to B and B links to C, all three belong to the same incident even when A and C do not directly qualify. The dossier still shows only the actual qualifying edges, so transitive membership is visible rather than silently presented as a direct A↔C claim.

Each incident receives:

- a stable hash-based incident id derived only from its sorted observation ids and timestamps;
- start/end timestamps;
- a deterministic title;
- affected region/AOIs and centroid where available;
- sorted domains;
- chronological observations;
- all qualifying connection reasons;
- source summaries and health states;
- confidence level and explanation;
- uncertainties and data gaps.

## Confidence

Connection confidence is a deterministic 0..1 score. Incident confidence is based on the mean of its qualifying connection scores, with a small bonus for multiple source ids and bounded penalties for recorded data-quality gaps.

Singleton incidents intentionally receive low confidence and the explanation that no cross-observation correlation is being claimed.

Feed-health state affects confidence as follows:

- `live`: no penalty;
- `degraded`: small penalty plus data-gap message;
- `stale`: larger penalty plus data-gap message;
- `offline`: strongest penalty plus data-gap message;
- missing health record: small uncertainty penalty and an explicit unknown-health gap.

These penalties do not fabricate replacement data and do not silently convert missing observations into negative evidence.

## Determinism and byte stability

For identical logical inputs, output ordering and values are reproducible:

- observations are canonicalized and sorted;
- duplicate resolution is input-order independent;
- feed-health input order is canonicalized;
- connection endpoints and connection arrays are sorted;
- incident observations are chronological;
- AOIs, domains, source ids, uncertainties, and gaps are sorted deterministically;
- incident ids use deterministic in-process hashes with no randomness or clock access.

The engine never calls `Date.now()`, reads browser state, performs network requests, or mutates input arrays/objects.

## Limits

The engine normalizes/deduplicates first, then retains the newest `maxObservations` observations using deterministic tie-breakers. The configured cap is itself bounded at 10,000 observations.

Pair checks use chronological ordering and stop scanning a row once the time window is exceeded. A separate `maxPairEvaluations` guard (bounded at 5,000,000) prevents pathological dense batches from creating unbounded quadratic work. When that guard is reached, `stats.pairEvaluationLimitReached` is set to `true` so callers can surface incomplete correlation coverage rather than implying full analysis.

## Incident dossier component

`src/components/IncidentDossier.tsx` is standalone and receives a single `Incident`. It renders:

- title and time range;
- confidence score/level;
- region, AOI ids, and affected domains;
- chronological observations;
- every accepted correlation edge with its reasons;
- source ids, URLs, trust classes, health states, and data age;
- uncertainties and data gaps.

The component performs no correlation itself and has no side effects. This keeps policy in the pure engine and presentation in React.

## Tests

`src/lib/incident-correlation.test.ts` covers:

- spatially and temporally matching events;
- spatial separation;
- events outside the time window;
- missing coordinates with and without shared AOI fallback;
- stale-source confidence effects;
- deduplication;
- stable incident ids;
- byte-stable ordering under reversed inputs;
- immutable input objects;
- observation and pair-evaluation limits;
- the rule that similar text alone never creates a link.
