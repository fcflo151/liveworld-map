import { describe, expect, it } from 'vitest';
import { createAlertRule, evaluateAlertRules, loadAlertRules, storeAlertRules, type StorageLike } from './alert-rules';
import type { AoiReport } from './aoi';
import type { WatchEvent } from './watch';

const report = (count: number): AoiReport => ({ total: count, groups: count ? [{ key: 'military_flights', label: 'Military', color: '#f00', count, items: [], memberIds: [] }] : [] });
const memberReport = (...ids: string[]): AoiReport => ({
  total: ids.length,
  groups: ids.length ? [{
    key: 'military_flights', label: 'Military', color: '#f00', count: ids.length,
    items: ids.slice(0, 50).map((id, index) => ({ id, label: `Aircraft ${index + 1}`, lat: 50, lng: 10 })),
    memberIds: ids,
  }] : [],
});
const memory = (): StorageLike => { const map = new Map<string, string>(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: k => { map.delete(k); } }; };

describe('AOI alert rules', () => {
  it('seeds a threshold baseline and fires only when it is crossed', () => {
    const rule = createAlertRule({ name: 'Busy', aoiId: 'a1', layer: '*', trigger: 'count-above', threshold: 2 }, { id: 'r1', now: 1 });
    const seeded = evaluateAlertRules([rule], { a1: report(2) }, [], undefined, 10);
    expect(seeded.notifications).toEqual([]);
    const fired = evaluateAlertRules([rule], { a1: report(3) }, [], seeded.state, 20);
    expect(fired.notifications).toHaveLength(1);
    expect(fired.notifications[0].message).toContain('threshold > 2');
  });

  it('matches entry events by AOI and layer', () => {
    const rule = createAlertRule({ name: 'Aircraft', aoiId: 'a1', layer: 'military_flights', trigger: 'enter', cooldownMs: 0 }, { id: 'r1', now: 1 });
    const event: WatchEvent = { id: 'w1', kind: 'enter', aoiId: 'a1', layer: 'military_flights', layerLabel: 'Military', color: '#f00', label: 'VIPER1', at: 10 };
    expect(evaluateAlertRules([rule], { a1: report(1) }, [event], undefined, 10).notifications[0].message).toContain('VIPER1');
  });

  it('derives entry transitions for a rule-only AOI after the baseline sweep', () => {
    const rule = createAlertRule({ name: 'Aircraft', aoiId: 'a1', layer: 'military_flights', trigger: 'enter', cooldownMs: 0 }, { id: 'r1', now: 1 });
    const seeded = evaluateAlertRules([rule], { a1: memberReport('abc') }, [], undefined, 10);
    expect(seeded.notifications).toEqual([]);

    const fired = evaluateAlertRules([rule], { a1: memberReport('abc', 'def') }, [], seeded.state, 20);
    expect(fired.notifications).toHaveLength(1);
    expect(fired.notifications[0].message).toContain('Aircraft 2');
  });

  it('derives exit transitions for a rule-only AOI after the baseline sweep', () => {
    const rule = createAlertRule({ name: 'Aircraft', aoiId: 'a1', layer: 'military_flights', trigger: 'exit', cooldownMs: 0 }, { id: 'r1', now: 1 });
    const seeded = evaluateAlertRules([rule], { a1: memberReport('abc', 'def') }, [], undefined, 10);
    expect(seeded.notifications).toEqual([]);

    const fired = evaluateAlertRules([rule], { a1: memberReport('def') }, [], seeded.state, 20);
    expect(fired.notifications).toHaveLength(1);
    expect(fired.notifications[0].message).toContain('abc');
  });

  it('honours cooldowns', () => {
    const rule = createAlertRule({ name: 'Entry', aoiId: 'a1', layer: '*', trigger: 'enter', cooldownMs: 100 }, { id: 'r1', now: 1 });
    const event: WatchEvent = { id: 'w1', kind: 'enter', aoiId: 'a1', layer: 'x', layerLabel: 'X', color: '#fff', label: 'one', at: 10 };
    const first = evaluateAlertRules([rule], { a1: report(1) }, [event], undefined, 10);
    expect(evaluateAlertRules([rule], { a1: report(1) }, [event], first.state, 50).notifications).toEqual([]);
  });

  it('persists valid rules and ignores invalid records', () => {
    const storage = memory();
    const rule = createAlertRule({ name: 'Entry', aoiId: 'a1', layer: '*', trigger: 'enter' }, { id: 'r1', now: 1 });
    expect(storeAlertRules([rule], storage)).toBe(true);
    expect(loadAlertRules(storage)).toEqual([rule]);
  });
});
