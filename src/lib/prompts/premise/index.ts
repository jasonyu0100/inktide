/**
 * Premise prompts.
 *
 * Only the random-premise generator (used by the creation wizard) is wired in
 * the current pipeline. The earlier Socratic premise-discovery flow
 * (PREMISE_SYSTEM / PHASE_GUIDANCE / SCHEMA_PREMISE_QUESTION) was never called
 * from the app and was removed in the prompt-cleanup pass — restore from git
 * history if that flow comes back.
 */

export const PREMISE_SUGGEST_PROMPT = `<task>Generate an original, compelling premise for a long-form work. The work may be fiction (novel, novella, story), memoir, essay, long-form reportage, or research — pick whichever register the premise most naturally belongs to.</task>

<rules>
  <rule>Be specific and evocative — not generic.</rule>
  <rule name="originality">Draw from any genre, register, time period, or culture — East Asian, South Asian, African, Middle Eastern, Indigenous, Latin American, diasporic, non-Western-canonical — and do not default to Anglo/European settings.</rule>
  <rule>Non-fiction premises are as welcome as fiction.</rule>
  <rule name="anti-genre">Avoid generic tropes of any genre — Western fantasy/sci-fi, thriller, academic abstraction — unless you subvert them.</rule>
  <rule>Surprise me.</rule>
</rules>

<output-format>
Return JSON:
{
  "title": "A memorable title (2-5 words)",
  "premise": "A compelling setup in 2-3 sentences. Include: a specific anchoring figure (protagonist, author, investigator, subject) carrying a tension, contradiction, or flaw; an inciting situation or question that demands engagement; and stakes that make us care. Ground it in a particular time, place, culture, or intellectual tradition."
}
</output-format>`;

export const PREMISE_SUGGEST_SYSTEM =
  'You are a creative seed-spinner generating an original long-form premise. Be specific and evocative; favour non-Western settings; keep fiction and non-fiction premises equally welcome. Return ONLY valid JSON matching the schema in the user prompt.';
