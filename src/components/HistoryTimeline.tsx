'use client';

import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  compareHistorySnapshots,
  type HistorySnapshot,
  type SnapshotComparison,
} from '@/lib/history-snapshots';

export interface HistoryTimelineProps {
  snapshots: readonly HistorySnapshot[];
  /** Snapshot currently applied to the map, if any. */
  activeSnapshotId?: string | null;
  /** Caller applies map/layer/event state from the selected snapshot. */
  onReplay: (snapshot: HistorySnapshot) => void;
  onDelete?: (snapshot: HistorySnapshot) => void;
  onCompare?: (comparison: SnapshotComparison, before: HistorySnapshot, after: HistorySnapshot) => void;
  title?: string;
  className?: string;
}

function entityTotal(snapshot: HistorySnapshot): number {
  return Object.values(snapshot.entities).reduce((sum, domain) => sum + domain.count, 0);
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatElapsed(ms: number): string {
  const absolute = Math.abs(ms);
  if (absolute < 60_000) return `${Math.round(absolute / 1000)}s`;
  if (absolute < 3_600_000) return `${Math.round(absolute / 60_000)}m`;
  if (absolute < 86_400_000) return `${(absolute / 3_600_000).toFixed(1)}h`;
  return `${(absolute / 86_400_000).toFixed(1)}d`;
}

function totalEntityDelta(comparison: SnapshotComparison): number {
  return Object.values(comparison.entities).reduce((sum, domain) => sum + domain.delta, 0);
}

/**
 * Compact replay/timeline UI. The component does not own map state or storage;
 * callbacks keep it usable from the dashboard, a modal, or a future replay view.
 */
export default function HistoryTimeline({
  snapshots,
  activeSnapshotId = null,
  onReplay,
  onDelete,
  onCompare,
  title = 'HISTORY / REPLAY',
  className = '',
}: HistoryTimelineProps) {
  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => b.capturedAt - a.capturedAt || a.id.localeCompare(b.id)),
    [snapshots],
  );
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparison, setComparison] = useState<SnapshotComparison | null>(null);
  const replayRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const compareSnapshots = useMemo(
    () => compareIds
      .map(id => ordered.find(snapshot => snapshot.id === id))
      .filter((snapshot): snapshot is HistorySnapshot => Boolean(snapshot)),
    [compareIds, ordered],
  );

  const toggleCompare = (id: string) => {
    setComparison(null);
    setCompareIds(current => {
      if (current.includes(id)) return current.filter(value => value !== id);
      if (current.length < 2) return [...current, id];
      return [current[1], id];
    });
  };

  const runComparison = () => {
    if (compareSnapshots.length !== 2) return;
    const [first, second] = [...compareSnapshots].sort((a, b) => a.capturedAt - b.capturedAt);
    const next = compareHistorySnapshots(first, second);
    setComparison(next);
    onCompare?.(next, first, second);
  };

  const handleReplayKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let target: number | null = null;
    if (event.key === 'ArrowDown') target = Math.min(ordered.length - 1, index + 1);
    if (event.key === 'ArrowUp') target = Math.max(0, index - 1);
    if (event.key === 'Home') target = 0;
    if (event.key === 'End') target = ordered.length - 1;
    if (target == null || target === index) return;
    event.preventDefault();
    replayRefs.current[target]?.focus();
  };

  return (
    <section
      aria-label="Historical snapshots and replay"
      className={`w-full max-w-[460px] rounded-xl border border-white/[0.08] bg-black/70 p-3 font-mono text-white shadow-2xl backdrop-blur-2xl ${className}`}
    >
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-[10px] font-semibold tracking-[0.22em] text-white/70">{title}</h2>
          <p className="mt-0.5 text-[9px] tracking-[0.08em] text-white/30">
            {ordered.length} {ordered.length === 1 ? 'SNAPSHOT' : 'SNAPSHOTS'} · newest first
          </p>
        </div>
        <button
          type="button"
          onClick={runComparison}
          disabled={compareSnapshots.length !== 2}
          title={compareSnapshots.length === 2 ? 'Compare the two selected snapshots.' : 'Select two snapshots to compare.'}
          className="min-h-8 rounded-md border border-white/[0.10] px-2.5 text-[9px] tracking-[0.12em] text-white/55 transition-colors enabled:hover:border-[var(--cyan-primary)]/50 enabled:hover:text-[var(--cyan-primary)] disabled:cursor-not-allowed disabled:opacity-30 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
        >
          COMPARE {compareSnapshots.length}/2
        </button>
      </div>

      {comparison && (
        <div role="status" className="mb-3 rounded-lg border border-[var(--cyan-primary)]/20 bg-[var(--cyan-primary)]/[0.04] p-2.5 text-[9px] text-white/45">
          <div className="flex items-center justify-between gap-2">
            <span className="tracking-[0.14em] text-[var(--cyan-primary)]/80">COMPARISON</span>
            <span className="tabular-nums">Δ {totalEntityDelta(comparison) >= 0 ? '+' : ''}{totalEntityDelta(comparison)} ENTITIES</span>
          </div>
          <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <span>WINDOW</span><span className="text-right tabular-nums">{formatElapsed(comparison.elapsedMs)}</span>
            <span>LAYERS</span><span className="text-right tabular-nums">+{comparison.layers.added.length} / -{comparison.layers.removed.length}</span>
            <span>MAP MOVED</span><span className="text-right">{comparison.map.changed ? 'YES' : 'NO'}</span>
          </div>
        </div>
      )}

      <ol aria-label="Snapshot timeline" className="max-h-[540px] space-y-1.5 overflow-y-auto pr-1">
        {ordered.map((snapshot, index) => {
          const active = snapshot.id === activeSnapshotId;
          const compareSelected = compareIds.includes(snapshot.id);
          const total = entityTotal(snapshot);
          return (
            <li key={snapshot.id} className="relative pl-4">
              {index < ordered.length - 1 && (
                <span aria-hidden className="absolute left-[5px] top-6 bottom-[-8px] w-px bg-white/[0.08]" />
              )}
              <span
                aria-hidden
                className="absolute left-[2px] top-[19px] h-[7px] w-[7px] rounded-full border border-white/20"
                style={{
                  background: active ? 'var(--cyan-primary)' : 'rgba(255,255,255,0.12)',
                  boxShadow: active ? '0 0 8px var(--cyan-primary)' : 'none',
                }}
              />

              <article
                className="rounded-lg border bg-white/[0.025] transition-colors"
                style={{ borderColor: active ? 'color-mix(in srgb, var(--cyan-primary) 45%, transparent)' : 'rgba(255,255,255,0.07)' }}
              >
                <div className="flex items-stretch gap-1 p-1">
                  <button
                    ref={(element: HTMLButtonElement | null) => { replayRefs.current[index] = element; }}
                    type="button"
                    onClick={() => onReplay(snapshot)}
                    onKeyDown={(event: KeyboardEvent<HTMLButtonElement>) => handleReplayKey(event, index)}
                    aria-current={active ? 'true' : undefined}
                    aria-label={`Replay snapshot from ${formatTime(snapshot.capturedAt)}`}
                    title="Replay this snapshot on the map. Arrow keys move through the timeline."
                    className="min-w-0 flex-1 rounded-md px-2 py-2 text-left hover:bg-white/[0.04] focus:outline-none focus-visible:ring-1 focus-visible:ring-white/55"
                  >
                    <span className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-[10px] tabular-nums text-white/72">{formatTime(snapshot.capturedAt)}</span>
                      {active && <span className="text-[8px] tracking-[0.12em] text-[var(--cyan-primary)]">ACTIVE</span>}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[8px] tracking-[0.08em] text-white/28">
                      <span>{snapshot.activeLayers.length} LAYERS</span>
                      <span>{total.toLocaleString()} ENTITIES</span>
                      <span>Z{snapshot.map.zoom.toFixed(1)}</span>
                      {snapshot.aoiRefs?.length ? <span>{snapshot.aoiRefs.length} AOI</span> : null}
                    </span>
                  </button>

                  <button
                    type="button"
                    aria-pressed={compareSelected}
                    aria-label={`${compareSelected ? 'Remove' : 'Add'} snapshot ${index + 1} ${compareSelected ? 'from' : 'to'} comparison`}
                    title={compareSelected ? 'Remove from comparison.' : 'Select for two-snapshot comparison.'}
                    onClick={() => toggleCompare(snapshot.id)}
                    className="w-9 rounded-md border border-transparent text-[9px] tracking-wider text-white/30 hover:bg-white/[0.05] hover:text-white/70 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/55"
                    style={compareSelected ? {
                      borderColor: 'color-mix(in srgb, var(--gold-primary) 45%, transparent)',
                      background: 'color-mix(in srgb, var(--gold-primary) 8%, transparent)',
                      color: 'var(--gold-primary)',
                    } : undefined}
                  >
                    {compareSelected ? String(compareIds.indexOf(snapshot.id) + 1) : '±'}
                  </button>

                  {onDelete && (
                    <button
                      type="button"
                      onClick={() => onDelete(snapshot)}
                      aria-label={`Delete snapshot from ${formatTime(snapshot.capturedAt)}`}
                      title="Delete this stored snapshot."
                      className="w-9 rounded-md text-[9px] tracking-wider text-white/22 hover:bg-[#FF3D57]/10 hover:text-[#FF3D57] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#FF3D57]/70"
                    >
                      DEL
                    </button>
                  )}
                </div>

                {(snapshot.events.selected.length > 0 || snapshot.events.highlighted.length > 0) && (
                  <div className="border-t border-white/[0.05] px-3 py-1.5 text-[8px] tracking-[0.08em] text-white/25">
                    {snapshot.events.selected.length} SELECTED · {snapshot.events.highlighted.length} HIGHLIGHTED
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ol>

      {ordered.length === 0 && (
        <p role="status" className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-[10px] tracking-wider text-white/30">
          NO HISTORY SNAPSHOTS
        </p>
      )}

      {ordered.length > 0 && (
        <p className="mt-2 text-[8px] leading-relaxed text-white/20">
          Replay restores captured state through the caller. Identity-level arrivals/departures require stable IDs in both snapshots.
        </p>
      )}
    </section>
  );
}
