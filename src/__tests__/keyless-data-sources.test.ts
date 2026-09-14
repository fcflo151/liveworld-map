import { describe, expect, test } from 'vitest';
import { normalizeDwdWarnings, unwrapDwdWarningsJson } from '@/lib/sources/dwd-warnings';
import { normalizeFloodResponse, normalizeMarineResponse, parseCoordinateQuery } from '@/lib/sources/open-meteo';
import { parseGdacsObservations } from '@/lib/sources/gdacs';
import { buildGibsWmsTileUrl, normalizeGibsDate } from '@/lib/nasa-gibs';
import { parseGtfsRealtime, selectSituationalGtfs } from '@/lib/sources/gtfs-rt';
import { listKeylessSources, SOURCE_REGISTRY } from '@/lib/source-registry';

const params = (value: Record<string, string>) => new URLSearchParams(value);
const concat = (...parts: number[][]) => parts.flat();
const varint = (value: number) => {
  const out: number[] = [];
  let current = value;
  do {
    let byte = current & 0x7f;
    current = Math.floor(current / 128);
    if (current > 0) byte |= 0x80;
    out.push(byte);
  } while (current > 0);
  return out;
};
const fieldBytes = (field: number, bytes: number[]) => concat(varint((field << 3) | 2), varint(bytes.length), bytes);
const fieldString = (field: number, value: string) => fieldBytes(field, [...new TextEncoder().encode(value)]);
const fieldVarint = (field: number, value: number) => concat(varint(field << 3), varint(value));

describe('keyless data sources', () => {
  test('registry includes only attributed keyless sources', () => {
    const ids = listKeylessSources().map(source => source.id);
    expect(ids).toEqual(expect.arrayContaining(['gdacs', 'dwd-warnings', 'nasa-gibs', 'open-meteo-marine', 'open-meteo-flood', 'osm-overpass', 'gtfs-de']));
    expect(SOURCE_REGISTRY['osm-overpass'].attribution).toContain('OpenStreetMap');
    expect(SOURCE_REGISTRY['gtfs-de'].license).toContain('CC BY-SA 4.0');
    expect(SOURCE_REGISTRY['open-meteo-flood'].termsNotes).toContain('non-commercial');
  });

  test('DWD wrapper parses, normalizes and deduplicates warnings', () => {
    const raw = `warnWetter.loadWarnings(${JSON.stringify({
      time: 1_789_000_000_000,
      warnings: {
        '101': [
          { id: 'w-1', regionName: 'Hamburg', event: 'STURM', headline: 'Warnung vor Sturm', level: 4, start: 1_789_000_000_000, end: 1_789_003_600_000, description: 'Beschreibung', instruction: 'Hinweise' },
          { id: 'w-1', regionName: 'Hamburg', event: 'STURM', headline: 'duplicate', level: 4 },
        ],
      },
    })});`;
    const warnings = normalizeDwdWarnings(unwrapDwdWarningsJson(raw));
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ id: 'w-1', region: 'Hamburg', severity: 'severe', source: 'DWD' });
  });

  test('DWD accepts a valid empty warning set and rejects malformed input', () => {
    expect(normalizeDwdWarnings({ time: Date.now(), warnings: {} })).toEqual([]);
    expect(() => unwrapDwdWarningsJson('not-json')).toThrow('Invalid DWD warning response');
    expect(() => normalizeDwdWarnings({ warnings: [] })).toThrow('Invalid DWD warning schema');
  });

  test('GDACS observations keep stable IDs and suppress duplicate episodes', () => {
    const item = `<item><title>Flood</title><link>https://www.gdacs.org/x</link><pubDate>Mon, 14 Sep 2026 12:00:00 GMT</pubDate><gdacs:eventtype>FL</gdacs:eventtype><gdacs:eventid>123</gdacs:eventid><gdacs:episodeid>7</gdacs:episodeid><gdacs:alertlevel>Orange</gdacs:alertlevel><gdacs:alertscore>1.8</gdacs:alertscore><gdacs:severity>High impact</gdacs:severity><gdacs:country>DE</gdacs:country><geo:lat>53.5</geo:lat><geo:long>10.0</geo:long></item>`;
    const observations = parseGdacsObservations(`<rss><channel>${item}${item}</channel></rss>`);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ id: 'gdacs:FL:123:7', alertLevel: 'orange', role: 'supplementary-observation', complements: 'weather-layer' });
  });

  test('Open-Meteo coordinate validation and marine normalization are deterministic', () => {
    expect(parseCoordinateQuery(params({ lat: '53.5', lng: '10' }))).toEqual({ lat: 53.5, lng: 10 });
    expect(parseCoordinateQuery(params({ lat: '999', lng: '10' }))).toBeNull();
    const marine = normalizeMarineResponse({ latitude: 54, longitude: 10, timezone: 'GMT', hourly: { time: ['2026-09-14T00:00'], wave_height: [1.2], wave_direction: [270], wave_period: [6], sea_surface_temperature: [17.5], ocean_current_velocity: [0.4], ocean_current_direction: [90], sea_level_height_msl: [0.13] } });
    expect(marine.hourly[0]).toMatchObject({ waveHeight: 1.2, oceanCurrentVelocity: 0.4, seaLevelHeightMsl: 0.13 });
    expect(() => normalizeMarineResponse({})).toThrow('Invalid marine response schema');
  });

  test('flood indicator remains model-relative instead of inventing a warning threshold', () => {
    const flood = normalizeFloodResponse({ latitude: 50, longitude: 8, daily: { time: ['2026-09-14', '2026-09-15'], river_discharge: [20, 6], river_discharge_mean: [10, 10], river_discharge_p75: [15, 15] } });
    expect(flood.daily.map(day => day.highFlowIndicator)).toEqual([true, false]);
    expect(() => normalizeFloodResponse({ daily: { time: [] } })).toThrow('Invalid flood coordinates');
  });

  test('NASA GIBS uses date-aware WMS raster URLs and stays separate from FIRMS', () => {
    expect(normalizeGibsDate('2026-09-14')).toBe('2026-09-14');
    const url = buildGibsWmsTileUrl('true-color', '2026-09-14');
    expect(url).toContain('gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi');
    expect(url).toContain('TIME=2026-09-14');
    expect(url).toContain('MODIS_Terra_CorrectedReflectance_TrueColor');
    expect(url).toContain('{bbox-epsg-3857}');
    expect(url).not.toContain('FIRMS');
  });

  test('GTFS realtime decoder keeps alerts and delayed trip updates, not zero-delay noise', () => {
    const translatedHeader = fieldBytes(1, fieldString(1, 'Signal failure'));
    const alert = concat(fieldBytes(10, translatedHeader), fieldVarint(7, 1));
    const alertEntity = concat(fieldString(1, 'alert-1'), fieldBytes(5, alert));

    const trip = concat(fieldString(1, 'trip-1'), fieldString(5, 'route-1'));
    const tripUpdate = concat(fieldBytes(1, trip), fieldVarint(5, 420));
    const tripEntity = concat(fieldString(1, 'trip-entity'), fieldBytes(3, tripUpdate));

    const zeroTrip = concat(fieldString(1, 'trip-2'), fieldString(5, 'route-2'));
    const zeroTripEntity = concat(fieldString(1, 'trip-zero'), fieldBytes(3, fieldBytes(1, zeroTrip)));

    // GTFS-Realtime delay is signed int32; early-running services use negative values.
    const earlyTrip = concat(fieldString(1, 'trip-early'), fieldString(5, 'route-early'));
    const negativeSixty = [0xc4, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01];
    const earlyDelayField = concat(varint(5 << 3), negativeSixty);
    const earlyTripUpdate = concat(fieldBytes(1, earlyTrip), earlyDelayField);
    const earlyTripEntity = concat(fieldString(1, 'trip-early-entity'), fieldBytes(3, earlyTripUpdate));

    const header = concat(fieldString(1, '2.0'), fieldVarint(3, 1_789_000_000));
    const feedBytes = new Uint8Array(concat(fieldBytes(1, header), fieldBytes(2, alertEntity), fieldBytes(2, tripEntity), fieldBytes(2, zeroTripEntity), fieldBytes(2, earlyTripEntity)));

    const selected = selectSituationalGtfs(parseGtfsRealtime(feedBytes));
    expect(selected.timestamp).toBe(1_789_000_000);
    expect(selected.alerts[0]).toMatchObject({ entityId: 'alert-1', header: 'Signal failure', effect: 1 });
    expect(selected.tripUpdates).toHaveLength(2);
    expect(selected.tripUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ tripId: 'trip-1', routeId: 'route-1', delaySeconds: 420 }),
      expect.objectContaining({ tripId: 'trip-early', routeId: 'route-early', delaySeconds: -60 }),
    ]));
  });
});
