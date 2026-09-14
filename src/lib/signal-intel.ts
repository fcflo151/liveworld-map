export interface AircraftIntegritySample {
  lat: number;
  lng: number;
  nac_p: number;
  callsign?: string;
}

export interface GnssIntegrityZone {
  lat: number;
  lng: number;
  severity: number;
  level: 'medium' | 'high';
  affected: number;
  samples: number;
  affected_percent: number;
  average_nac_p: number;
  confidence: 'low' | 'medium' | 'high';
  cell_degrees: number;
  source_url: string;
  caveat: string;
}

/**
 * Aggregate aircraft navigation-accuracy reports into coarse cells. A low
 * NACp can have several causes, so the result is deliberately called an
 * integrity anomaly rather than jamming or spoofing.
 *
 * The (bad - 1) bias and 2/10 percent bands mirror GPSJam's published map
 * methodology, but this is a current ADS-B snapshot instead of its 24 h set.
 */
export function aggregateGnssIntegrity(
  samples: AircraftIntegritySample[],
  threshold = 4,
  cellDegrees = 2,
): GnssIntegrityZone[] {
  const grid = new Map<string, {
    lat: number;
    lng: number;
    samples: number;
    affected: number;
    totalNacP: number;
  }>();

  for (const sample of samples) {
    if (!Number.isFinite(sample.lat) || !Number.isFinite(sample.lng) || !Number.isFinite(sample.nac_p)) continue;
    if (Math.abs(sample.lat) > 90 || Math.abs(sample.lng) > 180) continue;

    const cellLat = Math.floor(sample.lat / cellDegrees) * cellDegrees;
    const cellLng = Math.floor(sample.lng / cellDegrees) * cellDegrees;
    const key = `${cellLat},${cellLng}`;
    const cell = grid.get(key) ?? {
      lat: cellLat + cellDegrees / 2,
      lng: cellLng + cellDegrees / 2,
      samples: 0,
      affected: 0,
      totalNacP: 0,
    };
    cell.samples += 1;
    cell.totalNacP += sample.nac_p;
    if (sample.nac_p <= threshold) cell.affected += 1;
    grid.set(key, cell);
  }

  return [...grid.values()]
    .filter(cell => cell.samples >= 3 && cell.affected >= 2)
    .map(cell => {
      const affectedPercent = Math.max(0, ((cell.affected - 1) / cell.samples) * 100);
      return {
        lat: cell.lat,
        lng: cell.lng,
        severity: Math.min(100, Math.round(affectedPercent)),
        level: affectedPercent > 10 ? 'high' as const : 'medium' as const,
        affected: cell.affected,
        samples: cell.samples,
        affected_percent: Math.round(affectedPercent * 10) / 10,
        average_nac_p: Math.round((cell.totalNacP / cell.samples) * 10) / 10,
        confidence: cell.samples >= 20 ? 'high' as const : cell.samples >= 8 ? 'medium' as const : 'low' as const,
        cell_degrees: cellDegrees,
        source_url: 'https://gpsjam.org/',
        caveat: 'Low ADS-B NACp is an anomaly indicator, not proof of GNSS jamming or spoofing.',
      };
    })
    .filter(zone => zone.affected_percent >= 2)
    .sort((a, b) => b.severity - a.severity || b.samples - a.samples);
}

interface ReceiverbookSite {
  label?: unknown;
  url?: unknown;
  version?: unknown;
  type?: unknown;
  location?: { coordinates?: unknown };
  receivers?: unknown;
}

export interface PublicSdrReceiver {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  url: string;
  receiver_type: string;
  version: string | null;
  coverage: string;
  directory_url: string;
  coordinates_note: string;
}

function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function compactId(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `sdr-${(hash >>> 0).toString(16)}`;
}

/** Parse the receiver array embedded by Receiverbook's public map page. */
export function parseReceiverbookHtml(html: string): PublicSdrReceiver[] {
  const match = html.match(/var\s+receivers\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) throw new Error('Receiverbook receiver array not found');

  let sites: ReceiverbookSite[];
  try {
    sites = JSON.parse(match[1]);
  } catch {
    throw new Error('Receiverbook receiver array is invalid JSON');
  }

  const byUrl = new Map<string, PublicSdrReceiver>();
  for (const site of sites) {
    const coordinates = site.location?.coordinates;
    if (!Array.isArray(coordinates) || coordinates.length < 2) continue;
    const lng = Number(coordinates[0]);
    const lat = Number(coordinates[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;

    const nested = Array.isArray(site.receivers) ? site.receivers as ReceiverbookSite[] : [site];
    for (const receiver of nested) {
      const url = safeHttpUrl(receiver.url ?? site.url);
      if (!url) continue;
      const receiverType = String(receiver.type ?? site.type ?? 'WebSDR').slice(0, 40);
      const name = String(receiver.label ?? site.label ?? 'Public SDR receiver').replace(/\s+/g, ' ').trim().slice(0, 220);
      const location = String(site.label ?? name).replace(/\s+/g, ' ').trim().slice(0, 180);
      byUrl.set(url, {
        id: compactId(url),
        name,
        location,
        lat,
        lng,
        url,
        receiver_type: receiverType,
        version: receiver.version == null ? null : String(receiver.version).slice(0, 40),
        coverage: /kiwi/i.test(receiverType) ? '10 kHz–30 MHz (typical KiwiSDR hardware range)' : 'Receiver-specific; verify on receiver page',
        directory_url: 'https://www.receiverbook.de/map',
        coordinates_note: 'Operator-published directory position; may be approximate.',
      });
    }
  }

  return [...byUrl.values()];
}

const LOCATION_ANCHORS: Record<string, { lat: number; lng: number; name: string }> = {
  EDGG: { lat: 50.0, lng: 8.5, name: 'Langen FIR' },
  EDMM: { lat: 48.4, lng: 11.8, name: 'Munich FIR' },
  EDWW: { lat: 53.5, lng: 10.0, name: 'Bremen FIR' },
  EPWW: { lat: 52.0, lng: 19.0, name: 'Warsaw FIR' },
  UKBV: { lat: 50.4, lng: 30.5, name: 'Kyiv FIR' },
  UKDV: { lat: 48.5, lng: 35.0, name: 'Dnipro FIR' },
  LCCC: { lat: 35.0, lng: 33.0, name: 'Nicosia FIR' },
  LTAA: { lat: 39.0, lng: 33.0, name: 'Ankara FIR' },
  OIIX: { lat: 32.0, lng: 53.0, name: 'Tehran FIR' },
  LLBG: { lat: 32.005, lng: 34.886, name: 'Ben Gurion Airport' },
};

export const DEFAULT_NOTAM_LOCATIONS = Object.keys(LOCATION_ANCHORS);

const OPERATIONAL_NOTAM_RE = /\b(AIRSPACE\s+(?:IS\s+)?CLOSED|TEMPORARY\s+(?:RESERVED|RESTRICTED)\s+AIRSPACE|RESTRICTED\s+AREA|DANGER\s+AREA|PROHIBITED\s+AREA|MIL(?:ITARY)?\s+EXER(?:CISE)?|LIVE\s+FIRING|MISSILE|ROCKET|SPACE\s+LAUNCH|GUNFIRE|FIRING\s+ACTIVITY|UAS\s+ACTIVITY|DRONE\s+ACTIVITY)\b|Q(?:RT|RP|RD|WM)[A-Z]{2}/i;

function readField(row: Record<string, unknown>, names: string[]): string {
  for (const name of names) {
    const value = row[name];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return '';
}

function extractRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(item => item && typeof item === 'object') as Record<string, unknown>[];
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of ['notams', 'data', 'results', 'items', 'features']) {
    const rows = record[key];
    if (Array.isArray(rows)) {
      return rows.map(item => {
        if (item && typeof item === 'object' && 'properties' in item) return (item as { properties: Record<string, unknown> }).properties;
        return item;
      }).filter(item => item && typeof item === 'object') as Record<string, unknown>[];
    }
  }
  return [];
}

export function parseNotamCoordinate(text: string): { lat: number; lng: number } | null {
  // A Q-line normally appends a three-digit radius immediately after E/W,
  // e.g. 5129N00028W005, so the coordinate cannot require a word boundary.
  const match = text.toUpperCase().match(/(?:^|[^0-9])(\d{2})(\d{2})(\d{2})?([NS])\s*(\d{3})(\d{2})(\d{2})?([EW])/);
  if (!match) return null;
  const lat = Number(match[1]) + Number(match[2]) / 60 + Number(match[3] || 0) / 3600;
  const lng = Number(match[5]) + Number(match[6]) / 60 + Number(match[7] || 0) / 3600;
  return { lat: match[4] === 'S' ? -lat : lat, lng: match[8] === 'W' ? -lng : lng };
}

export interface OperationalNotam {
  id: string;
  location: string;
  location_name: string;
  lat: number;
  lng: number;
  message: string;
  starts_at: string | null;
  ends_at: string | null;
  severity: 'critical' | 'high' | 'elevated';
  position_basis: 'notam-coordinate' | 'fir-anchor';
  source_url: string;
}

export function normalizeOperationalNotams(payload: unknown): OperationalNotam[] {
  const result: OperationalNotam[] = [];
  for (const row of extractRows(payload)) {
    const message = readField(row, ['all', 'message', 'text', 'raw', 'notam', 'description']);
    const code = readField(row, ['Code', 'code', 'qcode', 'QCode']);
    if (!OPERATIONAL_NOTAM_RE.test(`${code} ${message}`)) continue;

    const location = readField(row, ['location', 'Location', 'locations', 'icaoCode', 'ICAOCode']).split(/[\s,\/]/)[0].toUpperCase();
    const parsed = parseNotamCoordinate(message);
    const anchor = LOCATION_ANCHORS[location];
    if (!parsed && !anchor) continue;
    const position = parsed ?? anchor;
    const critical = /MISSILE|ROCKET|SPACE\s+LAUNCH|AIRSPACE\s+(?:IS\s+)?CLOSED|PROHIBITED/i.test(`${code} ${message}`);
    const high = critical || /MIL(?:ITARY)?\s+EXER|LIVE\s+FIRING|FIRING\s+ACTIVITY|RESTRICTED|DANGER|Q(?:RT|RP|RD|WM)/i.test(`${code} ${message}`);
    const rawId = readField(row, ['id', 'ID', 'notamId', 'number']) || `${location}-${message}`;

    result.push({
      id: compactId(rawId),
      location: location || 'UNKNOWN',
      location_name: anchor?.name ?? location ?? 'NOTAM area',
      lat: position.lat,
      lng: position.lng,
      message: message.slice(0, 1600),
      starts_at: readField(row, ['startdate', 'startDate', 'starts_at', 'effectiveStart']) || null,
      ends_at: readField(row, ['enddate', 'endDate', 'ends_at', 'effectiveEnd']) || null,
      severity: critical ? 'critical' : high ? 'high' : 'elevated',
      position_basis: parsed ? 'notam-coordinate' : 'fir-anchor',
      source_url: 'https://applications.icao.int/dataservices/default.aspx',
    });
  }
  return result;
}
