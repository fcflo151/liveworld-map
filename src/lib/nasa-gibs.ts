import type { RasterSourceSpecification } from 'maplibre-gl';

export type GibsLayerId = 'true-color' | 'aerosol';

export interface GibsLayerDefinition {
  id: GibsLayerId;
  label: string;
  layer: string;
  format: 'image/jpeg' | 'image/png';
  opacity: number;
  maxzoom: number;
  description: string;
}

export const NASA_GIBS_LAYERS: readonly GibsLayerDefinition[] = Object.freeze([
  {
    id: 'true-color',
    label: 'NASA True Color (MODIS Terra)',
    layer: 'MODIS_Terra_CorrectedReflectance_TrueColor',
    format: 'image/jpeg',
    opacity: 0.82,
    maxzoom: 9,
    description: 'Daily natural-color satellite imagery. Visual context only; active fires remain sourced from FIRMS.',
  },
  {
    id: 'aerosol',
    label: 'NASA Aerosol (MODIS Terra)',
    layer: 'MODIS_Terra_Aerosol',
    format: 'image/png',
    opacity: 0.62,
    maxzoom: 8,
    description: 'Satellite-derived aerosol product for atmospheric context; not a second fire-event feed.',
  },
]);

export function normalizeGibsDate(value: string | Date = new Date()): string {
  const date = value instanceof Date ? value : new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid NASA GIBS date');
  return date.toISOString().slice(0, 10);
}

export function getGibsLayer(id: GibsLayerId): GibsLayerDefinition {
  const layer = NASA_GIBS_LAYERS.find(item => item.id === id);
  if (!layer) throw new Error(`Unknown NASA GIBS layer: ${id}`);
  return layer;
}

export function buildGibsWmsTileUrl(id: GibsLayerId, date: string | Date = new Date()): string {
  const layer = getGibsLayer(id);
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    REQUEST: 'GetMap',
    VERSION: '1.3.0',
    LAYERS: layer.layer,
    STYLES: '',
    FORMAT: layer.format,
    TRANSPARENT: layer.format === 'image/png' ? 'TRUE' : 'FALSE',
    HEIGHT: '256',
    WIDTH: '256',
    CRS: 'EPSG:3857',
    TIME: normalizeGibsDate(date),
  });
  return `https://gibs.earthdata.nasa.gov/wms/epsg3857/best/wms.cgi?${params.toString()}&BBOX={bbox-epsg-3857}`;
}

export function createGibsRasterSource(id: GibsLayerId, date: string | Date = new Date()): RasterSourceSpecification {
  const layer = getGibsLayer(id);
  return {
    type: 'raster',
    tiles: [buildGibsWmsTileUrl(id, date)],
    tileSize: 256,
    maxzoom: layer.maxzoom,
    attribution: 'NASA/GSFC/ESDIS · NASA GIBS',
  };
}
