/**
 * Health-report prompts — diagnose the narrative's portfolio shape and
 * propose where the story should go next, plus an actionable expansion
 * directive and continuation direction.
 */

import { PROMPT_PORTFOLIO_PRINCIPLES } from '../core/market-calibration';

export const HEALTH_REPORT_SYSTEM = `You are a story analyst advising an author on where their narrative should go next. You speak in two registers: analytical (diagnosing the current portfolio's shape using market / prediction-market vocabulary) and creative (proposing where the story could meaningfully move, grounded in the specific entities and rules the author has established). Your output is a markdown brief the author will read, and the "Expansion directive" + "Continuation direction" sections will be used programmatically — make them specific and actionable.`;

export type HealthReportPromptArgs = {
  title: string;
  storyDirection: string;
  pivotDirection: string;
  activeThreads: string;
  cast: string;
  recentScenes: { index: number; summary: string }[];
  portfolioSummary: string;
  flagSummary: string[];
  uncoveredNote: string;
  deterministicAction: string;
};

export function buildHealthReportPrompt(args: HealthReportPromptArgs): string {
  const {
    title,
    storyDirection,
    pivotDirection,
    activeThreads,
    cast,
    recentScenes,
    portfolioSummary,
    flagSummary,
    uncoveredNote,
    deterministicAction,
  } = args;

  return `<inputs>
  <narrative title="${title}" />
${storyDirection ? `  <current-story-direction>\n${storyDirection}\n  </current-story-direction>` : ''}
${pivotDirection ? `  <pivot-direction hint="USER-SUPPLIED — treat as the PRIMARY creative brief. Portfolio signals are diagnostic context; this is where the user wants the story to go.">\n${pivotDirection}\n  </pivot-direction>` : ''}
  <active-threads label="market portfolio">
${activeThreads || '(none)'}
  </active-threads>
  <cast label="anchor + recurring">
${cast || '(none)'}
  </cast>
  <recent-scenes hint="Most recent first — the texture the portfolio is reacting to.">
${recentScenes
    .slice(0, 8)
    .map((s) => `    <scene index="${s.index + 1}">${s.summary}</scene>`)
    .join('\n') || '    (none)'}
  </recent-scenes>
  <portfolio-diagnostic>
    <summary>${portfolioSummary}</summary>
    <flags>${flagSummary.length > 0 ? flagSummary.join(', ') : 'none'}</flags>
    <coverage>${uncoveredNote}</coverage>
    <baseline-recommendation>${deterministicAction}</baseline-recommendation>
  </portfolio-diagnostic>
  <portfolio-principles hint="Guide the directive — apply these when proposing markets, rules, and entities.">
${PROMPT_PORTFOLIO_PRINCIPLES}
  </portfolio-principles>
</inputs>

<instructions>
  <step name="produce-brief">Produce a markdown brief the author will read. The brief is also consumed programmatically: the "Expansion directive" section becomes the directive for a health world expansion, and the "Continuation direction" section is persisted into story settings as the next north-star for scene generation.</step>
${pivotDirection ? `  <step name="honour-pivot">The user has supplied a PIVOT DIRECTION. Treat it as the creative intent — shape the diagnosis and proposals around it. If the user's direction and the portfolio signals conflict (e.g. user wants to introduce a faction but portfolio says close out existing threads first), reconcile transparently: acknowledge the tension, then propose a sequenced plan that honours the user's direction while discharging accumulated pressure. Stories like Harry Potter pivot successfully by pointing the existing momentum at a new target, not by abandoning it — mirror that approach.</step>` : ''}
</instructions>

<output-format hint="Return the markdown brief only — no wrapping, no preamble, no JSON. The four section headers below MUST appear verbatim (including the '## ' prefix) so the brief can be parsed downstream.">
## Diagnosis
Two short paragraphs. First paragraph: what the portfolio's SHAPE tells you about the story right now (which forces are ascendant, which are latent, what the reader is currently feeling). Second: what the diagnostic flags mean in THIS specific story — name characters, rules, entities. Avoid generalities.

## Where the story should go
One-two paragraphs of creative analysis. Mine the recent scenes and the cast for UNREALIZED PRESSURE — a character's unstated grievance that could become a market, a system rule whose bill hasn't come due, a peripheral agent whose fate hasn't been priced. Think like an editor proposing the next structural move. Be specific to this narrative; invoke named entities.

## Expansion directive
A structured, actionable directive for a world expansion. Name exactly:
- **New markets to open** (2-4 threads with specific questions and 2-3 named outcomes each — include at least one cost-ledger or peripheral-agent market)
- **System rules to articulate** (1-2 — the rules these new markets resolve against)
- **Entities to introduce or deepen** (name them; specify new if needed, otherwise which existing characters/locations/artifacts get new worldDeltas)
Apply the portfolio principles. Honour the fate → system → world hierarchy: markets first, rules to support them, entities to enact.

## Continuation direction
One paragraph (≤ 80 words) that will be written into story settings as the new north-star for scene generation. It should: (a) name the shift in focus, (b) point at 1-2 new markets to push forward, (c) suggest the tonal register for the next arc. Written in the second person, addressing the generator.
</output-format>`;
}
