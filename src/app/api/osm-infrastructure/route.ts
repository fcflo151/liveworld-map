import { NextRequest, NextResponse } from 'next/server';
import {
  buildOverpassInfrastructureQuery,
  normalizeOverpassInfrastructure,
  parseOsmBBox,
  parseOsmCategories,
} from '@/lib/osm-infrastructure';

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const MIN_REQUEST_GAP_MS = 3_000;
const BACKOFF_MS = 30_000;

let queue: Promise<void> = Promise.resolve();
let nextRequestAt = 0;

class OverpassHttpError extends Error {
  constructor(readonly status: number) {
    super(`Overpass returned HTTP ${status}`);
  }
}

async function wait(ms: number) {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function serializedOverpassFetch(query: string): Promise<Response> {
  let release!: () => void;
  const previous = queue;
  queue = new Promise<void>(resolve => { release = resolve; });
  await previous;

  try {
    await wait(nextRequestAt - Date.now());
    const response = await fetch(OVERPASS_ENDPOINT, {
      method: 'POST',
      body: new URLSearchParams({ data: query }),
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        'User-Agent': 'LiveWorldMap/1.0 (+https://github.com/fcflo151/liveworld-map)',
        Referer: 'https://github.com/fcflo151/liveworld-map',
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    });

    nextRequestAt = Date.now() + (response.status === 429 || response.status === 406 ? BACKOFF_MS : MIN_REQUEST_GAP_MS);
    return response;
  } finally {
    release();
  }
}

/**
 * Small-area, public-civic OpenStreetMap context via Overpass.
 *
 * Deliberately limited to an allowlist of hospitals, fire stations and shelters.
 * The route rejects city-scale-or-larger requests, serializes upstream calls,
 * identifies this application, and emits shared-cache headers so map panning
 * does not turn into an abusive stream of Overpass requests.
 */
export async function GET(request: NextRequest) {
  const bbox = parseOsmBBox(request.nextUrl.searchParams.get('bbox'));
  if (!bbox) {
    return NextResponse.json({
      features: [],
      error: 'Provide bbox=south,west,north,east; maximum span is 1.5° latitude × 2° longitude.',
    }, { status: 400 });
  }

  const categories = parseOsmCategories(request.nextUrl.searchParams.get('categories'));
  if (categories.length === 0) {
    return NextResponse.json({
      features: [],
      error: 'No supported category requested. Supported: hospital, fire_station, shelter.',
    }, { status: 400 });
  }

  try {
    const query = buildOverpassInfrastructureQuery(bbox, categories);
    const upstream = await serializedOverpassFetch(query);
    if (!upstream.ok) throw new OverpassHttpError(upstream.status);

    const payload = await upstream.json();
    const features = normalizeOverpassInfrastructure(payload);
    const response = NextResponse.json({
      features,
      total: features.length,
      timestamp: new Date().toISOString(),
      source: {
        id: 'openstreetmap-overpass',
        name: 'OpenStreetMap via Overpass API',
        url: 'https://www.openstreetmap.org/',
        attribution: '© OpenStreetMap contributors, ODbL',
        trust: 'community',
      },
      query: { bbox, categories },
    });
    response.headers.set('Cache-Control', 'public, s-maxage=900, stale-while-revalidate=3600');
    return response;
  } catch (error) {
    const status = error instanceof OverpassHttpError ? error.status : null;
    console.warn('[LiveWorldMap] Overpass infrastructure fetch failed:', error instanceof Error ? error.message : error);
    const response = NextResponse.json({
      features: [],
      total: 0,
      error: status ? `Overpass upstream returned HTTP ${status}` : 'Failed to fetch public infrastructure data',
      source: {
        id: 'openstreetmap-overpass',
        name: 'OpenStreetMap via Overpass API',
        attribution: '© OpenStreetMap contributors, ODbL',
      },
    }, { status: 502 });
    if (status === 429 || status === 406) response.headers.set('Retry-After', '30');
    return response;
  }
}
