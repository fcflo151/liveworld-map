export const OVERPASS_MIN_ZOOM = 8;
export const OVERPASS_MAX_RESULTS = 300;
export const OVERPASS_MAX_SPAN_DEGREES = 4;

export interface ViewportBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

export interface InfrastructureFeature {
  type: 'Feature';
  id: string;
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    category: string;
    name: string;
    osmType: string;
    osmId: number;
    tags: Record<string, string>;
    source: 'OpenStreetMap';
    attribution: '© OpenStreetMap contributors';
  };
}

export function parseViewport(searchParams: URLSearchParams): { bounds: ViewportBounds; zoom: number } | null {
  const south = Number(searchParams.get('south'));
  const west = Number(searchParams.get('west'));
  const north = Number(searchParams.get('north'));
  const east = Number(searchParams.get('east'));
  const zoom = Number(searchParams.get('zoom'));
  if (![south, west, north, east, zoom].every(Number.isFinite)) return null;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
  if (zoom < OVERPASS_MIN_ZOOM) return null;
  if (north - south > OVERPASS_MAX_SPAN_DEGREES || east - west > OVERPASS_MAX_SPAN_DEGREES) return null;
  return { bounds: { south, west, north, east }, zoom };
}

export function buildInfrastructureQuery(bounds: ViewportBounds): string {
  const bbox = `${bounds.south},${bounds.west},${bounds.north},${bounds.east}`;
  return `[out:json][timeout:12][maxsize:8388608];(\n` +
    `nwr[power=plant](${bbox});\n` +
    `nwr[power=substation](${bbox});\n` +
    `way[power=line](${bbox});\n` +
    `nwr[man_made=gasometer](${bbox});\n` +
    `nwr[industrial=gas](${bbox});\n` +
    `nwr[seamark:type=harbour](${bbox});\n` +
    `nwr[aeroway=aerodrome](${bbox});\n` +
    `nwr[railway=station](${bbox});\n` +
    `nwr[amenity=hospital](${bbox});\n` +
    `nwr[amenity=fire_station](${bbox});\n` +
    `nwr[emergency=ambulance_station](${bbox});\n` +
    `);out center ${OVERPASS_MAX_RESULTS};`;
}

function category(tags: Record<string, string>): string {
  if (tags.power === 'plant') return 'power_plant';
  if (tags.power === 'substation') return 'substation';
  if (tags.power === 'line') return 'power_line';
  if (tags.man_made === 'gasometer' || tags.industrial === 'gas') return 'gas_infrastructure';
  if (tags['seamark:type'] === 'harbour') return 'harbour';
  if (tags.aeroway === 'aerodrome') return 'airport';
  if (tags.railway === 'station') return 'rail_station';
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'fire_station') return 'fire_station';
  if (tags.emergency === 'ambulance_station') return 'ambulance_station';
  return 'infrastructure';
}

export function normalizeOverpass(input: unknown): InfrastructureFeature[] {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { elements?: unknown }).elements)) {
    throw new Error('Invalid Overpass response schema');
  }
  const elements = (input as { elements: unknown[] }).elements;
  const out: InfrastructureFeature[] = [];
  const seen = new Set<string>();

  for (const raw of elements.slice(0, OVERPASS_MAX_RESULTS)) {
    if (!raw || typeof raw !== 'object') continue;
    const element = raw as Record<string, unknown>;
    const osmId = Number(element.id);
    const osmType = typeof element.type === 'string' ? element.type : 'unknown';
    const center = element.center && typeof element.center === 'object' ? element.center as Record<string, unknown> : null;
    const lat = typeof element.lat === 'number' ? element.lat : Number(center?.lat);
    const lon = typeof element.lon === 'number' ? element.lon : Number(center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(osmId)) continue;
    const id = `${osmType}/${osmId}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const tagsRaw = element.tags && typeof element.tags === 'object' ? element.tags as Record<string, unknown> : {};
    const tags = Object.fromEntries(Object.entries(tagsRaw).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
    const kind = category(tags);
    out.push({
      type: 'Feature',
      id,
      geometry: { type: 'Point', coordinates: [lon, lat] },
      properties: {
        category: kind,
        name: tags.name || tags.operator || kind.replaceAll('_', ' '),
        osmType,
        osmId,
        tags,
        source: 'OpenStreetMap',
        attribution: '© OpenStreetMap contributors',
      },
    });
  }
  return out;
}
