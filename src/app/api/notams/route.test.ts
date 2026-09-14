import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

describe('/api/notams', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.ICAO_API_KEY;
    delete process.env.OSIRIS_NOTAM_LOCATIONS;
  });

  it('exposes configuration state without contacting ICAO', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/notams?probe=1'));
    const body = await response.json();

    expect(body.configured).toBe(false);
    expect(body.locations).toHaveLength(10);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the key server-side and normalizes operational notices', async () => {
    process.env.ICAO_API_KEY = 'secret-test-key';
    process.env.OSIRIS_NOTAM_LOCATIONS = 'EDGG, EPWW, invalid';
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      void input;
      return new Response(JSON.stringify({ data: [
        { id: 'N1', location: 'EDGG', message: 'AIRSPACE CLOSED DUE ROCKET LAUNCH 5000N00830E' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('./route');
    const response = await GET(new NextRequest('http://localhost/api/notams'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.locations).toEqual(['EDGG', 'EPWW']);
    expect(JSON.stringify(body)).not.toContain('secret-test-key');
    expect(String(fetchMock.mock.calls[0][0])).toContain('api_key=secret-test-key');
  });
});
