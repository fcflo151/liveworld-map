'use client';

import { useMemo, useState } from 'react';
import { Bell, BellRing, ShieldCheck, Trash2 } from 'lucide-react';
import { AOI_LAYERS } from '@/lib/aoi';
import { BROWSER_ALERTS_KEY, createAlertRule, storeAlertRules, type AoiAlertRule, type AlertRuleTrigger, type RuleNotification } from '@/lib/alert-rules';
import type { DrawnShape } from '@/lib/draw';

interface AlertRulesPanelProps {
  aois: readonly DrawnShape[];
  rules: readonly AoiAlertRule[];
  notifications: readonly RuleNotification[];
  onRulesChange: (rules: AoiAlertRule[]) => void;
  onLocateAoi: (aoiId: string) => void;
  onClearNotifications: () => void;
}

const TRIGGERS: Array<{ value: AlertRuleTrigger; label: string }> = [
  { value: 'enter', label: 'ENTERS AOI' }, { value: 'exit', label: 'LEAVES AOI' },
  { value: 'count-above', label: 'COUNT ABOVE' }, { value: 'count-below', label: 'COUNT BELOW' },
];

export default function AlertRulesPanel({ aois, rules, notifications, onRulesChange, onLocateAoi, onClearNotifications }: AlertRulesPanelProps) {
  const [aoiId, setAoiId] = useState(aois[0]?.id ?? '');
  const [layer, setLayer] = useState('*');
  const [trigger, setTrigger] = useState<AlertRuleTrigger>('enter');
  const [threshold, setThreshold] = useState(1);
  const [message, setMessage] = useState('');
  const selectedAoi = aois.find(aoi => aoi.id === aoiId) ?? aois[0];
  const effectiveAoiId = selectedAoi?.id ?? '';
  const areaAois = useMemo(() => aois.filter(aoi => aoi.geojson.geometry.type === 'Polygon'), [aois]);

  const updateRules = (next: AoiAlertRule[]) => {
    if (storeAlertRules(next)) onRulesChange(next);
    else setMessage('Browser storage is unavailable.');
  };

  const add = () => {
    if (!effectiveAoiId) { setMessage('Draw an area of interest first.'); return; }
    const aoi = aois.find(item => item.id === effectiveAoiId)!;
    const layerLabel = layer === '*' ? 'Any entity' : AOI_LAYERS.find(item => item.key === layer)?.label ?? layer;
    try {
      const rule = createAlertRule({
        name: `${layerLabel} · ${aoi.name}`,
        aoiId: effectiveAoiId, layer, trigger,
        threshold: trigger.startsWith('count-') ? threshold : 1,
      });
      updateRules([rule, ...rules]);
      setMessage('Rule armed. The first sweep establishes its baseline.');
    } catch { setMessage('Unable to create this rule.'); }
  };

  const enableBrowserAlerts = async () => {
    if (typeof Notification === 'undefined') { setMessage('Browser notifications are not supported here.'); return; }
    const permission = await Notification.requestPermission();
    try { localStorage.setItem(BROWSER_ALERTS_KEY, permission === 'granted' ? 'on' : 'off'); } catch { /* preference remains session-only */ }
    setMessage(permission === 'granted' ? 'Browser notifications enabled.' : 'Notification permission was not granted.');
  };

  return (
    <section aria-label="AOI alert rules" className="glass-panel p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-white/[0.06] pb-2">
        <BellRing className="h-3.5 w-3.5 text-[#FFB74D]" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[10px] font-mono tracking-[0.2em] text-white/75">AOI ALERT RULES</h2>
          <p className="text-[9px] font-mono text-white/30">Crossings and count thresholds</p>
        </div>
        <button type="button" onClick={enableBrowserAlerts} title="Enable browser notifications" className="rounded border border-white/10 p-1.5 text-white/40 hover:text-[#FFB74D]"><Bell className="h-3 w-3" /></button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <select value={effectiveAoiId} onChange={event => setAoiId(event.target.value)} aria-label="Area of interest" className="rounded border border-white/10 bg-black/70 px-2 py-2 text-[9px] font-mono text-white/65 outline-none">
          {areaAois.map(aoi => <option key={aoi.id} value={aoi.id}>{aoi.name}</option>)}
          {!areaAois.length && <option value="">DRAW AN AOI FIRST</option>}
        </select>
        <select value={layer} onChange={event => setLayer(event.target.value)} aria-label="Entity layer" className="rounded border border-white/10 bg-black/70 px-2 py-2 text-[9px] font-mono text-white/65 outline-none">
          <option value="*">ANY ENTITY</option>
          {AOI_LAYERS.map(item => <option key={item.key} value={item.key}>{item.label.toUpperCase()}</option>)}
        </select>
        <select value={trigger} onChange={event => setTrigger(event.target.value as AlertRuleTrigger)} aria-label="Alert trigger" className="rounded border border-white/10 bg-black/70 px-2 py-2 text-[9px] font-mono text-white/65 outline-none">
          {TRIGGERS.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        {trigger.startsWith('count-') ? (
          <input type="number" min={0} value={threshold} onChange={event => setThreshold(Math.max(0, Number(event.target.value) || 0))} aria-label="Entity count threshold" className="rounded border border-white/10 bg-black/70 px-2 py-2 text-[9px] font-mono text-white/65 outline-none" />
        ) : <div className="rounded border border-white/[0.06] px-2 py-2 text-[9px] font-mono text-white/25">5 MIN COOLDOWN</div>}
      </div>
      <button type="button" onClick={add} disabled={!areaAois.length} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-[#FFB74D]/30 bg-[#FFB74D]/10 py-2 text-[9px] font-mono text-[#FFB74D] enabled:hover:bg-[#FFB74D]/20 disabled:opacity-30">
        <ShieldCheck className="h-3 w-3" /> ARM RULE
      </button>
      {message && <p role="status" className="mt-1.5 text-[9px] font-mono text-white/40">{message}</p>}

      <div className="mt-3 max-h-[210px] space-y-1.5 overflow-y-auto pr-1 styled-scrollbar">
        {rules.map(rule => (
          <article key={rule.id} className="flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.025] p-2">
            <button
              type="button"
              aria-pressed={rule.enabled}
              onClick={() => updateRules(rules.map(item => item.id === rule.id ? { ...item, enabled: !item.enabled, updatedAt: Date.now() } : item))}
              title={rule.enabled ? 'Disable rule' : 'Enable rule'}
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${rule.enabled ? 'bg-[#00E676] shadow-[0_0_7px_#00E676]' : 'bg-white/20'}`}
            />
            <button type="button" onClick={() => onLocateAoi(rule.aoiId)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[10px] font-mono text-white/70">{rule.name}</span>
              <span className="block text-[8px] font-mono text-white/25">{rule.trigger.toUpperCase()}{rule.trigger.startsWith('count-') ? ` ${rule.threshold}` : ''}</span>
            </button>
            <button type="button" onClick={() => updateRules(rules.filter(item => item.id !== rule.id))} aria-label={`Delete ${rule.name}`} className="rounded p-1 text-white/25 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
          </article>
        ))}
        {!rules.length && <p className="rounded-lg border border-dashed border-white/[0.08] px-3 py-5 text-center text-[9px] font-mono text-white/30">NO RULES ARMED</p>}
      </div>

      <div className="mt-3 border-t border-white/[0.06] pt-2">
        <div className="mb-1.5 flex items-center justify-between text-[9px] font-mono text-white/35"><span>RECENT TRIGGERS</span>{notifications.length > 0 && <button onClick={onClearNotifications} className="hover:text-white/70">CLEAR</button>}</div>
        <div className="max-h-[150px] space-y-1 overflow-y-auto styled-scrollbar">
          {notifications.slice(0, 20).map(note => (
            <button key={note.id} type="button" onClick={() => onLocateAoi(note.aoiId)} className="block w-full rounded border border-[#FFB74D]/10 bg-[#FFB74D]/[0.04] px-2 py-1.5 text-left">
              <span className="block text-[9px] font-mono text-[#FFB74D]">{note.ruleName}</span>
              <span className="block text-[8px] font-mono leading-relaxed text-white/35">{note.message}</span>
            </button>
          ))}
          {!notifications.length && <p className="text-[9px] font-mono text-white/20">No rule has fired in this session.</p>}
        </div>
      </div>
    </section>
  );
}
