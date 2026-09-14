import { describe, expect, it } from 'vitest';
import {
  buildOpenMeteoAirQualityUrl,
  europeanAqiStyle,
  normalizeOpenMeteoAirQuality,
  parseBBox,
  sampleBBox,
} from './air-quality';

describe('air quality adapter', () => {
  it('accepts bounded viewports and rejects oversized or invalid boxes', () => {
    expect(parseBBox('53,9,54,11')).toEqual({ south: 53, west: 9, north: 54, east: 11 });
    expect(parseBBox('54,9,53,11')).toBeNull();
    expect(parseBBox('-90,-180,90,180')).toBeNull();
    expect(parseBBox('oops')).toBeNull();
  });

  it('samples a viewport without touching its edges', () => {
    const points = sampleBBox({ south: 0, west: 0, north: 3, east: 3 }, 3);
    expect(points).toHaveLength(9);
    expect(points[0]).toEqual({ lat: 0.5, lng: 0.5 });
    expect(points[8]).toEqual({ lat: 2.5, lng: 2.5 });
  });

  it('uses the revised European AQI bands', () => {
    expect(europeanAqiStyle(20).level).toBe('Good');
    expect(europeanAqiStyle(21).level).toBe('Fair');
    expect(europeanAqiStyle(101).level).toBe('Extremely Poor');
  });

  it('normalizes Open-Meteo current values, including zero coordinates and values', () => {
    const stations = normalizeOpenMeteoAirQuality({
      latitude: 0,
      longitude: 0,
      current: {
        time: '2026-09-14T20:00',
        european_aqi: 31,
        pm2_5: 0,
        pm10: 2,
        nitrogen_dioxide: 3,
        ozone: 4,
        sulphur_dioxide: 5,
        carbon_monoxide: 6,
      },
      current_units: { pm2_5: 'μg/m³' },
    });

    expect(stations).toHaveLength(1);
    expect(stations[0]).toMatchObject({ lat: 0, lng: 0, pm25: 0, aqi: 31, level: 'Fair' });
  });

  it('builds one bounded multi-coordinate request', () => {
    const url = new URL(buildOpenMeteoAirQualityUrl([{ lat: 53.55, lng: 10 }, { lat: 52.52, lng: 13.41 }]));
    expect(url.hostname).toBe('air-quality-api.open-meteo.com');
    expect(url.searchParams.get('latitude')).toBe('53.55,52.52');
    expect(url.searchParams.get('current')).toContain('european_aqi');
  });
});
