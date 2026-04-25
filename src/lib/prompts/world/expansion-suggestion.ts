/**
 * Pre-expansion suggestion prompt — analyses the current world structure and
 * proposes a 2-4 sentence rationale for what the next expansion should add,
 * with explicit references to existing entities to integrate against.
 */

export type WorldExpansionSize = 'small' | 'medium' | 'large' | 'exact' | 'health';

export type ExpansionSizeConfig = {
  total: string;
  characters: string;
  locations: string;
  threads: string;
  label: string;
};

export type SuggestWorldExpansionArgs = {
  narrativeContext: string;
  charCount: number;
  locCount: number;
  threadCount: number;
  relCount: number;
  orphanChars: string[];
  rootLocs: string[];
  leafLocs: string[];
  size: WorldExpansionSize;
  sizeConfig: ExpansionSizeConfig;
};

export function buildSuggestWorldExpansionPrompt(args: SuggestWorldExpansionArgs): string {
  const {
    narrativeContext,
    charCount,
    locCount,
    threadCount,
    relCount,
    orphanChars,
    rootLocs,
    leafLocs,
    size,
    sizeConfig,
  } = args;

  return `<inputs>
  <narrative-context>
${narrativeContext}
  </narrative-context>

  <world-structure-analysis>
    <counts characters="${charCount}" locations="${locCount}" threads="${threadCount}" relationships="${relCount}" />
    <orphaned-characters>${orphanChars.length > 0 ? orphanChars.join(', ') : 'none'}</orphaned-characters>
    <top-level-locations>${rootLocs.join(', ')}</top-level-locations>
    <leaf-locations>${leafLocs.join(', ')}</leaf-locations>
    <avg-relationships-per-character>${charCount > 0 ? (relCount * 2 / charCount).toFixed(1) : 0}</avg-relationships-per-character>
  </world-structure-analysis>

  <expansion-plan size="${size}" label="${sizeConfig.label}" characters="${sizeConfig.characters}" locations="${sizeConfig.locations}" threads="${sizeConfig.threads}" total="${sizeConfig.total}" />
</inputs>

<instructions>
  <step name="suggest">Based on the full narrative context and structural analysis, suggest what NEW elements the world needs to become richer, more interconnected, and more alive.</step>
  <step name="size-tuning">${size === 'small' ? 'Focus on the single highest-impact addition that fills the biggest gap.' : size === 'medium' ? 'Suggest a balanced mix that deepens existing structures and introduces new dynamics.' : 'Think broadly about new factions, regions, and power structures that transform the world.'}</step>
  <principle name="extend-not-replace">World expansion EXTENDS the existing world — new entities must be deeply woven into the existing fabric through relationships, location hierarchies, and shared threads. Every new element should make the existing world burn brighter.</principle>
  <consider>
    <factor>Which existing characters lack connections? Who needs rivals, allies, mentors, or kin?</factor>
    <factor>Where is the location hierarchy too flat? Which locations need sub-locations (districts, rooms, landmarks)?</factor>
    <factor>Are there implied characters, factions, or organizations referenced in scenes but never created?</factor>
    <factor>What contrasting environments would create richer scene variety (urban vs wild, sacred vs profane)?</factor>
    <factor>Which threads need new participants to develop? What new open questions would deepen the story?</factor>
    <factor>Are there power structures, social hierarchies, or institutional relationships missing?</factor>
    <factor>Could adding characters from different social strata or factions create productive tension?</factor>
  </consider>
  <rule name="emphasize-connection">Suggestion must emphasize HOW new elements connect to existing ones — not just what to add, but who they relate to and where they fit in the hierarchy.</rule>
  <rule name="naming">Use character NAMES and location NAMES — never raw IDs.</rule>
</instructions>

<output-format>
Return JSON with this exact structure:
{
  "suggestion": "2-4 sentence description of what should be added to the world and WHY, with specific references to existing characters/locations that new elements should connect to"
}
</output-format>`;
}
