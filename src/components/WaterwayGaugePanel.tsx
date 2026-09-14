'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  Waves,
  TrendingUp,
  TrendingDown,
  Minus,
  X,
  MapPin,
  ExternalLink,
  Clock,
  Compass,
  Building,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { WaterwayGauge } from '@/app/api/waterways/route';

interface WaterwayGaugePanelProps {
  gauge: WaterwayGauge | null;
  onClose: () => void;
  onFocusCoordinates?: (lat: number, lng: number) => void;
}

export default function WaterwayGaugePanel({
  gauge,
  onClose,
  onFocusCoordinates,
}: WaterwayGaugePanelProps) {
  if (!gauge) return null;

  const stageMeta = (() => {
    switch (gauge.stage) {
      case 'high_2':
        return {
          label: 'HOCHWASSERMARKE II (SPERRE)',
          badgeColor: 'bg-rose-500/25 text-rose-300 border-rose-500/50',
          textColor: 'text-rose-400',
          icon: AlertTriangle,
          desc: 'Schifffahrt für diesen Streckenabschnitt behördlich gesperrt.',
        };
      case 'high_1':
        return {
          label: 'HOCHWASSERMARKE I',
          badgeColor: 'bg-orange-500/25 text-orange-300 border-orange-500/50',
          textColor: 'text-orange-400',
          icon: AlertTriangle,
          desc: 'Geschwindigkeitsbegrenzung & Fahrbeschränkung für die Schifffahrt.',
        };
      case 'low':
        return {
          label: 'NIEDRIGWASSERSTAND',
          badgeColor: 'bg-amber-500/25 text-amber-300 border-amber-500/50',
          textColor: 'text-amber-400',
          icon: AlertTriangle,
          desc: 'Abladetiefe für Güter- und Frachtschiffe reduziert.',
        };
      case 'normal':
      default:
        return {
          label: 'REGULÄRER PEGELSTAND',
          badgeColor: 'bg-[var(--cyan-primary)]/20 text-[var(--cyan-primary)] border-[var(--cyan-primary)]/40',
          textColor: 'text-[var(--cyan-primary)]',
          icon: CheckCircle2,
          desc: 'Uneingeschränkte Binnenschifffahrt auf der Wasserstraße.',
        };
    }
  })();

  const trendIcon = (() => {
    const t = gauge.measurement?.trend;
    if (t && t > 0) {
      return (
        <span className="flex items-center gap-1 text-cyan-400">
          <TrendingUp className="w-4 h-4" />
          <span>Steigend</span>
        </span>
      );
    }
    if (t && t < 0) {
      return (
        <span className="flex items-center gap-1 text-emerald-400">
          <TrendingDown className="w-4 h-4" />
          <span>Fallend</span>
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1 text-white/60">
        <Minus className="w-4 h-4" />
        <span>Gleichbleibend</span>
      </span>
    );
  })();

  const StageIcon = stageMeta.icon;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 20, scale: 0.96 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 20, scale: 0.96 }}
        transition={{ duration: 0.22 }}
        className="fixed top-14 right-4 z-40 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border border-cyan-500/30 bg-[#060b13]/92 backdrop-blur-xl shadow-2xl shadow-cyan-950/40 text-white font-mono flex flex-col overflow-hidden"
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.03]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
              <Waves className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold truncate tracking-wide text-white">
                  {gauge.name}
                </h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-semibold uppercase border border-cyan-500/30 shrink-0">
                  {gauge.water}
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate flex items-center gap-1.5">
                <span>Strom-km {gauge.km}</span>
                <span>•</span>
                <span>WSV Pegelonline</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors shrink-0"
            title="Schließen"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Level Banner */}
        <div className="p-4 bg-gradient-to-b from-cyan-950/30 to-transparent border-b border-white/10 flex items-center justify-between">
          <div>
            <span className="text-[10px] text-white/40 uppercase tracking-wider block">
              Aktueller Wasserstand
            </span>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {gauge.measurement?.value ?? '--'}
              </span>
              <span className="text-sm text-white/60 font-semibold">cm</span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] text-white/40 uppercase tracking-wider block">Tendenz</span>
            <div className="mt-1 text-xs font-semibold">{trendIcon}</div>
          </div>
        </div>

        {/* Stage Alert / Info Box */}
        <div className="p-4 space-y-3 text-xs">
          <div className={`p-2.5 rounded-lg border flex items-start gap-2.5 ${stageMeta.badgeColor}`}>
            <StageIcon className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-[11px] tracking-wide">{stageMeta.label}</div>
              <div className="text-[11px] opacity-90 font-sans mt-0.5 leading-snug">
                {stageMeta.desc}
              </div>
            </div>
          </div>

          {/* Details Metadata */}
          <div className="space-y-1.5 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 text-[11px]">
            <div className="flex items-center justify-between py-0.5">
              <span className="text-white/40 flex items-center gap-1">
                <Building className="w-3 h-3 text-purple-400" />
                Zuständigkeit
              </span>
              <span className="text-white/80 truncate max-w-[180px]" title={gauge.agency}>
                {gauge.agency}
              </span>
            </div>
            <div className="flex items-center justify-between py-0.5">
              <span className="text-white/40 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                Koordinaten
              </span>
              <span className="text-white/80">
                {gauge.lat.toFixed(4)}°N, {gauge.lng.toFixed(4)}°E
              </span>
            </div>
            {gauge.measurement?.timestamp && (
              <div className="flex items-center justify-between py-0.5">
                <span className="text-white/40 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-[var(--gold-primary)]" />
                  Messzeitpunkt
                </span>
                <span className="text-white/80">
                  {new Date(gauge.measurement.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })} Uhr
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between p-3 border-t border-white/10 bg-white/[0.02] text-xs">
          {onFocusCoordinates && (
            <button
              onClick={() => onFocusCoordinates(gauge.lat, gauge.lng)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors text-[11px]"
            >
              <Compass className="w-3.5 h-3.5" />
              Zentrieren
            </button>
          )}

          <a
            href={`https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(gauge.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[11px] text-white/50 hover:text-cyan-400 transition-colors ml-auto"
          >
            <span>WSV Portal</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
