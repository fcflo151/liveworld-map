import { NextRequest, NextResponse } from 'next/server';
import {
  buildOpenMeteoAirQualityUrl,
  normalizeOpenMeteoAirQuality,
  parseBBox,
  parseFinite,
  sampleBBox,
  type AirQualityPoint,
} from '@/lib/air-quality';

const SOURCE = {
  id: 'open-meteo-air-quality',
  name: 'Open-Meteo Air Quality',
  url: 'https://open-meteo.com/en/docs/air-quality-api',
  attribution: 'Open-Meteo; CAMS data',
  trust: 'aggregated' as const,
};

function requestPoints(request: NextRequest): AirQualityPoint[] | null {
  const { searchParams } = request.nextUrl;
  const bboxRaw = searchParams.get('bbox');
  if (bboxRaw) {
    const bbox = parseBBox(bboxRaw);
    return bbox ? sampleBBox(bbox, 3) : null;
  }

  const lat = parseFinite(searchParams.get('lat'));
  const lng = parseFinite(searchParams.get('lng'));
  if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return [{ lat, lng }];
}

/**
 * Keyless air-quality endpoint backed by Open-Meteo/CAMS.
 *
 * The retired OpenAQ v2 endpoint previously used here returned 410 and could be
 * mistaken for a successful empty result because the response status was never
 * checked. Open-Meteo is queried only for an explicit point or a bounded map
 * viewport so this route cannot fan out into an unbounded global scrape.
 */
export async function GET(request: NextRequest) {
  const points = requestPoints(request);
  if (!points) {
    return NextResponse.json({
      stations: [],
      total: 0,
      error: 'Provide lat/lng or a valid bbox=south,west,north,east (max 25° × 40°).',
      source: SOURCE,
    }, { status: 400 });
  }

  try {
    const upstream = await fetch(buildOpenMeteoAirQualityUrl(points), {
      signal: AbortSignal.timeout(10_000),
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LiveWorldMap/1.0 (+https://github.com/fcflo151/liveworld-map)',
      },
      next: { revalidate: 600 },
    });

    if (!upstream.ok) {
      console.warn(`[LiveWorldMap] Open-Meteo air quality returned HTTP ${upstream.status}`);
      return NextResponse.json({
        stations: [],
        total: 0,
        error: `Air-quality upstream returned HTTP ${upstream.status}`,
        source: SOURCE,
      }, { status: 502 });
    }

    const payload = await upstream.json();
    const stations = normalizeOpenMeteoAirQuality(payload);
    if (stations.length === 0) {
      return NextResponse.json({
        stations: [],
        total: 0,
        error: 'Air-quality upstream returned no usable current measurements.',
        source: SOURCE,
      }, { status: 502 });
    }

    return NextResponse.json({
      stations,
      total: stations.length,
      timestamp: new Date().toISOString(),
      source: SOURCE,
    });
  } catch (error) {
    console.error('Air Quality API error:', error);
    return NextResponse.json({
      stations: [],
      total: 0,
      error: 'Failed to fetch air quality data',
      source: SOURCE,
    }, { status: 502 });
  }
}
