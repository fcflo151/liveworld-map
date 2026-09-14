'use client';

import { useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  AlertOctagon,
  ShieldAlert,
  X,
  MapPin,
  Clock,
  Radio,
  Building2,
  CheckSquare,
  Crosshair,
} from 'lucide-react';
import type { CivilAlert } from '@/app/api/civil-protection/route';

interface CivilProtectionModalProps {
  alert: CivilAlert | null;
  onClose: () => void;
  onFocusCoordinates?: (lat: number, lng: number) => void;
}

export default function CivilProtectionModal({
  alert,
  onClose,
  onFocusCoordinates,
}: CivilProtectionModalProps) {
  // ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const severityMeta = useMemo(() => {
    if (!alert) return {
      badge: 'WARNUNG',
      border: 'border-yellow-500/40',
      badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      glow: 'shadow-yellow-950/50',
      accent: 'text-yellow-400',
      icon: AlertTriangle,
    };

    switch (alert.severity) {
      case 'Extreme':
        return {
          badge: 'EXTREME GEFAHR (STUFE 4)',
          border: 'border-rose-600/50',
          badgeBg: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
          glow: 'shadow-rose-950/60',
          accent: 'text-rose-400',
          icon: AlertOctagon,
        };
      case 'Severe':
        return {
          badge: 'SCHWERE GEFAHR (STUFE 3)',
          border: 'border-orange-500/50',
          badgeBg: 'bg-orange-500/25 text-orange-300 border-orange-500/50',
          glow: 'shadow-orange-950/60',
          accent: 'text-orange-400',
          icon: AlertTriangle,
        };
      case 'Moderate':
        return {
          badge: 'GEFAHR (STUFE 2)',
          border: 'border-amber-500/40',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          glow: 'shadow-amber-950/50',
          accent: 'text-amber-400',
          icon: AlertTriangle,
        };
      case 'Minor':
      default:
        return {
          badge: 'INFORMATION (STUFE 1)',
          border: 'border-emerald-500/40',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          glow: 'shadow-emerald-950/50',
          accent: 'text-emerald-400',
          icon: ShieldAlert,
        };
    }
  }, [alert]);

  if (!alert) return null;
  const IconComponent = severityMeta.icon;

  const formattedDate = new Date(alert.startDate).toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        {/* Backdrop click to close */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2 }}
          className={`relative z-10 w-full max-w-xl max-h-[90vh] flex flex-col rounded-xl border ${severityMeta.border} bg-[#060b13]/95 text-white font-mono shadow-2xl ${severityMeta.glow} overflow-hidden`}
        >
          {/* Top Decorative Alert Stripe */}
          <div
            className={`h-1.5 w-full ${
              alert.severity === 'Extreme'
                ? 'bg-gradient-to-r from-rose-600 via-rose-500 to-rose-700 animate-pulse'
                : alert.severity === 'Severe'
                ? 'bg-gradient-to-r from-orange-600 via-orange-500 to-orange-700'
                : 'bg-gradient-to-r from-amber-600 via-amber-500 to-amber-700'
            }`}
          />

          {/* Header */}
          <div className="flex items-start justify-between p-4 border-b border-white/10 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center border shrink-0 ${severityMeta.badgeBg}`}
              >
                <IconComponent className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${severityMeta.badgeBg}`}
                  >
                    {severityMeta.badge}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/15">
                    {alert.source}
                  </span>
                  <span className="text-[10px] text-white/40 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    MoWaS FEED
                  </span>
                </div>
                <h2 className="text-base font-bold text-white mt-1 leading-snug">
                  {alert.title}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors ml-2 shrink-0"
              title="Schließen (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="p-4 space-y-4 overflow-y-auto custom-scrollbar text-xs leading-relaxed">
            {/* Meta Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/10">
              <div>
                <span className="text-[10px] uppercase text-white/40 block">Gebiet</span>
                <span className="font-semibold text-white/90 flex items-center gap-1 truncate">
                  <MapPin className="w-3 h-3 text-[var(--cyan-primary)] shrink-0" />
                  {alert.areaDesc}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase text-white/40 block">Meldungszeit</span>
                <span className="font-semibold text-white/90 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--gold-primary)] shrink-0" />
                  {formattedDate}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase text-white/40 block">Herausgeber</span>
                <span className="font-semibold text-white/90 flex items-center gap-1 truncate">
                  <Building2 className="w-3 h-3 text-purple-400 shrink-0" />
                  {alert.sender || 'BBK / Leitstelle'}
                </span>
              </div>
            </div>

            {/* Instruction / Handlungsempfehlungen */}
            {alert.instruction && (
              <div className="rounded-lg p-3 border border-amber-500/40 bg-amber-950/20 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold uppercase text-[11px]">
                  <CheckSquare className="w-4 h-4 text-amber-400 shrink-0" />
                  Amtliche Handlungsempfehlungen
                </div>
                <p className="text-white/90 whitespace-pre-line text-xs font-sans pl-5">
                  {alert.instruction}
                </p>
              </div>
            )}

            {/* Situation Description */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-white/60 block">
                Lagebericht & Details
              </span>
              <div className="p-3 rounded-lg bg-black/40 border border-white/5 text-white/80 font-sans leading-relaxed text-xs">
                {alert.description || alert.headline || 'Keine weiteren Details verfügbar.'}
              </div>
            </div>

            {/* Coordinates / Technical telemetry */}
            <div className="flex items-center justify-between text-[11px] text-white/40 pt-1 border-t border-white/10">
              <span>Meldungs-ID: <code className="text-white/60">{alert.id}</code></span>
              <span>{alert.lat.toFixed(4)}°N, {alert.lng.toFixed(4)}°E</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 p-3.5 border-t border-white/10 bg-white/[0.02]">
            {onFocusCoordinates && (
              <button
                onClick={() => {
                  onFocusCoordinates(alert.lat, alert.lng);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--cyan-primary)]/40 bg-[var(--cyan-primary)]/15 text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/25 text-xs font-semibold transition-colors"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Auf Karte zentrieren
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg border border-white/20 bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
            >
              Schließen
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
