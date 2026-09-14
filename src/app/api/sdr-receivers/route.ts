import { NextResponse } from 'next/server';
import { parseReceiverbookHtml, type PublicSdrReceiver } from '@/lib/signal-intel';

export const dynamic = 'force-dynamic';

const SOURCE_URL = 'https://www.receiverbook.de/map';
const DIRECTORY_URLS = ['kiwisdr', 'websdr', 'openwebrx'].map(type => `${SOURCE_URL}?type=${type}`);
const CACHE_TTL = 15 * 60 * 1000;
let cached: { receivers: PublicSdrReceiver[]; fetchedAt: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return NextResponse.json({ receivers: cached.receivers, total: cached.receivers.length, source: 'Receiverbook public receiver directory', source_url: SOURCE_URL, cached: true, timestamp: new Date(cached.fetchedAt).toISOString() });
  }

  try {
    const settled = await Promise.allSettled(DIRECTORY_URLS.map(async url => {
      const response = await fetch(url, {
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: 'text/html', 'User-Agent': 'OSIRIS/4.2 (+public OSINT receiver map)' },
      });
      if (!response.ok) throw new Error(`Receiverbook HTTP ${response.status}`);
      return parseReceiverbookHtml(await response.text());
    }));
    const byUrl = new Map<string, PublicSdrReceiver>();
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const receiver of result.value) byUrl.set(receiver.url, receiver);
      }
    }
    const receivers = [...byUrl.values()];
    if (receivers.length === 0) throw new Error('Receiverbook returned no receivers');
    const partial = settled.some(result => result.status === 'rejected');
    cached = { receivers, fetchedAt: Date.now() };
    return NextResponse.json({
      receivers,
      total: receivers.length,
      source: 'Receiverbook public receiver directory',
      source_url: SOURCE_URL,
      partial,
      coordinates_note: 'Positions are operator-published and may be deliberately approximate.',
      timestamp: new Date().toISOString(),
    }, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' } });
  } catch (error) {
    if (cached) {
      return NextResponse.json({ receivers: cached.receivers, total: cached.receivers.length, source: 'Receiverbook public receiver directory', source_url: SOURCE_URL, stale: true, error: error instanceof Error ? error.message : 'Receiver directory unavailable', timestamp: new Date(cached.fetchedAt).toISOString() });
    }
    return NextResponse.json({ receivers: [], total: 0, source: 'Receiverbook public receiver directory', source_url: SOURCE_URL, error: error instanceof Error ? error.message : 'Receiver directory unavailable', timestamp: new Date().toISOString() }, { status: 502 });
  }
}
