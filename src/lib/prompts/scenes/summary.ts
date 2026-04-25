/**
 * Summary Requirement Prompt
 */

export const PROMPT_SUMMARY_REQUIREMENT = `<summary-requirement length="3-6 sentences" hint="The prose writer's only brief for the scene. Match the register of the source material (fiction, memoir, essay, reportage, research — whatever the context shows).">

  <include>
    <item>Specific entity names (not IDs).</item>
    <item>Concrete specifics (objects, dialogue, data, claims).</item>
    <item>Observable consequences.</item>
    <item>Context — time span, method, tone shifts, structural role of the scene.</item>
  </include>

  <avoid registers="dramatic" hint="Fiction, narrative memoir, literary reportage. In these registers, write what HAPPENED, what was SAID, what visibly CHANGED — not what was privately felt.">
    <pattern>Inner-state verbs that stand alone (realizes, confirms, understands, suspects, decides) when used as the ONLY delta.</pattern>
    <pattern>Emotional endings that only assert a feeling ("intentions", "revelations-of-feeling" with no observable consequence).</pattern>
    <pattern>Vague modifiers (face etched, expression unreadable, groundbreaking implications).</pattern>
  </avoid>

  <accept registers="reflective-essayistic-inquiry" hint="Realisation-as-delta is legitimate when the realisation is NAMED (a specific new claim, a specific reframing) and ATTRIBUTED (to the author, narrator, or a source). The test is specificity, not the presence of the word 'realise'.">
    <example type="good">"The narrator realises that the archive is organised by the logic of its absences, not its holdings" — valid scene summary in an essay.</example>
    <example type="bad">"She felt something shift" — not valid in any register because it is unnamed.</example>
  </accept>

  <universal hint="Across all registers.">Avoid gestural emotion-words that are stand-ins for craft — "felt", "seemed", "somehow", "a strange sense" without a specific tether.</universal>
</summary-requirement>`;
