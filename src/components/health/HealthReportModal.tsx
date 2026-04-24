'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter } from '@/components/Modal';
import type { HealthReport } from '@/lib/narrative-health';
import type { NarrativeState } from '@/types/narrative';
import { isScene } from '@/types/narrative';
import { generateHealthReport } from '@/lib/ai/health-report';
import { logError } from '@/lib/system-logger';
import { useStore } from '@/lib/store';

// ── Tiny markdown renderer ────────────────────────────────────────────────
// The AI report uses a predictable subset: ## section headings, paragraphs,
// - bullet lists, and **bold** inline. We don't pull in a full markdown lib
// for this — the modal only needs to render the three-section brief cleanly.

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(
      <strong key={`b${out.length}`} className="text-text-primary font-semibold">
        {m[1]}
      </strong>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function MarkdownView({ text }: { text: string }) {
  const sections = text.split(/(?=^##\s)/m).filter((s) => s.trim());
  return (
    <div className="flex flex-col gap-5 text-[13px] text-text-secondary leading-relaxed">
      {sections.map((section, i) => {
        const headingMatch = section.match(/^##\s+(.+?)\n/);
        const heading = headingMatch?.[1]?.trim();
        const body = headingMatch
          ? section.slice(headingMatch[0].length).trim()
          : section.trim();
        return (
          <section key={i} className="flex flex-col gap-2">
            {heading && (
              <h3 className="text-[11px] uppercase tracking-widest text-text-dim font-medium">
                {heading}
              </h3>
            )}
            {body.split(/\n\n+/).map((para, j) => {
              const trimmed = para.trim();
              if (trimmed.startsWith('- ')) {
                const items = trimmed
                  .split(/\n(?=- )/)
                  .map((l) => l.replace(/^- /, '').trim());
                return (
                  <ul key={j} className="flex flex-col gap-1.5">
                    {items.map((item, k) => (
                      <li
                        key={k}
                        className="flex items-start gap-2"
                      >
                        <span className="shrink-0 text-text-dim">·</span>
                        <span>{renderInline(item)}</span>
                      </li>
                    ))}
                  </ul>
                );
              }
              return <p key={j}>{renderInline(trimmed)}</p>;
            })}
          </section>
        );
      })}
    </div>
  );
}

const HEALTH_BAND_STYLE: Record<
  HealthReport['band'],
  { text: string; bg: string; label: string }
> = {
  healthy: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', label: 'Healthy' },
  watch: { text: 'text-sky-400', bg: 'bg-sky-500/10', label: 'Watch' },
  needs_maintenance: { text: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Needs maintenance' },
  critical: { text: 'text-red-400', bg: 'bg-red-500/10', label: 'Critical' },
};

/**
 * Health report modal — streams an AI-generated analyst brief on open. The
 * brief mines the narrative context and portfolio signals to produce a
 * creative proposal for where the story should go next, complete with
 * specific expansion directives and a continuation direction the system will
 * persist into story settings.
 *
 * Flow: overview popover → this modal (streams report) → world expansion
 * (uses the brief as the directive).
 */
export function HealthReportModal({
  report,
  narrative,
  resolvedKeys,
  currentIndex,
  onClose,
  onRunExpansion,
}: {
  report: HealthReport;
  narrative: NarrativeState;
  resolvedKeys: string[];
  currentIndex: number;
  onClose: () => void;
  /** Fired with the full AI-generated brief so the parent can launch the
   *  expansion with it as the directive. */
  onRunExpansion: (brief: string) => void;
}) {
  const { dispatch } = useStore();
  const t = report.dimensions.threads;
  // Seed `streamed` from the cached report on storySettings — the modal
  // shows the previously-generated brief on reopen without re-calling the
  // LLM. Regenerate (or running the expansion, which clears the cache)
  // are the only ways to replace it.
  const cachedReport = narrative.storySettings?.lastHealthReport ?? '';
  const [streamed, setStreamed] = useState(cachedReport);
  const [loading, setLoading] = useState(cachedReport.length === 0);
  const [error, setError] = useState('');
  // Optional user-supplied pivot direction — e.g. "shift the story toward
  // Draco's arc", "introduce the Order". When present, the AI treats it as
  // the primary creative brief; the portfolio signals become diagnostic
  // context. Users type this freely and click Regenerate to re-brief.
  const [pivotDirection, setPivotDirection] = useState('');
  const generatedOnce = useRef(false);
  // Hold the most-recently fired generation promise's cancel flag so a new
  // Regenerate can cancel the prior stream before starting.
  const cancelCurrentRef = useRef<() => void>(() => {});

  const runGeneration = useCallback(
    async (direction: string) => {
      // Cancel any in-flight generation from a prior click / mount.
      cancelCurrentRef.current();
      let cancelled = false;
      cancelCurrentRef.current = () => {
        cancelled = true;
      };

      const recentScenes = resolvedKeys
        .slice(Math.max(0, currentIndex - 7), currentIndex + 1)
        .map((k, i) => {
          const scene = narrative.scenes[k];
          if (!scene || !isScene(scene)) return null;
          return { index: currentIndex - 7 + i, summary: scene.summary || '' };
        })
        .filter((s): s is { index: number; summary: string } => s !== null)
        .reverse();

      setStreamed('');
      setError('');
      setLoading(true);
      try {
        const full = await generateHealthReport({
          narrative,
          signals: report.portfolioSignals,
          portfolioSummary: t.summary,
          deterministicAction: report.recommendedAction,
          recentScenes,
          userDirection: direction,
          onToken: (token) => {
            if (!cancelled) setStreamed((prev) => prev + token);
          },
        });
        // Persist the generated report on storySettings so re-opening the
        // modal shows it without re-calling the LLM. A health expansion
        // commit will clear this cache (the report has been acted on).
        if (!cancelled && full.trim().length > 0 && narrative.storySettings) {
          dispatch({
            type: 'SET_STORY_SETTINGS',
            settings: {
              ...narrative.storySettings,
              lastHealthReport: full,
            },
          });
        }
      } catch (err) {
        if (cancelled) return;
        logError('Health report generation failed', err, {
          source: 'world-expansion',
          operation: 'generate-health-report',
        });
        setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    },
    [
      narrative,
      resolvedKeys,
      currentIndex,
      report.portfolioSignals,
      report.recommendedAction,
      t.summary,
      dispatch,
    ],
  );

  // Initial auto-generation on mount — but only when we don't already have
  // a cached report. If storySettings carries a report, show it verbatim;
  // the user can Regenerate to refresh. Ref-guarded against React strict-
  // mode double invocation. No cleanup — strict mode's re-run would flip
  // the cancelled flag on the first (and only) stream. Regenerate handles
  // supersession internally via cancelCurrentRef.
  useEffect(() => {
    if (generatedOnce.current) return;
    generatedOnce.current = true;
    if (cachedReport.length === 0) {
      void runGeneration('');
    }
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Run expansion is gated on a successfully-generated AI brief. Before
  // streaming completes (or when it errored empty), the button stays
  // disabled — the user can Regenerate or Close. The deterministic action
  // stays only as an inline fallback in the error view, not as a silent
  // substitute for the AI report.
  const reportReady = !loading && streamed.trim().length > 0;
  const briefForExpansion = streamed;

  return (
    <Modal onClose={onClose} size="2xl">
      <ModalHeader onClose={onClose}>
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <span className="text-sm font-semibold text-text-primary">
            Thread portfolio
          </span>
          <span
            className={`text-[10px] uppercase tracking-widest px-2 py-0.5 rounded-full ${HEALTH_BAND_STYLE[t.band].text} ${HEALTH_BAND_STYLE[t.band].bg}`}
          >
            {HEALTH_BAND_STYLE[t.band].label} · {Math.round(t.score * 100)}%
          </span>
          {loading && (
            <span className="text-[10px] text-sky-400/80 animate-pulse ml-auto">
              streaming…
            </span>
          )}
        </div>
      </ModalHeader>

      <ModalBody className="p-6 space-y-4">
        {/* Phase 3 (guide) — pivot direction input. Available only once the
            report has streamed; during streaming this is disabled so the
            user focuses on what's emerging. */}
        <div>
          <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-1.5">
            Guide the pivot (optional)
          </label>
          <textarea
            value={pivotDirection}
            onChange={(e) => setPivotDirection(e.target.value)}
            placeholder="e.g. pivot toward Draco's arc; introduce a faction that opposes the protagonist"
            rows={2}
            className="w-full text-[12px] bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-text-primary placeholder:text-text-dim/60 focus:outline-none focus:border-white/20 transition-colors resize-none disabled:opacity-50"
            disabled={loading}
          />
        </div>

        {/* Phases 1 & 2 — streaming vs ready. Mirrors GeneratePanel's
            StreamingOutput: pulsing dot + mono pre while tokens arrive, then
            the rendered markdown view when the report is complete. */}
        {loading ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-sm font-semibold text-text-primary">
                Generating report&hellip;
              </h2>
            </div>
            {streamed ? (
              <pre className="text-[11px] text-text-dim font-mono whitespace-pre-wrap max-h-60 overflow-y-auto bg-white/3 rounded-lg p-3 leading-relaxed">
                {streamed}
              </pre>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="h-3 w-3/4 bg-white/6 rounded animate-pulse" />
                <div className="h-3 w-1/2 bg-white/6 rounded animate-pulse" />
                <div className="h-3 w-5/6 bg-white/6 rounded animate-pulse" />
              </div>
            )}
          </div>
        ) : error ? (
          <div className="text-[12px] bg-red-500/5 border border-red-500/20 rounded-lg p-4">
            <p className="text-red-400/90 mb-2">Report generation failed — {error}</p>
            <p className="text-text-secondary leading-relaxed">
              Fallback: {report.recommendedAction}
            </p>
          </div>
        ) : streamed.trim().length > 0 ? (
          <div>
            <label className="text-[10px] uppercase tracking-widest text-text-dim block mb-2">
              Report
            </label>
            <div className="bg-white/2 border border-white/6 rounded-lg p-5 max-h-[55vh] overflow-y-auto">
              <MarkdownView text={streamed} />
            </div>
          </div>
        ) : null}
      </ModalBody>

      <ModalFooter>
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-3 rounded-lg text-text-dim hover:text-text-primary hover:bg-white/5 transition text-[11px]"
        >
          Close
        </button>
        <button
          type="button"
          onClick={() => void runGeneration(pivotDirection)}
          disabled={loading}
          className="h-9 px-3 rounded-lg border border-white/8 text-text-dim hover:text-text-primary hover:border-white/15 transition disabled:opacity-30 text-[11px]"
          title="Re-run the report weighted by the direction above"
        >
          Regenerate
        </button>
        <button
          type="button"
          onClick={() => onRunExpansion(briefForExpansion)}
          disabled={!reportReady}
          className="h-9 px-5 rounded-lg bg-white/10 hover:bg-white/16 text-text-primary font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed text-[12px]"
          title={reportReady ? 'Open the world-expansion panel with the AI brief as the directive' : 'Generate a report first'}
        >
          Run expansion →
        </button>
      </ModalFooter>
    </Modal>
  );
}
