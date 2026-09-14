import type {
  Incident,
  IncidentConfidenceLevel,
  IncidentSourceStatus,
} from '@/lib/incident-correlation';

export interface IncidentDossierProps {
  incident: Incident;
  className?: string;
  title?: string;
}

const CONFIDENCE_META: Record<IncidentConfidenceLevel, { label: string; color: string }> = {
  high: { label: 'HIGH', color: '#00E676' },
  medium: { label: 'MEDIUM', color: '#FFD166' },
  low: { label: 'LOW', color: '#FF8A65' },
};

const SOURCE_STATUS_META: Record<IncidentSourceStatus, { label: string; color: string }> = {
  live: { label: 'LIVE', color: '#00E676' },
  degraded: { label: 'DEGRADED', color: '#FFB74D' },
  stale: { label: 'STALE', color: '#FFD166' },
  offline: { label: 'OFFLINE', color: '#FF3D57' },
  unknown: { label: 'UNKNOWN', color: '#9B978E' },
};

function formatUtc(epochMs: number): string {
  return new Date(epochMs).toISOString().replace('T', ' ').replace('.000Z', 'Z');
}

function formatAge(ageMs: number | null): string {
  if (ageMs == null || !Number.isFinite(ageMs)) return 'unknown';
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export default function IncidentDossier({
  incident,
  className = '',
  title = 'INCIDENT DOSSIER',
}: IncidentDossierProps) {
  const confidence = CONFIDENCE_META[incident.confidence.level];
  const region = incident.region
    ?? (incident.centroid ? `${incident.centroid.lat.toFixed(3)}, ${incident.centroid.lng.toFixed(3)}` : 'Unspecified');

  return (
    <article
      aria-label={`Incident dossier: ${incident.title}`}
      className={`w-full max-w-[720px] rounded-xl border border-white/[0.08] bg-black/75 p-4 font-mono text-white shadow-2xl backdrop-blur-2xl ${className}`}
    >
      <header className="border-b border-white/[0.07] pb-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-semibold tracking-[0.22em] text-white/35">{title}</p>
            <h2 className="mt-1 text-base font-semibold leading-tight text-white/90">{incident.title}</h2>
            <p className="mt-1 break-all text-[9px] tracking-wide text-white/30">{incident.id}</p>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-right"
            style={{ borderColor: `${confidence.color}55`, background: `${confidence.color}12` }}
            title={incident.confidence.reasons.join(' ')}
          >
            <span className="block text-[8px] tracking-[0.18em] text-white/35">CONFIDENCE</span>
            <strong className="mt-0.5 block text-sm tabular-nums" style={{ color: confidence.color }}>
              {percent(incident.confidence.score)} · {confidence.label}
            </strong>
          </div>
        </div>

        <dl className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
            <dt className="text-[8px] tracking-[0.16em] text-white/25">TIME RANGE</dt>
            <dd className="mt-1 leading-relaxed text-white/60">
              {formatUtc(incident.startAt)}<br />
              {incident.endAt !== incident.startAt ? `→ ${formatUtc(incident.endAt)}` : 'single timestamp'}
            </dd>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
            <dt className="text-[8px] tracking-[0.16em] text-white/25">REGION / AOI</dt>
            <dd className="mt-1 text-white/60">{region}</dd>
            {incident.aoiIds.length > 0 && (
              <dd className="mt-1 break-words text-[9px] text-white/35">AOI: {incident.aoiIds.join(', ')}</dd>
            )}
          </div>
        </dl>

        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Affected domains">
          {incident.domains.map(domain => (
            <span key={domain} className="rounded border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[8px] uppercase tracking-[0.12em] text-white/45">
              {domain}
            </span>
          ))}
        </div>
      </header>

      <section className="mt-4" aria-labelledby={`${incident.id}-timeline`}>
        <h3 id={`${incident.id}-timeline`} className="text-[9px] font-semibold tracking-[0.2em] text-white/45">
          CHRONOLOGY · {incident.observations.length}
        </h3>
        <ol className="mt-2 space-y-1.5">
          {incident.observations.map(observation => (
            <li key={observation.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <time className="text-[9px] tabular-nums text-[var(--cyan-primary)]/75">{formatUtc(observation.observedAt)}</time>
                <span className="text-[8px] uppercase tracking-[0.12em] text-white/25">{observation.domain}</span>
                {observation.category && <span className="text-[8px] text-white/30">· {observation.category}</span>}
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-white/70">{observation.title ?? observation.sourceObservationId}</p>
              <p className="mt-1 text-[8px] text-white/28">SOURCE {observation.sourceId} · ID {observation.sourceObservationId}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-4" aria-labelledby={`${incident.id}-links`}>
        <h3 id={`${incident.id}-links`} className="text-[9px] font-semibold tracking-[0.2em] text-white/45">
          CORRELATION LINKS · {incident.connections.length}
        </h3>
        {incident.connections.length > 0 ? (
          <div className="mt-2 space-y-1.5">
            {incident.connections.map(connection => (
              <details key={`${connection.fromObservationId}->${connection.toObservationId}`} className="rounded-lg border border-white/[0.06] bg-white/[0.02]">
                <summary className="cursor-pointer list-none px-2.5 py-2 text-[9px] text-white/55 [&::-webkit-details-marker]:hidden">
                  <span className="tabular-nums text-white/75">{percent(connection.confidence)}</span>
                  {' · '}{connection.fromObservationId} ↔ {connection.toObservationId}
                </summary>
                <ul className="border-t border-white/[0.05] px-5 py-2 text-[9px] leading-relaxed text-white/42">
                  {connection.reasons.map(reason => <li key={reason} className="list-disc">{reason}</li>)}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <p className="mt-2 rounded-lg border border-dashed border-white/[0.08] p-3 text-[9px] text-white/30">
            No automatic cross-observation link is claimed for this incident.
          </p>
        )}
      </section>

      <section className="mt-4" aria-labelledby={`${incident.id}-sources`}>
        <h3 id={`${incident.id}-sources`} className="text-[9px] font-semibold tracking-[0.2em] text-white/45">
          SOURCES · {incident.sources.length}
        </h3>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {incident.sources.map(source => {
            const meta = SOURCE_STATUS_META[source.status];
            return (
              <div key={source.id} className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: meta.color }} />
                  <span className="min-w-0 flex-1 truncate text-[10px] text-white/65">{source.name}</span>
                  <span className="text-[8px] tracking-[0.12em]" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <p className="mt-1 text-[8px] text-white/28">{source.id} · age {formatAge(source.ageMs)}</p>
                <p className="mt-1 text-[9px] leading-relaxed text-white/38">{source.explanation}</p>
                {source.url && (
                  <a href={source.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-[8px] text-[var(--cyan-primary)]/65 underline decoration-white/20 underline-offset-2">
                    {source.url}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <section aria-labelledby={`${incident.id}-uncertainties`}>
          <h3 id={`${incident.id}-uncertainties`} className="text-[9px] font-semibold tracking-[0.2em] text-white/45">UNCERTAINTIES</h3>
          {incident.uncertainties.length ? (
            <ul className="mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-[9px] leading-relaxed text-white/42">
              {incident.uncertainties.map(item => <li key={item} className="list-disc">{item}</li>)}
            </ul>
          ) : <p className="mt-2 text-[9px] text-white/28">No additional uncertainty flags.</p>}
        </section>

        <section aria-labelledby={`${incident.id}-gaps`}>
          <h3 id={`${incident.id}-gaps`} className="text-[9px] font-semibold tracking-[0.2em] text-white/45">DATA GAPS</h3>
          {incident.dataGaps.length ? (
            <ul className="mt-2 space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.02] px-5 py-2.5 text-[9px] leading-relaxed text-white/42">
              {incident.dataGaps.map(item => <li key={item} className="list-disc">{item}</li>)}
            </ul>
          ) : <p className="mt-2 text-[9px] text-white/28">No incident-specific data gaps flagged.</p>}
        </section>
      </div>
    </article>
  );
}
