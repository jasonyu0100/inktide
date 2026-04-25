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
  return `<inputs>
  <meta-context hint="World summary, character/thread data, scene summaries, and prose excerpts.">
${args.metaContext}
  </meta-context>
</inputs>

<instructions>
  <task>Extract the visual style, prose voice, plan guidance, genre, and pattern / anti-pattern commandments for this narrative.</task>

  <field name="imageStyle">A short (1-2 sentence) visual style description for consistent imagery.</field>

  <field name="proseProfile" hint="Infer the author's distinctive voice and style. Choose values that describe this specific work, not generic labels.">
    <subfield name="register">conversational | literary | raw | clinical | sardonic | lyrical | mythic | journalistic | (or other)</subfield>
    <subfield name="stance">close_third | intimate_first_person | omniscient_ironic | detached_observer | unreliable_first | (or other)</subfield>
    <subfield name="tense">past | present</subfield>
    <subfield name="sentenceRhythm">terse | varied | flowing | staccato | periodic | (or other)</subfield>
    <subfield name="interiority">surface | moderate | deep | embedded</subfield>
    <subfield name="dialogueWeight">sparse | moderate | heavy | almost_none</subfield>
    <subfield name="devices">2-5 literary devices this author characteristically employs (specific, not generic).</subfield>
    <subfield name="rules" hint="Derive from what the author DOES.">
      3-6 SPECIFIC prose rules as imperatives — concrete enough to apply sentence-by-sentence.
      <example type="bad">Write well.</example>
      <example type="good">Show emotion through physical reaction, never name it.</example>
      <example type="good">No figurative language — just plain statements of fact.</example>
      <example type="good">Exposition delivered only through discovery and dialogue.</example>
    </subfield>
    <subfield name="antiPatterns" hint="Derive from what the author does NOT do.">
      3-5 SPECIFIC prose failures to avoid.
      <example type="bad">Don't be boring.</example>
      <example type="good">NEVER use 'This was a [Name]' to introduce a mechanic — show what it does.</example>
      <example type="good">No strategic summaries in internal monologue ('He calculated that...') — show calculation through action.</example>
      <example type="good">Do not follow a reveal with a sentence restating its significance.</example>
    </subfield>
  </field>

  <field name="planGuidance">2-4 sentences of specific guidance for scene beat plans. What mechanisms should dominate? How should exposition be handled? What should plans avoid? Be specific to this work's voice.</field>

  <field name="patterns" count="3-5" hint="Positive thematic commandments — what makes THIS series good. Derive from the work's GENRE and subgenre.">
    <consider>Genre-specific tropes the work embraces and executes well.</consider>
    <consider>Structural patterns that define the work's rhythm.</consider>
    <consider>Character dynamics characteristic of the genre.</consider>
    <note>NOT prose style — that lives in proseProfile.</note>
    <example>Every cost paid must compound into later consequence.</example>
    <example>Magic always extracts a price from the wielder.</example>
    <example>The underdog earns every advantage through sacrifice, never luck.</example>
  </field>

  <field name="antiPatterns" count="3-5" hint="Negative story commandments — what to avoid in THIS series.">
    <consider>Genre tropes the work actively subverts or avoids.</consider>
    <consider>Common pitfalls in this genre.</consider>
    <consider>Patterns that would break THIS work's tone.</consider>
    <example>No deus ex machina rescues — solutions must be seeded.</example>
    <example>No convenient power-ups without prior setup.</example>
    <example>Antagonists cannot be stupid just to let protagonists win.</example>
  </field>
</instructions>

<output-format>
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
}
</output-format>`;
}
