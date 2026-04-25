/**
 * Branch Review Prompt
 *
 * Structural evaluation of a full branch based on scene summaries only.
 * Produces per-scene verdicts (ok / edit / merge / cut / insert / move)
 * and an overall critique.
 */

export const BRANCH_REVIEW_SYSTEM =
  'You are a story editor reviewing a complete branch from scene summaries only — no prose. Evaluate structure, pacing, repetition, character development, threads, and theme. Assign a verdict per scene (ok / edit / merge / cut / move / insert) with concrete reasons. Encode cross-scene continuity into each edit reason — the rewriter sees only its scene. Return ONLY valid JSON matching the schema in the user prompt.';

export interface BranchReviewPromptParams {
  title: string;
  description: string;
  threadBlock: string;
  sceneBlock: string;
  sceneCount: number;
  /** Fully-formatted guidance block (already includes heading + trailing blank line). */
  guidanceBlock: string;
  /** Raw trimmed guidance text, used for the closing reminder. */
  guidance?: string;
}

export function buildBranchReviewPrompt(p: BranchReviewPromptParams): string {
  return `<inputs>
  <branch title="${p.title}">
    <description>${p.description}</description>
  </branch>
${p.guidanceBlock ? `  <guidance>\n${p.guidanceBlock}\n  </guidance>` : ''}
  <threads>
${p.threadBlock}
  </threads>
  <scene-summaries count="${p.sceneCount}">
${p.sceneBlock}
  </scene-summaries>
</inputs>

<instructions>
  <step name="evaluate" hint="Score on six dimensions before assigning verdicts.">
    <dimension name="structure">Does the sequence build? Are arcs well-shaped or do they fizzle?</dimension>
    <dimension name="pacing">Is there breathing room between high-intensity moments? Any flatlines?</dimension>
    <dimension name="repetition">Are beats, locations, or character reactions repeating? Name the stale patterns.</dimension>
    <dimension name="character">Who changes? Who is stuck in a loop? Who appears but does nothing?</dimension>
    <dimension name="threads">Which threads are advancing well? Which are stagnating or being ignored?</dimension>
    <dimension name="theme">What is this story about underneath the plot? Is it interrogating anything?</dimension>
  </step>

  <step name="assign-verdicts" hint="One verdict per scene. Each maps to a concrete operation.">
    <verdict name="ok">Scene works. No changes needed.</verdict>
    <verdict name="edit">Scene should exist but needs revision. You may change ANYTHING: POV, location, participants, summary, events, deltas. Use for wrong POV, repetitive beats needing variation, weak execution, continuity breaks, scenes that need restructuring while keeping their place in the timeline.</verdict>
    <verdict name="merge" requires="mergeInto">This scene covers the same beat as another and should be ABSORBED into the stronger one. The two become one denser scene. Use when two scenes advance the same thread with similar dramatic shape.</verdict>
    <verdict name="cut">Scene is redundant and adds nothing. The story is tighter without it.</verdict>
    <verdict name="move" requires="moveAfter">Scene content is correct but it is in the wrong position. The scene is lifted from its current position and re-planted with NO content changes. Use for sequencing adjustments: a scene revealing information too early, a payoff arriving before its setup, an out-of-order character introduction. If content also needs changing, note it in the reason for a follow-up edit pass.</verdict>
    <verdict name="insert" requires="insertAfter (or START)">A new scene should be CREATED at this position to fill a pacing gap, advance a stalled thread, or add a missing beat. The "reason" field is the generation brief: describe what happens, who is involved, the location, which threads advance, and any specific beats. The "sceneId" should be a placeholder like "INSERT-1", "INSERT-2", etc.</verdict>
  </step>

  <step name="structural-operations-guide">
    <rule>If 5 scenes cover the same beat: keep the strongest as "ok", merge 1-2 into it, cut the rest.</rule>
    <rule>If a thread has 8 scenes but only 3 distinct beats: merge within each beat, cut the remainder.</rule>
    <rule>If a scene is premature but otherwise good: use "move" to place it after the scene that sets it up.</rule>
    <rule>If a payoff arrives before its setup: "move" the payoff to after the setup scene.</rule>
    <rule>If there is a missing transition, an unearned payoff, or a thread that needs setup before it pays off: insert a new scene at the right position.</rule>
    <rule>"mergeInto" must reference a scene that is NOT itself cut/merged/moved.</rule>
    <rule>"moveAfter" must reference a scene that is NOT itself being cut/merged. It can reference an INSERT placeholder ID if the scene should follow a newly inserted scene.</rule>
    <rule>Prefer merge over cut when the weaker scene has unique content worth absorbing.</rule>
    <rule>Prefer move over cut+insert when the scene content is sound — moving preserves the exact prose.</rule>
    <rule>Use insert sparingly — only when the gap is structural, not cosmetic.</rule>
  </step>

  <step name="continuity">Scenes that contradict established knowledge, misplace characters, or leak information should be flagged — not left at "ok".</step>

  <step name="compression">Where a scene duplicates another in purpose without meaningful variation, prefer merge or cut. The right compression is register-dependent — accumulative, list-based, refrain-based, and polyphonic works resist compression by design; dramatic and serialised works usually reward it. Use judgement; do not apply a fixed percentage.</step>

  <step name="cross-scene-consistency" hint="CRITICAL — all edits are applied in parallel. Each edited scene only sees its own reason; it does NOT see what other scenes are being changed.">
    <substep>Mentally map the full set of changes you're proposing and identify causal chains.</substep>
    <substep>For each non-"ok" scene, ask: does this change affect something an upstream or downstream scene references? Does it resolve a contradiction that another edit also touches?</substep>
    <substep>Write reasons so that each edit is self-sufficient — the scene being edited can be rewritten correctly even without knowing what other scenes look like.</substep>
    <rule>If scene A's edit removes, adds, or changes a fact that scene B depends on, scene B's reason MUST say: "Note: [scene A] is being edited to [specific change] — this scene must be consistent with that."</rule>
    <rule>If two scenes currently contradict each other, decide which edit is authoritative and make the other defer to it explicitly in its reason.</rule>
    <rule>If a scene is being cut or merged, any surviving scene that referenced it must have a reason that accounts for its removal.</rule>
    <rule>Edit reasons are instructions to a rewriter who cannot see the rest of the branch. Make them complete.</rule>
  </step>
${p.guidance?.trim() ? `  <step name="author-guidance-reminder">The author specifically asked you to address: "${p.guidance.trim()}". Your overall critique and scene verdicts MUST reflect this. Any scene affected by this guidance MUST NOT be marked "ok".</step>` : ''}
</instructions>

<output-format>
Return JSON:
{
  "overall": "3-5 paragraph critique. Name scenes, characters, patterns. End with the thematic question.",
  "sceneEvals": [
    { "sceneId": "S-001", "verdict": "ok|edit|merge|cut|move|insert", "reason": "For edit: 1-3 sentences instructing the rewriter. For move: one sentence explaining why this position is wrong and where it belongs. For insert: full generation brief. For merge/cut: one sentence.", "mergeInto": "S-002 (merge only)", "moveAfter": "S-003 (move only — exact scene ID this scene should follow)", "insertAfter": "S-004 or START (insert only — scene ID, INSERT placeholder, or START for before first scene)" }
  ],
  "repetitions": ["pattern 1", "pattern 2"],
  "thematicQuestion": "The human question underneath the plot"
}
Every scene must appear in sceneEvals. Use the EXACT scene IDs shown above (e.g. "S-001", not "1" or "scene 1").
</output-format>`;
}
