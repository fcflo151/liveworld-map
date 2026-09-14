import { NextResponse } from 'next/server';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { cachedSource } from '@/lib/sourceCache';
import { httpText } from '@/lib/httpJson';
import { parseGdacsObservations, type GdacsObservation } from '@/lib/sources/gdacs';

const UPSTREAM = 'https://www.gdacs.org/contentdata/xml/rss_7d.xml';
const source = getSourceRegistryEntry('gdacs')!;
let lastAttemptAt: number | undefined;
let lastSuccessAt: number | undefined;
let lastLatencyMs: number | undefined;
let lastError: string | undefined;

const load = cachedSource<GdacsObservation>('gdacs-observations', async () => {
  const started = Date.now();
  lastAttemptAt = started;
  try {
    const xml = await httpText(UPSTREAM, {
      timeoutMs: 12_000,
      headers: { Accept: 'application/rss+xml,application/xml,text/xml', 'User-Agent': 'LiveWorldMap/1.0 (GDACS observations)' },
    });
    const observations = parseGdacsObservations(xml);
    lastSuccessAt = Date.now();
    lastLatencyMs = lastSuccessAt - started;
    lastError = undefined;
    return observations;
  } catch (error) {
    lastLatencyMs = Date.now() - started;
    lastError = error instanceof Error ? error.message : 'Unknown upstream error';
    throw error;
  }
}, source.cacheTtlMs);

export async function GET() {
  const observations = await load();
  const health = evaluateFeedHealth({
    id: source.id,
    name: source.name,
    url: UPSTREAM,
    trust: source.confidenceClass,
    lastAttemptAt,
    lastSuccessAt,
    attemptSucceeded: lastAttemptAt !== undefined ? !lastError : undefined,
    error: lastError,
    latencyMs: lastLatencyMs,
    itemCount: observations.length,
    expectedIntervalMs: source.refreshIntervalMs ?? undefined,
  });

  return NextResponse.json({
    observations,
    total: observations.length,
    source,
    health,
    mapPolicy: 'supplementary-only',
    deduplicationNote: 'GDACS EQ/WF/VO and TC/FL/DR observations enrich primary/existing event layers; this endpoint does not create duplicate map objects.',
  }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } });
}
