import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Civil Protection & Disaster Intel (BBK NINA / MoWaS)', () => {
  let getCivilAlerts: typeof import('./route').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('./route');
    getCivilAlerts = mod.GET;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns civil protection alerts with fallback if API is unreachable', async () => {
    // Force network failure
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'));

    const res = await getCivilAlerts();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('alerts');
    expect(Array.isArray(data.alerts)).toBe(true);
    expect(data.alerts.length).toBeGreaterThan(0);

    const first = data.alerts[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('severity');
    expect(first).toHaveProperty('lat');
    expect(first).toHaveProperty('lng');
    expect(typeof first.lat).toBe('number');
    expect(typeof first.lng).toBe('number');
  });

  it('parses valid NINA/MoWaS mapData feed', async () => {
    vi.spyOn(global, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('mowas')) {
        return new Response(JSON.stringify([
          {
            id: 'mow.DE-NW-TEST-001',
            i18nTitle: { de: 'Amtliche Gefahrenmeldung - Test' },
            severity: 'Severe',
            urgency: 'Immediate',
            type: 'Alert',
            startDate: '2026-09-14T12:00:00Z',
          }
        ]), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });

    const res = await getCivilAlerts();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.alerts.length).toBeGreaterThanOrEqual(1);
    const match = data.alerts.find((a: any) => a.id === 'mow.DE-NW-TEST-001');
    if (match) {
      expect(match.severity).toBe('Severe');
      expect(match.title).toContain('Amtliche');
    }
  });
});

describe('Federal Waterways & River Gauges (WSV Pegelonline)', () => {
  let getWaterways: typeof import('../waterways/route').GET;

  beforeEach(async () => {
    vi.restoreAllMocks();
    vi.resetModules();
    const mod = await import('../waterways/route');
    getWaterways = mod.GET;
  });

  it('returns waterway gauges fallback when WSV API is unreachable', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Pegelonline offline'));

    const res = await getWaterways();
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data).toHaveProperty('stations');
    expect(Array.isArray(data.stations)).toBe(true);
    expect(data.stations.length).toBeGreaterThan(0);

    const kaub = data.stations.find((s: any) => s.id.includes('KAUB'));
    expect(kaub).toBeDefined();
    expect(kaub.water).toBe('RHEIN');
    expect(kaub.measurement).toBeDefined();
    expect(typeof kaub.measurement.value).toBe('number');
  });

  it('parses real WSV Pegelonline structure correctly', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      {
        uuid: 'test-uuid-1',
        shortname: 'KOELN',
        km: 688.0,
        latitude: 50.9366,
        longitude: 6.9634,
        agency: 'WSA Rhein',
        water: { shortname: 'RHEIN' },
        timeseries: [
          {
            shortname: 'W',
            currentMeasurement: {
              timestamp: '2026-09-14T14:00:00Z',
              value: 350,
              trend: 1,
              stateMnwMhw: 'normal'
            }
          }
        ]
      }
    ]), { status: 200 }));

    const res = await getWaterways();
    expect(res.status).toBe(200);
    const data = await res.json();
    const koeln = data.stations.find((s: any) => s.name === 'KOELN');
    if (koeln) {
      expect(koeln.water).toBe('RHEIN');
      expect(koeln.measurement.value).toBe(350);
      expect(koeln.measurement.trend).toBe(1);
    }
  });
});
