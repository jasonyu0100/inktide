/**
 * Prompts for rewriting scene prose guided by analysis/critique, plus the
 * separate "changelog" pass that summarises what changed.
 */

export type RewriteSystemPromptArgs = {
  formatSystemRole: string;
  formatRules: string;
  hasVoiceOverride: boolean;
  voiceOverride?: string;
  /** Built profile section (or empty string when no profile resolved). */
  profileSection: string;
  worldSummary: string;
  /** When streaming the rewrite as raw prose, no JSON disclaimer is emitted. */
  streaming: boolean;
};

export function buildRewriteSystemPrompt(args: RewriteSystemPromptArgs): string {
  const {
    formatSystemRole,
    formatRules,
    hasVoiceOverride,
    voiceOverride,
    profileSection,
    worldSummary,
    streaming,
  } = args;

  return `${formatSystemRole}

Your task is to REWRITE scene prose based on the provided analysis.${streaming ? '' : ' You return ONLY valid JSON — no markdown, no commentary.'}
${hasVoiceOverride
    ? `\nAUTHOR VOICE — PRIMARY creative direction; all style defaults below are subordinate to this voice:
${voiceOverride}
`
    : ''}${profileSection}
${formatRules}

Match the tone and genre of the world: ${worldSummary.slice(0, 200)}.`;
}

export function buildRewriteUserPrompt(args: {
  sceneBlock: string;
  neighborBlock: string;
  currentProse: string;
  analysis: string;
  hasExpandedContext: boolean;
  streaming: boolean;
}): string {
  const { sceneBlock, neighborBlock, currentProse, analysis, hasExpandedContext, streaming } = args;
  return `<inputs>
  <scene>
${sceneBlock}
  </scene>
${neighborBlock ? `  ${neighborBlock.replace(/\n/g, '\n  ')}` : ''}
  <current-prose>
${currentProse}
  </current-prose>
  <analysis hint="Critique to address — every point describes a specific change that MUST be implemented, not merely acknowledged cosmetically.">
${analysis}
  </analysis>
</inputs>

<instructions>
  <step name="address-every-point">Rewrite the prose to FULLY ADDRESS every point in the analysis. The rewrite is not a polish pass — it is a structural edit guided by the analysis.
    <example>If the analysis says a character should leave, they must leave in the prose.</example>
    <example>If it says an event should be removed, remove it entirely.</example>
    <example>If it says a detail should be added, add it concretely.</example>
  </step>
  <step name="preserve-rest">Preserve narrative deliveries, events, and plot points that the analysis does NOT ask you to change. Let the scene be as long or short as its content demands — say more in fewer words rather than padding to reach a length.</step>${hasExpandedContext ? '\n  <step name="cross-scene-continuity">You have been given the FULL PROSE of neighboring scenes. Use this to ensure continuity — character state, spatial positions, injuries, emotional beats, and knowledge must flow consistently across scene boundaries. Do not repeat beats that already occurred in preceding scenes, and set up what following scenes expect.</step>' : ''}
</instructions>

<output-format>
${streaming ? 'Write the full rewritten prose directly — no JSON, no markdown, no commentary. Start with the first word of the scene.' : 'Return JSON: { "prose": "the full rewritten prose text" }'}
</output-format>`;
}

export const REWRITE_CHANGELOG_SYSTEM =
  'You are a literary editor. Return ONLY valid JSON with changelog as a string.';

export function buildRewriteChangelogPrompt(args: { analysis: string }): string {
  return `<inputs>
  <analysis-addressed>${args.analysis.slice(0, 500)}</analysis-addressed>
</inputs>

<instructions>
  <step>Summarize the key changes in 3-5 bullet points. Each bullet: one sentence, plain description, no quotes. Focus on structural changes.</step>
</instructions>

<output-format>
Return JSON with changelog as a SINGLE STRING with bullet points separated by newlines:
{"changelog": "• Change one\\n• Change two\\n• Change three"}
</output-format>`;
}
