import { NextResponse } from 'next/server';
import { evaluateFeedHealth } from '@/lib/feed-health';
import { getSourceRegistryEntry } from '@/lib/source-registry';
import { cachedSource } from '@/lib/sourceCache';
import { httpText } from '@/lib/httpJson';
import { normalizeDwdWarnings, unwrapDwdWarningsJson, type DwdWarning } from '@/lib/sources/dwd-warnings';

const UPSTREAM = 'https://www.dwd.de/DWD/warnungen/warnapp/json/warnings.json';
const source = getSourceRegistryEntry('dwd-warnings')!;

let lastAttemptAt: number | undefined;
let lastSuccessAt: number | undefined;
let lastLatencyMs: number | undefined;
let lastError: string | undefined;

const loadWarnings = cachedSource<DwdWarning>('dwd-warnings', async () => {
  const started = Date.now();
  lastAttemptAt = started;
  try {
    const raw = await httpText(UPSTREAM, {
      timeoutMs: 10_000,
      headers: { Accept: 'application/json,text/plain;q=0.9,*/*;q=0.8', 'User-Agent': 'LiveWorldMap/1.0 (DWD weather warnings)' },
    });
    const warnings = normalizeDwdWarnings(unwrapDwdWarningsJson(raw));
    lastSuccessAt = Date.now();
    lastLatencyMs = lastSuccessAt - started;
    lastError = undefined;
    return warnings;
  } catch (error) {
    lastLatencyMs = Date.now() - started;
    lastError = error instanceof Error ? error.message : 'Unknown upstream error';
    throw error;
  }
}, source.cacheTtlMs);

export async function GET() {
  const warnings = await loadWarnings();
  const now = Date.now();
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
    itemCount: warnings.length,
    expectedIntervalMs: source.refreshIntervalMs ?? undefined,
  }, now);

  return NextResponse.json({ warnings, total: warnings.length, timestamp: new Date(now).toISOString(), source, health }, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=180' },
  });
}
