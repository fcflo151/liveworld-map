'use client';

import { useMemo, useState } from 'react';
import { Download, FileJson, FileText } from 'lucide-react';
import {
  createSituationReportArtifacts,
  type SituationReportArtifacts,
  type SituationReportInput,
} from '@/lib/situation-report';

export interface SituationReportPanelProps {
  input: SituationReportInput;
  filenameBase?: string;
  className?: string;
}

type PreviewFormat = 'markdown' | 'json';

function safeFilename(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'situation-report';
}

function downloadText(filename: string, mimeType: string, content: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default function SituationReportPanel({
  input,
  filenameBase,
  className = '',
}: SituationReportPanelProps) {
  const [previewFormat, setPreviewFormat] = useState<PreviewFormat>('markdown');

  const generated = useMemo<{
    artifacts: SituationReportArtifacts | null;
    error: string | null;
  }>(() => {
    try {
      return { artifacts: createSituationReportArtifacts(input), error: null };
    } catch (error) {
      return {
        artifacts: null,
        error: error instanceof Error ? error.message : 'Unable to build situation report.',
      };
    }
  }, [input]);

  const artifacts = generated.artifacts;
  const base = safeFilename(filenameBase ?? input.title);
  const preview = artifacts
    ? previewFormat === 'markdown'
      ? artifacts.markdown
      : artifacts.json
    : '';

  return (
    <section className={`glass-panel p-4 pointer-events-auto ${className}`.trim()} aria-label="Situation report">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <div className="hud-text text-[10px] tracking-[0.2em] text-[var(--gold-primary)]">
            SITUATION REPORT
          </div>
          <h2 className="mt-1 text-sm font-medium text-[var(--text-primary)]">
            {input.title}
          </h2>
          {artifacts && (
            <div className="mt-1 text-[10px] font-mono text-[var(--text-muted)]">
              {artifacts.report.prioritizedEvents.length} events ·{' '}
              {artifacts.report.timeline.length} timeline entries ·{' '}
              {artifacts.report.activeDataSources.length} active sources
            </div>
          )}
        </div>

        {artifacts && (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => downloadText(`${base}.md`, 'text/markdown', artifacts.markdown)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border-primary)] px-2.5 py-1.5 text-[10px] font-mono text-[var(--text-secondary)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
              title="Download Markdown report"
            >
              <FileText className="w-3 h-3" />
              MD
              <Download className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => downloadText(`${base}.json`, 'application/json', artifacts.json)}
              className="inline-flex items-center gap-1.5 rounded border border-[var(--border-primary)] px-2.5 py-1.5 text-[10px] font-mono text-[var(--text-secondary)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)] transition-colors"
              title="Download JSON report"
            >
              <FileJson className="w-3 h-3" />
              JSON
              <Download className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {generated.error ? (
        <div
          role="alert"
          className="rounded border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300"
        >
          {generated.error}
        </div>
      ) : (
        <>
          <div className="flex gap-1 mb-2" role="tablist" aria-label="Report preview format">
            <button
              type="button"
              role="tab"
              aria-selected={previewFormat === 'markdown'}
              onClick={() => setPreviewFormat('markdown')}
              className={`rounded px-2 py-1 text-[10px] font-mono transition-colors ${
                previewFormat === 'markdown'
                  ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              MARKDOWN
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={previewFormat === 'json'}
              onClick={() => setPreviewFormat('json')}
              className={`rounded px-2 py-1 text-[10px] font-mono transition-colors ${
                previewFormat === 'json'
                  ? 'bg-[var(--gold-primary)]/15 text-[var(--gold-primary)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              JSON
            </button>
          </div>

          <pre
            role="tabpanel"
            className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded border border-[var(--border-primary)] bg-[var(--bg-void)] p-3 text-[10px] leading-relaxed text-[var(--text-secondary)]"
          >
            {preview}
          </pre>
        </>
      )}
    </section>
  );
}
