export type DwdSeverity = 'minor' | 'moderate' | 'severe' | 'extreme' | 'unknown';

export interface DwdWarning {
  id: string;
  regionId: string;
  region: string;
  event: string;
  headline: string;
  severity: DwdSeverity;
  start: string | null;
  end: string | null;
  description: string | null;
  instruction: string | null;
  source: 'DWD';
  updatedAt: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function iso(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    const date = Number.isFinite(numeric) && /^\d+$/.test(value.trim()) ? new Date(numeric) : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }
  return null;
}

export function unwrapDwdWarningsJson(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error('Empty DWD warning response');
  if (trimmed.startsWith('{')) return JSON.parse(trimmed);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Invalid DWD warning response');
  return JSON.parse(trimmed.slice(start, end + 1));
}

export function normalizeDwdSeverity(level: unknown): DwdSeverity {
  const value = typeof level === 'number' ? level : Number(level);
  if (!Number.isFinite(value)) return 'unknown';
  if (value >= 5) return 'extreme';
  if (value >= 4) return 'severe';
  if (value >= 3) return 'moderate';
  if (value >= 1) return 'minor';
  return 'unknown';
}

export function normalizeDwdWarnings(input: unknown): DwdWarning[] {
  const root = asRecord(input);
  const groups = asRecord(root?.warnings);
  if (!root || !groups) throw new Error('Invalid DWD warning schema');
  const updatedAt = iso(root.time);
  const out: DwdWarning[] = [];
  const seen = new Set<string>();

  for (const [regionId, value] of Object.entries(groups)) {
    if (!Array.isArray(value)) continue;
    for (const item of value) {
      const warning = asRecord(item);
      if (!warning) continue;
      const region = text(warning.regionName) ?? text(warning.state) ?? regionId;
      const event = text(warning.event) ?? text(warning.headline) ?? 'Weather warning';
      const start = iso(warning.start);
      const end = iso(warning.end);
      const id = String(warning.id ?? warning.identifier ?? `${regionId}:${warning.type ?? event}:${start ?? 'active'}`);
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        id,
        regionId,
        region,
        event,
        headline: text(warning.headline) ?? event,
        severity: normalizeDwdSeverity(warning.level),
        start,
        end,
        description: text(warning.description),
        instruction: text(warning.instruction),
        source: 'DWD',
        updatedAt,
      });
    }
  }
  return out;
}
