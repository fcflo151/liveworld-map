from pathlib import Path
import re


def load_normalized(path: Path) -> tuple[str, str]:
    raw = path.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in raw else '\n'
    return raw.replace('\r\n', '\n'), newline


def write_preserved(path: Path, text: str, newline: str) -> None:
    if newline == '\r\n':
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))


page_path = Path('src/app/page.tsx')
page, page_newline = load_normalized(page_path)


def once(old: str, new: str, label: str) -> None:
    global page
    count = page.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    page = page.replace(old, new, 1)


# Remove lazy imports that were superseded by the MissionWorkspace container.
page = re.sub(
    r"^const (SavedViewsPanel|AlertRulesPanel|FeedHealthPanel|HistoryTimeline|SituationReportPanel) = dynamic\([^\n]+\);\n",
    '',
    page,
    flags=re.M,
)
page = page.replace(
    "import { evaluateFeedHealthMany, type FeedHealth, type FeedHealthInput, type FeedTrustClass } from '@/lib/feed-health';\n",
    "import { evaluateFeedHealthMany, type FeedHealthInput, type FeedTrustClass } from '@/lib/feed-health';\n",
)
page = page.replace("import type { SituationReportInput } from '@/lib/situation-report';\n", '')

current_view_marker = "  const handleApplySavedView = useCallback((view: SavedView) => {\n"
insert = """  const polygonAois = useMemo(
    () => drawnPolygons.filter(shape => shape.geojson.geometry.type === 'Polygon'),
    [drawnPolygons],
  );

  const handleViewsChange = useCallback((views: SavedView[]) => {
    setSavedViews(views);
    setActiveViewId(current => current && views.some(view => view.id === current) ? current : null);
  }, []);

"""
if insert.strip() not in page:
    if current_view_marker not in page:
        raise SystemExit('current view insertion marker missing')
    page = page.replace(current_view_marker, insert + current_view_marker, 1)

once(
    """  const closeAllSidePanels = useCallback(() => {
    setShowIntel(false);
    setShowMarkets(false);
    setShowAlerts(false);
    setShowSpaceCam(false);
    setShowDrawing(false);
    setShowDirections(false);
    setShowDesktopSearch(false);
    setShowArcGIS(false);
    setShowRemote(false);
  }, []);
""",
    """  const closeAllSidePanels = useCallback(() => {
    setShowIntel(false);
    setShowMarkets(false);
    setShowAlerts(false);
    setShowSpaceCam(false);
    setShowDrawing(false);
    setShowDirections(false);
    setShowDesktopSearch(false);
    setShowArcGIS(false);
    setShowRemote(false);
    setShowWorkspace(false);
    setMobilePanel(null);
  }, []);
""",
    'closeAllSidePanels',
)

replacements = {
    "onClick={() => { setShowIntel(!showIntel); setShowMarkets(false); setShowAlerts(false); }}": "onClick={() => { const next = !showIntel; closeAllSidePanels(); setShowIntel(next); }}",
    "onClick={() => { setShowIntel(false); setShowAlerts(false); setShowMarkets(false); setShowSpaceCam(v => !v); }}": "onClick={() => { const next = !showSpaceCam; closeAllSidePanels(); setShowSpaceCam(next); }}",
    "onClick={() => { setShowMarkets(!showMarkets); setShowIntel(false); setShowAlerts(false); setShowSpaceCam(false); }}": "onClick={() => { const next = !showMarkets; closeAllSidePanels(); setShowMarkets(next); }}",
    "onClick={() => { setShowAlerts(!showAlerts); setShowIntel(false); setShowMarkets(false); setShowDrawing(false); }}": "onClick={() => { const next = !showAlerts; closeAllSidePanels(); setShowAlerts(next); }}",
    "onClick={() => { setShowDrawing(!showDrawing); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); }}": "onClick={() => { const next = !showDrawing; closeAllSidePanels(); setShowDrawing(next); }}",
    "onClick={() => { setShowDirections(!showDirections); if (showDirections) { setActiveRoute(null); } setShowDesktopSearch(false); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); }}": "onClick={() => { const next = !showDirections; closeAllSidePanels(); if (!next) setActiveRoute(null); setShowDirections(next); }}",
    "onClick={() => { setShowDesktopSearch(!showDesktopSearch); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); }}": "onClick={() => { const next = !showDesktopSearch; closeAllSidePanels(); setShowDesktopSearch(next); }}",
    "onClick={() => { setShowArcGIS(!showArcGIS); setShowRemote(false); }}": "onClick={() => { const next = !showArcGIS; closeAllSidePanels(); setShowArcGIS(next); }}",
    "onClick={() => { setShowRemote(!showRemote); setShowArcGIS(false); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); setShowDesktopSearch(false); }}": "onClick={() => { const next = !showRemote; closeAllSidePanels(); setShowRemote(next); }}",
}
for old, new in replacements.items():
    once(old, new, old[:48])

# Keyboard openings must obey the same panel exclusivity contract.
once(
    "if (e.key === 'm') setShowMarkets(p => !p);",
    "if (e.key === 'm') { setShowMarkets(p => !p); setShowWorkspace(false); setShowIntel(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); setShowDirections(false); setShowDesktopSearch(false); setShowArcGIS(false); setShowRemote(false); }",
    'keyboard markets',
)
once(
    "if (e.key === 'i') setShowIntel(p => !p);",
    "if (e.key === 'i') { setShowIntel(p => !p); setShowWorkspace(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); setShowDirections(false); setShowDesktopSearch(false); setShowArcGIS(false); setShowRemote(false); }",
    'keyboard intel',
)
once(
    "if (e.key === 's') { setShowDesktopSearch(p => !p); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); }",
    "if (e.key === 's') { setShowDesktopSearch(p => !p); setShowWorkspace(false); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); setShowDirections(false); setShowArcGIS(false); setShowRemote(false); }",
    'keyboard search',
)
once(
    "setShowDesktopSearch(true); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false);",
    "setShowDesktopSearch(true); setShowWorkspace(false); setShowIntel(false); setShowMarkets(false); setShowAlerts(false); setShowSpaceCam(false); setShowDrawing(false); setShowDirections(false); setShowArcGIS(false); setShowRemote(false);",
    'ctrl-f search',
)

# Insert the desktop Workspace tool immediately after the existing Search tool.
search_anchor = '<span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-mono tracking-wider text-white/80 bg-black/80 backdrop-blur-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">SEARCH</span>'
search_pos = page.find(search_anchor)
if search_pos < 0:
    raise SystemExit('desktop search anchor missing')
sep_marker = '\n\n        {/* Separator */}\n        <div className="w-4 h-px bg-white/10 mx-auto" />'
sep_pos = page.find(sep_marker, search_pos)
if sep_pos < 0:
    raise SystemExit('desktop search separator missing')
workspace_block = """

        <div className="relative group">
          <button onClick={() => { const next = !showWorkspace; closeAllSidePanels(); setShowWorkspace(next); }} className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-white/50 ${showWorkspace ? 'bg-[var(--gold-primary)]/20' : 'hover:bg-white/10'}`} title="Mission Workspace — saved views, AOI rules, history, source health and reports" aria-label="Mission Workspace" aria-expanded={showWorkspace}>
            <Compass className={`w-4 h-4 ${showWorkspace ? 'text-[var(--gold-primary)]' : 'text-white/60'}`} />
            {showWorkspace && <span aria-hidden="true" className="absolute -right-1 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-full bg-current text-[var(--gold-primary)]" />}
          </button>
          <span className="absolute right-11 top-1/2 -translate-y-1/2 px-2 py-1 text-[9px] font-mono tracking-wider text-white/80 bg-black/80 backdrop-blur-sm rounded whitespace-nowrap opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity pointer-events-none">MISSION</span>
          <AnimatePresence>
            {showWorkspace && (
              <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="absolute right-12 top-1/2 -translate-y-1/2 w-[420px] max-w-[calc(100vw-64px)]">
                <MissionWorkspace
                  currentViewState={currentViewState}
                  savedViews={savedViews}
                  onViewsChange={handleViewsChange}
                  onApplyView={handleApplySavedView}
                  activeViewId={activeViewId}
                  aois={polygonAois}
                  alertRules={alertRules}
                  ruleNotifications={ruleNotifications}
                  onRulesChange={setAlertRules}
                  onLocateAoi={handleLocateAoi}
                  onClearNotifications={() => setRuleNotifications([])}
                  snapshots={historySnapshots}
                  activeSnapshotId={activeSnapshotId}
                  onCaptureSnapshot={handleCaptureSnapshot}
                  onReplaySnapshot={handleReplaySnapshot}
                  onDeleteSnapshot={handleDeleteSnapshot}
                  feeds={evaluatedFeeds}
                  situationReportInput={situationReportInput}
                  onClose={() => setShowWorkspace(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>"""
if 'aria-label="Mission Workspace"' not in page:
    page = page[:sep_pos] + workspace_block + page[sep_pos:]

once(
    "{ id: 'route' as const, icon: Route, label: 'ROUTE' },\n                { id: 'remote' as const, icon: Bluetooth, label: 'REMOTE' },",
    "{ id: 'route' as const, icon: Route, label: 'ROUTE' },\n                { id: 'workspace' as const, icon: Compass, label: 'MISSION' },\n                { id: 'remote' as const, icon: Bluetooth, label: 'REMOTE' },",
    'mobile workspace tab',
)

once(
    """                        setMobilePanel(null);
                        setShowDirections((open) => {
                          if (open) setActiveRoute(null);
                          return !open;
                        });
                        return;
                      }
                      setMobilePanel(mobilePanel === tab.id ? null : tab.id);
""",
    """                        const next = !showDirections;
                        closeAllSidePanels();
                        if (!next) setActiveRoute(null);
                        setShowDirections(next);
                        return;
                      }
                      const next = mobilePanel === tab.id ? null : tab.id;
                      closeAllSidePanels();
                      setMobilePanel(next);
""",
    'mobile panel exclusivity',
)

once(
    "{mobilePanel === 'layers' ? 'LAYERS & STATS' : mobilePanel === 'markets' ? 'MARKETS & INTEL' : mobilePanel === 'intel' ? 'INTEL FEED' : mobilePanel === 'recon' ? 'LIVEWORLD RECON' : mobilePanel === 'remote' ? 'WORLD REMOTE' : 'SEARCH'}",
    "{mobilePanel === 'layers' ? 'LAYERS & STATS' : mobilePanel === 'markets' ? 'MARKETS & INTEL' : mobilePanel === 'intel' ? 'INTEL FEED' : mobilePanel === 'recon' ? 'LIVEWORLD RECON' : mobilePanel === 'workspace' ? 'MISSION WORKSPACE' : mobilePanel === 'remote' ? 'WORLD REMOTE' : 'SEARCH'}",
    'mobile drawer title',
)

remote_render = """                  {mobilePanel === 'remote' && (
                    <WorldRemote onClose={() => setMobilePanel(null)} onPlaceOnMap={(devs) => {
"""
workspace_mobile = """                  {mobilePanel === 'workspace' && (
                    <MissionWorkspace
                      className="max-w-none"
                      currentViewState={currentViewState}
                      savedViews={savedViews}
                      onViewsChange={handleViewsChange}
                      onApplyView={handleApplySavedView}
                      activeViewId={activeViewId}
                      aois={polygonAois}
                      alertRules={alertRules}
                      ruleNotifications={ruleNotifications}
                      onRulesChange={setAlertRules}
                      onLocateAoi={handleLocateAoi}
                      onClearNotifications={() => setRuleNotifications([])}
                      snapshots={historySnapshots}
                      activeSnapshotId={activeSnapshotId}
                      onCaptureSnapshot={handleCaptureSnapshot}
                      onReplaySnapshot={handleReplaySnapshot}
                      onDeleteSnapshot={handleDeleteSnapshot}
                      feeds={evaluatedFeeds}
                      situationReportInput={situationReportInput}
                      onClose={() => setMobilePanel(null)}
                    />
                  )}
"""
if "mobilePanel === 'workspace' &&" not in page:
    if remote_render not in page:
        raise SystemExit('mobile remote render anchor missing')
    page = page.replace(remote_render, workspace_mobile + remote_render, 1)

write_preserved(page_path, page, page_newline)

# Remove an unused Node http/https fallback from conflicts. The active code
# already uses bounded fetch() below, so the require-based helper was dead.
conflicts_path = Path('src/app/api/conflicts/route.ts')
conflicts, conflicts_newline = load_normalized(conflicts_path)
pattern = r"\n    const https = require\('https'\);\n    const http = require\('http'\);\n\n    const fetchRSS = \(url: string\): Promise<string> => \{.*?\n    \};\n\n    const feedPromises"
conflicts, count = re.subn(pattern, '\n    const feedPromises', conflicts, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'conflicts dead fallback: expected 1 match, found {count}')
write_preserved(conflicts_path, conflicts, conflicts_newline)
