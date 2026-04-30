/**
 * Summary Requirement Prompt
 *
 * The scene summary is the load-bearing artifact that feeds plan and prose
 * generation downstream — and it's the only artifact other scenes can read.
 * Detail that lives only in prose evaporates at the scene boundary; detail
 * in the summary stays canonical and downstream-readable. So the summary's
 * length must match the scene's information density: routine scenes stay
 * tight (a 6-sentence brief is enough to dramatise a fight, a conversation,
 * a journey), but cognition-dense scenes — multi-step planning, scenario
 * modelling, scheme construction, complex world-rule derivations — must
 * expand to capture WHAT was actually cognised, not just that thinking
 * occurred. Under-writing a cognition-dense summary forces the prose layer
 * to fall back on stand-in verbs ("he thought intently", "she planned
 * carefully"), which is the dominant failure mode.
 */

export const PROMPT_SUMMARY_REQUIREMENT = `<summary-requirement length="adaptive — 3-6 sentences for routine scenes; expand to whatever depth the reasoning requires for cognition-dense scenes" hint="The prose writer's only brief for the scene. Match the register of the source material (fiction, memoir, essay, reportage, research — whatever the context shows).">

  <length-policy hint="The dominant failure mode is under-writing dense scenes. Calibrate to information density, not to a fixed length. There is no functional upper bound — match what the cognition actually contains.">
    <default kind="routine" length="3-6 sentences">Physical action, dialogue, observable events, single-thread movements, scene-setting beats. The default is brief because the scene's content fits in a brief.</default>

    <expand kind="cognition-dense" length="no functional upper bound — write the reasoning at full resolution, however many sentences or paragraphs it takes">
      Triggers (any of):
      - Character reasoning through multi-step plans (weighing scenario A vs B vs C with named tradeoffs)
      - Scheme construction with multiple moving parts (which agents are co-opted, which information asymmetries are exploited, which contingencies are prepared for)
      - Modelling other agents' likely responses (what does each rival know, predict, react to)
      - Deriving conclusions from named premises (the full chain of inference, with each step's warrant)
      - Complex world-rule reveals (the system / convention being established, the constraints it implies, what it forbids)
      - Multi-thread coordination (one decision that touches several markets at once, with the relationships between them named)
      - Any scene whose reasoning depth exceeds what 3-6 sentences can hold without compression artefacts

      For these scenes the summary MUST contain the actual computation, not a label for it. The wrong move:
        "Mara refined her approach to the upcoming arbitration, weighing options and assessing risks."
      The right move:
        "Mara considered three approaches to the arbitration. Approach A — open with her strongest precedent and force the panel to address it directly — offered fast resolution but burned her secondary arguments if the panel rejected it. Approach B — sequence weaker precedents first to anchor the panel's attention before deploying her strongest — depended on the chair's known impatience holding for at least thirty minutes. Approach C — concede the most contentious point upfront in exchange for a tighter scope ruling — sacrificed leverage but eliminated the panel's main objection. She rejected A because the chair's history showed he hardens against frontal arguments raised in the first ten minutes. She committed to B for the morning session while preparing C as a fallback for the afternoon, identifying the signal she needed from the chair's opening: if he raised the scope question, sequencing was unsalvageable and she had to pivot to C immediately."

      A cognition-dense summary can run for many paragraphs when the underlying reasoning genuinely demands it — chains of inference, layered contingencies, multi-agent strategy graphs, system derivations. Do not compress for length's sake. If the reasoning is deep, give the summary the depth to hold it; the only artefact you avoid is gestures-toward-thinking that don't actually carry the thinking.
    </expand>

    <test hint="Apply this on every scene, regardless of length.">
      Could a competent reader who knows nothing else about this work reconstruct what was actually thought, decided, derived, or concluded — using only this summary? If no, the summary is too thin: expand until yes. There is no penalty for length; the penalty is for missing content.
    </test>
  </length-policy>

  <division-of-labour hint="Why the summary cannot defer to prose for cognitive content.">
    <captures-in-summary>Claims made, scenarios weighed, conclusions reached, named tradeoffs accepted, structural relationships inferred, the chain of reasoning itself. Anything downstream prose / plan / future scenes need to be coherent with.</captures-in-summary>
    <captures-in-plan-and-prose>Sensory texture, beat pacing, line-by-line dialogue, atmospheric detail, prose flavour, the dramatisation. Plan and prose handle HOW the cognition is delivered; the summary owns WHAT was cognised.</captures-in-plan-and-prose>
    <why>Detail that lives only in prose is per-scene — the next scene's plan can't see it. Summary is canonical and read by every downstream pass (plan, prose, fate-reextract, briefing, search). If a thought matters across scenes, it must live in the summary. If it matters only for this scene's texture, prose is the right home.</why>
  </division-of-labour>

  <include>
    <item>Specific entity names (not IDs).</item>
    <item>Concrete specifics (objects, dialogue, data, claims).</item>
    <item>Observable consequences.</item>
    <item>Context — time span, method, tone shifts, structural role of the scene.</item>
    <item kind="cognition-dense">For cognition-dense scenes: each scenario considered (named), each tradeoff weighed (named), each conclusion reached (named), each agent modelled (named with their predicted reaction).</item>
  </include>

  <avoid registers="dramatic" hint="Fiction, narrative memoir, literary reportage. In these registers, write what HAPPENED, what was SAID, what visibly CHANGED — not what was privately felt.">
    <pattern>Inner-state verbs that stand alone (realizes, confirms, understands, suspects, decides) when used as the ONLY delta.</pattern>
    <pattern>Emotional endings that only assert a feeling ("intentions", "revelations-of-feeling" with no observable consequence).</pattern>
    <pattern>Vague modifiers (face etched, expression unreadable, groundbreaking implications).</pattern>
    <pattern kind="cognition-stand-in">Stand-in cognitive verbs that label thinking without naming its content: "considered the situation", "weighed his options", "planned carefully", "refined his strategy", "thought through the implications". If the character is computing something, name what — the scenarios, the tradeoffs, the conclusion. Otherwise the summary is fiction-as-stage-direction.</pattern>
  </avoid>

  <accept registers="reflective-essayistic-inquiry" hint="Realisation-as-delta is legitimate when the realisation is NAMED (a specific new claim, a specific reframing) and ATTRIBUTED (to the author, narrator, or a source). The test is specificity, not the presence of the word 'realise'.">
    <example type="good">"The narrator realises that the archive is organised by the logic of its absences, not its holdings" — valid scene summary in an essay.</example>
    <example type="bad">"She felt something shift" — not valid in any register because it is unnamed.</example>
  </accept>

  <universal hint="Across all registers.">Avoid gestural emotion-words that are stand-ins for craft — "felt", "seemed", "somehow", "a strange sense" without a specific tether.</universal>
</summary-requirement>`;
