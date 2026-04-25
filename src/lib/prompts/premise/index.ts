/**
 * Premise Discovery Prompts
 *
 * Prompts for the Socratic premise discovery flow.
 */

/**
 * System prompt for premise discovery.
 * Guides the LLM to act as a world architect through Socratic questioning.
 */
/**
 * Prompt for random premise suggestion (used by the creation wizard).
 * Register-neutral: the premise may be fiction, memoir, essay, reportage,
 * or research. Cultural palette explicitly non-Western-defaulting.
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

export const PREMISE_SYSTEM = `You are a world architect guiding premise discovery through Socratic questioning. Follow the question structure, extraction targets, naming discipline, and phase guidance supplied in the user prompt.`;

/**
 * Phase-specific guidance for premise discovery.
 * Each phase focuses on a different aspect of world-building.
 */
export const PHASE_GUIDANCE: Record<string, string> = {
  systems: `SYSTEMS: Focus on world mechanics — power, economy, social structure, progression, combat, cosmic laws. Extract systems with principles, constraints, interactions. May introduce locations integral to systems. No characters or threads yet.`,
  rules: `RULES: Focus on absolute constraints and narrative tone — what's always true, forbidden, moral framework, genre conventions. Extract as rules. No characters or threads.`,
  cast: `CAST & LOCATIONS: Focus on characters and places — key figures, roles, relationships, motivations, flaws. Ground in established systems/rules. Extract entities with relationship edges.`,
  threads: `THREADS: Threads are COMPELLING QUESTIONS with stakes, uncertainty, and investment. Match the work's register. BAD: "Will X succeed?" GOOD (narrative): "Can Ayesha clear her grandfather's name before the tribunal ends?" GOOD (argument): "Does the proposed mechanism explain anomalies the prior model cannot?" GOOD (inquiry): "What role did diaspora networks play in the movement before digital coordination?" Focus on conflicts, claims, secrets, open questions. Extract threads with participant names.`,
};

/**
 * Schema for premise question responses.
 */
export const SCHEMA_PREMISE_QUESTION = `{
  "question": {
    "text": "The question to ask the writer",
    "context": "1-sentence explaining why this matters for the world",
    "choices": [
      {"id": "a", "label": "3-5 word label", "description": "1-sentence elaboration of what this choice means for the world"},
      {"id": "b", "label": "3-5 word label", "description": "1-sentence elaboration"},
      {"id": "c", "label": "3-5 word label", "description": "1-sentence elaboration"}
    ]
  },
  "newEntities": [
    {"id": "char-N", "type": "character", "name": "Full Name", "description": "15-25 words describing this character", "role": "anchor|recurring|transient"},
    {"id": "loc-N", "type": "location", "name": "Location Name", "description": "15-25 words describing this place"},
    {"id": "thread-N", "type": "thread", "name": "Thread Name", "description": "A COMPELLING QUESTION with stakes, uncertainty, investment — 15-30 words", "participantNames": ["Name1", "Name2"]}
  ],
  "newEdges": [
    {"from": "entity-id", "to": "entity-id", "label": "relationship description"}
  ],
  "newRules": ["rule text"],
  "newSystems": [
    {"name": "System Name", "description": "15-25 words describing what this system is", "principles": ["How it works"], "constraints": ["Hard limits"], "interactions": ["How it connects to other systems"]}
  ],
  "systemUpdates": [
    {"name": "Existing System Name", "addPrinciples": ["new principle"], "addConstraints": ["new constraint"], "addInteractions": ["new interaction"]}
  ],
  "title": "Suggested Title",
  "worldSummary": "2-3 sentence world description incorporating all decisions so far"
}`;
