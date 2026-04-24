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
import type { HealthReport, PortfolioSignals } from '@/lib/narrative-health';
import { callGenerateStream } from './api';
import { PROMPT_PORTFOLIO_PRINCIPLES } from '@/lib/prompts/core/market-calibration';
import { MAX_TOKENS_DEFAULT } from '@/lib/constants';

const SYSTEM_PROMPT = `You are a story analyst advising an author on where their narrative should go next. You speak in two registers: analytical (diagnosing the current portfolio's shape using market / prediction-market vocabulary) and creative (proposing where the story could meaningfully move, grounded in the specific entities and rules the author has established). Your output is a markdown brief the author will read, and the "Expansion directive" + "Continuation direction" sections will be used programmatically — make them specific and actionable.`;

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

  const prompt = `NARRATIVE: ${narrative.title}

${storyDirection ? `CURRENT STORY DIRECTION:\n${storyDirection}\n\n` : ''}${pivotDirection ? `USER-SUPPLIED PIVOT DIRECTION (treat this as the PRIMARY creative brief — the portfolio signals are diagnostic context, but this is where the user wants the story to go):\n${pivotDirection}\n\n` : ''}ACTIVE THREADS (market portfolio):
${activeThreads || '(none)'}

CAST (anchor + recurring):
${cast || '(none)'}

RECENT SCENES (most recent first — the texture the portfolio is reacting to):
${recentScenes
    .slice(0, 8)
    .map((s) => `[scene ${s.index + 1}] ${s.summary}`)
    .join('\n\n') || '(none)'}

PORTFOLIO DIAGNOSTIC
  summary: ${portfolioSummary}
  flags: ${flagSummary.length > 0 ? flagSummary.join(', ') : 'none'}
  ${uncoveredNote}
  baseline recommendation: ${deterministicAction}

═══════════════════════════════════════════════
TASK
═══════════════════════════════════════════════

Produce a markdown brief the author will read. The brief is also consumed programmatically: the "Expansion directive" section becomes the directive for a health world expansion, and the "Continuation direction" section is persisted into story settings as the next north-star for scene generation.

${pivotDirection ? `The user has supplied a PIVOT DIRECTION above. Treat it as the creative intent — shape the diagnosis and proposals around it. If the user's direction and the portfolio signals conflict (e.g. user wants to introduce a faction but portfolio says close out existing threads first), reconcile transparently: acknowledge the tension, then propose a sequenced plan that honours the user's direction while discharging accumulated pressure. Stories like Harry Potter pivot successfully by pointing the existing momentum at a new target, not by abandoning it — mirror that approach.\n\n` : ''}Structure:

## Diagnosis
Two short paragraphs. First paragraph: what the portfolio's SHAPE tells you about the story right now (which forces are ascendant, which are latent, what the reader is currently feeling). Second: what the diagnostic flags mean in THIS specific story — name characters, rules, entities. Avoid generalities.

## Where the story should go
One-two paragraphs of creative analysis. Mine the recent scenes and the cast for UNREALIZED PRESSURE — a character's unstated grievance that could become a market, a system rule whose bill hasn't come due, a peripheral agent whose fate hasn't been priced. Think like an editor proposing the next structural move. Be specific to this narrative; invoke named entities.

## Expansion directive
A structured, actionable directive for a world expansion. Name exactly:
- **New markets to open** (2-4 threads with specific questions and 2-3 named outcomes each — include at least one cost-ledger or peripheral-agent market)
- **System rules to articulate** (1-2 — the rules these new markets resolve against)
- **Entities to introduce or deepen** (name them; specify new if needed, otherwise which existing characters/locations/artifacts get new worldDeltas)
Apply the portfolio principles below. Honour the fate → system → world hierarchy: markets first, rules to support them, entities to enact.

## Continuation direction
One paragraph (≤ 80 words) that will be written into story settings as the new north-star for scene generation. It should: (a) name the shift in focus, (b) point at 1-2 new markets to push forward, (c) suggest the tonal register for the next arc. Written in the second person, addressing the generator.

═══════════════════════════════════════════════
PORTFOLIO PRINCIPLES (guide the directive)
═══════════════════════════════════════════════

${PROMPT_PORTFOLIO_PRINCIPLES}

Return the markdown brief only — no wrapping, no preamble, no JSON. The four section headers above MUST appear verbatim (including the \`## \` prefix) so the brief can be parsed downstream.`;

  const full = await callGenerateStream(
    prompt,
    SYSTEM_PROMPT,
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
