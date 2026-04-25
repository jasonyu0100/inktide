/**
 * AI-generated health report — mines the narrative context + portfolio
 * diagnostics to produce a creative analyst's brief with concrete directives
 * for a health world expansion and a forward-looking continuation direction.
 *
 * The rule-based `recommendedAction` is the deterministic baseline;
 * `generateHealthReport` is the richer creative pass that considers the
 * specific story — its cast, system rules, recent scenes, and the portfolio
 * signals together — to propose where the story should actually go.
 *
 * Output is streaming markdown with four labelled sections:
 *   ## Diagnosis
 *   ## Where the story should go
 *   ## Expansion directive
 *   ## Continuation direction
 *
 * The full document is used as the expansion directive; the Continuation
 * direction section is also extracted and persisted into storySettings so
 * future scene generation picks up the new north-star.
 */

import type { NarrativeState } from '@/types/narrative';
import type { PortfolioSignals } from '@/lib/narrative-health';
import { callGenerateStream } from './api';
import { HEALTH_REPORT_SYSTEM, buildHealthReportPrompt } from '@/lib/prompts/health';
import { MAX_TOKENS_DEFAULT } from '@/lib/constants';

export type GenerateHealthReportOptions = {
  narrative: NarrativeState;
  /** Portfolio signals from narrative-health. Encodes dangers, warnings, and
   *  context-aware measures (newness, variety, direction). */
  signals: PortfolioSignals;
  /** Current thread portfolio summary (one-line rollup from the dimension). */
  portfolioSummary: string;
  /** Deterministic recommended action — the baseline the AI expands upon. */
  deterministicAction: string;
  /** Recent scene summaries, most-recent-first. Trim to last ~8 for context. */
  recentScenes: { index: number; summary: string }[];
  /** Optional user-supplied direction to steer the pivot. When present, the
   *  brief incorporates the user's creative intent (e.g. "introduce the Order
   *  of the Phoenix", "pivot toward Draco's arc") rather than proposing
   *  purely from portfolio signals. Empty / omitted = AI freestyles. */
  userDirection?: string;
  /** Streaming callback for incremental tokens. */
  onToken: (token: string) => void;
  /** Optional abort signal. */
  signal?: AbortSignal;
};

export async function generateHealthReport(
  opts: GenerateHealthReportOptions,
): Promise<string> {
  const {
    narrative,
    signals,
    portfolioSummary,
    deterministicAction,
    recentScenes,
    userDirection,
    onToken,
  } = opts;

  // Compact active-threads block — question + current leader for each open thread.
  const activeThreads = Object.values(narrative.threads)
    .filter((t) => !t.closedAt)
    .slice(0, 12)
    .map((t) => `- [${t.id}] ${t.description}`)
    .join('\n');

  // Compact cast block — names + role of anchor/recurring characters.
  const cast = Object.values(narrative.characters)
    .filter((c) => c.role === 'anchor' || c.role === 'recurring')
    .slice(0, 12)
    .map((c) => `- ${c.name} (${c.role})`)
    .join('\n');

  const uncoveredNote =
    signals.uncoveredAnchorNames.length > 0
      ? `Named characters with no stake in any open market: ${signals.uncoveredAnchorNames.slice(0, 6).join(', ')}.`
      : '';

  const flagSummary: string[] = [];
  if (signals.starved) flagSummary.push('starved (fewer than 2 active threads)');
  if (signals.thin) flagSummary.push('thin portfolio');
  if (signals.bloated) flagSummary.push('bloated portfolio');
  if (signals.lowNewness) flagSummary.push('no recent opens');
  if (signals.noForwardSignal) flagSummary.push('no resolutions approaching');
  if (signals.stagnant) flagSummary.push('contested but stuck');
  if (signals.concentrated)
    flagSummary.push(`attention concentrated (${Math.round(signals.topVolumeShare * 100)}% on single thread)`);

  const storyDirection = narrative.storySettings?.storyDirection?.trim() ?? '';
  const pivotDirection = userDirection?.trim() ?? '';

  const prompt = buildHealthReportPrompt({
    title: narrative.title,
    storyDirection,
    pivotDirection,
    activeThreads,
    cast,
    recentScenes,
    portfolioSummary,
    flagSummary,
    uncoveredNote,
    deterministicAction,
  });

  const full = await callGenerateStream(
    prompt,
    HEALTH_REPORT_SYSTEM,
    onToken,
    MAX_TOKENS_DEFAULT,
    'generateHealthReport',
    undefined, // default model
    undefined, // no reasoning budget
    undefined, // no separate onReasoning
    undefined, // default temperature
  );
  return full;
}

/** Extract the "Continuation direction" section from a health-report markdown
 *  document. Used to persist the AI's proposed north-star into story settings
 *  after a health expansion commits. Returns empty string if not found. */
export function extractContinuationDirection(markdown: string): string {
  const match = markdown.match(
    /##\s*Continuation direction\s*\n([\s\S]*?)(?:\n##\s|\n?$)/i,
  );
  if (!match) return '';
  return match[1].trim();
}
