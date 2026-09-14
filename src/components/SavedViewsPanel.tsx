'use client';

import { useState } from 'react';
import { BookmarkPlus, MapPinned, Play, Trash2 } from 'lucide-react';
import { createSavedView, removeSavedView, storeSavedViews, upsertSavedView, type SavedView, type SavedViewState } from '@/lib/saved-views';

interface SavedViewsPanelProps {
  current: SavedViewState;
  views: readonly SavedView[];
  onViewsChange: (views: SavedView[]) => void;
  onApply: (view: SavedView) => void;
  activeViewId?: string | null;
}

export default function SavedViewsPanel({ current, views, onViewsChange, onApply, activeViewId = null }: SavedViewsPanelProps) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) { setMessage('Enter a name for this view.'); return; }
    try {
      const next = upsertSavedView(views, createSavedView(trimmed, current));
      if (!storeSavedViews(next)) { setMessage('Browser storage is unavailable.'); return; }
      onViewsChange(next);
      setName('');
      setMessage(`Saved “${trimmed}”.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save view.');
    }
  };

  const remove = (id: string) => {
    const next = removeSavedView(views, id);
    if (storeSavedViews(next)) onViewsChange(next);
  };

  return (
    <section aria-label="Saved situational views" className="glass-panel p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <MapPinned className="h-3.5 w-3.5 text-[var(--gold-primary)]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[10px] font-mono tracking-[0.2em] text-white/75">SAVED VIEWS</h2>
          <p className="text-[9px] font-mono text-white/30">Map, layers, theme, AOIs and tripwires</p>
        </div>
        <span className="text-[9px] font-mono text-white/35">{views.length}/24</span>
      </div>

      <div className="flex gap-1.5">
        <input
          value={name}
          onChange={event => setName(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') save(); }}
          maxLength={80}
          placeholder="Name this operational view…"
          aria-label="Saved view name"
          className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/45 px-2.5 py-2 text-[10px] font-mono text-white/80 outline-none placeholder:text-white/25 focus:border-[var(--gold-primary)]/50"
        />
        <button type="button" onClick={save} className="inline-flex items-center gap-1 rounded-md border border-[var(--gold-primary)]/35 bg-[var(--gold-primary)]/10 px-2.5 text-[9px] font-mono text-[var(--gold-primary)] hover:bg-[var(--gold-primary)]/20">
          <BookmarkPlus className="h-3 w-3" /> SAVE
        </button>
      </div>
      {message && <p role="status" className="mt-1.5 text-[9px] font-mono text-white/40">{message}</p>}

      <div className="mt-3 max-h-[430px] space-y-1.5 overflow-y-auto pr-1 styled-scrollbar">
        {views.map(view => {
          const active = view.id === activeViewId;
          return (
            <article key={view.id} className={`rounded-lg border p-2 ${active ? 'border-[var(--gold-primary)]/45 bg-[var(--gold-primary)]/[0.06]' : 'border-white/[0.07] bg-white/[0.025]'}`}>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => onApply(view)} className="min-w-0 flex-1 text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold-primary)]">
                  <span className="block truncate text-[11px] font-mono text-white/75">{view.name}</span>
                  <span className="mt-0.5 block text-[8px] font-mono text-white/28">
                    {Object.values(view.activeLayers).filter(Boolean).length} LAYERS · {view.polygons.length} AOI · Z{view.zoom.toFixed(1)}
                  </span>
                </button>
                <button type="button" onClick={() => onApply(view)} title={`Apply ${view.name}`} aria-label={`Apply ${view.name}`} className="rounded p-1.5 text-[var(--cyan-primary)] hover:bg-white/[0.06]"><Play className="h-3 w-3" /></button>
                <button type="button" onClick={() => remove(view.id)} title={`Delete ${view.name}`} aria-label={`Delete ${view.name}`} className="rounded p-1.5 text-white/25 hover:bg-red-500/10 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
              </div>
            </article>
          );
        })}
        {views.length === 0 && <p className="rounded-lg border border-dashed border-white/[0.08] px-3 py-8 text-center text-[10px] font-mono text-white/30">NO SAVED VIEWS</p>}
      </div>
    </section>
  );
}
