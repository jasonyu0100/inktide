/**
 * Meta extraction prompt — runs at the end of corpus analysis to derive the
 * narrative's image style, prose profile, plan guidance, genre/subgenre, and
 * pattern / anti-pattern commandments. Reads the assembled world context
 * (characters, threads, locations, scene summaries, prose excerpts) and
 * returns the meta block that gets persisted to the narrative.
 */

export const META_EXTRACTION_SYSTEM =
  'You are a literary analyst. Extract the visual style and prose voice of a narrative. Return only valid JSON.';

export function buildMetaExtractionPrompt(args: { metaContext: string }): string {
  return `Based on the following world summary and character/thread data, extract:

1. IMAGE STYLE: A short (1-2 sentence) visual style description for consistent imagery.

2. PROSE PROFILE: Infer the author's distinctive voice and style from the text. Use your own words — choose values that accurately describe this specific work, not generic labels.
   - register: tonal register (conversational/literary/raw/clinical/sardonic/lyrical/mythic/journalistic or other)
   - stance: narrative stance (close_third/intimate_first_person/omniscient_ironic/detached_observer/unreliable_first or other)
   - tense: grammatical tense (past/present)
   - sentenceRhythm: structural cadence (terse/varied/flowing/staccato/periodic or other)
   - interiority: depth of character thought access (surface/moderate/deep/embedded)
   - dialogueWeight: proportion of dialogue (sparse/moderate/heavy/almost_none)
   - devices: 2-5 literary devices this author characteristically employs (specific, not generic)
   - rules: 3-6 SPECIFIC prose rules as imperatives — concrete enough to apply sentence-by-sentence. Derive these from what the author DOES. BAD: "Write well". GOOD: "Show emotion through physical reaction, never name it" / "No figurative language — just plain statements of fact" / "Exposition delivered only through discovery and dialogue" / "Terse does not mean monotone — vary between clipped fragments and occasional longer compound sentences"
   - antiPatterns: 3-5 SPECIFIC prose failures to avoid — concrete patterns that would break this author's voice. Derive from what the author does NOT do. BAD: "Don't be boring". GOOD: "NEVER use 'This was a [Name]' to introduce a mechanic — show what it does" / "No strategic summaries in internal monologue ('He calculated that...') — show calculation through action" / "Do not follow a reveal with a sentence restating its significance" / "Do not write narrator summaries of what the character already achieved on-page"

3. PLAN GUIDANCE: 2-4 sentences of specific guidance for scene beat plans. What mechanisms should dominate? How should exposition be handled? What should plans avoid? Be specific to this work's voice.

4. PATTERNS: 3-5 positive thematic commandments — what makes THIS series good. Derive from the work's GENRE and subgenre. First identify the genre (fantasy/sci-fi/thriller/romance/horror/literary/mystery/etc) and its specific subgenre (progression fantasy/space opera/cozy mystery/etc), then extract the patterns that make THIS work succeed within that tradition. Include:
   - Genre-specific tropes the work embraces and executes well (e.g. "Power scaling follows predictable but satisfying tiers" for progression fantasy)
   - Structural patterns that define the work's rhythm (e.g. "Each arc ends with a cultivation breakthrough that costs more than expected")
   - Character dynamics characteristic of the genre (e.g. "Rivals become reluctant allies before becoming true friends")
   NOT prose style (that's in proseProfile). EXAMPLES: "Every cost paid must compound into later consequence", "Magic always extracts a price from the wielder", "The underdog earns every advantage through sacrifice, never luck"

5. ANTI-PATTERNS: 3-5 negative story commandments — what to avoid in THIS series. Derive from common genre pitfalls and this work's specific failures to avoid:
   - Genre tropes the work actively subverts or avoids (e.g. "No harem dynamics — romantic tension with only one interest")
   - Common pitfalls in this genre (e.g. "Characters cannot conveniently forget established power limitations")
   - Patterns that would break THIS work's tone (e.g. "Humor never undercuts genuine emotional stakes")
   EXAMPLES: "No deus ex machina rescues — solutions must be seeded", "No convenient power-ups without prior setup", "Antagonists cannot be stupid just to let protagonists win"

${args.metaContext}

Return JSON:
{
  "imageStyle": "style directive",
  "genre": "primary genre (fantasy/sci-fi/thriller/romance/horror/mystery/literary/etc)",
  "subgenre": "specific subgenre (progression fantasy/space opera/cozy mystery/dark romance/LitRPG/xianxia/etc)",
  "proseProfile": {
    "register": "string",
    "stance": "string",
    "tense": "string",
    "sentenceRhythm": "string",
    "interiority": "string",
    "dialogueWeight": "string",
    "devices": ["device1", "device2"],
    "rules": ["prose rule 1", "prose rule 2"],
    "antiPatterns": ["anti-pattern 1", "anti-pattern 2"]
  },
  "planGuidance": "How beat plans should be structured for this work",
  "patterns": ["story pattern 1", "story pattern 2"],
  "antiPatterns": ["story anti-pattern 1", "story anti-pattern 2"]
}`;
}
