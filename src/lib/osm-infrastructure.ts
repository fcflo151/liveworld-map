export const OSM_INFRASTRUCTURE_CATEGORIES = ['hospital', 'fire_station', 'shelter'] as const;
export type OsmInfrastructureCategory = (typeof OSM_INFRASTRUCTURE_CATEGORIES)[number];

export type OsmBBox = { south: number; west: number; north: number; east: number };

export type OsmInfrastructureItem = {
  id: string;
  osmId: number;
  osmType: 'node' | 'way' | 'relation';
  name: string;
  category: OsmInfrastructureCategory;
  lat: number;
  lng: number;
  operator?: string;
  website?: string;
  wheelchair?: string;
  sourceUrl: string;
};

type OsmTags = Record<string, string | undefined>;
type OverpassElement = {
  type?: 'node' | 'way' | 'relation';
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: OsmTags;
};

type OverpassPayload = { elements?: OverpassElement[] };

const MAX_LAT_SPAN = 1.5;
const MAX_LNG_SPAN = 2.0;
const CATEGORY_SET = new Set<string>(OSM_INFRASTRUCTURE_CATEGORIES);

export function parseOsmBBox(raw: string | null): OsmBBox | null {
  if (!raw) return null;
  const parts = raw.split(',').map(Number);
  if (parts.length !== 4 || parts.some(value => !Number.isFinite(value))) return null;
  const [south, west, north, east] = parts;
  if (south < -90 || north > 90 || west < -180 || east > 180) return null;
  if (south >= north || west >= east) return null;
  if (north - south > MAX_LAT_SPAN || east - west > MAX_LNG_SPAN) return null;
  return { south, west, north, east };
}

export function parseOsmCategories(raw: string | null): OsmInfrastructureCategory[] {
  if (!raw) return [...OSM_INFRASTRUCTURE_CATEGORIES];
  const unique = new Set(
    raw.split(',').map(value => value.trim()).filter(value => CATEGORY_SET.has(value)) as OsmInfrastructureCategory[],
  );
  return [...unique];
}

function categoryFilter(category: OsmInfrastructureCategory): string {
  switch (category) {
    case 'hospital':
      return '["amenity"="hospital"]';
    case 'fire_station':
      return '["amenity"="fire_station"]';
    case 'shelter':
      return '["amenity"="shelter"]';
  }
}

export function buildOverpassInfrastructureQuery(
  bbox: OsmBBox,
  categories: OsmInfrastructureCategory[],
): string {
  if (categories.length === 0) throw new Error('At least one supported OSM category is required');
  const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
  const selectors = categories.map(category => `nwr${categoryFilter(category)}(${box});`).join('\n  ');
  return `[out:json][timeout:12];\n(\n  ${selectors}\n);\nout center tags qt 250;`;
}

function finite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function classify(tags: OsmTags): OsmInfrastructureCategory | null {
  if (tags.amenity === 'hospital') return 'hospital';
  if (tags.amenity === 'fire_station') return 'fire_station';
  if (tags.amenity === 'shelter') return 'shelter';
  return null;
}

function defaultName(category: OsmInfrastructureCategory): string {
  switch (category) {
    case 'hospital': return 'Hospital';
    case 'fire_station': return 'Fire station';
    case 'shelter': return 'Shelter';
  }
}

export function normalizeOverpassInfrastructure(payload: OverpassPayload): OsmInfrastructureItem[] {
  const seen = new Set<string>();
  const items: OsmInfrastructureItem[] = [];

  for (const element of payload.elements || []) {
    if (!element.type || !Number.isFinite(element.id)) continue;
    const tags = element.tags || {};
    // The public-context layer deliberately excludes military-tagged objects.
    if (tags.military || tags.landuse === 'military') continue;
    const category = classify(tags);
    if (!category) continue;

    const lat = finite(element.lat) ?? finite(element.center?.lat);
    const lng = finite(element.lon) ?? finite(element.center?.lon);
    if (lat === null || lng === null) continue;

    const key = `${element.type}-${element.id}`;
    if (seen.has(key)) continue;
    seen.add(key);

    items.push({
      id: `osm-${key}`,
      osmId: element.id as number,
      osmType: element.type,
      name: tags.name?.trim() || defaultName(category),
      category,
      lat,
      lng,
      operator: tags.operator?.trim() || undefined,
      website: tags.website?.trim() || undefined,
      wheelchair: tags.wheelchair?.trim() || undefined,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    });
  }

  return items;
}
