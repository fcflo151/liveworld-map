export interface CoordinateQuery {
  lat: number;
  lng: number;
}

export function parseCoordinateQuery(searchParams: URLSearchParams): CoordinateQuery | null {
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

export interface MarinePointForecast {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: Array<{
    time: string;
    waveHeight?: number;
    waveDirection?: number;
    wavePeriod?: number;
    seaSurfaceTemperature?: number;
    oceanCurrentVelocity?: number;
    oceanCurrentDirection?: number;
  }>;
}

function finiteAt(values: unknown, index: number): number | undefined {
  if (!Array.isArray(values)) return undefined;
  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function normalizeMarineResponse(input: unknown): MarinePointForecast {
  if (!input || typeof input !== 'object') throw new Error('Invalid marine response schema');
  const source = input as Record<string, unknown>;
  const hourly = source.hourly;
  if (!hourly || typeof hourly !== 'object') throw new Error('Invalid marine response schema');
  const h = hourly as Record<string, unknown>;
  if (!Array.isArray(h.time)) throw new Error('Invalid marine response schema');

  const latitude = Number(source.latitude);
  const longitude = Number(source.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Invalid marine coordinates');

  return {
    latitude,
    longitude,
    timezone: typeof source.timezone === 'string' ? source.timezone : 'GMT',
    hourly: h.time.map((time, index) => ({
      time: String(time),
      waveHeight: finiteAt(h.wave_height, index),
      waveDirection: finiteAt(h.wave_direction, index),
      wavePeriod: finiteAt(h.wave_period, index),
      seaSurfaceTemperature: finiteAt(h.sea_surface_temperature, index),
      oceanCurrentVelocity: finiteAt(h.ocean_current_velocity, index),
      oceanCurrentDirection: finiteAt(h.ocean_current_direction, index),
    })),
  };
}

export interface FloodPointForecast {
  latitude: number;
  longitude: number;
  daily: Array<{
    date: string;
    riverDischarge?: number;
    mean?: number;
    median?: number;
    maximum?: number;
    p75?: number;
    highFlowIndicator: boolean;
  }>;
}

export function normalizeFloodResponse(input: unknown): FloodPointForecast {
  if (!input || typeof input !== 'object') throw new Error('Invalid flood response schema');
  const source = input as Record<string, unknown>;
  const daily = source.daily;
  if (!daily || typeof daily !== 'object') throw new Error('Invalid flood response schema');
  const d = daily as Record<string, unknown>;
  if (!Array.isArray(d.time)) throw new Error('Invalid flood response schema');

  const latitude = Number(source.latitude);
  const longitude = Number(source.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Invalid flood coordinates');

  return {
    latitude,
    longitude,
    daily: d.time.map((date, index) => {
      const riverDischarge = finiteAt(d.river_discharge, index);
      const mean = finiteAt(d.river_discharge_mean, index);
      const median = finiteAt(d.river_discharge_median, index);
      const maximum = finiteAt(d.river_discharge_max, index);
      const p75 = finiteAt(d.river_discharge_p75, index);
      const reference = p75 ?? mean ?? median;
      return {
        date: String(date),
        riverDischarge,
        mean,
        median,
        maximum,
        p75,
        // This is intentionally only a simple model-relative indicator. It is
        // not called a warning and does not invent a flood threshold.
        highFlowIndicator: riverDischarge !== undefined && reference !== undefined && reference > 0 && riverDischarge > reference,
      };
    }),
  };
}
