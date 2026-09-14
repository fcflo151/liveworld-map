import { normalizeDwdWarnings, unwrapDwdWarningsJson } from '@/lib/sources/dwd-warnings';
import { normalizeFloodResponse, normalizeMarineResponse, parseCoordinateQuery } from '@/lib/sources/open-meteo';
import { buildInfrastructureQuery, normalizeOverpass, parseViewport, OVERPASS_MAX_RESULTS } from '@/lib/sources/overpass';
import { parseGdacsObservations } from '@/lib/sources/gdacs';
import { buildGibsWmsTileUrl, normalizeGibsDate } from '@/lib/nasa-gibs';
import { listKeylessSources, SOURCE_REGISTRY } from '@/lib/source-registry';

const params = (value: Record<string, string>) => new URLSearchParams(value);

describe('keyless data sources', () => {
  test('registry marks the new sources keyless and preserves attribution', () => {
    const ids = listKeylessSources().map(source => source.id);
    expect(ids).toEqual(expect.arrayContaining(['gdacs', 'dwd-warnings', 'nasa-gibs', 'open-meteo-marine', 'open-meteo-flood', 'osm-overpass']));
    expect(SOURCE_REGISTRY['osm-overpass'].attribution).toContain('OpenStreetMap');
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

  test('Overpass policy enforces zoom/span limits and hard result bounds', () => {
    expect(parseViewport(params({ south: '53.4', west: '9.8', north: '53.7', east: '10.2', zoom: '9' }))).not.toBeNull();
    expect(parseViewport(params({ south: '50', west: '5', north: '56', east: '12', zoom: '7' }))).toBeNull();
    const query = buildInfrastructureQuery({ south: 53.4, west: 9.8, north: 53.7, east: 10.2 });
    expect(query).toContain(`out center ${OVERPASS_MAX_RESULTS}`);
    expect(query).toContain('[timeout:12]');
    const features = normalizeOverpass({ elements: [{ type: 'node', id: 1, lat: 53.5, lon: 10, tags: { amenity: 'hospital', name: 'Test Hospital' } }, { type: 'node', id: 1, lat: 53.5, lon: 10, tags: { amenity: 'hospital' } }] });
    expect(features).toHaveLength(1);
    expect(features[0].properties.category).toBe('hospital');
  });

  test('NASA GIBS uses date-aware direct WMS raster URLs without FIRMS events', () => {
    expect(normalizeGibsDate('2026-09-14')).toBe('2026-09-14');
    const url = buildGibsWmsTileUrl('true-color', '2026-09-14');
    expect(url).toContain('gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi');
    expect(url).toContain('TIME=2026-09-14');
    expect(url).toContain('MODIS_Terra_CorrectedReflectance_TrueColor');
    expect(url).toContain('{bbox-epsg-3857}');
    expect(url).not.toContain('FIRMS');
  });
});
