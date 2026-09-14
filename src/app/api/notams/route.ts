import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_NOTAM_LOCATIONS, normalizeOperationalNotams } from '@/lib/signal-intel';

export const dynamic = 'force-dynamic';

const API_URL = 'https://applications.icao.int/dataservices/api/notams-realtime-list';
const SOURCE_URL = 'https://applications.icao.int/dataservices/default.aspx';
const CACHE_TTL = 5 * 60 * 1000;
let cached: { notams: ReturnType<typeof normalizeOperationalNotams>; fetchedAt: number; locations: string[] } | null = null;

function configuredLocations(): string[] {
  const raw = process.env.OSIRIS_NOTAM_LOCATIONS?.split(',') ?? DEFAULT_NOTAM_LOCATIONS;
  return [...new Set(raw.map(value => value.trim().toUpperCase()).filter(value => /^[A-Z0-9]{4}$/.test(value)))].slice(0, 10);
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.ICAO_API_KEY?.trim();
  const locations = configuredLocations();
  if (request.nextUrl.searchParams.get('probe') === '1') {
    return NextResponse.json({ configured: Boolean(apiKey), locations, source_url: SOURCE_URL });
  }
  if (!apiKey) {
    return NextResponse.json({ configured: false, notams: [], total: 0, locations, source: 'ICAO API Data Service', source_url: SOURCE_URL, error: 'ICAO_API_KEY is not configured', timestamp: new Date().toISOString() });
  }
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL && cached.locations.join(',') === locations.join(',')) {
    return NextResponse.json({ configured: true, notams: cached.notams, total: cached.notams.length, locations, source: 'ICAO API Data Service', source_url: SOURCE_URL, cached: true, timestamp: new Date(cached.fetchedAt).toISOString() });
  }

  const query = new URLSearchParams({ api_key: apiKey, format: 'json', criticality: '', locations: locations.join(',') });
  try {
    const response = await fetch(`${API_URL}?${query}`, { cache: 'no-store', signal: AbortSignal.timeout(20_000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`ICAO NOTAM API HTTP ${response.status}`);
    const notams = normalizeOperationalNotams(await response.json());
    cached = { notams, fetchedAt: Date.now(), locations };
    return NextResponse.json({
      configured: true,
      notams,
      total: notams.length,
      locations,
      source: 'ICAO API Data Service',
      source_url: SOURCE_URL,
      caveat: 'Operational filter for closures, restrictions, exercises and launch/firing activity. Always verify against an official flight briefing.',
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'private, max-age=0, s-maxage=300, stale-while-revalidate=300' } });
  } catch (error) {
    if (cached) {
      return NextResponse.json({ configured: true, notams: cached.notams, total: cached.notams.length, locations, source: 'ICAO API Data Service', source_url: SOURCE_URL, stale: true, error: error instanceof Error ? error.message : 'ICAO NOTAM API unavailable', timestamp: new Date(cached.fetchedAt).toISOString() });
    }
    return NextResponse.json({ configured: true, notams: [], total: 0, locations, source: 'ICAO API Data Service', source_url: SOURCE_URL, error: error instanceof Error ? error.message : 'ICAO NOTAM API unavailable', timestamp: new Date().toISOString() }, { status: 502 });
  }
}
