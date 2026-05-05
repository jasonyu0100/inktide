/**
 * Plan-side format-awareness block — surfaces the downstream rendering
 * target so the planner shapes mechanism mix and `what`-field scaffolding
 * to survive the format transit. The plan stays format-agnostic in
 * structure (same fn / mechanism taxonomy across all formats), but each
 * format prefers a different accent profile downstream and the plan can
 * leave the right doors open.
 *
 * Returns "" for the prose default (the plan's defaults are already
 * prose-tuned, so an empty block keeps the prompt clean).
 */

import type { ProseFormat } from "@/types/narrative";

export function buildPlanFormatBlock(format: ProseFormat): string {
  if (format === "prose") return "";

  const body = FORMAT_BODIES[format];
  if (!body) return "";

  return `<rendering-format target="${format}" hint="The downstream prose stage will RE-RENDER this plan into the named format — the blueprint stays the same shape, but the accent profile differs. Plan with the format's strengths in mind so the rendering doesn't have to fight the blueprint.">
${body}
  </rendering-format>`;
}

const FORMAT_BODIES: Partial<Record<ProseFormat, string>> = {
  screenplay: `  <accent>
    <rule>Sparser propositions per beat than prose — each minute of stage time covers fewer claims than a paragraph. If a beat in 'what' lists 5+ propositions, the screen rendering will compress or drop them. Distribute load across more beats rather than packing.</rule>
    <rule>Dialogue-heavier overall. Whenever 2+ participants share a substantive beat, prefer dialogue mechanism over thought / narration / action — stage lives in audible exchange.</rule>
    <rule>Externalisable mechanisms (dialogue / action / environment / document) are the screenplay's native register. The plan's mix should lean toward these where the story earns it.</rule>
  </accent>
  <interior-mechanisms hint="Beats with mechanism = thought / narration / memory / comic must externalise downstream. Leave the externalisation door open in 'what'.">
    <rule name="thought">'what' must scaffold the EXTERNALISATION ROUTE — what V.O. line carries the calculation, OR what visible micro-expression / blocking carries it without words, OR what visualised aperture / INSERT shot stages the interior. Don't write 'X recognises Y as Z' — write 'X registers Y; V.O. names it as Z' or 'X's hand stills; the basin's hum drops'. The prose stage must know HOW to externalise this beat without inventing.</rule>
    <rule name="narration">'what' must scaffold a TIME-COMPRESSION DEVICE — series of shots, montage, V.O. bridge, or a moments-later cut. 'Three weeks of routines compressed' is fine; 'time passes' isn't.</rule>
    <rule name="memory">'what' must name both the TRIGGER (what the present-day character sees / hears) and the FLASHBACK CONTENT (what the cut shows). The trigger lives in the present-day action; the cut delivers the recall.</rule>
    <rule name="comic">'what' must name the VISIBLE COMIC DEVICE — the reaction shot, the visual undercut, the off-beat punchline cue. Comic register on stage is bodily, not authorial.</rule>
  </interior-mechanisms>
  <blank-stage-test hint="Apply during planning, not just rendering.">For any beat with two or more participants holding still in a room, name what the camera will see and hear: a candle burning down, a guard's footfall in the corridor, sweat at a temple, an INSERT cut into a body or a memory. Stillness needs texture or staging; if 'what' offers neither, the rendering will fail.</blank-stage-test>`,
  meta: `  <accent>
    <rule>Beats render as fluid prose interleaved with bracketed engine observations. Plan the prose for natural beats — the overlay rides on top, it doesn't replace propositions.</rule>
    <rule>Inflection-point beats (thread commitments, payoffs, reveals, arc pivots) carry observation density; quiet beats run prose-only. Plan with that rhythm in mind — don't pack every beat with shift-worthy material.</rule>
  </accent>`,
  simulation: `  <accent>
    <rule>Beats render as fluid prose interleaved with bracketed in-world system logs. Plan the prose for natural beats — the HUD overlay rides on top.</rule>
    <rule>The world's diegetic rules / systems / state transitions surface as logs at the moments they fire in-fiction. Plan beats so those moments land cleanly — a [System Rule Triggered] should follow a beat that DEPICTS the trigger, not narrates around it.</rule>
  </accent>`,
};
