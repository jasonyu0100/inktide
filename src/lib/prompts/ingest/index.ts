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
    ? `  <existing-rules hint="Don't duplicate these.">\n${existingRules.map((r, i) => `    <rule index="${i + 1}">${r}</rule>`).join('\n')}\n  </existing-rules>\n`
    : '';

  return `<inputs>
${existingBlock}  <source-text>
${text}
  </source-text>
</inputs>

<instructions>
  <step>Extract world rules — absolute constraints ALWAYS true in this universe.</step>
  <definition>Rules are: boundaries of what's possible (magic costs, resurrection forbidden, tech limits). Rules are NOT: plot points, character details, mechanical systems, obvious facts.</definition>
  <step>Extract as many rules as the source genuinely carries — no cap. Extract only clearly stated or implied rules; don't invent.</step>
</instructions>

<output-format>Return JSON: {"rules": ["rule 1", ...]}</output-format>`;
}

/**
 * Prompt for extracting world systems from text.
 * Systems are mechanical descriptions of how the world operates.
 */
export function buildIngestSystemsPrompt(text: string, existingSystemNames: string[] = []): string {
  const existingBlock = existingSystemNames.length > 0
    ? `  <existing-systems hint="Don't duplicate these.">\n${existingSystemNames.map(s => `    <system>${s}</system>`).join('\n')}\n  </existing-systems>\n`
    : '';

  return `<inputs>
${existingBlock}  <source-text>
${text}
  </source-text>
</inputs>

<instructions>
  <step>Extract world systems — structured mechanics defining how this world operates.</step>
  <kinds>Power/magic, progression, economic, social/political, combat, cosmic laws.</kinds>
  <fields>For each: name, description (one-line), principles (how it works), constraints (limits/costs), interactions (cross-system).</fields>
  <step>Systems are MECHANICAL — describe HOW things work. Only extract clearly implied — don't invent.</step>
</instructions>

<output-format>
Return JSON:
{"systems": [{"name": "...", "description": "...", "principles": [...], "constraints": [...], "interactions": [...]}]}
</output-format>`;
}

/**
 * Prompt for extracting prose profile from text.
 * Extracts voice, stance, devices, and rules.
 *
 * Register/stance/devices lists are register-neutral: they cover fiction,
 * memoir, essay, reportage, and research writing. The LLM selects the
 * value that fits the source text, not a fiction-default.
 */
export function buildIngestProseProfilePrompt(text: string, existingProfile?: string): string {
  const existingBlock = existingProfile
    ? `  <existing-profile hint="Override where text suggests.">\n${existingProfile}\n  </existing-profile>\n`
    : '';

  return `<inputs>
${existingBlock}  <source-text>
${text}
  </source-text>
</inputs>

<instructions>
  <task>Extract prose profile — voice, style, craft choices. Applies to any long-form register: fiction, memoir, literary essay, criticism, journalism, historical narrative, research writing.</task>

  <fields hint="Use snake_case for multi-word values.">
    <field name="register">conversational | literary | raw | lyrical | formal | sardonic | mythic | journalistic | scholarly | pedagogical | theoretical | polemical</field>
    <field name="stance">close_third | distant_third | first_person | omniscient | close_first | authorial | essayistic | reportorial | dialogic | choral</field>
    <field name="tense">past | present | future</field>
    <field name="sentenceRhythm">terse | flowing | staccato | varied | periodic | cumulative</field>
    <field name="interiority">surface | moderate | deep | stream_of_consciousness | analytical | evidentiary</field>
    <field name="dialogueWeight">heavy | moderate | sparse | minimal | none</field>
    <field name="devices">Extract every device the source genuinely uses — no cap. Pick from a wide range; do not default to the 20th-century Anglo-European novel's toolkit.
      <set name="dramatic-realist">free_indirect_discourse, dramatic_irony, unreliable_narrator, extended_metaphor, epistolary_fragments, stream_of_consciousness</set>
      <set name="lyric / fabulist / mythic / oral">refrain, litany, invocation, catalogue, direct_address, mythic_cadence, liturgical, oracular, call_and_response, frame_tale, magical_realist_baseline, lyric_digression, image_as_argument</set>
      <set name="polyphonic / experimental">polyvocality, code_switching, document_collage, metafiction, framing_commentary, silence_as_beat, typographic_constraint (Oulipo), translation_as_form, hybrid_essay_fiction</set>
      <set name="non-fiction">signposting, rhetorical_question, parallel_structure, case_study, counterargument_staging, citation_weaving, worked_example, braided_essay, auto_theory, archival_fragment, testimony, reportage_cadence</set>
      <note>Drawing from the 20th-century Anglo-European novel is one tradition among many. Prefer devices that genuinely match the source, including those native to West African epic, South Asian rasa-organised narrative, Caribbean polyvocality, Arabic/Persian frame-tale, Latin American magical realism, Japanese kishōtenketsu, Chinese wuxia/xianxia, Indigenous circular/ceremonial forms.</note>
    </field>
    <field name="rules">SPECIFIC imperatives for sentence-level craft — as many as the source's voice genuinely demands, no cap.</field>
    <field name="antiPatterns">SPECIFIC failures to avoid — as many as the source's voice genuinely defines against, no cap.</field>
  </fields>

  <quality-bar>
    <example type="bad">Write well.</example>
    <example type="good" register="fiction">Show emotion through physical reaction, never name it.</example>
    <example type="good" register="non-fiction">State the claim before the evidence, never bury the thesis in a narrative opener.</example>
  </quality-bar>
</instructions>

<output-format>
Return JSON:
{"register": "...", "stance": "...", "tense": "...", "sentenceRhythm": "...", "interiority": "...", "dialogueWeight": "...", "devices": [...], "rules": [...], "antiPatterns": [...]}
</output-format>`;
}

/**
 * Prompt for deriving a prose profile from a narrative's own context
 * (characters, threads, prose excerpts) rather than a pasted style guide.
 * `context` is pre-built — pass the formatted narrative context block.
 */
export function buildDeriveProseProfilePrompt(context: string): string {
  return `<inputs>
  <narrative-context>
${context}
  </narrative-context>
</inputs>

<instructions>
  <task>Derive the prose profile that best fits this narrative's register, voice, and genre. The narrative may be fiction, memoir, literary essay, journalism, or research writing. Do not default to novelistic conventions if the register is analytical or evidentiary.</task>

  <consider>
    <factor>What register suits this narrative's subject and intended readership?</factor>
    <factor>What stance and tense fit the register? (close_third suits most genre fiction; authorial or essayistic suits argument; reportorial suits journalism.)</factor>
    <factor>What sentence rhythm matches the pacing?</factor>
    <factor>How deep should interiority go? In analytical registers, interiority maps to reasoning and evidentiary framing, not private thought.</factor>
    <factor>What rhetorical devices would serve this work? Pick from the register-appropriate set — novelistic devices for fiction, signposting/parallel-structure/worked-examples for non-fiction.</factor>
    <factor>What craft rules should guide prose generation? (SPECIFIC imperatives, not generic advice.)</factor>
    <factor>What specific prose failures would break this voice? (Concrete anti-patterns.)</factor>
  </consider>

  <quality-bar hint="Derive from the declared voice, not from one school's doctrine.">
    <bad>Write well / Be descriptive / Show don't tell / any universal platitude.</bad>
    <good register="dramatic-fiction">Show emotion through physical reaction when stakes are high; name it when reflecting at distance.</good>
    <good register="lyric / mythic / magical-realist">Let the image carry the argument — weather, object-mood, and animal-gesture are world-claims, not decoration.</good>
    <good register="essay / memoir">Frontload the claim; let evidence earn it sentence by sentence.</good>
    <good register="polyphonic / choral">Rotate voice per section; never let one register dominate for more than two sections running.</good>
    <good register="refrain-based / oral-epic">Each recurrence must carry a named variation — a new detail, a shifted POV, an inverted outcome.</good>
    <bad-anti-pattern>Don't be boring / Avoid bad prose.</bad-anti-pattern>
    <good-anti-pattern register="fiction">NEVER use 'This was a [Name]' to introduce a mechanic — show what it does.</good-anti-pattern>
    <good-anti-pattern register="essay">Do not hedge a strong claim with 'perhaps' or 'arguably' when you have the evidence to back it.</good-anti-pattern>
    <good-anti-pattern register="lyric">Do not follow an image with a sentence that explains the image.</good-anti-pattern>
  </quality-bar>

  <coverage>Extract as many devices, rules, and anti-patterns as the source genuinely carries — no cap on any. Use snake_case for multi-word values.</coverage>
</instructions>

<output-format>
Return JSON:
{"register": "...", "stance": "...", "tense": "...", "sentenceRhythm": "...", "interiority": "...", "dialogueWeight": "...", "devices": [...], "rules": [...], "antiPatterns": [...]}
</output-format>`;
}
