import { NextRequest, NextResponse } from 'next/server';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { cachedSource } from '@/lib/sourceCache';
import { httpJson } from '@/lib/httpJson';
import { normalizeFloodResponse, parseCoordinateQuery, type FloodPointForecast } from '@/lib/sources/open-meteo';

const source = getSourceRegistryEntry('open-meteo-flood')!;
const cache = new Map<string, () => Promise<FloodPointForecast[]>>();
const attempts = new Map<string, { attempt: number; success?: number; latency?: number; error?: string }>();

function cacheKey(lat: number, lng: number) {
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function loader(lat: number, lng: number) {
  const key = cacheKey(lat, lng);
  const existing = cache.get(key);
  if (existing) return existing;
  const load = cachedSource<FloodPointForecast>(`flood:${key}`, async () => {
    const started = Date.now();
    attempts.set(key, { attempt: started });
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      daily: 'river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max,river_discharge_p75',
      forecast_days: '30',
      timezone: 'GMT',
      cell_selection: 'nearest',
    });
    try {
      const json = await httpJson<unknown>(`https://flood-api.open-meteo.com/v1/flood?${params}`, {
        timeoutMs: 10_000,
        headers: { 'User-Agent': 'LiveWorldMap/1.0 (on-demand flood point forecast)' },
      });
      const forecast = normalizeFloodResponse(json);
      attempts.set(key, { attempt: started, success: Date.now(), latency: Date.now() - started });
      return [forecast];
    } catch (error) {
      attempts.set(key, { attempt: started, latency: Date.now() - started, error: error instanceof Error ? error.message : 'Unknown upstream error' });
      throw error;
    }
  }, source.cacheTtlMs);
  cache.set(key, load);
  if (cache.size > 250) cache.delete(cache.keys().next().value!);
  return load;
}

export async function GET(request: NextRequest) {
  const point = parseCoordinateQuery(request.nextUrl.searchParams);
  if (!point) return NextResponse.json({ error: 'lat and lng must be valid WGS84 coordinates' }, { status: 400 });
  const key = cacheKey(point.lat, point.lng);
  const [forecast] = await loader(point.lat, point.lng)();
  const meta = attempts.get(key);
  const health = evaluateFeedHealth({
    id: source.id,
    name: source.name,
    url: source.url,
    trust: source.confidenceClass,
    lastAttemptAt: meta?.attempt,
    lastSuccessAt: meta?.success,
    attemptSucceeded: meta ? !meta.error : undefined,
    error: meta?.error,
    latencyMs: meta?.latency,
    itemCount: forecast?.daily.length ?? 0,
    expectedIntervalMs: source.refreshIntervalMs ?? undefined,
  });
  return NextResponse.json({ forecast: forecast ?? null, source, health, advisory: 'GloFAS model guidance, not an official local flood warning or gauge measurement. WSV Pegelonline remains primary for German federal-waterway gauges.' }, {
    headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1800' },
  });
}
