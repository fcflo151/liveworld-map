export type AirQualityPoint = { lat: number; lng: number };

export type AirQualityStation = {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  so2: number | null;
  co: number | null;
  aqi: number | null;
  unit: string;
  level: string;
  color: string;
  lastUpdated: string | null;
  model: string;
};

type OpenMeteoCurrent = {
  time?: string;
  european_aqi?: number | null;
  pm2_5?: number | null;
  pm10?: number | null;
  nitrogen_dioxide?: number | null;
  ozone?: number | null;
  sulphur_dioxide?: number | null;
  carbon_monoxide?: number | null;
};

type OpenMeteoAirQuality = {
  latitude?: number;
  longitude?: number;
  current?: OpenMeteoCurrent;
  current_units?: { pm2_5?: string };
};

export type BBox = { south: number; west: number; north: number; east: number };

const MAX_BBOX_LAT_SPAN = 25;
const MAX_BBOX_LNG_SPAN = 40;

export function parseFinite(value: string | null): number | null {
  if (value === null || value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBBox(raw: string | null): BBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) return null;
  const [south, west, north, east] = parts;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  if (south >= north || west >= east) return null;
  if (north - south > MAX_BBOX_LAT_SPAN || east - west > MAX_BBOX_LNG_SPAN) return null;
  return { south, west, north, east };
}

export function sampleBBox(bbox: BBox, side = 3): AirQualityPoint[] {
  const size = Math.max(2, Math.min(4, Math.floor(side)));
  const points: AirQualityPoint[] = [];
  for (let y = 0; y < size; y++) {
    const lat = bbox.south + ((bbox.north - bbox.south) * (y + 0.5)) / size;
    for (let x = 0; x < size; x++) {
      const lng = bbox.west + ((bbox.east - bbox.west) * (x + 0.5)) / size;
      points.push({ lat: roundCoord(lat), lng: roundCoord(lng) });
    }
  }
  return points;
}

function roundCoord(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function europeanAqiStyle(aqi: number | null): { level: string; color: string } {
  if (aqi === null) return { level: 'Unknown', color: '#78909C' };
  if (aqi <= 20) return { level: 'Good', color: '#00E676' };
  if (aqi <= 40) return { level: 'Fair', color: '#9CCC65' };
  if (aqi <= 60) return { level: 'Moderate', color: '#FFD54F' };
  if (aqi <= 80) return { level: 'Poor', color: '#FF9800' };
  if (aqi <= 100) return { level: 'Very Poor', color: '#F44336' };
  return { level: 'Extremely Poor', color: '#8E24AA' };
}

export function normalizeOpenMeteoAirQuality(
  payload: OpenMeteoAirQuality | OpenMeteoAirQuality[],
): AirQualityStation[] {
  const rows = Array.isArray(payload) ? payload : [payload];
  return rows.flatMap((row, index) => {
    const lat = finiteOrNull(row.latitude);
    const lng = finiteOrNull(row.longitude);
    if (lat === null || lng === null || !row.current) return [];

    const aqi = finiteOrNull(row.current.european_aqi);
    const style = europeanAqiStyle(aqi);
    return [{
      id: `aq-open-meteo-${lat.toFixed(4)}-${lng.toFixed(4)}`,
      name: rows.length === 1 ? 'Air quality' : `Air quality sample ${index + 1}`,
      city: 'Model grid',
      country: 'Global',
      lat,
      lng,
      pm25: finiteOrNull(row.current.pm2_5),
      pm10: finiteOrNull(row.current.pm10),
      no2: finiteOrNull(row.current.nitrogen_dioxide),
      o3: finiteOrNull(row.current.ozone),
      so2: finiteOrNull(row.current.sulphur_dioxide),
      co: finiteOrNull(row.current.carbon_monoxide),
      aqi,
      unit: row.current_units?.pm2_5 || 'μg/m³',
      level: style.level,
      color: style.color,
      lastUpdated: typeof row.current.time === 'string' ? row.current.time : null,
      model: 'CAMS via Open-Meteo',
    }];
  });
}

export function buildOpenMeteoAirQualityUrl(points: AirQualityPoint[]): string {
  if (points.length === 0 || points.length > 16) throw new Error('Air-quality request must contain 1-16 points');
  const params = new URLSearchParams({
    latitude: points.map(point => point.lat).join(','),
    longitude: points.map(point => point.lng).join(','),
    current: [
      'european_aqi',
      'pm2_5',
      'pm10',
      'nitrogen_dioxide',
      'ozone',
      'sulphur_dioxide',
      'carbon_monoxide',
    ].join(','),
    domains: 'auto',
    timezone: 'GMT',
    cell_selection: 'nearest',
  });
  return `https://air-quality-api.open-meteo.com/v1/air-quality?${params}`;
}
