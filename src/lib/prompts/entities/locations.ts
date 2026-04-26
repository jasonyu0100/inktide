/**
 * Locations Prompt — XML block injected into user prompts.
 */

export const PROMPT_LOCATIONS = `<locations hint="PHYSICAL places you can stand in. Draw examples from the work's own cultural palette.">
  <example type="good">a throne room, a madrasa courtyard, a Stanford lab, a Song dynasty teahouse, a favela stairwell, a longhouse, a kiln floor — places you can walk into.</example>
  <example type="bad" reason="abstract domains belong in system knowledge">"the wizarding world", "academia", "NeurIPS", "the diaspora", "late capitalism".</example>
  <rule name="hierarchy">room → building → district → city → region (via parentId).</rule>
  <rule name="ties" hint="Entity BELONGING — identity, not visiting. Removing = significant event. (Entities can be characters, or collective bodies in non-fiction: a research group, a village, a guild.)">Use tieDeltas for belonging shifts.</rule>
</locations>`;
