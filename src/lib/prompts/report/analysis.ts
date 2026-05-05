/**
 * Report Analysis Prompts
 *
 * System role + user prompt for generating the prose sections of a
 * narrative-analysis report. The writing sits between charts and tables;
 * keep each section short and register-appropriate.
 */

export const REPORT_SYSTEM = `You are writing the prose sections of a narrative analysis report. Your writing will be interspersed between charts, tables, and data visualisations — you are providing the interpretive commentary that makes the data meaningful. Your audience may not have read the work; introduce entities, settings, and key moments naturally as you reference them. Match the analytic voice to the work's register: fiction (dramatic shape), non-fiction (argument / evidence through-line), or simulation (rule-driven trajectory under stated initial conditions — describe the rule set, what was forced vs contingent, where decision points were rule-bound vs discretionary). Follow the style rules and section schema supplied in the user prompt.`;

/**
 * Section keys the LLM is expected to return. Kept alongside REPORT_ANALYSIS_PROMPT
 * so the prompt and the reducer consume the same source of truth. If a key is
 * added here, it must also be named in REPORT_ANALYSIS_PROMPT — the prompt test
 * guards that invariant.
 */
export const REPORT_SECTIONS = [
  'story_intro',
  'verdict',
  'activity',
  'forces',
  'forces_over_time',
  'swing',
  'segments',
  'cast',
  'locations',
  'threads',
  'modes',
  'arcs',
  'propositions',
  'closing',
] as const;

export type ReportSectionKey = typeof REPORT_SECTIONS[number];

/**
 * User prompt for report generation. Takes a pre-built context block.
 */
export function REPORT_ANALYSIS_PROMPT(context: string): string {
  return `<inputs>
${context}
</inputs>

<task>Write the prose commentary for a narrative analysis report. Each section will sit between data visualisations, so keep them concise — the charts do the heavy lifting, your words provide interpretation and narrative context.</task>

<style>
  <rule>Match the analytic voice to the work being analysed — let the source's own register set your register.</rule>
  <rule>Specific, grounded, short paragraphs (2-4 sentences).</rule>
  <rule>Ground every observation in specific scenes, entities, or moments by name.</rule>
  <rule>Focus on the three forces: Fate (thread resolutions / argument resolutions), World (entity transformation), and System (rule/mechanism deepening). Also discuss Activity (the composite pacing curve that tracks when the three forces are moving together).</rule>
  <rule>Do not treat Tension as a metric; it is derived and not a primary force.</rule>
  <rule>No markdown, no bullet points, no headers. Flowing prose.</rule>
  <rule>Use the present tense when describing what the work does.</rule>
</style>

<output-format hint="Follow the length guidance exactly — these sit between visual elements and must not overwhelm them.">
Return a JSON object with these keys:

{
  "story_intro": "2-3 sentences introducing the work's premise, world, and central entities to someone who hasn't read it. Set the stage — what kind of work is this (fiction, non-fiction such as memoir / essay / reportage / research / history, or simulation that models real-life events from a stated rule set such as a historical counterfactual, policy or wargame scenario, agent-based study, or LitRPG / cultivation), what world or domain does it inhabit, who or what are we following? For simulation works, name the rule set and initial conditions as part of the stage.",
  "verdict": "2-3 sentences. The headline: what score did this work earn, what shape and archetype define it, and what single force drives it most? This sits right after the score display.",
  "activity": "1-2 short paragraphs. What does the activity curve tell us about the reading experience? When are the three forces firing together (peaks) vs quiet (valleys)? Reference specific scenes where peaks and valleys occur and what happens in them.",
  "forces": "1-2 short paragraphs. How do Fate, World, and System interact in this work? Which dominates and why — name the specific threads, entity arcs, or world-building that shapes each. What's the balance like? For a simulation work the System force is typically load-bearing — describe the rule set, the initial conditions, and which threads close on rule-driven consequence rather than authorial choice.",
  "forces_over_time": "3-5 sentences. Commentary on the force decomposition chart — how do the three forces evolve across the timeline? Are there phases where one force takes over? Do they converge at key moments?",
  "swing": "3-5 sentences. What does the scene-to-scene volatility tell us? Is the pacing steady, varied, or erratic? Name a specific high-swing moment and what causes the sharp shift between those consecutive scenes.",
  "segments": "A JSON array of strings, one per segment (the work is divided into segments at valleys). For each segment, write 2-4 sentences describing what happens in this stretch, what force dominates it, and what the key moments are. Introduce entities and events naturally. Example: [\\"The opening segment establishes...\\", \\"The second segment shifts to...\\"]",
  "cast": "3-5 sentences. Who or what carries this work — the anchor entities the narrative leans on. How is POV distributed and does it serve the work? Name any anchor entities who are underused or overexposed relative to their importance. Entities span characters, sources / institutions / authorial voice (non-fiction), and observers / agents / faction drivers under the rule set (simulation).",
  "locations": "2-3 sentences. Do the settings do structural work — creating atmosphere, enabling action, forcing entity interactions, grounding evidence — or are they interchangeable backdrops?",
  "threads": "1-2 short paragraphs. What are the backbone threads of this work, and how well are they serviced? Are any threads (dramatic open questions, unresolved arguments, dangling lines of inquiry, or rule-driven 'will the modelled system reach state X under conditions Y?' markets) neglected or unresolved? Name specific threads and their current status. For simulation works, note whether closures are rule-driven (the conditions force the outcome) or authorially asserted — the former is the register's hallmark.",
  "modes": "3-5 sentences. What does the mode distribution tell us about variety? If certain modes dominate, what does that mean — e.g. lots of 'Growth' means the work prioritises entity development over revelation.",
  "arcs": "1-2 short paragraphs. How does quality evolve across arcs? Name specific arcs and what makes them strong or weak. Does the work improve, plateau, or decline?",
  "propositions": "1-2 short paragraphs. What does the proposition classification reveal about structural craft? Comment on anchor ratio (20-30% = strong), whether seeds convert to closes, and how the local/global balance shifts across arcs. A high foundation count means the thematic or argumentative spine is strong. High ending count in later arcs means distant setups are paying off. Use the named labels (anchor/foundation, seed/foreshadow, close/ending, texture/atmosphere). Name specific structural patterns.",
  "closing": "2-3 sentences. What does this work do best, and what's the single most impactful change that would improve it? End on a forward-looking note."
}
</output-format>`;
}
