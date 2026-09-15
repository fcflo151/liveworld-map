'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Search, X, MapPin, Navigation, Building2, Globe2, Landmark, Satellite } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   LiveWorld Map — Enhanced Search / Locate Bar
   Street-level geocoding + loaded entities + lightweight ISS lookup
   Ctrl+F / Cmd+F keyboard shortcut support
   ═══════════════════════════════════════════════════════════════ */

interface SearchResult {
  label: string;
  lat: number;
  lng: number;
  type: string;
  importance: number;
  category: string;
  zoomLevel: number;
  entityId?: string;
}

export interface LoadedSearchItem {
  id: string;
  label: string;
  lat: number;
  lng: number;
  type?: string;
  detail?: string;
  zoomLevel?: number;
}

interface SearchBarProps {
  onLocate: (lat: number, lng: number, zoom?: number) => void;
  alwaysExpanded?: boolean;
  loadedItems?: LoadedSearchItem[];
  variant?: 'default' | 'liquid';
}

function getZoomForType(type: string, category: string, boundingbox?: string[]): number {
  if (boundingbox && boundingbox.length === 4) {
    const latDiff = Math.abs(parseFloat(boundingbox[1]) - parseFloat(boundingbox[0]));
    const lngDiff = Math.abs(parseFloat(boundingbox[3]) - parseFloat(boundingbox[2]));
    const maxDiff = Math.max(latDiff, lngDiff);
    if (maxDiff < 0.002) return 19;
    if (maxDiff < 0.01) return 17;
    if (maxDiff < 0.05) return 15;
    if (maxDiff < 0.2) return 13;
    if (maxDiff < 1) return 11;
    if (maxDiff < 5) return 8;
    if (maxDiff < 20) return 6;
    return 4;
  }

  if (['house', 'building', 'address', 'shop', 'amenity', 'office'].includes(type)) return 18;
  if (['road', 'street', 'highway', 'path', 'residential', 'tertiary', 'secondary', 'primary'].includes(type)) return 17;
  if (['neighbourhood', 'quarter', 'suburb', 'hamlet', 'isolated_dwelling'].includes(type)) return 15;
  if (['village', 'town', 'borough'].includes(type)) return 14;
  if (['city', 'municipality'].includes(type)) return 12;
  if (['county', 'state_district', 'state', 'province'].includes(type)) return 8;
  if (type === 'country') return 5;
  if (type === 'continent') return 3;
  if (category === 'boundary') return 8;
  if (category === 'place') return 13;
  if (category === 'highway') return 17;
  if (category === 'building') return 18;
  if (category === 'amenity') return 17;
  return 13;
}

function getResultIcon(type: string, category: string) {
  if (category === 'satellite') {
    return <Satellite className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />;
  }
  if (['house', 'building', 'address', 'shop', 'amenity', 'office'].includes(type) || category === 'building') {
    return <Building2 className="w-3 h-3 text-[var(--cyan-primary)] flex-shrink-0" />;
  }
  if (['road', 'street', 'highway', 'path'].includes(type) || category === 'highway') {
    return <Navigation className="w-3 h-3 text-[var(--alert-green)] flex-shrink-0" />;
  }
  if (['country', 'continent', 'state'].includes(type)) {
    return <Globe2 className="w-3 h-3 text-[var(--gold-primary)] flex-shrink-0" />;
  }
  if (['city', 'town', 'village', 'municipality'].includes(type)) {
    return <Landmark className="w-3 h-3 text-[#FF9500] flex-shrink-0" />;
  }
  return <MapPin className="w-3 h-3 text-[var(--gold-primary)] flex-shrink-0" />;
}

function formatLabel(displayName: string): { primary: string; secondary: string } {
  const parts = displayName.split(',').map(s => s.trim());
  if (parts.length <= 1) return { primary: parts[0] || '', secondary: '' };
  return {
    primary: parts.slice(0, 2).join(', '),
    secondary: parts.slice(2, 4).join(', '),
  };
}

function isIssQuery(value: string): boolean {
  const query = value.trim().toLocaleLowerCase();
  return query === 'iss' ||
    query === '25544' ||
    query === 'iss zarya' ||
    query === 'iss (zarya)' ||
    query.includes('international space station');
}

/**
 * The layer panel owns layer state today. Until search and layers share a
 * central entity registry, focus the existing SPACE control when an ISS search
 * result is selected. Failure is harmless: the map still flies to the current
 * ISS sub-point and the user can enable the layer manually.
 */
function requestScienceSatelliteLayer() {
  if (typeof document === 'undefined') return;

  const clickScienceLayer = () => {
    const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Stations / Telescopes"]');
    if (toggle && toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
    return Boolean(toggle);
  };

  if (clickScienceLayer()) return;

  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('button[aria-label]'));
  const spaceGroup = buttons.find(button => button.getAttribute('aria-label')?.startsWith('SPACE TRACKING'));
  if (!spaceGroup) return;

  if (spaceGroup.getAttribute('aria-expanded') !== 'true') spaceGroup.click();
  window.setTimeout(clickScienceLayer, 120);
}

export default function SearchBar({ onLocate, alwaysExpanded = false, loadedItems = [], variant = 'default' }: SearchBarProps) {
  const [open, setOpen] = useState(alwaysExpanded);
  const [value, setValue] = useState('');
  const [remoteResults, setRemoteResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const liquid = variant === 'liquid';

  const results = useMemo(() => {
    const query = value.trim().toLocaleLowerCase();
    const localResults: SearchResult[] = query.length < 2 ? [] : loadedItems
      .filter(item => `${item.label} ${item.detail ?? ''} ${item.type ?? ''}`.toLocaleLowerCase().includes(query))
      .slice(0, 8)
      .map(item => ({
        label: item.detail ? `${item.label}, ${item.detail}` : item.label,
        lat: item.lat,
        lng: item.lng,
        type: item.type || 'loaded entity',
        importance: 1,
        category: 'loaded',
        zoomLevel: item.zoomLevel ?? 12,
        entityId: item.id,
      }));

    const seen = new Set(localResults.map(item => `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`));
    return [
      ...localResults,
      ...remoteResults.filter(item => !seen.has(`${item.lat.toFixed(5)},${item.lng.toFixed(5)}`)),
    ].slice(0, 12);
  }, [loadedItems, remoteResults, value]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        e.stopPropagation();
        setOpen(true);
        setTimeout(() => {
          inputRef.current?.focus();
          inputRef.current?.select();
        }, 50);
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    if (!open || alwaysExpanded) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setRemoteResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, alwaysExpanded]);

  const parseCoords = (s: string): { lat: number; lng: number } | null => {
    const match = s.trim().match(/^([+-]?\d+\.?\d*)[,\s]+([+-]?\d+\.?\d*)$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
    return null;
  };

  const handleSearch = useCallback(async (q: string) => {
    setValue(q);
    setSelectedIdx(-1);

    const coords = parseCoords(q);
    if (coords) {
      setRemoteResults([{
        label: `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`,
        ...coords,
        type: 'coordinate',
        importance: 1,
        category: 'coordinate',
        zoomLevel: 15,
      }]);
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    if (q.trim().length < 2) {
      setRemoteResults([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    timerRef.current = setTimeout(async () => {
      setLoading(true);

      const placePromise = fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=8&addressdetails=1&extratags=1`,
        { headers: { 'Accept-Language': 'en' } },
      ).then(async response => {
        if (!response.ok) return [] as SearchResult[];
        const data = await response.json() as Array<{
          display_name: string;
          lat: string;
          lon: string;
          type?: string;
          importance?: number;
          class?: string;
          boundingbox?: string[];
        }>;
        return data.map(result => ({
          label: result.display_name,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          type: result.type || 'unknown',
          importance: result.importance || 0,
          category: result.class || 'unknown',
          zoomLevel: getZoomForType(result.type || 'unknown', result.class || 'unknown', result.boundingbox),
        }));
      }).catch(() => [] as SearchResult[]);

      const issPromise = isIssQuery(q)
        ? fetch('/api/iss', { cache: 'no-store' })
          .then(async response => {
            if (!response.ok) return null;
            const payload = await response.json() as {
              satellite?: { name?: string; lat?: number; lng?: number; alt?: number; noradId?: string };
            };
            const satellite = payload.satellite;
            if (!satellite || !Number.isFinite(satellite.lat) || !Number.isFinite(satellite.lng)) return null;
            return {
              label: `${satellite.name || 'ISS (ZARYA)'}, International Space Station · ${Math.round(satellite.alt ?? 0)} km`,
              lat: satellite.lat!,
              lng: satellite.lng!,
              type: 'ISS',
              importance: 2,
              category: 'satellite',
              zoomLevel: 4,
              entityId: satellite.noradId || '25544',
            } satisfies SearchResult;
          }).catch(() => null)
        : Promise.resolve(null);

      const [places, iss] = await Promise.all([placePromise, issPromise]);
      if (requestId !== requestIdRef.current) return;

      setRemoteResults(iss ? [iss, ...places] : places);
      setLoading(false);
    }, 300);
  }, []);

  const handleSelect = (result: SearchResult) => {
    if (result.category === 'satellite' && result.entityId === '25544') {
      requestScienceSatelliteLayer();
    }
    onLocate(result.lat, result.lng, result.zoomLevel);
    if (!alwaysExpanded) setOpen(false);
    setValue('');
    setRemoteResults([]);
    setSelectedIdx(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (alwaysExpanded) {
        setValue('');
        setRemoteResults([]);
        inputRef.current?.blur();
      } else {
        setOpen(false);
        setValue('');
        setRemoteResults([]);
      }
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(index => Math.min(index + 1, results.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(index => Math.max(index - 1, 0));
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIdx >= 0 && selectedIdx < results.length) handleSelect(results[selectedIdx]);
      else if (results.length > 0) handleSelect(results[0]);
    }
  };

  if (!open && !alwaysExpanded) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 glass-panel-sm px-3 py-2 text-[10px] font-mono tracking-[0.15em] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:border-[var(--border-active)] transition-all hover:shadow-[0_0_12px_rgba(212,175,55,0.08)]"
      >
        <Search className="w-3 h-3" />
        CMD: LOCATE
      </button>
    );
  }

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`flex items-center gap-2 glass-panel px-3 py-2.5 !border-[var(--border-active)] transition-all ${liquid ? '!rounded-full !border-white/15 bg-[linear-gradient(110deg,rgba(255,255,255,0.14),rgba(255,255,255,0.035)_42%,rgba(80,217,255,0.1))] backdrop-blur-2xl shadow-[0_10px_34px_rgba(0,0,0,0.25)]' : ''}`}
        style={{ boxShadow: liquid ? '0 10px 34px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.16)' : '0 0 20px rgba(212,175,55,0.05), inset 0 0 20px rgba(0,0,0,0.2)' }}
      >
        <Search className="w-3.5 h-3.5 text-[var(--gold-primary)] flex-shrink-0" />
        <input
          ref={inputRef}
          value={value}
          onChange={e => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={liquid ? 'SEARCH PLACES, ISS & LOADED ENTITIES...' : 'SEARCH ADDRESS, CITY, ISS, OR COORDINATES...'}
          className="flex-1 bg-transparent text-[11px] text-[var(--text-primary)] font-mono tracking-wider outline-none placeholder:text-[var(--text-muted)]"
          autoComplete="off"
          spellCheck={false}
        />
        {loading && <div className="w-3 h-3 border border-[var(--gold-primary)] border-t-transparent rounded-full animate-spin" />}
        <span className="text-[9px] text-[var(--text-muted)] font-mono opacity-50 hidden md:inline">CTRL+F</span>
        {(value || !alwaysExpanded) && (
          <button
            onClick={() => {
              if (alwaysExpanded) {
                setValue('');
                setRemoteResults([]);
              } else {
                setOpen(false);
                setValue('');
                setRemoteResults([]);
              }
            }}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {results.length > 0 && (
        <div
          className={`absolute top-full left-0 right-0 mt-1 glass-panel overflow-hidden max-h-[320px] overflow-y-auto styled-scrollbar z-[9999] ${liquid ? 'rounded-2xl border-white/15' : ''}`}
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 1px rgba(212,175,55,0.2)' }}
        >
          {results.map((result, index) => {
            const { primary, secondary } = formatLabel(result.label);
            const isSelected = index === selectedIdx;
            return (
              <button
                key={`${result.category}-${result.entityId ?? index}-${result.lat}-${result.lng}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIdx(index)}
                className={`w-full text-left px-3 py-2.5 transition-colors border-b border-[var(--border-secondary)] last:border-0 flex items-start gap-2.5 ${isSelected ? 'bg-[rgba(212,175,55,0.08)]' : 'hover:bg-[var(--hover-accent)]'}`}
              >
                <div className="mt-0.5">{getResultIcon(result.type, result.category)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] text-[var(--text-primary)] font-mono truncate leading-tight">{primary}</div>
                  {secondary && (
                    <div className="text-[9px] text-[var(--text-muted)] font-mono truncate mt-0.5">{secondary}</div>
                  )}
                </div>
                <div className="flex flex-col items-end flex-shrink-0">
                  <span className="text-[9px] text-[var(--text-muted)] font-mono uppercase tracking-wider">
                    {result.category === 'satellite'
                      ? 'LIVE SAT'
                      : result.category === 'loaded'
                        ? 'LOADED'
                        : result.type === 'coordinate'
                          ? 'COORDS'
                          : result.type}
                  </span>
                  <span className="text-[9px] text-[var(--gold-primary)] font-mono opacity-40">
                    Z{result.zoomLevel}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
