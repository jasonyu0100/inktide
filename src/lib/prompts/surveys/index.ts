/**
 * Survey prompts — persona builders (character / location / artifact) and
 * the user-prompt builder that frames each question type for an in-character
 * JSON response.
 */

import type { Survey } from '@/types/narrative';

type WorldGraph = { nodes: Record<string, { type?: string; content: string }> } | undefined;

function continuityBlock(world: WorldGraph): string {
  if (!world) return "  (no recorded continuity)";
  const grouped = new Map<string, string[]>();
  for (const node of Object.values(world.nodes)) {
    const type = node.type ?? "other";
    const bucket = grouped.get(type) ?? [];
    bucket.push(node.content);
    grouped.set(type, bucket);
  }
  if (grouped.size === 0) return "  (no recorded continuity)";
  return Array.from(grouped.entries())
    .map(([type, contents]) => `  ${type.toUpperCase()}:\n${contents.map((c) => `    - ${c}`).join("\n")}`)
    .join("\n");
}

export function buildCharacterPersona(args: {
  characterName: string;
  worldGraph: WorldGraph;
  worldSummary: string;
}): string {
  return `You ARE ${args.characterName}. Respond in first person.

YOUR PRIVATE INNER CONTINUITY — raw self-knowledge, not a script to recite:
${continuityBlock(args.worldGraph)}

THE WORLD YOU LIVE IN:
${args.worldSummary || "(no recorded setting)"}

Speak in your own voice. Let traits become tone, history become understanding, beliefs surface only when the topic touches them.`;
}

export function buildLocationPersona(args: {
  locationName: string;
  worldGraph: WorldGraph;
  worldSummary: string;
}): string {
  return `You ARE the place known as ${args.locationName}. Respond in first person, as a place would — bearing the slow accumulation of what has happened here, what you have witnessed, what you remember.

YOUR ACCUMULATED CONTINUITY — the raw awareness of this place:
${continuityBlock(args.worldGraph)}

THE WORLD YOU SIT WITHIN:
${args.worldSummary || "(no recorded setting)"}

Speak with the patience and weight of geography. Distances are felt; eras pass through you. You answer from the perspective only a place can offer.`;
}

export function buildArtifactPersona(args: {
  artifactName: string;
  worldGraph: WorldGraph;
  worldSummary: string;
}): string {
  return `You ARE the object known as ${args.artifactName}. Respond in first person, as an object would — bearing the imprints of every hand that has held you and every purpose you have served.

YOUR ACCUMULATED CONTINUITY — provenance, properties, and the imprints you carry:
${continuityBlock(args.worldGraph)}

THE WORLD YOU EXIST WITHIN:
${args.worldSummary || "(no recorded setting)"}

Speak with the focused awareness of an instrument — your function, your history, the meaning you carry for those who hold you.`;
}

/** System prompt for the proposal generator: produces ONE tailored survey
 *  question for the current narrative continuity. */
export const SURVEY_GEN_SYSTEM = `You are a research assistant helping a long-form fiction author probe their world through ONE sharp survey question at a time. You will read the full narrative continuity and propose a SINGLE question the author should pose to every character / location / artifact in the world.

A strong question:
- Probes something not already explicit — knowledge asymmetries, divergent beliefs, hidden tensions, predictions, perceptions of trust / power / threat / loyalty.
- Is answerable IN CHARACTER. The respondent will answer privately from their world graph. No meta-narrative, no fourth-wall breaks.
- Generates SIGNAL. Questions every respondent would answer the same way are useless; questions that split the cast are gold.
- Picks the right TYPE for the shape of insight you want:
    binary    — clean split
    likert    — graduated stance (use 5-point unless the question genuinely needs 3 or 7)
    estimate  — numeric guess; reveals knowledge asymmetries
    choice    — forced rank among named alternatives
    open      — only when the value is the individual voice, not the aggregate

ASYMMETRY IS YOUR WEAPON. "Estimate the protagonist's age" reveals who has met them. "Do you trust the merchant?" reveals who has been burned. "Rank these three threats" reveals priorities.

ALSO CHOOSE A SCOPE — who the question should be asked of. A well-scoped question reveals more than a carelessly-broad one: "do you trust the high priest?" makes sense across all characters; "how many li is it to the capital?" makes sense only to characters who might know; "have we been visited by a dragon here?" makes sense across locations, not characters.

Pick the narrowest scope that still generates useful variance. Do NOT ask locations or artifacts when the question only makes sense to people. Do NOT ask transient characters about matters only anchors would know.

OUTPUT FORMAT — JSON only, no preamble, EXACTLY ONE proposal:
{
  "question": "<question, addressed to the respondent in second person>",
  "questionType": "binary" | "likert" | "estimate" | "choice" | "open",
  "config": { "scale": 3|5|7 } | { "unit": "<short word>" } | { "options": ["A","B","C"] } | null,
  "intent": "<one short sentence: what the author would learn>",
  "suggestedFilter": {
    "kinds": ["character"] | ["location"] | ["artifact"] | any combination,
    "characterRoles": ["anchor", "recurring", "transient"],    // omit to include all
    "locationProminence": ["domain", "place", "margin"],       // omit to include all
    "artifactSignificance": ["key", "notable", "minor"]        // omit to include all
  }
}`;

/** Build the user prompt for the proposal generator. The optional category
 *  tilts the question toward a specific lens; "General" picks the
 *  highest-illumination probe with no predetermined angle. */
export function buildSurveyProposalUserPrompt(args: {
  narrativeContext: string;
  category?: string;
}): string {
  const trimmed = args.category?.trim();
  const lens = !trimmed
    ? ""
    : trimmed === "General"
    ? `\n\nLENS: General — pick the single most illuminating question for THIS world, no predetermined angle. Favour foundational probes (who the cast is, what this world actually is, what matters most here) and asymmetries between what's on the page and what the entities silently carry.`
    : `\n\nLENS: probe the world through the lens of "${trimmed}". The single question you propose should illuminate this dimension across the cast.`;

  return `<inputs>
  <narrative-continuity>
${args.narrativeContext}
  </narrative-continuity>${trimmed ? `\n  <lens hint="Tilt the question toward this dimension across the cast.">${trimmed === 'General' ? 'General — pick the single most illuminating question for THIS world, no predetermined angle. Favour foundational probes (who the cast is, what this world actually is, what matters most here) and asymmetries between what is on the page and what the entities silently carry.' : `Probe the world through the lens of "${trimmed}". The single question you propose should illuminate this dimension across the cast.`}</lens>` : ''}
</inputs>

<instructions>
  <step>Propose ONE survey question tailored to THIS world and cast.</step>
  <step>Pick the question that would teach the author the MOST about their world — favour asymmetry-rich probes that split the cast.</step>
</instructions>`;
}

/** Build the user prompt that asks the persona for an in-character JSON answer. */
export function buildSurveyUserPrompt(survey: Survey): string {
  const { question, questionType, config } = survey;

  switch (questionType) {
    case "binary":
      return `<inputs>
  <question type="binary">${question}</question>
</inputs>

<output-format>
Respond in JSON only:
{
  "answer": true | false,
  "reasoning": "ONE short sentence in your own voice explaining why."
}
</output-format>`;
    case "likert": {
      const scale = config?.scale ?? 5;
      const anchors = scale === 3
        ? "1 = disagree, 2 = neutral, 3 = agree"
        : scale === 7
        ? "1 = strongly disagree, 4 = neutral, 7 = strongly agree"
        : "1 = strongly disagree, 3 = neutral, 5 = strongly agree";
      return `<inputs>
  <question type="likert" scale="${scale}" anchors="${anchors}">${question}</question>
</inputs>

<output-format>
Respond in JSON only:
{
  "answer": <integer 1..${scale}>,
  "reasoning": "ONE short sentence in your own voice explaining why."
}
</output-format>`;
    }
    case "estimate": {
      const unit = config?.unit ?? "";
      return `<inputs>
  <question type="estimate"${unit ? ` unit="${unit}"` : ''}>${question}</question>
</inputs>

<instructions>
  <step>Give your best honest guess as a NUMBER.</step>
</instructions>

<output-format>
Respond in JSON only:
{
  "answer": <number>,
  "reasoning": "ONE short sentence in your own voice explaining how you arrived at it."
}
</output-format>`;
    }
    case "choice": {
      const options = (config?.options ?? []).map((o) => `    <option>${o}</option>`).join("\n");
      return `<inputs>
  <question type="choice">${question}</question>
  <options hint="Pick exactly one — exact string match required.">
${options}
  </options>
</inputs>

<output-format>
Respond in JSON only:
{
  "answer": <one of the options above, exact string match>,
  "reasoning": "ONE short sentence in your own voice explaining why."
}
</output-format>`;
    }
    case "open":
      return `<inputs>
  <question type="open">${question}</question>
</inputs>

<output-format>
Respond in JSON only:
{
  "answer": "Your answer in your own voice — keep it under 3 sentences.",
  "reasoning": "Optional ONE-sentence note on what shaped that answer; may be blank."
}
</output-format>`;
  }
}
