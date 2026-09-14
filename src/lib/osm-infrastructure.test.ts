import { describe, expect, it } from 'vitest';
import {
  buildOverpassInfrastructureQuery,
  normalizeOverpassInfrastructure,
  parseOsmBBox,
  parseOsmCategories,
} from './osm-infrastructure';

describe('OSM public infrastructure adapter', () => {
  it('only accepts small viewports', () => {
    expect(parseOsmBBox('53.4,9.7,53.8,10.3')).toEqual({ south: 53.4, west: 9.7, north: 53.8, east: 10.3 });
    expect(parseOsmBBox('50,0,55,10')).toBeNull();
    expect(parseOsmBBox('54,10,53,11')).toBeNull();
  });

  it('drops unsupported categories rather than interpolating arbitrary Overpass QL', () => {
    expect(parseOsmCategories('hospital,unknown,fire_station')).toEqual(['hospital', 'fire_station']);
    expect(parseOsmCategories(null)).toEqual(['hospital', 'fire_station', 'shelter']);
  });

  it('builds a bounded allowlisted query', () => {
    const query = buildOverpassInfrastructureQuery(
      { south: 53.4, west: 9.7, north: 53.8, east: 10.3 },
      ['hospital', 'shelter'],
    );
    expect(query).toContain('["amenity"="hospital"]');
    expect(query).toContain('["amenity"="shelter"]');
    expect(query).toContain('(53.4,9.7,53.8,10.3)');
    expect(query).toContain('out center tags qt 250');
  });

  it('normalizes node and way centers, preserves zero coordinates, and excludes military objects', () => {
    const items = normalizeOverpassInfrastructure({
      elements: [
        { type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'hospital', name: 'Zero Hospital' } },
        { type: 'way', id: 2, center: { lat: 53.5, lon: 10 }, tags: { amenity: 'fire_station' } },
        { type: 'node', id: 3, lat: 53.6, lon: 10.1, tags: { amenity: 'shelter', military: 'bunker' } },
      ],
    });

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ lat: 0, lng: 0, category: 'hospital', name: 'Zero Hospital' });
    expect(items[1]).toMatchObject({ category: 'fire_station', name: 'Fire station' });
  });
});
