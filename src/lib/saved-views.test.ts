import { describe, expect, it } from 'vitest';
import { createSavedView, loadSavedViews, parseSavedViews, removeSavedView, storeSavedViews, upsertSavedView, type SavedViewState, type StorageLike } from './saved-views';

const state: SavedViewState = {
  latitude: 48, longitude: 11, zoom: 7, projection: 'globe', mapStyle: 'dark', theme: 'core',
  activeLayers: { flights: true, cctv: false }, polygons: [], watchedAoiIds: [],
};

function memory(): StorageLike {
  const values = new Map<string, string>();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => { values.set(key, value); }, removeItem: key => { values.delete(key); } };
}

describe('saved views', () => {
  it('creates a deterministic normalized view', () => {
    const view = createSavedView(' Europe ', state, { id: 'v1', now: 100 });
    expect(view).toMatchObject({ id: 'v1', name: 'Europe', createdAt: 100, updatedAt: 100 });
    expect(Object.keys(view.activeLayers)).toEqual(['cctv', 'flights']);
  });

  it('drops malformed rows without losing valid views', () => {
    const view = createSavedView('Valid', state, { id: 'ok', now: 100 });
    expect(parseSavedViews(JSON.stringify([{ nope: true }, view]))).toEqual([view]);
  });

  it('persists, updates and deletes views', () => {
    const storage = memory();
    const first = createSavedView('First', state, { id: 'v1', now: 100 });
    expect(storeSavedViews([first], storage)).toBe(true);
    expect(loadSavedViews(storage)).toEqual([first]);
    const updated = { ...first, name: 'Updated', updatedAt: 200 };
    const list = upsertSavedView([first], updated);
    expect(list[0].name).toBe('Updated');
    expect(removeSavedView(list, 'v1')).toEqual([]);
  });

  it('rejects invalid coordinates', () => {
    expect(() => createSavedView('Bad', { ...state, latitude: 100 })).toThrow();
  });
});
