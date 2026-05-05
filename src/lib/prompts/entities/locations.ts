/**
 * Locations Prompt — XML block injected into user prompts.
 */

export const PROMPT_LOCATIONS = `<locations hint="PHYSICAL places you can stand in OR scenario theatres / model regions / agent populations the work treats as locatable. Draw examples from the work's own cultural palette and register.">
  <example type="good" register="fiction-or-non-fiction">a throne room, a madrasa courtyard, a Stanford lab, a Song dynasty teahouse, a favela stairwell, a longhouse, a kiln floor — places you can walk into.</example>
  <example type="good" register="simulation">a Mughal subah under direct revenue collection, a quarantined São Paulo school district, a contested strait under blockade rules, a Bihar village quadrant in the redistribution model, a sect's hereditary practice grounds, a Politburo briefing room — scenario theatres or modelled regions where rules apply.</example>
  <example type="bad" reason="abstract domains belong in system knowledge">"the wizarding world", "academia", "NeurIPS", "the diaspora", "late capitalism", "the global market".</example>
  <rule name="hierarchy">room → building → district → city → region (via parentId). For simulation: substation → district → modelled region → scenario theatre.</rule>
  <rule name="ties" hint="Entity BELONGING — identity, not visiting. Removing = significant event. The tied entity may be an individual or a collective body (a household, a research group, a village, a guild, an agent population, a faction's catchment).">Use tieDeltas for belonging shifts.</rule>
</locations>`;
