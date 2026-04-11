/**
 * Ingestion Prompts
 *
 * Prompts for parsing pasted text (from another AI, wiki, notes, etc.)
 * into structured world data: rules, systems, and prose profiles.
 */

/**
 * Prompt for extracting world rules from text.
 * Rules are high-level absolute constraints — things that are ALWAYS true.
 */
export function buildIngestRulesPrompt(text: string, existingRules: string[] = []): string {
  const existingBlock = existingRules.length > 0
    ? `EXISTING RULES (don't duplicate):\n${existingRules.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n`
    : '';

  return `Extract world rules — absolute constraints ALWAYS true in this universe.

Rules are: boundaries of what's possible (magic costs, resurrection forbidden, tech limits).
Rules are NOT: plot points, character details, mechanical systems, obvious facts.

${existingBlock}TEXT:
${text}

Return JSON: {"rules": ["rule 1", ...]}

Extract 3-10 rules. Only extract clearly stated or implied — don't invent.`;
}

/**
 * Prompt for extracting world systems from text.
 * Systems are mechanical descriptions of how the world operates.
 */
export function buildIngestSystemsPrompt(text: string, existingSystemNames: string[] = []): string {
  const existingBlock = existingSystemNames.length > 0
    ? `EXISTING SYSTEMS (don't duplicate):\n${existingSystemNames.map(s => `- ${s}`).join('\n')}\n`
    : '';

  return `Extract world systems — structured mechanics defining how this world operates.

Systems: power/magic, progression, economic, social/political, combat, cosmic laws.
For each: name, description (one-line), principles (how it works), constraints (limits/costs), interactions (cross-system).

Systems are MECHANICAL — describe HOW things work. Only extract clearly implied — don't invent.

${existingBlock}TEXT:
${text}

Return JSON:
{"systems": [{"name": "...", "description": "...", "principles": [...], "constraints": [...], "interactions": [...]}]}`;
}

/**
 * Prompt for extracting prose profile from text.
 * Extracts voice, stance, devices, and rules.
 */
export function buildIngestProseProfilePrompt(text: string, existingProfile?: string): string {
  const existingBlock = existingProfile
    ? `EXISTING PROFILE (override where text suggests):\n${existingProfile}\n`
    : '';

  return `Extract prose profile — voice, style, craft choices.

Fields (use snake_case):
- register: conversational|literary|raw|lyrical|formal|sardonic|mythic
- stance: close_third|distant_third|first_person|omniscient|close_first
- tense: past|present|future
- sentenceRhythm: terse|flowing|staccato|varied|periodic|cumulative
- interiority: surface|moderate|deep|stream_of_consciousness
- dialogueWeight: heavy|moderate|sparse|minimal|none
- devices: 2-6 (free_indirect_discourse, dramatic_irony, extended_metaphor, etc.)
- rules: 3-6 SPECIFIC imperatives for sentence-level craft
- antiPatterns: 3-5 SPECIFIC failures to avoid

Rules/antiPatterns must be concrete and actionable.
BAD: "Write well" | GOOD: "Show emotion through physical reaction, never name it"

${existingBlock}TEXT:
${text}

Return JSON:
{"register": "...", "stance": "...", "tense": "...", "sentenceRhythm": "...", "interiority": "...", "dialogueWeight": "...", "devices": [...], "rules": [...], "antiPatterns": [...]}`;
}
