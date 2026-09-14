import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const GEM_PIPELINES = 'https://raw.githubusercontent.com/GlobalEnergyMonitor/goit-ggit-data-ops/map-data/ggit_map_latest.geojson';
const GEM_LNG = 'https://raw.githubusercontent.com/GlobalEnergyMonitor/goit-ggit-interim-maps/main/trackers/ggit-goget-gogpt/lng_map_latest.geojson';
const GEM_PROJECT = 'https://globalenergymonitor.org/projects/global-gas-infrastructure-tracker/';

type Coordinates = number | Coordinates[];

export type Feature = {
  type: 'Feature';
  geometry: { type: string; coordinates: Coordinates } | null;
  properties?: Record<string, unknown>;
};

const FALLBACK_PIPELINE_ROWS: Array<[string, string, number[][]]> = [
  ['Nord Stream 1', 'retired', [[28.70, 60.60], [24.50, 59.60], [18.00, 58.00], [13.70, 55.30]]],
  ['Nord Stream 2', 'mothballed', [[28.40, 59.70], [23.00, 58.60], [17.00, 56.30], [13.70, 54.10]]],
  ['Baltic Pipe', 'operating', [[4.70, 57.40], [8.10, 56.20], [12.60, 55.00], [14.30, 54.20]]],
  ['Yamal–Europe', 'idle', [[37.60, 55.75], [27.55, 53.90], [21.00, 52.20], [14.60, 52.25]]],
  ['Trans-Mediterranean Pipeline', 'operating', [[3.05, 32.90], [9.50, 36.80], [12.55, 38.20], [15.60, 40.65], [12.50, 45.00]]],
  ['Trans Adriatic Pipeline', 'operating', [[23.70, 40.75], [20.10, 40.70], [19.45, 41.30], [17.90, 40.55]]],
  ['TurkStream', 'operating', [[37.80, 44.60], [32.00, 43.20], [28.00, 42.00], [27.70, 42.70]]],
  ['Medgaz', 'operating', [[-0.30, 35.80], [-2.45, 36.85]]],
];

const FALLBACK_PIPELINES: Feature[] = FALLBACK_PIPELINE_ROWS.map(([name, status, coordinates], index) => ({
  type: 'Feature' as const,
  geometry: { type: 'LineString', coordinates },
  properties: { id: `fallback-pipeline-${index}`, name, status, source: 'OSIRIS fallback (schematic route)', source_url: GEM_PROJECT, route_accuracy: 'schematic' },
}));

const FALLBACK_LNG_ROWS: Array<[string, string, number, number]> = [
  ['Wilhelmshaven LNG', 'Germany', 53.57, 8.15], ['Brunsbüttel LNG', 'Germany', 53.90, 9.13],
  ['Gate Terminal Rotterdam', 'Netherlands', 51.95, 4.05], ['Zeebrugge LNG', 'Belgium', 51.34, 3.20],
  ['Dunkirk LNG', 'France', 51.02, 2.18], ['Świnoujście LNG', 'Poland', 53.91, 14.25],
  ['Klaipėda LNG', 'Lithuania', 55.66, 21.14], ['Krk LNG', 'Croatia', 45.20, 14.55],
  ['Revithoussa LNG', 'Greece', 37.96, 23.40], ['Barcelona LNG', 'Spain', 41.34, 2.17],
];

const FALLBACK_LNG: Feature[] = FALLBACK_LNG_ROWS.map(([name, country, lat, lng], index) => ({
  type: 'Feature' as const,
  geometry: { type: 'Point', coordinates: [lng, lat] },
  properties: { id: `fallback-lng-${index}`, name, country, status: 'operating', source: 'OSIRIS fallback catalogue', source_url: GEM_PROJECT },
}));

function europeanCoordinate(coordinates: Coordinates): boolean {
  if (!Array.isArray(coordinates)) return false;
  if (coordinates.length >= 2 && typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
    return coordinates[0] >= -25 && coordinates[0] <= 45 && coordinates[1] >= 25 && coordinates[1] <= 72;
  }
  return coordinates.some(europeanCoordinate);
}

export function normalizePipeline(feature: Feature): Feature | null {
  if (!feature.geometry || !['LineString', 'MultiLineString'].includes(feature.geometry.type)) return null;
  const p = feature.properties ?? {};
  const name = p.PipelineName ?? p.name ?? p.Name;
  if (!name) return null;
  return {
    type: 'Feature', geometry: feature.geometry,
    properties: {
      id: p.ProjectID ?? p.id ?? String(name),
      name: String(name),
      segment: p.SegmentName ?? '',
      status: String(p.Status ?? p.status ?? 'unknown').toLowerCase(),
      countries: p.CountriesOrAreas ?? p.Country ?? '',
      capacity: p.Capacity ?? '',
      capacity_units: p.CapacityUnits ?? '',
      owner: p.Owner ?? '',
      route_accuracy: p.RouteAccuracy ?? '',
      source: 'Global Energy Monitor · GGIT',
      source_url: p.Wiki ?? GEM_PROJECT,
    },
  };
}

export function normalizeLng(feature: Feature): Feature | null {
  if (!feature.geometry || feature.geometry.type !== 'Point') return null;
  const p = feature.properties ?? {};
  const name = p.TerminalName ?? p.FacilityName ?? p.ProjectName ?? p.name ?? p.Name;
  if (!name) return null;
  return {
    type: 'Feature', geometry: feature.geometry,
    properties: {
      id: p.ProjectID ?? p.UnitID ?? p.id ?? String(name),
      name: String(name),
      country: p.Country ?? p.CountriesOrAreas ?? '',
      status: String(p.Status ?? p.status ?? 'unknown').toLowerCase(),
      capacity: p.Capacity ?? '',
      capacity_units: p.CapacityUnits ?? '',
      owner: p.Owner ?? '',
      source: 'Global Energy Monitor · GGIT',
      source_url: p.Wiki ?? GEM_PROJECT,
    },
  };
}

async function fetchGeojson(url: string, signal: AbortSignal): Promise<Feature[]> {
  const response = await fetch(url, { signal, next: { revalidate: 86_400 }, headers: { Accept: 'application/geo+json, application/json' } });
  if (!response.ok) throw new Error(`${new URL(url).hostname} responded ${response.status}`);
  const body = await response.json();
  return Array.isArray(body?.features) ? body.features : [];
}

export async function GET(req: Request) {
  const scope = new URL(req.url).searchParams.get('scope') ?? 'europe';
  const signal = AbortSignal.timeout(20_000);
  const [pipelineResult, lngResult] = await Promise.allSettled([
    fetchGeojson(GEM_PIPELINES, signal), fetchGeojson(GEM_LNG, signal),
  ]);
  let pipelines = pipelineResult.status === 'fulfilled'
    ? pipelineResult.value.map(normalizePipeline).filter((feature): feature is Feature => Boolean(feature))
    : FALLBACK_PIPELINES;
  let lngTerminals = lngResult.status === 'fulfilled'
    ? lngResult.value.map(normalizeLng).filter((feature): feature is Feature => Boolean(feature))
    : FALLBACK_LNG;
  const pipelineFallback = pipelineResult.status === 'rejected' || pipelines.length === 0;
  const lngFallback = lngResult.status === 'rejected' || lngTerminals.length === 0;
  if (pipelineFallback) pipelines = FALLBACK_PIPELINES;
  if (lngFallback) lngTerminals = FALLBACK_LNG;

  if (scope !== 'global') {
    pipelines = pipelines.filter(feature => Boolean(feature.geometry && europeanCoordinate(feature.geometry.coordinates)));
    lngTerminals = lngTerminals.filter(feature => Boolean(feature.geometry && europeanCoordinate(feature.geometry.coordinates)));
  }

  return NextResponse.json({
    pipelines: { type: 'FeatureCollection', features: pipelines },
    lng_terminals: { type: 'FeatureCollection', features: lngTerminals },
    scope,
    total_pipelines: pipelines.length,
    total_lng_terminals: lngTerminals.length,
    partial: pipelineFallback || lngFallback,
    fallback: {
      pipelines: pipelineFallback,
      lng_terminals: lngFallback,
    },
    source: 'Global Energy Monitor · Global Gas Infrastructure Tracker',
    source_url: GEM_PROJECT,
    license: 'CC BY 4.0',
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } });
}
