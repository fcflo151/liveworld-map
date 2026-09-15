import { NextResponse } from 'next/server';
import { propagateTLE } from '@/lib/orbit';

export const maxDuration = 15;

const ISS_NORAD_ID = '25544';
const ISS_TLE_URL = `https://celestrak.org/NORAD/elements/gp.php?CATNR=${ISS_NORAD_ID}&FORMAT=tle`;
const TLE_TTL_MS = 15 * 60 * 1000;

type TleRecord = {
  name: string;
  line1: string;
  line2: string;
};

type IssCache = {
  tle: TleRecord | null;
  fetchedAt: number;
};

const globalIssCache = globalThis as typeof globalThis & {
  __liveworldIssCache?: IssCache;
};

const cache = globalIssCache.__liveworldIssCache ??= {
  tle: null,
  fetchedAt: 0,
};

function parseIssTle(text: string): TleRecord | null {
  const lines = text.split('\n').map(line => line.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  for (let i = 0; i < lines.length - 2; i += 1) {
    if (!lines[i].startsWith('1') && lines[i + 1].startsWith('1') && lines[i + 2].startsWith('2')) {
      const noradId = lines[i + 1].substring(2, 7).trim();
      if (noradId !== ISS_NORAD_ID) continue;
      return {
        name: lines[i].replace(/^0\s+/, '').trim() || 'ISS (ZARYA)',
        line1: lines[i + 1],
        line2: lines[i + 2],
      };
    }
  }

  return null;
}

async function getIssTle(): Promise<TleRecord | null> {
  const now = Date.now();
  if (cache.tle && now - cache.fetchedAt < TLE_TTL_MS) return cache.tle;

  try {
    const response = await fetch(ISS_TLE_URL, {
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
      headers: { 'User-Agent': 'LiveWorldMap/1.0 ISS tracker' },
    });

    if (!response.ok) return cache.tle;
    const parsed = parseIssTle(await response.text());
    if (!parsed) return cache.tle;

    cache.tle = parsed;
    cache.fetchedAt = now;
    return parsed;
  } catch {
    return cache.tle;
  }
}

export async function GET() {
  const tle = await getIssTle();
  if (!tle) {
    return NextResponse.json(
      { satellite: null, error: 'ISS position temporarily unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const propagated = propagateTLE(tle.line1, tle.line2);
  if (!propagated) {
    return NextResponse.json(
      { satellite: null, error: 'ISS orbit propagation failed' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  return NextResponse.json({
    satellite: {
      name: tle.name,
      aliases: ['ISS', 'ISS (ZARYA)', 'International Space Station', ISS_NORAD_ID],
      noradId: ISS_NORAD_ID,
      lat: Math.round(propagated.lat * 10000) / 10000,
      lng: Math.round(propagated.lng * 10000) / 10000,
      alt: Math.round(propagated.altKm),
      category: 'science',
      mission: 'Space Station',
    },
    source: 'celestrak',
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15',
    },
  });
}
