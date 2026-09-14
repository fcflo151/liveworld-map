export type SourceDataType = 'event' | 'warning' | 'raster' | 'forecast' | 'infrastructure';
export type SourceAuth = 'none' | 'api-key';
export type SourceConfidenceClass = 'official' | 'primary' | 'curated' | 'aggregated';

export interface SourceRegistryEntry {
  id: string;
  name: string;
  provider: string;
  url: string;
  dataType: SourceDataType;
  auth: SourceAuth;
  keyRequired: boolean;
  license: string;
  attribution: string;
  coverage: string;
  refreshIntervalMs: number | null;
  cacheTtlMs: number;
  confidenceClass: SourceConfidenceClass;
  termsNotes: string;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

export const SOURCE_REGISTRY: Readonly<Record<string, SourceRegistryEntry>> = Object.freeze({
  gdacs: {
    id: 'gdacs',
    name: 'GDACS Disaster Alerts',
    provider: 'Global Disaster Alert and Coordination System (GDACS)',
    url: 'https://www.gdacs.org/gdacsapi/swagger/index.html',
    dataType: 'event',
    auth: 'none',
    keyRequired: false,
    license: 'GDACS Terms of Use',
    attribution: 'Global Disaster Alert and Coordination System, GDACS',
    coverage: 'Global major disasters',
    refreshIntervalMs: 15 * MINUTE,
    cacheTtlMs: 10 * MINUTE,
    confidenceClass: 'aggregated',
    termsNotes: 'Free public API/feed access. GDACS impact and alert scores supplement, rather than replace, authoritative primary-source warnings.',
  },
  'dwd-warnings': {
    id: 'dwd-warnings',
    name: 'DWD Weather Warnings',
    provider: 'Deutscher Wetterdienst (DWD)',
    url: 'https://www.dwd.de/DE/leistungen/opendata/help/warnungen/opendata_warnings.html',
    dataType: 'warning',
    auth: 'none',
    keyRequired: false,
    license: 'DWD Open Data terms',
    attribution: 'Quelle: Deutscher Wetterdienst (DWD)',
    coverage: 'Germany',
    refreshIntervalMs: 5 * MINUTE,
    cacheTtlMs: 3 * MINUTE,
    confidenceClass: 'official',
    termsNotes: 'Meteorological warnings only; kept separate from BBK/NINA civil-protection alerts.',
  },
  'nasa-gibs': {
    id: 'nasa-gibs',
    name: 'NASA GIBS Imagery',
    provider: 'NASA EOSDIS Global Imagery Browse Services (GIBS)',
    url: 'https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',
    dataType: 'raster',
    auth: 'none',
    keyRequired: false,
    license: 'NASA Earth Science Data and Information Policy',
    attribution: 'NASA/GSFC/ESDIS; imagery served by NASA GIBS',
    coverage: 'Global imagery, product dependent',
    refreshIntervalMs: null,
    cacheTtlMs: 24 * HOUR,
    confidenceClass: 'official',
    termsNotes: 'Direct WMTS use. Imagery is visual context only; active fire events remain sourced from NASA FIRMS.',
  },
  'open-meteo-marine': {
    id: 'open-meteo-marine',
    name: 'Open-Meteo Marine',
    provider: 'Open-Meteo',
    url: 'https://open-meteo.com/en/docs/marine-weather-api',
    dataType: 'forecast',
    auth: 'none',
    keyRequired: false,
    license: 'CC BY 4.0 data; free public API subject to Open-Meteo terms',
    attribution: 'Weather data by Open-Meteo.com',
    coverage: 'Global marine forecast grids',
    refreshIntervalMs: 30 * MINUTE,
    cacheTtlMs: 15 * MINUTE,
    confidenceClass: 'aggregated',
    termsNotes: 'The free keyless public API is for non-commercial use. Commercial use requires the customer API. Requested only for selected coordinates.',
  },
  'open-meteo-flood': {
    id: 'open-meteo-flood',
    name: 'Open-Meteo Flood / GloFAS',
    provider: 'Open-Meteo using Copernicus GloFAS data',
    url: 'https://open-meteo.com/en/docs/flood-api',
    dataType: 'forecast',
    auth: 'none',
    keyRequired: false,
    license: 'CC BY 4.0 data; free public API subject to Open-Meteo terms',
    attribution: 'Flood data by Open-Meteo.com; source model: Copernicus GloFAS',
    coverage: 'Global rivers at approximately 5 km model resolution',
    refreshIntervalMs: 6 * HOUR,
    cacheTtlMs: 30 * MINUTE,
    confidenceClass: 'aggregated',
    termsNotes: 'Forecast/model guidance, not a gauge measurement. WSV Pegelonline remains primary for concrete German federal-waterway gauges. Free keyless public API is non-commercial.',
  },
  'osm-overpass': {
    id: 'osm-overpass',
    name: 'OpenStreetMap Infrastructure',
    provider: 'OpenStreetMap contributors via Overpass API',
    url: 'https://overpass-api.de/api/interpreter',
    dataType: 'infrastructure',
    auth: 'none',
    keyRequired: false,
    license: 'Open Database License (ODbL) 1.0',
    attribution: '© OpenStreetMap contributors',
    coverage: 'Global, community-mapped and completeness varies by region/category',
    refreshIntervalMs: null,
    cacheTtlMs: 15 * MINUTE,
    confidenceClass: 'curated',
    termsNotes: 'Viewport/AOI queries only. Public Overpass capacity is best-effort; requests are bounded, cached and not polled aggressively.',
  },
});

export function getSourceRegistryEntry(id: string): SourceRegistryEntry | undefined {
  return SOURCE_REGISTRY[id];
}

export function listKeylessSources(): SourceRegistryEntry[] {
  return Object.values(SOURCE_REGISTRY).filter(source => !source.keyRequired && source.auth === 'none');
}
