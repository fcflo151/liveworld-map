import { describe, it, expect } from 'vitest';
import { GET as getStations, MAJOR_STATIONS, RAIL_CORRIDORS } from './stations/route';
import { GET as getDepartures } from './departures/route';

describe('Rail Intel API', () => {
  it('returns list of major train stations and corridors', async () => {
    const req = new Request('http://localhost:3000/api/trains/stations');
    const res = await getStations(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.stations).toBeDefined();
    expect(data.stations.length).toBeGreaterThan(10);
    expect(data.corridors).toBeDefined();
    expect(data.corridors.length).toBeGreaterThan(2);

    // Verify key stations exist
    const berlin = data.stations.find((s: any) => s.city === 'Berlin');
    expect(berlin).toBeDefined();
    expect(berlin.hasHighSpeed).toBe(true);

    const munich = data.stations.find((s: any) => s.city === 'München');
    expect(munich).toBeDefined();
  });

  it('filters stations by country', async () => {
    const req = new Request('http://localhost:3000/api/trains/stations?country=Switzerland');
    const res = await getStations(req);
    const data = await res.json();

    expect(data.stations.every((s: any) => s.country === 'Switzerland')).toBe(true);
    expect(data.stations.some((s: any) => s.city === 'Zürich')).toBe(true);
  });

  it('returns live or scheduled departures for a requested station', async () => {
    const req = new Request('http://localhost:3000/api/trains/departures?name=Frankfurt(Main)Hbf');
    const res = await getDepartures(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.station).toBe('Frankfurt(Main)Hbf');
    expect(Array.isArray(data.departures)).toBe(true);
    expect(data.departures.length).toBeGreaterThan(0);

    const first = data.departures[0];
    expect(first.line).toBeDefined();
    expect(first.direction).toBeDefined();
    expect(first.plannedTime).toMatch(/^\d{2}:\d{2}$/);
  });
});
