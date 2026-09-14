import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicSourceFetch, publicSourceHeaders, stealthFetch, stealthHeaders } from './stealthFetch';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('public source fetcher', () => {
  it('uses a stable application identity without spoofed forwarding headers', () => {
    const headers = publicSourceHeaders({ Accept: 'application/geo+json', 'X-Test': 'yes' });

    expect(headers['User-Agent']).toContain('LiveWorldMap/1.0');
    expect(headers.Accept).toBe('application/geo+json');
    expect(headers['x-test']).toBe('yes');
    expect(headers['X-Forwarded-For']).toBeUndefined();
    expect(headers['X-Real-IP']).toBeUndefined();
  });

  it('keeps the legacy header alias compliant', () => {
    expect(stealthHeaders()).toEqual(publicSourceHeaders());
  });

  it('passes transparent headers to fetch and preserves caller headers', async () => {
    const response = new Response('{}', { status: 200 });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

    await publicSourceFetch('https://example.test/feed', {
      headers: { Authorization: 'Bearer test', Accept: 'application/xml' },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('LiveWorldMap/1.0');
    expect(headers.authorization).toBe('Bearer test');
    expect(headers.accept).toBe('application/xml');
    expect(headers['X-Forwarded-For']).toBeUndefined();
  });

  it('keeps the legacy fetch alias functional without spoofing', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('ok'));

    await stealthFetch('https://example.test/feed');

    const [, init] = fetchMock.mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers['User-Agent']).toContain('LiveWorldMap/1.0');
    expect(headers['X-Real-IP']).toBeUndefined();
  });
});
