'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Train, Clock, AlertTriangle, CheckCircle2, RefreshCw, X, MapPin, Users, Compass, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import type { StationData } from '@/app/api/trains/stations/route';
import type { LiveDeparture } from '@/app/api/trains/departures/route';

interface TrainStationPanelProps {
  station: StationData | null;
  onClose: () => void;
  onFocusCoordinates?: (lat: number, lng: number) => void;
}

export default function TrainStationPanel({ station, onClose, onFocusCoordinates }: TrainStationPanelProps) {
  const [departures, setDepartures] = useState<LiveDeparture[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'ICE' | 'REGIONAL' | 'S'>('ALL');
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);

  const fetchDepartures = useCallback(async (stationName: string, stationId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trains/departures?station=${encodeURIComponent(stationName)}&eva=${encodeURIComponent(stationId || '')}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setDepartures(data.departures || []);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      setError('Live-Abfahrtsdaten vorübergehend nicht erreichbar');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!station) return;
    fetchDepartures(station.name, station.id);

    // Auto refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDepartures(station.name, station.id);
    }, 30_000);

    return () => clearInterval(interval);
  }, [station, fetchDepartures]);

  const filteredDepartures = useMemo(() => {
    if (filter === 'ALL') return departures;
    if (filter === 'ICE') {
      return departures.filter(d => ['ICE', 'TGV', 'EC', 'IC'].includes(d.category));
    }
    if (filter === 'REGIONAL') {
      return departures.filter(d => ['RE', 'RB', 'REGIONAL'].includes(d.category));
    }
    if (filter === 'S') {
      return departures.filter(d => d.category === 'S');
    }
    return departures;
  }, [departures, filter]);

  // Overall punctuality metric
  const punctuality = useMemo(() => {
    if (departures.length === 0) return 100;
    const onTime = departures.filter(d => !d.cancelled && d.delayMinutes <= 3).length;
    return Math.round((onTime / departures.length) * 100);
  }, [departures]);

  if (!station) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        className="fixed top-14 right-4 z-40 w-[380px] max-w-[calc(100vw-2rem)] rounded-xl border border-[var(--cyan-primary)]/30 bg-[#060b13]/92 backdrop-blur-xl shadow-2xl shadow-cyan-950/40 text-white font-mono flex flex-col overflow-hidden"
        style={{ maxHeight: isMinimized ? 'auto' : 'calc(100vh - 6rem)' }}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--cyan-primary)]/15 border border-[var(--cyan-primary)]/40 flex items-center justify-center text-[var(--cyan-primary)] shrink-0">
              <Train className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate tracking-wide text-white">{station.name}</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] font-semibold uppercase border border-[var(--gold-primary)]/30 shrink-0">
                  {station.country}
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate flex items-center gap-1.5">
                <span>{station.city}</span>
                <span>•</span>
                <span>{station.tracks} Gleise</span>
                {station.operator && (
                  <>
                    <span>•</span>
                    <span className="text-[var(--cyan-primary)]/80">{station.operator}</span>
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={() => fetchDepartures(station.name, station.id)}
              disabled={loading}
              title="Aktualisieren"
              className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-[var(--cyan-primary)] transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[var(--cyan-primary)]' : ''}`} />
            </button>
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1.5 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            >
              {isMinimized ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <button
              onClick={onClose}
              title="Schließen"
              className="p-1.5 rounded hover:bg-red-500/20 text-white/70 hover:text-red-400 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Station Intel KPIs */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-white/[0.015] border-b border-white/10 text-[11px]">
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
                <span className="text-white/40 text-[10px] uppercase flex items-center gap-1">
                  <Users className="w-3 h-3 text-[var(--cyan-primary)]" />
                  Passagiere
                </span>
                <span className="font-semibold text-white mt-0.5 text-xs">{station.dailyPassengers || '—'} / Tag</span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
                <span className="text-white/40 text-[10px] uppercase flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-[var(--alert-green)]" />
                  Pünktlich
                </span>
                <span className={`font-semibold mt-0.5 text-xs ${punctuality >= 80 ? 'text-[var(--alert-green)]' : punctuality >= 60 ? 'text-amber-400' : 'text-rose-400'}`}>
                  {punctuality}%
                </span>
              </div>
              <div className="p-2 rounded-lg bg-white/[0.02] border border-white/5 flex flex-col">
                <span className="text-white/40 text-[10px] uppercase flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--gold-primary)]" />
                  Stand
                </span>
                <span className="font-semibold text-white/80 mt-0.5 text-xs truncate">
                  {lastUpdated || 'Live'}
                </span>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 px-3 py-2 border-b border-white/10 text-[11px] overflow-x-auto no-scrollbar">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-2.5 py-1 rounded-md transition-all ${filter === 'ALL' ? 'bg-[var(--cyan-primary)]/20 text-[var(--cyan-primary)] font-bold border border-[var(--cyan-primary)]/40' : 'text-white/50 hover:text-white/80'}`}
              >
                ALLE ({departures.length})
              </button>
              <button
                onClick={() => setFilter('ICE')}
                className={`px-2.5 py-1 rounded-md transition-all ${filter === 'ICE' ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)] font-bold border border-[var(--gold-primary)]/40' : 'text-white/50 hover:text-white/80'}`}
              >
                ICE / FERN
              </button>
              <button
                onClick={() => setFilter('REGIONAL')}
                className={`px-2.5 py-1 rounded-md transition-all ${filter === 'REGIONAL' ? 'bg-blue-500/20 text-blue-400 font-bold border border-blue-500/40' : 'text-white/50 hover:text-white/80'}`}
              >
                REGIO (RE/RB)
              </button>
              <button
                onClick={() => setFilter('S')}
                className={`px-2.5 py-1 rounded-md transition-all ${filter === 'S' ? 'bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/40' : 'text-white/50 hover:text-white/80'}`}
              >
                S-BAHN
              </button>
            </div>

            {/* Departures List */}
            <div className="flex-1 overflow-y-auto divide-y divide-white/5 max-h-[380px] p-2 space-y-1">
              {loading && departures.length === 0 ? (
                <div className="py-12 text-center text-white/40 text-xs flex flex-col items-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-[var(--cyan-primary)]" />
                  <span>Verbinde mit Zuginformationssystem...</span>
                </div>
              ) : error && departures.length === 0 ? (
                <div className="py-8 text-center text-rose-400 text-xs px-4">
                  <AlertTriangle className="w-5 h-5 mx-auto mb-1 opacity-80" />
                  <span>{error}</span>
                </div>
              ) : filteredDepartures.length === 0 ? (
                <div className="py-8 text-center text-white/40 text-xs">
                  Keine Abfahrten für diese Kategorie gefunden.
                </div>
              ) : (
                filteredDepartures.map((dep) => {
                  const isDelayed = dep.delayMinutes > 0;
                  const isSevere = dep.delayMinutes >= 15;

                  return (
                    <div
                      key={dep.id}
                      className="p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors flex flex-col gap-1 border border-transparent hover:border-white/10"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase border shrink-0 ${
                              ['ICE', 'TGV', 'EC'].includes(dep.category)
                                ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] border-[var(--gold-primary)]/40'
                                : dep.category === 'IC'
                                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : dep.category === 'S'
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40'
                                : 'bg-[var(--cyan-primary)]/15 text-[var(--cyan-primary)] border-[var(--cyan-primary)]/40'
                            }`}
                          >
                            {dep.line}
                          </span>
                          <span className="text-xs font-semibold text-white/95 truncate">
                            {dep.direction}
                          </span>
                        </div>

                        {/* Departure times */}
                        <div className="flex items-center gap-1.5 shrink-0 text-right">
                          {dep.cancelled ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                              AUSFALL
                            </span>
                          ) : (
                            <>
                              <span className={`text-xs font-bold ${isDelayed ? 'line-through text-white/40 text-[11px]' : 'text-white'}`}>
                                {dep.plannedTime}
                              </span>
                              {isDelayed && (
                                <span className={`text-xs font-bold ${isSevere ? 'text-rose-400' : 'text-amber-400'}`}>
                                  {dep.actualTime}
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Platform & Status Details */}
                      <div className="flex items-center justify-between text-[10px] text-white/50 pt-0.5">
                        <div className="flex items-center gap-2 truncate">
                          <span className="px-1.5 py-0.2 rounded bg-white/5 border border-white/10 text-white/80">
                            Gleis {dep.platform}
                          </span>
                          {dep.stops && dep.stops.length > 0 && (
                            <span className="truncate text-white/40">
                              über {dep.stops.join(' • ')}
                            </span>
                          )}
                        </div>

                        {!dep.cancelled && (
                          <div className="shrink-0 font-medium">
                            {isDelayed ? (
                              <span className={`flex items-center gap-1 ${isSevere ? 'text-rose-400' : 'text-amber-400'}`}>
                                +{dep.delayMinutes} min
                              </span>
                            ) : (
                              <span className="text-[var(--alert-green)]">Pünktlich</span>
                            )}
                          </div>
                        )}
                      </div>

                      {dep.remarks && dep.remarks.length > 0 && (
                        <div className="text-[10px] text-amber-300/80 bg-amber-950/20 px-1.5 py-0.5 rounded border border-amber-500/20 truncate">
                          ⚠️ {dep.remarks.join(' • ')}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer with map coordinates button */}
            <div className="p-2.5 bg-white/[0.02] border-t border-white/10 flex items-center justify-between text-[11px]">
              <span className="text-white/40 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-[var(--cyan-primary)]" />
                {station.lat.toFixed(3)}°N, {station.lng.toFixed(3)}°E
              </span>
              {onFocusCoordinates && (
                <button
                  onClick={() => onFocusCoordinates(station.lat, station.lng)}
                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 text-[var(--cyan-primary)] text-[10px] flex items-center gap-1 transition-colors"
                >
                  <Compass className="w-3 h-3" />
                  Zentrieren
                </button>
              )}
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
