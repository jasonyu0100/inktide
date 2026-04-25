/**
 * Arc-direction and story-direction prompts — generated when the user asks
 * for a one-arc next-step suggestion or a multi-arc showrunner trajectory.
 */

export function buildSuggestArcDirectionPrompt(args: { narrativeContext: string }): string {
  return `<inputs>
  <narrative-context>
${args.narrativeContext}
  </narrative-context>
</inputs>

<instructions>
  <step name="analyze">Based on the full scene history, suggest the most compelling direction for the NEXT arc.</step>
  <consider>
    <factor>Unresolved thread markets, their probability distributions, and which outcomes are contested vs. saturating.</factor>
    <factor>Character tensions and relationship dynamics.</factor>
    <factor>Narrative momentum — what has been building?</factor>
    <factor>What would create the most significant development?</factor>
    <factor>How many scenes this arc needs to land properly (don't rush — quiet arcs need fewer, epic arcs need more).</factor>
  </consider>
  <rule name="naming">Use character NAMES, location NAMES, and thread DESCRIPTIONS in the direction and suggestion — never raw IDs.</rule>
</instructions>

<output-format>
Return JSON with this exact structure:
{
  "arcName": "suggested arc name",
  "direction": "2-3 sentence description of what the next arc should focus on and why",
  "sceneSuggestion": "brief outline of what kind of scenes would work",
  "suggestedSceneCount": 3
}
suggestedSceneCount must be between 1 and 8.
</output-format>`;
}

export function buildSuggestAutoDirectionPrompt(args: { narrativeContext: string }): string {
  return `<role>Showrunner planning the long-term trajectory of this story.</role>

<inputs>
  <narrative-context>
${args.narrativeContext}
  </narrative-context>
</inputs>

<instructions>
  <step name="big-picture">Analyze the full narrative state — characters, threads, knowledge graphs, relationships, and scene history — and suggest a high-level STORY DIRECTION that should guide the next several arcs.</step>
  <consider>
    <factor>What is the central open question the story is building toward?</factor>
    <factor>Which character arcs have the most untapped potential?</factor>
    <factor>What thematic tensions could be deepened or brought into conflict?</factor>
    <factor>Where should alliances shift, secrets surface, or power dynamics change?</factor>
    <factor>What is the most satisfying macro-trajectory from where the story stands now?</factor>
  </consider>
  <rule name="scope">Do NOT suggest a single scene or arc. Describe the overarching direction the story should move in — the kind of guidance a showrunner gives a writers' room for the next season.</rule>
  <rule name="naming">Use character NAMES, location NAMES, and thread DESCRIPTIONS — never raw IDs.</rule>
</instructions>

<output-format>Return JSON: { "direction": "2-4 sentences describing the big-picture story direction" }</output-format>`;
}
