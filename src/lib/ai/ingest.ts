import { callGenerate, SYSTEM_PROMPT } from './api';
import { GENERATE_MODEL } from '@/lib/constants';
import { parseJson } from './json';
import type { NarrativeState, ProseProfile } from '@/types/narrative';

/**
 * Parse pasted text (prose sample, style guide, author analysis) into a ProseProfile.
 * Extracts voice, stance, devices, and rules from the text.
 */
export async function ingestProseProfile(text: string, existing?: Partial<ProseProfile>): Promise<ProseProfile> {
  const existingBlock = existing
    ? `EXISTING PROFILE (use as context — override fields where the text clearly suggests different values):\n${JSON.stringify(existing, null, 2)}\n`
    : '';

  const prompt = `Analyze the following text and extract a prose profile — the voice, style, and craft choices that define how this writing sounds. The text may be a prose sample, style guide, author analysis, editorial notes, or any description of writing style.

For each field, extract the most accurate single value:

- register: Tonal register of the narration. Examples: conversational, literary, raw, lyrical, journalistic, formal, sardonic, mythic
- stance: Narrator's distance from the character. Examples: close_third, distant_third, first_person, omniscient, second_person, close_first
- tense: Grammatical tense. Examples: past, present, future
- sentenceRhythm: Structural cadence of prose. Examples: terse, flowing, staccato, varied, periodic, cumulative
- interiority: How deep the narrator goes into character thought. Examples: surface, moderate, deep, stream_of_consciousness
- dialogueWeight: Proportion of prose given to dialogue. Examples: heavy, moderate, sparse, minimal, none
- devices: Rhetorical and narrative devices the author uses. Examples: free_indirect_discourse, dramatic_irony, unreliable_narrator, extended_metaphor, ironic_understatement, comic_escalation, epistolary_fragments, stream_of_consciousness, second_person_address, pathetic_fallacy
- rules: 3-6 SPECIFIC prose rules as imperatives — concrete enough to apply sentence-by-sentence. Derive from what this author DOES. BAD: "Write well" or "Be descriptive". GOOD: "Show emotion through physical reaction, never name it" / "No figurative language — just plain statements of fact" / "Terse does not mean monotone — vary between clipped fragments and occasional longer compound sentences" / "Exposition delivered only through discovery and dialogue"
- antiPatterns: 3-5 SPECIFIC prose failures to avoid — concrete patterns that would break this voice. Derive from what the author does NOT do. BAD: "Don't be boring". GOOD: "NEVER use 'This was a [Name]' to introduce a mechanic — show what it does" / "No strategic summaries in internal monologue ('He calculated that...') — show through action" / "Do not follow a reveal with a sentence restating its significance" / "Do not write narrator summaries of what the character already achieved on-page"

${existingBlock}
TEXT TO ANALYZE:
${text}

Return JSON:
{
  "register": "...",
  "stance": "...",
  "tense": "...",
  "sentenceRhythm": "...",
  "interiority": "...",
  "dialogueWeight": "...",
  "devices": ["...", "..."],
  "rules": ["...", "..."],
  "antiPatterns": ["...", "..."]
}

Extract 2-6 devices, 3-6 rules, and 3-5 anti-patterns depending on how much the text reveals. Rules and anti-patterns must be SPECIFIC and ACTIONABLE — each should describe a concrete sentence-level pattern to follow or avoid. Only extract what is clearly stated or strongly implied — don't invent. Use snake_case for multi-word values (e.g., "close_third", not "close third").`;

  const raw = await callGenerate(prompt, SYSTEM_PROMPT, undefined, 'ingestProseProfile', GENERATE_MODEL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = parseJson(raw, 'ingestProseProfile') as any;

  return {
    register:       typeof parsed.register === 'string'       ? parsed.register       : 'conversational',
    stance:         typeof parsed.stance === 'string'         ? parsed.stance         : 'close_third',
    tense:          typeof parsed.tense === 'string'          ? parsed.tense          : undefined,
    sentenceRhythm: typeof parsed.sentenceRhythm === 'string' ? parsed.sentenceRhythm : undefined,
    interiority:    typeof parsed.interiority === 'string'    ? parsed.interiority    : undefined,
    dialogueWeight: typeof parsed.dialogueWeight === 'string' ? parsed.dialogueWeight : undefined,
    devices:        Array.isArray(parsed.devices) ? parsed.devices.filter((d: unknown) => typeof d === 'string') : [],
    rules:          Array.isArray(parsed.rules)   ? parsed.rules.filter((r: unknown) => typeof r === 'string')   : [],
    antiPatterns:   Array.isArray(parsed.antiPatterns) ? parsed.antiPatterns.filter((a: unknown) => typeof a === 'string') : [],
  };
}

/**
 * Derive a prose profile from the story's narrative context — characters, threads,
 * world rules, tone, and sample prose. No pasted text needed.
 */
export async function deriveProseProfile(narrative: NarrativeState): Promise<ProseProfile> {
  // Build a compact context from the narrative
  const lines: string[] = [];

  lines.push(`TITLE: ${narrative.title}`);
  if (narrative.description) lines.push(`DESCRIPTION: ${narrative.description}`);

  // Characters — names, roles, brief descriptions
  const chars = Object.values(narrative.characters);
  if (chars.length > 0) {
    lines.push(`\nCHARACTERS (${chars.length}):`);
    for (const c of chars.slice(0, 15)) {
      lines.push(`  - ${c.name} (${c.role})`);
    }
  }

  // Threads — narrative tensions
  const threads = Object.values(narrative.threads);
  if (threads.length > 0) {
    lines.push(`\nTHREADS (${threads.length}):`);
    for (const t of threads.slice(0, 10)) {
      lines.push(`  - ${t.id} [${t.status}]: ${t.description.slice(0, 100)}`);
    }
  }

  // Sample scene summaries for tone
  const scenes = Object.values(narrative.scenes);
  if (scenes.length > 0) {
    lines.push(`\nSCENE SUMMARIES (sample):`);
    for (const s of scenes.slice(0, 8)) {
      const pov = narrative.characters[s.povId]?.name ?? s.povId;
      lines.push(`  - [${pov}] ${s.summary.slice(0, 150)}`);
    }
  }

  // Sample prose excerpts (first few scenes that have prose)
  const withProse = scenes.filter((s) => s.proseVersions && s.proseVersions.length > 0);
  if (withProse.length > 0) {
    lines.push(`\nPROSE EXCERPTS:`);
    for (const s of withProse.slice(0, 3)) {
      const latestProse = s.proseVersions![s.proseVersions!.length - 1].prose;
      const excerpt = latestProse.slice(0, 2000);
      lines.push(`---\n${excerpt}\n---`);
    }
  }

  const context = lines.join('\n');

  const prompt = `You are a literary analyst. Given the following story context — its characters, world, narrative threads, and prose samples — derive the ideal prose profile that best fits this story's voice, tone, and genre.

${context}

Analyze the story's genre, tone, subject matter, and existing prose (if any) to determine the best-fitting prose profile. Consider:
- What register suits the story's world and characters?
- What narrative stance and tense fit the genre?
- What sentence rhythm matches the story's pacing?
- How deep should interiority go given the POV and character complexity?
- What rhetorical devices would serve this story?
- What craft rules should guide prose generation? (SPECIFIC imperatives, not generic advice)
- What specific prose failures would break this voice? (concrete anti-patterns)

QUALITY BAR for rules and anti-patterns:
- BAD rule: "Write well" / "Be descriptive" / "Show don't tell"
- GOOD rule: "Show emotion through physical reaction, never name it" / "No figurative language — just plain statements of fact" / "Terse does not mean monotone — vary between clipped fragments and occasional longer compound sentences"
- BAD anti-pattern: "Don't be boring" / "Avoid bad prose"
- GOOD anti-pattern: "NEVER use 'This was a [Name]' to introduce a mechanic — show what it does" / "No strategic summaries in internal monologue ('He calculated that...') — show through action" / "Do not follow a reveal with a sentence restating its significance"

Return JSON:
{
  "register": "...",
  "stance": "...",
  "tense": "...",
  "sentenceRhythm": "...",
  "interiority": "...",
  "dialogueWeight": "...",
  "devices": ["...", "..."],
  "rules": ["...", "..."],
  "antiPatterns": ["...", "..."]
}

Extract 2-6 devices, 3-6 rules, and 3-5 anti-patterns. Every rule and anti-pattern must describe a concrete sentence-level pattern. Use snake_case for multi-word values (e.g., "close_third").`;

  const raw = await callGenerate(prompt, SYSTEM_PROMPT, undefined, 'deriveProseProfile', GENERATE_MODEL);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parsed = parseJson(raw, 'deriveProseProfile') as any;

  return {
    register:       typeof parsed.register === 'string'       ? parsed.register       : 'conversational',
    stance:         typeof parsed.stance === 'string'         ? parsed.stance         : 'close_third',
    tense:          typeof parsed.tense === 'string'          ? parsed.tense          : undefined,
    sentenceRhythm: typeof parsed.sentenceRhythm === 'string' ? parsed.sentenceRhythm : undefined,
    interiority:    typeof parsed.interiority === 'string'    ? parsed.interiority    : undefined,
    dialogueWeight: typeof parsed.dialogueWeight === 'string' ? parsed.dialogueWeight : undefined,
    devices:        Array.isArray(parsed.devices) ? parsed.devices.filter((d: unknown) => typeof d === 'string') : [],
    rules:          Array.isArray(parsed.rules)   ? parsed.rules.filter((r: unknown) => typeof r === 'string')   : [],
    antiPatterns:   Array.isArray(parsed.antiPatterns) ? parsed.antiPatterns.filter((a: unknown) => typeof a === 'string') : [],
  };
}
