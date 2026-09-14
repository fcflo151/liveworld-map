'use client';

import { useMemo, useState } from 'react';
import {
  FEED_STATUS_ORDER,
  formatFeedAge,
  groupFeedHealthByStatus,
  type FeedHealth,
  type FeedStatus,
} from '@/lib/feed-health';

export interface FeedHealthPanelProps {
  feeds: readonly FeedHealth[];
  title?: string;
  className?: string;
  defaultStatus?: FeedStatus | 'all';
}

const STATUS_META: Record<FeedStatus, { label: string; color: string; hint: string }> = {
  live: { label: 'LIVE', color: '#00E676', hint: 'Fresh data and no configured degradation threshold exceeded.' },
  degraded: { label: 'DEGRADED', color: '#FFB74D', hint: 'Fresh data is available, but one or more quality signals are impaired.' },
  stale: { label: 'STALE', color: '#FFD166', hint: 'Usable data exists, but it is older than the configured freshness limit.' },
  offline: { label: 'OFFLINE', color: '#FF3D57', hint: 'No usable data exists or the last success is beyond the offline limit.' },
};

const TRUST_HINT: Record<FeedHealth['trust'], string> = {
  official: 'Official: published by the responsible authority or operator.',
  primary: 'Primary: obtained directly from the system or first-party provider.',
  curated: 'Curated: selected and maintained by LiveWorld Map or a trusted curator.',
  aggregated: 'Aggregated: combined from multiple upstream sources.',
};

function formatTimestamp(value: number | null): string {
  if (value == null) return '—';
  return new Date(value).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function statusCount(feeds: readonly FeedHealth[], status: FeedStatus): number {
  return feeds.reduce((count, feed) => count + (feed.status === status ? 1 : 0), 0);
}

/** Compact source-health HUD. It only renders evaluated health objects; policy and
 * status calculation remain in the pure `feed-health` module. */
export default function FeedHealthPanel({
  feeds,
  title = 'SOURCE HEALTH',
  className = '',
  defaultStatus = 'all',
}: FeedHealthPanelProps) {
  const [filter, setFilter] = useState<FeedStatus | 'all'>(defaultStatus);
  const grouped = useMemo(() => groupFeedHealthByStatus(feeds), [feeds]);
  const visibleStatuses = filter === 'all' ? FEED_STATUS_ORDER : [filter];

  return (
    <section
      aria-label="Data source health"
      className={`w-full max-w-[440px] rounded-xl border border-white/[0.08] bg-black/70 p-3 font-mono text-white shadow-2xl backdrop-blur-2xl ${className}`}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[10px] font-semibold tracking-[0.22em] text-white/70">{title}</h2>
          <p className="mt-0.5 text-[9px] tracking-[0.08em] text-white/30">
            {feeds.length} {feeds.length === 1 ? 'SOURCE' : 'SOURCES'} · deterministic health policy
          </p>
        </div>
        <span
          role="status"
          aria-label={`${statusCount(feeds, 'offline')} offline sources`}
          className="rounded border border-white/[0.08] px-2 py-1 text-[9px] tabular-nums text-white/45"
        >
          {statusCount(feeds, 'offline')} OFF
        </span>
      </div>

      <div role="group" aria-label="Filter sources by status" className="mb-3 flex flex-wrap gap-1">
        {(['all', ...FEED_STATUS_ORDER] as const).map(status => {
          const active = filter === status;
          const count = status === 'all' ? feeds.length : statusCount(feeds, status);
          const meta = status === 'all' ? null : STATUS_META[status];
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              title={meta?.hint ?? 'Show sources of every status.'}
              onClick={() => setFilter(status)}
              className="min-h-7 rounded-md border px-2 text-[9px] tracking-[0.12em] transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
              style={{
                borderColor: active ? (meta?.color ?? 'rgba(255,255,255,0.35)') : 'rgba(255,255,255,0.08)',
                background: active ? (meta ? `${meta.color}14` : 'rgba(255,255,255,0.08)') : 'transparent',
                color: active ? (meta?.color ?? 'rgba(255,255,255,0.85)') : 'rgba(255,255,255,0.38)',
              }}
            >
              {status === 'all' ? 'ALL' : STATUS_META[status].label} {count}
            </button>
          );
        })}
      </div>

      <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
        {visibleStatuses.map(status => {
          const sources = grouped[status];
          if (!sources.length) return null;
          const meta = STATUS_META[status];
          return (
            <section key={status} aria-labelledby={`feed-health-${status}`}>
              <div className="mb-1.5 flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}88` }} />
                <h3 id={`feed-health-${status}`} title={meta.hint} className="text-[9px] tracking-[0.18em] text-white/45">
                  {meta.label} · {sources.length}
                </h3>
              </div>

              <div className="space-y-1.5">
                {sources.map(feed => (
                  <details
                    key={feed.id}
                    className="group rounded-lg border border-white/[0.07] bg-white/[0.025] open:bg-white/[0.04]"
                  >
                    <summary
                      title={feed.explanation}
                      className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-2.5 py-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-white/45 [&::-webkit-details-marker]:hidden"
                    >
                      <span
                        aria-hidden
                        className="h-2 w-2 flex-none rounded-full"
                        style={{ background: meta.color, boxShadow: `0 0 7px ${meta.color}66` }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-medium tracking-wide text-white/75">{feed.name}</span>
                        <span className="mt-0.5 block truncate text-[9px] text-white/30">{feed.id}</span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[10px] tabular-nums" style={{ color: meta.color }}>{formatFeedAge(feed.ageMs)}</span>
                        <span className="block text-[8px] tracking-wider text-white/25">{feed.itemCount.toLocaleString()} ITEMS</span>
                      </span>
                      <span aria-hidden className="text-[10px] text-white/25 transition-transform group-open:rotate-90">›</span>
                    </summary>

                    <div className="border-t border-white/[0.05] px-2.5 py-2.5 text-[9px] text-white/42">
                      <p className="mb-2 leading-relaxed text-white/55">{feed.explanation}</p>
                      <dl className="grid grid-cols-[112px_1fr] gap-x-2 gap-y-1.5">
                        <dt className="text-white/25">LAST ATTEMPT</dt><dd className="break-words tabular-nums">{formatTimestamp(feed.lastAttemptAt)}</dd>
                        <dt className="text-white/25">LAST SUCCESS</dt><dd className="break-words tabular-nums">{formatTimestamp(feed.lastSuccessAt)}</dd>
                        <dt className="text-white/25">DATA AGE</dt><dd className="tabular-nums">{formatFeedAge(feed.ageMs)}</dd>
                        <dt className="text-white/25">LATENCY</dt><dd className="tabular-nums">{feed.latencyMs == null ? '—' : `${Math.round(feed.latencyMs)} ms`}</dd>
                        <dt className="text-white/25">ENTRIES</dt><dd className="tabular-nums">{feed.itemCount.toLocaleString()}</dd>
                        <dt className="text-white/25">COVERAGE</dt><dd className="tabular-nums">{feed.coverage == null ? '—' : `${Math.round(feed.coverage * 100)}%`}</dd>
                        <dt className="text-white/25">TRUST</dt>
                        <dd title={TRUST_HINT[feed.trust]} className="uppercase tracking-wider text-white/55">{feed.trust}</dd>
                        <dt className="text-white/25">SOURCE</dt>
                        <dd className="min-w-0">
                          <a
                            href={feed.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Open source: ${feed.url}`}
                            className="block truncate text-[var(--cyan-primary)]/80 underline decoration-white/20 underline-offset-2 hover:text-[var(--cyan-primary)] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
                          >
                            {feed.url}
                          </a>
                        </dd>
                      </dl>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          );
        })}

        {feeds.length === 0 && (
          <p role="status" className="rounded-lg border border-dashed border-white/[0.08] px-3 py-6 text-center text-[10px] tracking-wider text-white/30">
            NO SOURCE HEALTH DATA
          </p>
        )}
        {feeds.length > 0 && visibleStatuses.every(status => grouped[status].length === 0) && (
          <p role="status" className="rounded-lg border border-dashed border-white/[0.08] px-3 py-6 text-center text-[10px] tracking-wider text-white/30">
            NO SOURCES MATCH THIS FILTER
          </p>
        )}
      </div>
    </section>
  );
}
