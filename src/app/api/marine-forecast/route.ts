import { NextRequest, NextResponse } from 'next/server';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { cachedSource } from '@/lib/sourceCache';
import { httpJson } from '@/lib/httpJson';
import { normalizeMarineResponse, parseCoordinateQuery, type MarinePointForecast } from '@/lib/sources/open-meteo';

const source = getSourceRegistryEntry('open-meteo-marine')!;
const cache = new Map<string, () => Promise<MarinePointForecast[]>>();
const attempts = new Map<string, { attempt: number; success?: number; latency?: number; error?: string }>();

function cacheKey(lat: number, lng: number) {
  // About 1 km precision prevents tiny cursor movement from exploding cache keys.
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function loader(lat: number, lng: number) {
  const key = cacheKey(lat, lng);
  const existing = cache.get(key);
  if (existing) return existing;
  const load = cachedSource<MarinePointForecast>(`marine:${key}`, async () => {
    const started = Date.now();
    attempts.set(key, { attempt: started });
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      hourly: 'wave_height,wave_direction,wave_period,sea_surface_temperature,ocean_current_velocity,ocean_current_direction,sea_level_height_msl',
      forecast_days: '3',
      timezone: 'GMT',
      cell_selection: 'sea',
    });
    try {
      const json = await httpJson<unknown>(`https://marine-api.open-meteo.com/v1/marine?${params}`, {
        timeoutMs: 10_000,
        headers: { 'User-Agent': 'LiveWorldMap/1.0 (on-demand marine point forecast)' },
      });
      const forecast = normalizeMarineResponse(json);
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
    itemCount: forecast?.hourly.length ?? 0,
    expectedIntervalMs: source.refreshIntervalMs ?? undefined,
  });

  return NextResponse.json({
    forecast: forecast ?? null,
    source,
    health,
    advisory: 'Model guidance only. Sea level/tide/current accuracy is limited near coasts and must not be used for navigation.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
