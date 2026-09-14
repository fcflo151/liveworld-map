'use client';

import { useState } from 'react';
import {
  Activity,
  Bell,
  Camera,
  Compass,
  FileText,
  History,
  MapPin,
  X,
} from 'lucide-react';
import type { SavedView, SavedViewState } from '@/lib/saved-views';
import type { AoiAlertRule, RuleNotification } from '@/lib/alert-rules';
import type { HistorySnapshot, SnapshotComparison } from '@/lib/history-snapshots';
import type { FeedHealth } from '@/lib/feed-health';
import type { SituationReportInput } from '@/lib/situation-report';
import type { DrawnShape } from '@/lib/draw';

import SavedViewsPanel from './SavedViewsPanel';
import AlertRulesPanel from './AlertRulesPanel';
import HistoryTimeline from './HistoryTimeline';
import FeedHealthPanel from './FeedHealthPanel';
import SituationReportPanel from './SituationReportPanel';

export type MissionWorkspaceTab = 'views' | 'rules' | 'history' | 'sources' | 'report';

export interface MissionWorkspaceProps {
  onClose?: () => void;
  initialTab?: MissionWorkspaceTab;
  className?: string;

  // Views tab
  currentViewState: SavedViewState;
  savedViews: readonly SavedView[];
  onViewsChange: (views: SavedView[]) => void;
  onApplyView: (view: SavedView) => void;
  activeViewId?: string | null;

  // Rules tab
  aois: readonly DrawnShape[];
  alertRules: readonly AoiAlertRule[];
  ruleNotifications: readonly RuleNotification[];
  onRulesChange: (rules: AoiAlertRule[]) => void;
  onLocateAoi: (aoiId: string) => void;
  onClearNotifications: () => void;

  // History tab
  snapshots: readonly HistorySnapshot[];
  activeSnapshotId?: string | null;
  onReplaySnapshot: (snapshot: HistorySnapshot) => void;
  onDeleteSnapshot?: (snapshot: HistorySnapshot) => void;
  onCaptureSnapshot?: () => void;
  onCompareSnapshots?: (comparison: SnapshotComparison, before: HistorySnapshot, after: HistorySnapshot) => void;

  // Sources tab
  feeds: readonly FeedHealth[];

  // Report tab
  situationReportInput: SituationReportInput;
}

const TABS: Array<{ id: MissionWorkspaceTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'views', label: 'VIEWS', icon: MapPin },
  { id: 'rules', label: 'RULES', icon: Bell },
  { id: 'history', label: 'HISTORY', icon: History },
  { id: 'sources', label: 'SOURCES', icon: Activity },
  { id: 'report', label: 'REPORT', icon: FileText },
];

export default function MissionWorkspace({
  onClose,
  initialTab = 'views',
  className = '',
  currentViewState,
  savedViews,
  onViewsChange,
  onApplyView,
  activeViewId,
  aois,
  alertRules,
  ruleNotifications,
  onRulesChange,
  onLocateAoi,
  onClearNotifications,
  snapshots,
  activeSnapshotId,
  onReplaySnapshot,
  onDeleteSnapshot,
  onCaptureSnapshot,
  onCompareSnapshots,
  feeds,
  situationReportInput,
}: MissionWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<MissionWorkspaceTab>(initialTab);

  const activeRulesCount = alertRules.filter(r => r.enabled).length;
  const offlineFeedsCount = feeds.filter(f => f.status === 'offline').length;

  return (
    <div
      className={`glass-panel flex flex-col max-h-[85vh] w-full max-w-[440px] pointer-events-auto rounded-xl border border-white/10 bg-black/80 font-mono shadow-2xl backdrop-blur-xl overflow-hidden ${className}`.trim()}
      aria-label="Mission Workspace"
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between border-b border-white/[0.08] px-3.5 py-2.5 bg-white/[0.02]">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-[var(--gold-primary)]" />
          <span className="text-[11px] font-bold tracking-[0.2em] text-white/90">MISSION WORKSPACE</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Mission Workspace"
            className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </header>

      {/* ── Navigation Tabs ── */}
      <nav
        role="tablist"
        aria-label="Mission Workspace sections"
        className="flex border-b border-white/[0.08] bg-black/40 p-1 gap-1 overflow-x-auto styled-scrollbar"
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;

          let badge: string | number | null = null;
          if (tab.id === 'views' && savedViews.length > 0) badge = savedViews.length;
          if (tab.id === 'rules' && activeRulesCount > 0) badge = activeRulesCount;
          if (tab.id === 'history' && snapshots.length > 0) badge = snapshots.length;
          if (tab.id === 'sources' && offlineFeedsCount > 0) badge = `${offlineFeedsCount}!`;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[62px] inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[9px] font-mono tracking-wider transition-all ${
                isActive
                  ? 'border border-[var(--gold-primary)]/40 bg-[var(--gold-primary)]/15 text-[var(--gold-primary)] shadow-sm'
                  : 'border border-transparent text-white/45 hover:bg-white/[0.04] hover:text-white/75'
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span>{tab.label}</span>
              {badge !== null && (
                <span
                  className={`ml-0.5 rounded px-1 py-0.2 text-[8px] font-bold tabular-nums ${
                    tab.id === 'sources' && offlineFeedsCount > 0
                      ? 'bg-red-500/25 text-red-300'
                      : isActive
                        ? 'bg-[var(--gold-primary)]/25 text-[var(--gold-primary)]'
                        : 'bg-white/10 text-white/50'
                  }`}
                >
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Tab Content Panel ── */}
      <main className="flex-1 overflow-y-auto styled-scrollbar p-2">
        {activeTab === 'views' && (
          <SavedViewsPanel
            current={currentViewState}
            views={savedViews}
            onViewsChange={onViewsChange}
            onApply={onApplyView}
            activeViewId={activeViewId}
          />
        )}

        {activeTab === 'rules' && (
          <AlertRulesPanel
            aois={aois}
            rules={alertRules}
            notifications={ruleNotifications}
            onRulesChange={onRulesChange}
            onLocateAoi={onLocateAoi}
            onClearNotifications={onClearNotifications}
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-2">
            {onCaptureSnapshot && (
              <div className="flex justify-end px-1">
                <button
                  type="button"
                  onClick={onCaptureSnapshot}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[var(--cyan-primary)]/40 bg-[var(--cyan-primary)]/10 px-2.5 py-1 text-[9px] font-mono text-[var(--cyan-primary)] hover:bg-[var(--cyan-primary)]/20 transition-colors"
                >
                  <Camera className="h-3 w-3" />
                  SNAPSHOT AUFZEICHNEN
                </button>
              </div>
            )}
            <HistoryTimeline
              snapshots={snapshots}
              activeSnapshotId={activeSnapshotId}
              onReplay={onReplaySnapshot}
              onDelete={onDeleteSnapshot}
              onCompare={onCompareSnapshots}
              className="max-w-none border-none bg-transparent p-1 shadow-none backdrop-blur-none"
            />
          </div>
        )}

        {activeTab === 'sources' && (
          <FeedHealthPanel
            feeds={feeds}
            className="max-w-none border-none bg-transparent p-1 shadow-none backdrop-blur-none"
          />
        )}

        {activeTab === 'report' && (
          <SituationReportPanel
            input={situationReportInput}
            className="max-w-none border-none bg-transparent p-1 shadow-none backdrop-blur-none"
          />
        )}
      </main>
    </div>
  );
}
