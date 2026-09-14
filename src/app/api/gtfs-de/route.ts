import { NextResponse } from 'next/server';
import { cachedSource } from '@/lib/sourceCache';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { publicSourceFetch } from '@/lib/stealthFetch';
import { parseGtfsRealtime, selectSituationalGtfs, type GtfsRealtimeFeed } from '@/lib/sources/gtfs-rt';

const UPSTREAM = 'https://realtime.gtfs.de/realtime-free.pb';
const source = getSourceRegistryEntry('gtfs-de')!;
let lastAttemptAt: number | undefined;
let lastSuccessAt: number | undefined;
let lastLatencyMs: number | undefined;
let lastError: string | undefined;

const loadFeed = cachedSource<GtfsRealtimeFeed>('gtfs-de-realtime', async () => {
  const started = Date.now();
  lastAttemptAt = started;
  try {
    const response = await publicSourceFetch(UPSTREAM, { headers: { Accept: 'application/x-protobuf' } }, 15_000);
    if (!response.ok) throw new Error(`GTFS.de HTTP ${response.status}`);
    const feed = selectSituationalGtfs(parseGtfsRealtime(await response.arrayBuffer()));
    lastSuccessAt = Date.now();
    lastLatencyMs = lastSuccessAt - started;
    lastError = undefined;
    return [feed];
  } catch (error) {
    lastLatencyMs = Date.now() - started;
    lastError = error instanceof Error ? error.message : 'Unknown upstream error';
    throw error;
  }
}, source.cacheTtlMs);

export async function GET() {
  const [feed] = await loadFeed();
  const now = Date.now();
  const alerts = feed?.alerts ?? [];
  const tripUpdates = feed?.tripUpdates ?? [];
  const health = evaluateFeedHealth({
    id: source.id,
    name: source.name,
    url: UPSTREAM,
    trust: source.confidenceClass,
    lastAttemptAt,
    lastSuccessAt,
    attemptSucceeded: lastAttemptAt !== undefined ? !lastError : undefined,
    error: lastError,
    latencyMs: lastLatencyMs,
    itemCount: alerts.length + tripUpdates.length,
    expectedIntervalMs: source.refreshIntervalMs ?? undefined,
  }, now);

  return NextResponse.json({
    alerts,
    tripUpdates,
    feedTimestamp: feed?.timestamp ?? null,
    total: alerts.length + tripUpdates.length,
    source,
    health,
    scope: 'ServiceAlerts plus delayed TripUpdates only; no VehiclePositions.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=10, stale-while-revalidate=30' } });
}
