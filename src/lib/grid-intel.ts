export interface GridFrequency {
  hz: number;
  deviation_mhz: number;
  status: 'normal' | 'strained' | 'critical';
  measured_at: string;
  location: string;
  lat: number;
  lng: number;
  source: string;
  source_url: string;
}

export interface PowerFlow {
  id: string;
  from: string;
  to: string;
  from_lat: number;
  from_lng: number;
  to_lat: number;
  to_lng: number;
  mw: number;
  measured_at: string;
  source: string;
}

export interface GenerationOutage {
  id: string;
  name: string;
  country: string;
  lat: number;
  lng: number;
  unavailable_mw: number;
  available_mw: number | null;
  nominal_mw: number | null;
  starts_at: string;
  ends_at: string;
  fuel: string;
  source: string;
}

export interface EntsoeArea {
  code: string;
  name: string;
  lat: number;
  lng: number;
}

export interface EntsoeCorridor {
  id: string;
  from: EntsoeArea;
  to: EntsoeArea;
}

export const ENTSOE_AREAS: Record<string, EntsoeArea> = {
  DE: { code: '10Y1001A1001A83F', name: 'Germany/Luxembourg', lat: 51.05, lng: 10.45 },
  FR: { code: '10YFR-RTE------C', name: 'France', lat: 46.23, lng: 2.21 },
  BE: { code: '10YBE----------2', name: 'Belgium', lat: 50.50, lng: 4.47 },
  NL: { code: '10YNL----------L', name: 'Netherlands', lat: 52.13, lng: 5.29 },
  PL: { code: '10YPL-AREA-----S', name: 'Poland', lat: 51.92, lng: 19.15 },
  CZ: { code: '10YCZ-CEPS-----N', name: 'Czechia', lat: 49.82, lng: 15.47 },
  AT: { code: '10YAT-APG------L', name: 'Austria', lat: 47.52, lng: 14.55 },
  DK1: { code: '10YDK-1--------W', name: 'Denmark West', lat: 56.15, lng: 9.50 },
  SE4: { code: '10Y1001A1001A47J', name: 'Sweden SE4', lat: 56.30, lng: 14.20 },
  NO2: { code: '10YNO-2--------T', name: 'Norway NO2', lat: 59.05, lng: 7.25 },
};

export const ENTSOE_CORRIDORS: EntsoeCorridor[] = [
  ['de-fr', 'DE', 'FR'], ['de-be', 'DE', 'BE'], ['de-nl', 'DE', 'NL'],
  ['de-pl', 'DE', 'PL'], ['de-cz', 'DE', 'CZ'], ['de-at', 'DE', 'AT'],
  ['de-dk1', 'DE', 'DK1'], ['dk1-no2', 'DK1', 'NO2'], ['dk1-se4', 'DK1', 'SE4'],
].map(([id, from, to]) => ({ id, from: ENTSOE_AREAS[from], to: ENTSOE_AREAS[to] }));

const decodeXml = (value: string) => value
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'");

function xmlValue(xml: string, tag: string): string {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = xml.match(new RegExp(`<(?:\\w+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, 'i'));
  return match ? decodeXml(match[1].trim()) : '';
}

function xmlBlocks(xml: string, tag: string): string[] {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...xml.matchAll(new RegExp(`<(?:\\w+:)?${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:\\w+:)?${escaped}>`, 'gi'))]
    .map(match => match[1]);
}

function durationMs(resolution: string): number {
  const match = resolution.match(/^PT(?:(\d+)H)?(?:(\d+)M)?$/);
  if (!match) return 60 * 60 * 1000;
  return ((Number(match[1]) || 0) * 60 + (Number(match[2]) || 0)) * 60 * 1000;
}

function latestPoint(series: string): { value: number; measuredAt: string } | null {
  let best: { value: number; measuredAt: string } | null = null;
  for (const period of xmlBlocks(series, 'Period')) {
    const start = xmlValue(period, 'start');
    const step = durationMs(xmlValue(period, 'resolution'));
    if (!start || !Number.isFinite(new Date(start).getTime())) continue;
    for (const point of xmlBlocks(period, 'Point')) {
      const position = Number(xmlValue(point, 'position'));
      const value = Number(xmlValue(point, 'quantity'));
      if (!Number.isFinite(position) || !Number.isFinite(value)) continue;
      const measuredAt = new Date(new Date(start).getTime() + Math.max(0, position - 1) * step).toISOString();
      if (!best || measuredAt > best.measuredAt) best = { value, measuredAt };
    }
  }
  return best;
}

export function parseFrequency(payload: unknown): GridFrequency | null {
  const body = payload as { unix_seconds?: unknown; data?: unknown };
  let hz: number | undefined;
  let measuredAt: string | undefined;

  if (Array.isArray(body.unix_seconds) && Array.isArray(body.data)) {
    for (let index = body.data.length - 1; index >= 0; index -= 1) {
      const candidate = Number(body.data[index]);
      if (!Number.isFinite(candidate)) continue;
      hz = candidate;
      measuredAt = new Date(Number(body.unix_seconds[index]) * 1000).toISOString();
      break;
    }
  } else if (Array.isArray(body.data)) {
    for (let index = body.data.length - 1; index >= 0; index -= 1) {
      const point = body.data[index] as Record<string, unknown> | null;
      if (!point) continue;
      const values = point.values && typeof point.values === 'object' ? Object.values(point.values) : [];
      const candidate = Number(point.frequency ?? point.value ?? values.find(value => Number.isFinite(Number(value))));
      if (!Number.isFinite(candidate)) continue;
      hz = candidate;
      measuredAt = typeof point.timestamp === 'string' ? point.timestamp : undefined;
      break;
    }
  }

  if (!Number.isFinite(hz) || !measuredAt) return null;
  const deviation = Math.abs(hz! - 50);
  return {
    hz: Number(hz!.toFixed(3)),
    deviation_mhz: Math.round((hz! - 50) * 1000),
    status: deviation >= 0.2 ? 'critical' : deviation >= 0.1 ? 'strained' : 'normal',
    measured_at: measuredAt,
    location: 'Continental Europe · Freiburg measurement',
    lat: 47.999, lng: 7.842,
    source: 'Fraunhofer ISE Energy-Charts',
    source_url: 'https://www.energy-charts.info/',
  };
}

export function parsePhysicalFlow(xml: string, corridor: EntsoeCorridor): PowerFlow | null {
  let latest: { value: number; measuredAt: string } | null = null;
  for (const series of xmlBlocks(xml, 'TimeSeries')) {
    const point = latestPoint(series);
    if (point && (!latest || point.measuredAt > latest.measuredAt)) latest = point;
  }
  if (!latest) return null;
  return {
    id: corridor.id,
    from: corridor.from.name,
    to: corridor.to.name,
    from_lat: corridor.from.lat,
    from_lng: corridor.from.lng,
    to_lat: corridor.to.lat,
    to_lng: corridor.to.lng,
    mw: Math.round(latest.value),
    measured_at: latest.measuredAt,
    source: 'ENTSO-E Transparency Platform',
  };
}

const FUEL_TYPES: Record<string, string> = {
  B04: 'Fossil gas', B05: 'Hard coal', B06: 'Oil', B10: 'Hydro',
  B12: 'Hydro reservoir', B14: 'Nuclear', B16: 'Solar', B18: 'Wind offshore', B19: 'Wind onshore',
};

export function parseGenerationOutages(xml: string, area: EntsoeArea): GenerationOutage[] {
  return xmlBlocks(xml, 'TimeSeries').flatMap((series, index) => {
    const name = xmlValue(series, 'registeredResource.name') || xmlValue(series, 'production_RegisteredResource.name');
    const nominal = Number(xmlValue(series, 'nominalP'));
    const point = latestPoint(series);
    const period = xmlBlocks(series, 'Period')[0] ?? '';
    const start = xmlValue(period, 'start');
    const end = xmlValue(period, 'end');
    if (!name || !point) return [];
    const nominalMw = Number.isFinite(nominal) && nominal > 0 ? nominal : null;
    const unavailable = nominalMw === null ? point.value : Math.max(0, nominalMw - point.value);
    if (unavailable <= 0) return [];
    return [{
      id: `${area.code}-${index}-${name}`,
      name,
      country: area.name,
      lat: area.lat,
      lng: area.lng,
      unavailable_mw: Math.round(unavailable),
      available_mw: nominalMw === null ? null : Math.round(point.value),
      nominal_mw: nominalMw === null ? null : Math.round(nominalMw),
      starts_at: start,
      ends_at: end,
      fuel: FUEL_TYPES[
        xmlValue(series, 'production_RegisteredResource.pSRType.psrType') ||
        xmlValue(series, 'MktPSRType.psrType') ||
        xmlValue(series, 'psrType')
      ] ?? 'Generation unit',
      source: 'ENTSO-E Transparency Platform',
    }];
  });
}
