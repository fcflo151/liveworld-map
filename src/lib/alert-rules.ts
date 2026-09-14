import type { AoiReport } from './aoi';
import type { WatchEvent } from './watch';

export const ALERT_RULES_KEY = 'liveworld.alert-rules.v1';
export const BROWSER_ALERTS_KEY = 'liveworld.alert-rules.browser.v1';
export const ALERT_RULE_VERSION = 1 as const;
export const MAX_ALERT_RULES = 40;

export type AlertRuleTrigger = 'enter' | 'exit' | 'count-above' | 'count-below';

export interface AoiAlertRule {
  version: typeof ALERT_RULE_VERSION;
  id: string;
  name: string;
  aoiId: string;
  layer: string;
  trigger: AlertRuleTrigger;
  threshold: number;
  cooldownMs: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface AlertRuleEvaluationState {
  counts: Record<string, number>;
  lastFiredAt: Record<string, number>;
}

export interface RuleNotification {
  id: string;
  ruleId: string;
  ruleName: string;
  aoiId: string;
  layer: string;
  trigger: AlertRuleTrigger;
  message: string;
  at: number;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const EMPTY_ALERT_EVALUATION: AlertRuleEvaluationState = { counts: {}, lastFiredAt: {} };

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function storageOrNull(storage?: StorageLike | null): StorageLike | null {
  if (storage !== undefined) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function validateAlertRule(value: unknown): AoiAlertRule | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const triggers: AlertRuleTrigger[] = ['enter', 'exit', 'count-above', 'count-below'];
  if (
    row.version !== ALERT_RULE_VERSION || typeof row.id !== 'string' || !row.id.trim()
    || typeof row.name !== 'string' || !row.name.trim()
    || typeof row.aoiId !== 'string' || !row.aoiId.trim()
    || typeof row.layer !== 'string' || !row.layer.trim()
    || !triggers.includes(row.trigger as AlertRuleTrigger)
    || !finite(row.threshold) || row.threshold < 0
    || !finite(row.cooldownMs) || row.cooldownMs < 0
    || typeof row.enabled !== 'boolean'
    || !finite(row.createdAt) || !finite(row.updatedAt)
  ) return null;
  return {
    version: ALERT_RULE_VERSION,
    id: row.id.trim(), name: row.name.trim().slice(0, 100), aoiId: row.aoiId.trim(), layer: row.layer.trim(),
    trigger: row.trigger as AlertRuleTrigger, threshold: Math.floor(row.threshold), cooldownMs: Math.floor(row.cooldownMs),
    enabled: row.enabled, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function createAlertRule(
  input: Pick<AoiAlertRule, 'name' | 'aoiId' | 'layer' | 'trigger'> & Partial<Pick<AoiAlertRule, 'threshold' | 'cooldownMs' | 'enabled'>>,
  options: { id?: string; now?: number } = {},
): AoiAlertRule {
  const now = finite(options.now) ? options.now : Date.now();
  const rule = validateAlertRule({
    version: ALERT_RULE_VERSION,
    id: options.id ?? `rule-${now.toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    threshold: input.threshold ?? 1,
    cooldownMs: input.cooldownMs ?? 5 * 60_000,
    enabled: input.enabled ?? true,
    createdAt: now, updatedAt: now,
    ...input,
  });
  if (!rule) throw new Error('The alert rule is invalid.');
  return rule;
}

export function parseAlertRules(raw: string | null): AoiAlertRule[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const byId = new Map<string, AoiAlertRule>();
    for (const value of parsed) {
      const rule = validateAlertRule(value);
      if (rule && (!byId.has(rule.id) || byId.get(rule.id)!.updatedAt < rule.updatedAt)) byId.set(rule.id, rule);
    }
    return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name)).slice(0, MAX_ALERT_RULES);
  } catch { return []; }
}

export function loadAlertRules(storage?: StorageLike | null): AoiAlertRule[] {
  const target = storageOrNull(storage);
  if (!target) return [];
  try { return parseAlertRules(target.getItem(ALERT_RULES_KEY)); } catch { return []; }
}

export function storeAlertRules(rules: readonly AoiAlertRule[], storage?: StorageLike | null): boolean {
  const target = storageOrNull(storage);
  if (!target) return false;
  try {
    const normalized = parseAlertRules(JSON.stringify(rules));
    if (normalized.length) target.setItem(ALERT_RULES_KEY, JSON.stringify(normalized));
    else target.removeItem(ALERT_RULES_KEY);
    return true;
  } catch { return false; }
}

function countFor(report: AoiReport | undefined, layer: string): number {
  if (!report) return 0;
  if (layer === '*') return report.total;
  return report.groups.find(group => group.key === layer)?.count ?? 0;
}

function condition(trigger: AlertRuleTrigger, value: number, threshold: number): boolean {
  return trigger === 'count-above' ? value > threshold : value < threshold;
}

export function evaluateAlertRules(
  rules: readonly AoiAlertRule[],
  reports: Readonly<Record<string, AoiReport>>,
  events: readonly WatchEvent[],
  previous: AlertRuleEvaluationState = EMPTY_ALERT_EVALUATION,
  now: number = Date.now(),
): { state: AlertRuleEvaluationState; notifications: RuleNotification[] } {
  const state: AlertRuleEvaluationState = { counts: {}, lastFiredAt: {} };
  const notifications: RuleNotification[] = [];

  for (const rule of rules) {
    if (!rule.enabled) continue;
    const currentCount = countFor(reports[rule.aoiId], rule.layer);
    state.counts[rule.id] = currentCount;
    const lastFired = previous.lastFiredAt[rule.id];
    if (lastFired !== undefined) state.lastFiredAt[rule.id] = lastFired;
    const cooledDown = lastFired === undefined || now - lastFired >= rule.cooldownMs;
    let message: string | null = null;

    if (rule.trigger === 'enter' || rule.trigger === 'exit') {
      const matches = events.filter(event => event.aoiId === rule.aoiId && event.kind === rule.trigger && (rule.layer === '*' || event.layer === rule.layer));
      if (matches.length && cooledDown) {
        const sample = matches.slice(0, 3).map(event => event.label).join(', ');
        message = `${matches.length} ${matches.length === 1 ? 'entity' : 'entities'} ${rule.trigger === 'enter' ? 'entered' : 'left'} the AOI: ${sample}${matches.length > 3 ? '…' : ''}`;
      }
    } else {
      const before = previous.counts[rule.id];
      if (before !== undefined && !condition(rule.trigger, before, rule.threshold) && condition(rule.trigger, currentCount, rule.threshold) && cooledDown) {
        message = `Entity count is ${currentCount}; threshold ${rule.trigger === 'count-above' ? '>' : '<'} ${rule.threshold} crossed.`;
      }
    }

    if (message) {
      state.lastFiredAt[rule.id] = now;
      notifications.push({
        id: `${rule.id}:${now}`, ruleId: rule.id, ruleName: rule.name, aoiId: rule.aoiId,
        layer: rule.layer, trigger: rule.trigger, message, at: now,
      });
    }
  }
  return { state, notifications };
}

export function appendRuleNotifications(current: readonly RuleNotification[], incoming: readonly RuleNotification[], limit = 80): RuleNotification[] {
  return [...incoming, ...current].sort((a, b) => b.at - a.at).slice(0, limit);
}
