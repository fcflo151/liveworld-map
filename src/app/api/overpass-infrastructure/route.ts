import { NextRequest, NextResponse } from 'next/server';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { cachedSource } from '@/lib/sourceCache';
import { httpJson } from '@/lib/httpJson';
import { buildInfrastructureQuery, normalizeOverpass, parseViewport, OVERPASS_MIN_ZOOM, type InfrastructureFeature } from '@/lib/sources/overpass';

const source = getSourceRegistryEntry('osm-overpass')!;
const loaders = new Map<string, () => Promise<InfrastructureFeature[]>>();
const attempts = new Map<string, { attempt: number; success?: number; latency?: number; error?: string }>();

function roundedKey(south: number, west: number, north: number, east: number) {
  return [south, west, north, east].map(value => value.toFixed(2)).join(',');
}

function getLoader(key: string, query: string) {
  const existing = loaders.get(key);
  if (existing) return existing;
  const load = cachedSource<InfrastructureFeature>(`overpass:${key}`, async () => {
    const started = Date.now();
    attempts.set(key, { attempt: started });
    try {
      const data = await httpJson<unknown>(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`, {
        timeoutMs: 15_000,
        headers: { 'User-Agent': 'LiveWorldMap/1.0 (bounded infrastructure viewport query)' },
      });
      const features = normalizeOverpass(data);
      attempts.set(key, { attempt: started, success: Date.now(), latency: Date.now() - started });
      return features;
    } catch (error) {
      attempts.set(key, { attempt: started, latency: Date.now() - started, error: error instanceof Error ? error.message : 'Unknown upstream error' });
      throw error;
    }
  }, source.cacheTtlMs);
  loaders.set(key, load);
  if (loaders.size > 200) loaders.delete(loaders.keys().next().value!);
  return load;
}

export async function GET(request: NextRequest) {
  const viewport = parseViewport(request.nextUrl.searchParams);
  if (!viewport) {
    return NextResponse.json({
      error: `Valid bounds and zoom >= ${OVERPASS_MIN_ZOOM} are required; viewports are intentionally size-limited to protect public Overpass capacity.`,
    }, { status: 400 });
  }

  const { south, west, north, east } = viewport.bounds;
  const key = roundedKey(south, west, north, east);
  const query = buildInfrastructureQuery(viewport.bounds);
  const features = await getLoader(key, query)();
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
    itemCount: features.length,
    expectedIntervalMs: 15 * 60_000,
  });

  return NextResponse.json({
    type: 'FeatureCollection',
    features,
    total: features.length,
    source,
    health,
    queryPolicy: { minZoom: OVERPASS_MIN_ZOOM, polling: false, viewportOnly: true, cached: true },
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
