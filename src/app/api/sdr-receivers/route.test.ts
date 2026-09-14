import { beforeEach, describe, expect, it, vi } from 'vitest';

function directoryHtml(type: string, index: number) {
  return `<script>var receivers = [{"label":"Site ${index}","location":{"coordinates":[${10 + index},${50 + index}]},"receivers":[{"label":"Receiver ${index}","version":"1.0","url":"http://${type}.example.test/","type":"${type}"}]}];</script>`;
}

describe('/api/sdr-receivers', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('loads each concrete Receiverbook directory instead of the empty aggregate filter', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      const type = value.includes('type=kiwisdr') ? 'KiwiSDR' : value.includes('type=websdr') ? 'WebSDR' : 'OpenWebRX';
      const index = type === 'KiwiSDR' ? 1 : type === 'WebSDR' ? 2 : 3;
      return new Response(directoryHtml(type, index), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(3);
    expect(body.partial).toBe(false);
    expect(fetchMock.mock.calls.map(call => String(call[0]))).toEqual([
      'https://www.receiverbook.de/map?type=kiwisdr',
      'https://www.receiverbook.de/map?type=websdr',
      'https://www.receiverbook.de/map?type=openwebrx',
    ]);
  });

  it('returns a partial catalogue when one directory is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL | Request) => {
      const value = String(url);
      if (value.includes('type=websdr')) throw new Error('offline');
      const type = value.includes('type=kiwisdr') ? 'KiwiSDR' : 'OpenWebRX';
      return new Response(directoryHtml(type, type === 'KiwiSDR' ? 1 : 3), { status: 200 });
    }));
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.total).toBe(2);
    expect(body.partial).toBe(true);
  });
});
