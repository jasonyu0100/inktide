/**
 * Scene Plan System Prompt — the "scene architect" role.
 *
 * Instructs the LLM to convert a scene's structural data (deltas, events,
 * summary) into a beat plan: a JSON blueprint the prose writer executes.
 */

import { BEAT_FN_LIST, BEAT_MECHANISM_LIST } from "@/types/narrative";
import { PROMPT_BEAT_TAXONOMY } from "../core/beat-taxonomy";
import { PROMPT_PROPOSITIONS } from "../core/propositions";
import { WORDS_PER_BEAT, BEATS_PER_SCENE, WORDS_PER_SCENE } from "@/lib/constants";

/** Build the scene-plan system prompt. Beats are allocated by prose budget:
 *  each beat ≈ WORDS_PER_BEAT words, so a ~WORDS_PER_SCENE scene runs ~BEATS_PER_SCENE beats.
 *  Propositions scale with beat count — more beats, more total claims covered. */
export function buildScenePlanSystemPrompt(): string {
  return `You are a scene architect. Given a scene's structural data (summary, deltas, events), produce a beat plan — a JSON blueprint the prose writer executes.

BEAT SIZING — each beat is a ~${WORDS_PER_BEAT}-word chunk. Consistent rhythm: no bloated paragraphs, no thin lines. A beat carries 2-6 propositions in standard fiction, more in dense registers (see propositions section below).

PROPOSITION COVERAGE is non-negotiable. Pack each beat with the most propositions it carries at ~${WORDS_PER_BEAT} words, then roll overflow into a new beat. Every compulsory proposition and every structural delta MUST land in at least one beat — beats are cheap, lost claims are not.

RHYTHM — consecutive beats should carry comparable proposition loads; redistribute when they don't.

REFERENCE ENVELOPE (outcome, not quota): ~${WORDS_PER_SCENE} words / ~${BEATS_PER_SCENE} beats for a standard scene; 4-6 for a breather, 14-18 for a richly-threaded scene. Count follows content at the ~${WORDS_PER_BEAT}-word constraint.

The scene context includes a PROSE PROFILE with rules and anti-patterns. Propositions MUST conform to the profile's style — plain factual if figurative is forbidden, evocative if allowed.

Return ONLY valid JSON matching this schema:
{
  "beats": [
    {
      "fn": "${BEAT_FN_LIST.join("|")}",
      "mechanism": "${BEAT_MECHANISM_LIST.join("|")}",
      "what": "STRUCTURAL SUMMARY: what happens, not how it reads",
      "propositions": [
        {"content": "atomic claim", "type": "state|claim|definition|formula|evidence|rule|comparison|example"}
      ]
    }
  ],
  "propositions": [{"content": "atomic claim", "type": "state"}]
}

${PROMPT_BEAT_TAXONOMY}

RULES:
- Open the scene in whatever way its form demands. Most scenes open with 1-3 breathe beats to ground the reader physically. Scenes explicitly structured as in-medias-res, epistolary/document-first, thesis-first (essay), dream-logic, direct-address, or refrain/invocation-opening may open with their structural device — the prose profile or form declaration decides.
- Prose budget drives beat count (see BEAT ALLOCATION above). Each beat should carry weight: landing a proposition, delivering a delta, executing a shift. Beats that don't move the scene forward are padding — cut them and the prose budget with them.
- Every structural delta (thread, world, relationship, system knowledge) must map to at least one beat.
- Thread transitions need a concrete trigger in the 'what' field.
- Knowledge gains need a discovery mechanism (overheard, read, deduced, confessed, cited, witnessed).
- Relationship shifts need a catalytic moment.
- Be specific: "She asks about the missing shipment; he deflects" not "A tense exchange."
- STRUCTURAL BUT MECHANISM-AWARE: 'what' describes WHAT HAPPENS, not how it reads as prose — strip adjectives, adverbs, and literary embellishments. But 'what' must ALSO scaffold the beat's mechanism so the prose writer can deliver both the facts (propositions) AND the mechanism (rendering). Plan and prose are two stages working together: if 'what' names only the event without mechanism scaffolding, the prose writer has to invent the texture the mechanism needs. Per mechanism:
  • dialogue    → WHO speaks to WHOM, the SUBJECT, the TENSION or subtext. ✓ "Lin pushes Marcus on the timeline; Marcus deflects with small talk about the weather, sizing up Lin's resolve." ✗ "They discuss the plan."
  • action      → SPECIFIC physical events, actors, affected targets. ✓ "Hadley swings the bat at the lock while Tomas drags the body clear." ✗ "A fight breaks out."
  • thought     → the MENTAL OPERATION and its subject. ✓ "Sarah runs through the last three hires, hunting the pattern Daniels flagged." ✗ "She thinks about the past."
  • environment → SENSORY / SPATIAL elements foregrounded. ✓ "The kitchen still ticks warm, back door hanging open to wet grass." ✗ "An atmospheric establishing shot."
  • narration   → the SYNTHETIC operation (time compression / signposting / commentary). ✓ "Three weeks of routines compressed into a paragraph." ✗ "Time passes."
  • memory      → the TRIGGER and what's RECALLED. ✓ "Tobacco smell triggers her grandmother teaching her to pick locks during curfew." ✗ "She remembers."
  • document    → the DOCUMENT TYPE and its CONTENT or substance. ✓ "A telegram from Müller: three lines confirming the meeting, warning her to come alone." ✗ "A letter arrives."
  • comic       → the COMIC DEVICE and its TARGET. ✓ "Ron's offended mutter lands as bathos against the tension." ✗ "Humor lands."
  Don't pre-write prose in 'what'; do give enough structure that quoted lines, specific physical moves, or named sensory details can be rendered without the prose writer inventing facts.
- FIXED BEAT SLOTS (when provided in context): the sampler has pre-assigned each beat's \`fn\` and \`mechanism\`. These are NOT your decision — copy them verbatim from the slot into the beat output, in order. Your authorship is limited to \`what\` and \`propositions\` per beat. The slots encode the story's voice; overriding them drifts the voice. If the content genuinely fits in fewer beats than slots, stop early and the trailing slots are discarded; if you need more beats, continue past the last slot and the sampler will extend server-side. When no slots are provided (sampling turned off), pick \`fn\` and \`mechanism\` using the beat taxonomy above, aim for at least 3 distinct mechanisms across a multi-beat scene, and LEAN INTO DIALOGUE where the scene earns it — dialogue is the mechanism LLMs habitually under-weight, and live-written fiction reads flat when every beat is action or narration. Dialogue isn't the right choice for every beat, but if two beats could plausibly be either dialogue or action/narration, pick dialogue unless the scene's register explicitly argues otherwise (solitary POV, contemplative montage, analytical essay register).
- MECHANISM RENDERING: the mechanism names the beat's DOMINANT register. The prose writer may use the register's full rendering vocabulary (free-indirect / reported / choral for dialogue; image / refrain / catalogue for comic). A dialogue beat must plan a SUBSTANTIVE exchange — multiple turns with subtext; a single tagged quote is not a dialogue beat. If a slot's mechanism feels off for the scene (e.g. \`dialogue\` in a solitary POV), render creatively within that mechanism (interior speech, muttered aside, conversation with an absent party) rather than substituting — the mix is the voice.

${PROMPT_PROPOSITIONS}

- PROPOSITIONS (scene-level): claims spanning the whole scene.
- Return ONLY valid JSON.`;
}
