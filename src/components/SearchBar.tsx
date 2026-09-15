'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X, MapPin, Navigation, Building2, Globe2, Landmark, TrainFront, Plane, Ship, Siren, RadioTower, Newspaper, Map } from 'lucide-react';

export type SearchCategory = 'places' | 'stations' | 'flights' | 'ships' | 'alerts' | 'infrastructure' | 'news' | 'aois';

interface SearchResult {
  label: string;
  lat: number;
  lng: number;
  type: string;
  category: SearchCategory | 'coordinate';
  zoomLevel: number;
  detail?: string;
}

export interface LoadedSearchItem {
  id: string;
  label: string;
  lat: number;
  lng: number;
  type?: string;
  detail?: string;
  zoomLevel?: number;
  category?: SearchCategory;
}

interface SearchBarProps {
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  alwaysExpanded?: boolean;
  loadedItems?: LoadedSearchItem[];
  variant?: 'default' | 'liquid';
  /** Increment to focus and select this one global search instance. */
  focusToken?: number;
}

const CATEGORY_META: Record<SearchCategory, { label: string; Icon: typeof Search }> = {
  places: { label: 'PLACES', Icon: MapPin },
  stations: { label: 'STATIONS', Icon: TrainFront },
  flights: { label: 'FLIGHTS', Icon: Plane },
  ships: { label: 'SHIPS', Icon: Ship },
  alerts: { label: 'ALERTS', Icon: Siren },
  infrastructure: { label: 'INFRA', Icon: RadioTower },
  news: { label: 'NEWS', Icon: Newspaper },
  aois: { label: 'AOIS', Icon: Map },
};

function getResultIcon(type: string, category: SearchResult['category']) {
  if (category !== 'coordinate' && category !== 'places') {
    const Icon = CATEGORY_META[category].Icon;
    return <Icon className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />;
  }
  if (['address', 'building', 'house', 'poi'].includes(type)) return <Building2 className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />;
  if (['street', 'road'].includes(type)) return <Navigation className="w-3 h-3 text-[var(--alert-green)] flex-shrink-0" />;
  if (['country', 'continent'].includes(type)) return <Globe2 className="w-3 h-3 text-[var(--gold-primary)] flex-shrink-0" />;
  if (['city', 'region'].includes(type)) return <Landmark className="w-3 h-3 text-[#FF9500] flex-shrink-0" />;
  return <MapPin className="w-3 h-3 text-[var(--gold-primary)] flex-shrink-0" />;
}

function formatLabel(label: string): { primary: string; secondary: string } {
  const parts = label.split(',').map(s => s.trim());
  return parts.length <= 1
    ? { primary: parts[0] || '', secondary: '' }
    : { primary: parts.slice(0, 2).join(', '), secondary: parts.slice(2, 4).join(', ') };
}

function parseCoords(value: string): { lat: number; lng: number } | null {
  const match = value.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
  if (!match) return null;
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

/** The map's single global search. Local entities filter immediately; remote
 * geocoding only runs after an explicit Enter search. */
export default function SearchBar({ onLocate, alwaysExpanded = false, loadedItems = [], variant = 'default', focusToken = 0 }: SearchBarProps) {
  const [open, setOpen] = useState(alwaysExpanded);
  const [value, setValue] = useState('');
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [activeCategory, setActiveCategory] = useState<SearchCategory | 'all'>('all');
  const [remoteSearched, setRemoteSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const liquid = variant === 'liquid';

  const results = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    const coordinates = parseCoords(value);
    const localResults: SearchResult[] = query.length < 2 ? [] : loadedItems
      .filter(item => (activeCategory === 'all' || item.category === activeCategory)
        && `${item.label} ${item.detail ?? ''} ${item.type ?? ''}`.toLocaleLowerCase().includes(query))
      .slice(0, 12)
      .map(item => ({ label: item.label, detail: item.detail, lat: item.lat, lng: item.lng, type: item.type || 'loaded entity', category: item.category || 'infrastructure', zoomLevel: item.zoomLevel ?? 12 }));
    const coordinateResult: SearchResult[] = coordinates ? [{ label: `${coordinates.lat.toFixed(4)}, ${coordinates.lng.toFixed(4)}`, detail: 'Coordinates', ...coordinates, type: 'coordinate', category: 'coordinate', zoomLevel: 15 }] : [];
    const visibleRemote = activeCategory === 'all' || activeCategory === 'places' ? remoteResults : [];
    const seen = new Set([...coordinateResult, ...localResults].map(item => `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`));
    return [...coordinateResult, ...localResults, ...visibleRemote.filter(item => !seen.has(`${item.lat.toFixed(5)},${item.lng.toFixed(5)}`))].slice(0, 16);
  }, [activeCategory, loadedItems, remoteResults, value]);

  const availableCategories = useMemo(() => {
    const found = new Set(loadedItems.map(item => item.category).filter((category): category is SearchCategory => Boolean(category)));
    return (Object.keys(CATEGORY_META) as SearchCategory[]).filter(category => found.has(category));
  }, [loadedItems]);

  const focus = useCallback(() => {
    setOpen(true);
    window.setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 50);
  }, []);

  useEffect(() => {
    if (focusToken <= 0) return;
    const timer = window.setTimeout(focus, 0);
    return () => window.clearTimeout(timer);
  }, [focus, focusToken]);
  useEffect(() => { if (open) window.setTimeout(() => inputRef.current?.focus(), 50); }, [open]);
  useEffect(() => {
    if (!open || alwaysExpanded) return;
    const handler = (event: MouseEvent) => { if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [alwaysExpanded, open]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setValue(''); setRemoteResults([]); setRemoteSearched(false); setSelectedIdx(-1); setLoading(false);
  }, []);

  const runRemoteSearch = useCallback(async () => {
    const query = value.trim();
    if (query.length < 2 || parseCoords(query)) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true); setRemoteSearched(true);
    try {
      const language = navigator.language || 'en';
      const response = await fetch(`/api/geosearch?q=${encodeURIComponent(query)}&lang=${encodeURIComponent(language)}&includeNominatim=1`, { signal: controller.signal });
      const payload: { results?: Array<{ name: string; context: string; lat: number; lng: number; kind: string }> } = await response.json();
      if (controller.signal.aborted) return;
      setRemoteResults((payload.results || []).map(result => ({
        label: result.name, detail: result.context, lat: result.lat, lng: result.lng, type: result.kind, category: 'places' as const,
        zoomLevel: result.kind === 'country' ? 5 : result.kind === 'region' ? 8 : result.kind === 'city' ? 12 : 15,
      })));
      setActiveCategory('all'); setSelectedIdx(-1);
    } catch {
      if (!controller.signal.aborted) setRemoteResults([]);
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [value]);

  const handleSelect = useCallback((result: SearchResult) => {
    onLocate(result.lat, result.lng, result.zoomLevel);
    if (!alwaysExpanded) setOpen(false);
    clear();
  }, [alwaysExpanded, clear, onLocate]);

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault(); if (!alwaysExpanded) setOpen(false); clear(); inputRef.current?.blur(); return;
    }
    if (event.key === 'ArrowDown') { event.preventDefault(); setSelectedIdx(index => Math.min(index + 1, results.length - 1)); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); setSelectedIdx(index => Math.max(index - 1, 0)); return; }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < results.length) handleSelect(results[selectedIdx]);
      else if (parseCoords(value)) handleSelect(results[0]);
      else if (remoteSearched && remoteResults.length > 0) handleSelect(remoteResults[0]);
      else void runRemoteSearch();
    }
  };

  if (!open && !alwaysExpanded) return <button onClick={focus} className="flex items-center gap-1.5 glass-panel-sm px-3 py-2 text-[10px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--gold-primary)] transition-all"><Search className="w-3 h-3" />GLOBAL SEARCH</button>;

  return (
    <div className="relative w-full" ref={containerRef}>
      <div className={`flex items-center gap-2 glass-panel px-3 py-2.5 !border-[var(--border-active)] transition-all ${liquid ? '!rounded-full !border-white/15 bg-[linear-gradient(110deg,rgba(255,255,255,0.14),rgba(255,255,255,0.035)_42%,rgba(80,217,255,0.1))] backdrop-blur-2xl shadow-[0_10px_34px_rgba(0,0,0,0.25)]' : ''}`}>
        <Search className="w-3.5 h-3.5 text-[var(--gold-primary)] flex-shrink-0" />
        <input ref={inputRef} value={value} onChange={(event) => { setValue(event.target.value); setRemoteResults([]); setRemoteSearched(false); setSelectedIdx(-1); }} onKeyDown={handleKeyDown} placeholder={liquid ? 'GLOBAL SEARCH — PLACES & LIVE ENTITIES...' : 'SEARCH PLACES, ENTITIES, OR COORDINATES...'} aria-label="Global search" className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] font-mono tracking-wider outline-none placeholder:text-[var(--text-muted)]" autoComplete="off" spellCheck={false} />
        {loading && <div className="w-3 h-3 border border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin" />}
        <span className="text-[9px] text-[var(--text-muted)] font-mono opacity-50 hidden md:inline">CTRL+K</span>
        {(value || !alwaysExpanded) && <button onClick={() => { if (alwaysExpanded) clear(); else { setOpen(false); clear(); } }} aria-label="Clear search" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="w-3 h-3" /></button>}
      </div>

      {value.trim().length >= 2 && <div className={`absolute top-full left-0 right-0 mt-1 glass-panel overflow-hidden max-h-[360px] overflow-y-auto styled-scrollbar z-[9999] ${liquid ? 'rounded-2xl border-white/15' : ''}`}>
        <div className="flex gap-1 overflow-x-auto px-2 py-2 border-b border-[var(--border-secondary)]">
          <button onClick={() => setActiveCategory('all')} className={`px-2 py-1 rounded text-[9px] font-mono ${activeCategory === 'all' ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>ALL</button>
          <button onClick={() => setActiveCategory('places')} className={`px-2 py-1 rounded text-[9px] font-mono ${activeCategory === 'places' ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>PLACES</button>
          {availableCategories.map(category => <button key={category} onClick={() => setActiveCategory(category)} className={`px-2 py-1 rounded text-[9px] font-mono ${activeCategory === category ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}`}>{CATEGORY_META[category].label}</button>)}
        </div>
        {results.map((result, index) => {
          const { primary, secondary } = formatLabel(result.label);
          const selected = index === selectedIdx;
          return <button key={`${result.category}-${result.lat}-${result.lng}-${index}`} onClick={() => handleSelect(result)} onMouseEnter={() => setSelectedIdx(index)} className={`w-full text-left px-3 py-2.5 transition-colors border-b border-[var(--border-secondary)] last:border-0 flex items-start gap-2.5 ${selected ? 'bg-[rgba(212,175,55,0.08)]' : 'hover:bg-[var(--hover-accent)]'}`}>
            <div className="mt-0.5">{getResultIcon(result.type, result.category)}</div>
            <div className="flex-1 min-w-0"><div className="text-[11px] text-[var(--text-primary)] font-mono truncate leading-tight">{primary}</div>{(result.detail || secondary) && <div className="text-[9px] text-[var(--text-muted)] font-mono truncate mt-0.5">{result.detail || secondary}</div>}</div>
            <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{result.category === 'coordinate' ? 'COORDS' : CATEGORY_META[result.category].label}</span>
          </button>;
        })}
        {!loading && results.length === 0 && <div className="px-3 py-3 text-[10px] font-mono text-[var(--text-muted)]">{remoteSearched ? 'NO MATCHES FOUND' : 'PRESS ENTER TO SEARCH PLACES OUTSIDE THE LOADED MAP DATA'}</div>}
        {!loading && !remoteSearched && !parseCoords(value) && <button onClick={() => void runRemoteSearch()} className="w-full px-3 py-2 text-left text-[10px] font-mono text-[var(--gold-primary)] hover:bg-[var(--hover-accent)]">PRESS ENTER TO SEARCH PLACES</button>}
      </div>}
    </div>
  );
}
