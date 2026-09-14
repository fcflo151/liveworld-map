import type { DrawnShape } from './draw';
import { deserializeShapes } from './aoi-export';

export const SAVED_VIEWS_KEY = 'liveworld.saved-views.v1';
export const SAVED_VIEW_VERSION = 1 as const;
export const MAX_SAVED_VIEWS = 24;

export interface SavedViewState {
  latitude: number;
  longitude: number;
  zoom: number;
  projection: 'globe' | 'mercator';
  mapStyle: 'dark' | 'satellite';
  theme: 'core' | 'ghost';
  activeLayers: Record<string, boolean>;
  polygons: DrawnShape[];
  watchedAoiIds: string[];
}

export interface SavedView extends SavedViewState {
  version: typeof SAVED_VIEW_VERSION;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function storageOrNull(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function cleanLayers(value: unknown): Record<string, boolean> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.some(([key, enabled]) => !key.trim() || typeof enabled !== 'boolean')) return null;
  return Object.fromEntries(entries.sort(([a], [b]) => a.localeCompare(b))) as Record<string, boolean>;
}

function cleanIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some(id => typeof id !== 'string')) return null;
  return [...new Set(value.map(id => id.trim()).filter(Boolean))].sort();
}

export function validateSavedView(value: unknown): SavedView | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const layers = cleanLayers(row.activeLayers);
  const watched = cleanIds(row.watchedAoiIds);
  const polygons = deserializeShapes(JSON.stringify(row.polygons ?? []));
  if (
    row.version !== SAVED_VIEW_VERSION || typeof row.id !== 'string' || !row.id.trim()
    || typeof row.name !== 'string' || !row.name.trim()
    || !finite(row.createdAt) || !finite(row.updatedAt)
    || !finite(row.latitude) || Math.abs(row.latitude) > 90
    || !finite(row.longitude) || Math.abs(row.longitude) > 180
    || !finite(row.zoom) || row.zoom < 0 || row.zoom > 24
    || (row.projection !== 'globe' && row.projection !== 'mercator')
    || (row.mapStyle !== 'dark' && row.mapStyle !== 'satellite')
    || (row.theme !== 'core' && row.theme !== 'ghost')
    || !layers || !watched || !Array.isArray(row.polygons)
    || polygons.length !== row.polygons.length
  ) return null;

  const polygonIds = new Set(polygons.map(shape => shape.id));
  return {
    version: SAVED_VIEW_VERSION,
    id: row.id.trim(), name: row.name.trim().slice(0, 80),
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    latitude: row.latitude, longitude: row.longitude, zoom: row.zoom,
    projection: row.projection, mapStyle: row.mapStyle, theme: row.theme,
    activeLayers: layers, polygons,
    watchedAoiIds: watched.filter(id => polygonIds.has(id)),
  };
}

export function createSavedView(
  name: string,
  state: SavedViewState,
  options: { id?: string; now?: number } = {},
): SavedView {
  const now = finite(options.now) ? options.now : Date.now();
  const candidate = validateSavedView({
    ...state,
    version: SAVED_VIEW_VERSION,
    id: options.id ?? `view-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    createdAt: now,
    updatedAt: now,
  });
  if (!candidate) throw new Error('The current map state cannot be saved.');
  return candidate;
}

export function parseSavedViews(raw: string | null): SavedView[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, SavedView>();
    for (const value of parsed) {
      const view = validateSavedView(value);
      if (view && (!byId.has(view.id) || byId.get(view.id)!.updatedAt < view.updatedAt)) byId.set(view.id, view);
    }
    return [...byId.values()]
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
      .slice(0, MAX_SAVED_VIEWS);
  } catch {
    return [];
  }
}

export function loadSavedViews(storage?: StorageLike | null): SavedView[] {
  const target = storageOrNull(storage);
  if (!target) return [];
  try { return parseSavedViews(target.getItem(SAVED_VIEWS_KEY)); } catch { return []; }
}

export function storeSavedViews(views: readonly SavedView[], storage?: StorageLike | null): boolean {
  const target = storageOrNull(storage);
  if (!target) return false;
  const normalized = parseSavedViews(JSON.stringify(views));
  try {
    if (normalized.length) target.setItem(SAVED_VIEWS_KEY, JSON.stringify(normalized));
    else target.removeItem(SAVED_VIEWS_KEY);
    return true;
  } catch {
    return false;
  }
}

export function upsertSavedView(views: readonly SavedView[], view: SavedView): SavedView[] {
  return parseSavedViews(JSON.stringify([view, ...views.filter(item => item.id !== view.id)]));
}

export function removeSavedView(views: readonly SavedView[], id: string): SavedView[] {
  return views.filter(view => view.id !== id);
}
