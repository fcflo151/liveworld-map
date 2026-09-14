import { NextResponse } from 'next/server';

/**
 * OSIRIS — Rail Intel: Live Station Departures
 * Real-time station departure board with delay tracking, platform changes, and cancellations.
 *
 * Important: this route never fabricates departures. If the upstream is unavailable,
 * it serves the last known real snapshot when possible and otherwise reports offline.
 */

export interface LiveDeparture {
  id: string;
  line: string;
  category: 'ICE' | 'IC' | 'EC' | 'TGV' | 'RE' | 'RB' | 'S' | 'REGIONAL' | 'OTHER';
  direction: string;
  plannedTime: string;
  actualTime: string;
  delayMinutes: number;
  platform: string;
  cancelled: boolean;
  operator: string;
  remarks?: string[];
  stops?: string[];
}

interface DepartureCacheEntry {
  data: LiveDeparture[];
  timestamp: number;
}

const departuresCache = new Map<string, DepartureCacheEntry>();
const CACHE_TTL_MS = 25_000;
const STALE_CACHE_MAX_AGE_MS = 10 * 60_000;
const UPSTREAM = 'transport.opendata.ch';

function categorizeLine(name: string, category?: string): LiveDeparture['category'] {
  const upper = (name + ' ' + (category || '')).toUpperCase();
  if (upper.includes('ICE')) return 'ICE';
  if (upper.includes('TGV') || upper.includes('AVE') || upper.includes('EUROSTAR')) return 'TGV';
  if (upper.includes('IC ') || upper.startsWith('IC')) return 'IC';
  if (upper.includes('EC ') || upper.startsWith('EC')) return 'EC';
  if (upper.includes('RE') || upper.includes('IRE')) return 'RE';
  if (upper.includes('RB')) return 'RB';
  if (upper.includes('S ') || upper.startsWith('S') || upper.includes('S-BAHN')) return 'S';
  return 'REGIONAL';
}

function responseHeaders() {
  return {
    'Cache-Control': 'public, max-age=15, stale-while-revalidate=30',
  };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const station = searchParams.get('station') || searchParams.get('name') || 'Berlin Hbf';
  const queryKey = station.toLowerCase().trim();
  const cached = departuresCache.get(queryKey);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({
      station,
      departures: cached.data,
      total: cached.data.length,
      status: 'live',
      source: UPSTREAM,
      cached: true,
      stale: false,
      lastSuccessfulUpdate: new Date(cached.timestamp).toISOString(),
      timestamp: new Date().toISOString(),
    }, { headers: responseHeaders() });
  }

  let upstreamError: string | null = null;

  try {
    const res = await fetch(
      `https://transport.opendata.ch/v1/stationboard?station=${encodeURIComponent(station)}&limit=15`,
      { signal: AbortSignal.timeout(4000), cache: 'no-store' },
    );

    if (!res.ok) {
      upstreamError = `Upstream returned HTTP ${res.status}`;
    } else {
      const data = await res.json();
      const stationboard = Array.isArray(data?.stationboard) ? data.stationboard : [];

      if (stationboard.length === 0) {
        upstreamError = 'Upstream returned no departures for this station';
      } else {
        const departures: LiveDeparture[] = stationboard.map((item: any, i: number) => {
          const stop = item.stop || {};
          const planned = stop.departure ? new Date(stop.departure) : new Date();
          const delayMin = typeof stop.delay === 'number' ? stop.delay : 0;
          const actual = new Date(planned.getTime() + delayMin * 60000);

          const plannedFmt = `${String(planned.getHours()).padStart(2, '0')}:${String(planned.getMinutes()).padStart(2, '0')}`;
          const actualFmt = `${String(actual.getHours()).padStart(2, '0')}:${String(actual.getMinutes()).padStart(2, '0')}`;
          const lineName = item.category && item.number
            ? `${item.category} ${item.number}`
            : item.name || `Line ${i + 1}`;
          const stops = Array.isArray(item.passList)
            ? item.passList.slice(1, 4).map((p: any) => p.station?.name).filter(Boolean)
            : [];

          return {
            id: `sb-${i}-${item.name || i}`,
            line: lineName,
            category: categorizeLine(lineName, item.category),
            direction: item.to || 'Unbekannt',
            plannedTime: plannedFmt,
            actualTime: actualFmt,
            delayMinutes: delayMin,
            platform: stop.platform || stop.prognosis?.platform || '—',
            cancelled: stop.prognosis?.status === 'cancelled',
            operator: item.operator || 'National Railway',
            stops,
          };
        });

        departuresCache.set(queryKey, { data: departures, timestamp: now });

        return NextResponse.json({
          station,
          departures,
          total: departures.length,
          status: 'live',
          source: UPSTREAM,
          cached: false,
          stale: false,
          lastSuccessfulUpdate: new Date(now).toISOString(),
          timestamp: new Date().toISOString(),
        }, { headers: responseHeaders() });
      }
    }
  } catch (error) {
    upstreamError = error instanceof Error ? error.message : 'Upstream request failed';
  }

  if (cached && now - cached.timestamp <= STALE_CACHE_MAX_AGE_MS) {
    return NextResponse.json({
      station,
      departures: cached.data,
      total: cached.data.length,
      status: 'degraded',
      source: UPSTREAM,
      cached: true,
      stale: true,
      lastSuccessfulUpdate: new Date(cached.timestamp).toISOString(),
      error: upstreamError,
      timestamp: new Date().toISOString(),
    }, { headers: responseHeaders() });
  }

  return NextResponse.json({
    station,
    departures: [],
    total: 0,
    status: 'offline',
    source: UPSTREAM,
    cached: false,
    stale: false,
    lastSuccessfulUpdate: cached ? new Date(cached.timestamp).toISOString() : null,
    error: upstreamError || 'No live departure data available',
    timestamp: new Date().toISOString(),
  }, {
    status: 503,
    headers: {
      'Cache-Control': 'no-store',
    },
  });
}
