/**
 * Reasoning-mode prompt blocks — one block per mode, selected at prompt-
 * assembly time by `reasoningModeBlock(mode)`. Each block tells the LLM:
 *
 *   1. Its 2×2 position (forward/backward × expand/narrow/select/generalise)
 *   2. Its taxonomic opposite (the 2×2 diagonal — useful for contrast)
 *      AND its drift neighbor (the mode it empirically collapses into
 *      mid-chain — usually NOT the same mode as the opposite)
 *   3. Shape archetype (evocative, not a validation target)
 *   4. A procedure AND a quality-check — every mode has both
 *   5. Arrow composition, node order, mindset
 *
 * 2×2 positions:
 *   - DIVERGENT   (forward + expansive)   ↔ ABDUCTION (backward + selective)
 *   - DEDUCTION   (forward + narrow)      ↔ INDUCTION (backward + generalising)
 *
 * Drift neighbor graph (empirical failure modes, not taxonomic opposites —
 * backward modes silently flip forward once scaffolding exists; narrow
 * modes quietly expand once "necessary" loosens):
 *   - ABDUCTION  → drifts into DEDUCTION  (forward-from-last-prior)
 *   - INDUCTION  → drifts into DEDUCTION  (forward-from-sketched-principle)
 *   - DIVERGENT  → drifts into ABDUCTION  (commits to first coherent branch)
 *   - DEDUCTION  → drifts into DIVERGENT  ("necessary" turns one-of-several)
 */

import type { ReasoningMode } from "@/lib/ai/reasoning-graph/types";

/**
 * Divergent mode — "what else could be true from here?" Branches outward
 * from the current state, expanding the solution space rather than
 * finding one answer. Risk: never terminates without external selection.
 */
const DIVERGENT_MODE_BLOCK = `<reasoning-mode name="divergent" position="forward+expansive" archetype="branching, solution-space expansion">
  <position>FORWARD + EXPANSIVE — one source branches into many possibilities. Shape: a tree fanning outward, 1 → N → N².</position>
  <taxonomic-opposite mode="abduction">Divergent generates alternatives forward; abduction picks among them backward from a committed outcome.</taxonomic-opposite>
  <drift-neighbor mode="abduction">Collapses when the first coherent branch becomes attractive and you start selecting rather than generating. Tell: you compared branches before finishing the set. Counter: complete the planned set BEFORE scoring any branch.</drift-neighbor>
  <full-2x2>
    <mode name="divergent">forward + expansive: one → many possibilities</mode>
    <mode name="deduction">forward + narrow: premise → necessary consequence</mode>
    <mode name="abduction">backward + selective: committed outcome ← best hypothesis</mode>
    <mode name="induction">backward + generalising: shared pattern ← many observations</mode>
  </full-2x2>

  <core-question>What else could be true from here? Branch outward without committing — the goal is to EXPAND the solution space, not pick a winner.</core-question>

  <branch-set-quality-check hint="Apply once after all branches are generated — over the SET, not each branch.">
    <axis index="1" name="qualitative-distinctness">Branches that differ only in surface vocabulary are one branch. Collapse or replace.</axis>
    <axis index="2" name="force-space-spread">Branches must distribute across forces (System/World/Fate). If >70% share one dominant force, regenerate the underweight forces.</axis>
    <axis index="3" name="pairwise-compatibility">Note for each pair: mutually exclusive or compatible. All-exclusive is a fork; all-compatible is one future with accessories. Healthy sets have both.</axis>
    <axis index="4" name="retroactive-regret">Imagine the true outcome is revealed — would you regret NOT generating any branch? If the obvious set is complete but the tail is missing, add at least one low-probability branch.</axis>
  </branch-set-quality-check>

  <termination-criterion>Stop when all four checks pass — NOT when you hit a node count. If a check fails, regenerate the offending branches.</termination-criterion>

  <arrow-composition hint="Dominant, not exclusive.">
    <primary edges="causes, enables, reveals, develops">Forward arrows at HIGH branching. A single source node often carries 2–4 outgoing forward arrows into distinct possibilities. Tree, not chain.</primary>
    <secondary edges="requires, constrains">Sparingly; only when a branch genuinely surfaces a prerequisite. Late discoveries, not the engine.</secondary>
    <situational edges="risks, resolves">As branches call for.</situational>
  </arrow-composition>

  <node-order alignment="aligned">
    <plan-first>Emit plannedNodeCount BEFORE the nodes array. Scopes the branching up front.</plan-first>
    <generation>Start at the present state, branch outward to consequences.</generation>
    <presentation>Index 0 is the source. Later indices are consequences flowing outward. \`order\` matches \`index\` — visible signature of forward-aligned divergent thinking.</presentation>
  </node-order>

  <mindset>
    <rule>Prefer producing branches over elaborating one chain deeply.</rule>
    <rule>Contradictory branches are welcome — two incompatible consequences from the same premise widens the space.</rule>
    <rule>Scoring branches before all are written = drift to abduction. Committing to a single through-line = drift to deduction. Back off and branch.</rule>
  </mindset>

  <end-of-chain-self-check>
    <check>\`order\` matches \`index\` for every node. If they diverge, resort so the source is first.</check>
    <check>All four quality-check axes pass. Fix before emitting.</check>
  </end-of-chain-self-check>

  <summary>The graph is an EXPANSION, not a solution — many possible futures hanging off the current state, the arc free to select later.</summary>
</reasoning-mode>`;

/**
 * Abduction mode — "what prior configuration best explains this
 * outcome?" Reasons backward from a committed terminal (fate node) to
 * the specific prior setup that makes it feel inevitable. Generates
 * competing hypotheses, scores them, selects the best. Backward and
 * specific. Risk: post-hoc rationalisation.
 */
const ABDUCTION_MODE_BLOCK = `<reasoning-mode name="abduction" position="backward+selective" archetype="inference to best explanation">
  <position>BACKWARD + SELECTIVE — a committed outcome is explained by picking the best among competing prior configurations. Shape: hypothesis chains converging on a terminal, ONE selected, others rejected.</position>
  <taxonomic-opposite mode="divergent">Divergent generates many forward without committing; abduction picks one backward from a committed outcome. A single hypothesis is not abduction — REQUIRES competitors scored against each other.</taxonomic-opposite>
  <drift-neighbor mode="deduction">Real risk: abduction silently flips to forward derivation once the first prior is committed. ANCHOR DISCIPLINE below is the countermeasure — most important part of this block.</drift-neighbor>
  <full-2x2>
    <mode name="divergent">forward + expansive: one → many possibilities</mode>
    <mode name="deduction">forward + narrow: premise → necessary consequence</mode>
    <mode name="abduction">backward + selective: committed outcome ← best hypothesis</mode>
    <mode name="induction">backward + generalising: shared pattern ← many observations</mode>
  </full-2x2>

  <core-question>What prior configuration best explains this outcome? Reason BACKWARD from terminal states (fate nodes) to priors. You do NOT simulate forward — you generate EXPLANATIONS for fates already TRUE.</core-question>

  <anchor-discipline critical="true" hint="READ FIRST — abductive chains drift deductive mid-chain without this.">
    <reference-point>At every new node, the reference point is the FATE TERMINAL, not the previously generated node. Ask "WHAT EXPLAINS THE FATE?" — NOT "what follows from the last node?"</reference-point>
    <failure-mode>You correctly generate N-1 by reasoning back from the terminal, then generate N-2 by reasoning FORWARD from N-1. Chain starts abductive, silently converts to deductive. Terminal stops anchoring. Looks like an explanation, is actually forward derivation.</failure-mode>
    <self-check>Each new node: does it still directly explain the TERMINAL FATE, or has it become a consequence of the last prior? If the latter, discard and reanchor to the fate.</self-check>
  </anchor-discipline>

  <secondary-failure-mode>Abduction can degenerate into post-hoc rationalisation. Guard: generate 2–3 COMPETING hypotheses per fate node and score them before selecting. An explanation that doesn't survive comparison is not an explanation.</secondary-failure-mode>

  <abductive-procedure hint="Apply to every fate node.">
    <step index="1" name="treat-fate-committed">Don't question whether it occurs. It will. Only question: what makes it feel inevitable.</step>
    <step index="2" name="generate-competing-hypotheses">Generate 2–3 hypotheses (H1, H2, H3) — each a candidate reasoning node or chain explaining the fate.</step>
    <step index="3" name="score-each">Score each on four axes.
      <axis name="coherence">Does it contradict any existing node or edge?</axis>
      <axis name="sufficiency">Does it fully account for the fate?</axis>
      <axis name="minimality">Fewest new nodes?</axis>
      <axis name="retroactive-inevitability">Would a reader, seeing the setup AFTER the outcome, feel it was engineered rather than accidental?</axis>
    </step>
    <step index="4" name="select">Select the highest-scoring hypothesis; record WHY others were rejected (cite specific axis failures).</step>
    <step index="5" name="anomalies-first">Chaos and warning nodes are highest-priority evidence. Any hypothesis that fails to explain them is incomplete.</step>
    <step index="6" name="check-information-asymmetry">Tag each node VISIBLE (observable by any character) or HIDDEN (only via specific knowledge/foreknowledge). A valid chain has at least one HIDDEN — all-visible eliminates dramatic tension.</step>
  </abductive-procedure>

  <ri-test hint="Apply after scoring.">
    <question>Could this setup have been deliberately arranged by someone who already knew the outcome?</question>
    <yes>Valid.</yes>
    <no>Revise or reject; it's accidental, not inevitable.</no>
    <target>Engineered inevitability is the target. Coherence + sufficiency + minimality are necessary; failing RI produces narrative that feels lucky rather than fated.</target>
  </ri-test>

  <arrow-composition hint="Dominant, not exclusive.">
    <primary edges="requires, develops, causes">Backward arrows. \`requires\` = "fate depends on this prior"; \`develops\` = "this matured into the fate"; \`causes\` = "this prior produced the fate".</primary>
    <avoid edges="enables">Avoid as terminal edge into a fate — implies optionality; abductive conclusions are not optional.</avoid>
    <secondary edges="constrains, reveals">Where the hypothesis genuinely leans on a rule or info disclosure.</secondary>
    <situational edges="risks, resolves">As the chain calls.</situational>
  </arrow-composition>

  <node-order alignment="diverged" hint="Generation and presentation DIVERGE. Presentation must be coherent, not scattered.">
    <plan-first>Emit plannedNodeCount BEFORE the nodes array — load-bearing so the TERMINAL fate node gets index N-1 while generated first.</plan-first>
    <generation>Start at the terminal fate, reason backward. Emit terminal first, then priors in discovery order. Auto-captured as \`order\`.</generation>
    <presentation hint="\`index\` field — TOPOLOGICAL ORDER over edges.">
      <step index="1">\`A requires B\` → B is prior. \`A causes B\` → A is prior. \`S constrains E\` → S is prior.</step>
      <step index="2">Index 0 to a node with NO causal predecessors — earliest prior.</step>
      <step index="3">Each subsequent index: all predecessors already have lower indices. Terminal fate is N-1.</step>
      <step index="4">Causally-parallel nodes: order by which naturally introduces its shared downstream first. No scattering — ascending index reads as one sweep from earliest prior to terminal.</step>
    </presentation>
    <signature>Generation runs backward (terminal first); presentation runs forward (terminal last). \`order\` shows the detective's path; \`index\` shows the chronology presented.</signature>
    <example>4-node chain emitted [fate, prior-A, prior-B, prior-C] with edges \`fate requires prior-A\`, \`prior-A requires prior-B\`, \`prior-A requires prior-C\`. Valid: [fate=3, A=2, B=0, C=1].</example>
  </node-order>

  <mindset>
    <rule>Fate is input, not output. You explain it.</rule>
    <rule>Two fate nodes sharing an explanation share a single reasoning node with edges to both — don't duplicate.</rule>
    <rule>If a chain needs many new elements, it's failing minimality — revise, don't pad.</rule>
  </mindset>

  <end-of-chain-self-check>
    <check>\`order\` and \`index\` DIVERGE: terminal fate has the HIGHEST \`index\` but LOWEST \`order\`. If aligned, you drifted into forward derivation — rewrite from the fate.</check>
    <check>Walking ascending \`index\` reads as one coherent chronology, earliest prior to terminal. Scattered reads = wrong topological order.</check>
    <check>At least one node per chain tagged HIDDEN. All-visible eliminates tension.</check>
  </end-of-chain-self-check>

  <summary>The graph is a DETECTIVE'S RECONSTRUCTION — fate nodes with backward chains to specific prior configurations, each chain chosen over competitors.</summary>
</reasoning-mode>`;

/**
 * Induction mode — "what general pattern explains these observations?"
 * Reasons backward from multiple observed states to the shared
 * principle underlying them. Backward and general. Risk: locks onto
 * the first coherent pattern and stops exploring.
 */
const INDUCTION_MODE_BLOCK = `<reasoning-mode name="induction" position="backward+generalising" archetype="pattern across observations">
  <position>BACKWARD + GENERALISING — many observations converge on a shared principle. Shape: a watershed — leaves at the bottom feeding one root at the top.</position>
  <taxonomic-opposite mode="deduction">Deduction derives consequences forward from a rule; induction infers the rule backward from many cases. A single observation is not induction — REQUIRES multiple cases sharing a pattern.</taxonomic-opposite>
  <drift-neighbor mode="deduction" hint="Opposite and drift coincide here — especially treacherous.">Once a principle is sketched, further "principle" nodes become forward derivations from the first rather than inductions from fresh evidence.</drift-neighbor>
  <full-2x2>
    <mode name="divergent">forward + expansive: one → many possibilities</mode>
    <mode name="deduction">forward + narrow: premise → necessary consequence</mode>
    <mode name="abduction">backward + selective: committed outcome ← best hypothesis</mode>
    <mode name="induction">backward + generalising: shared pattern ← many observations</mode>
  </full-2x2>

  <core-question>What general pattern explains these observations? Reason backward from MULTIPLE observed states (scenes, arcs, behaviours, events) to the SHARED principle. Abduction explains one outcome with a specific prior; induction explains several with a general rule.</core-question>

  <anchor-discipline critical="true" hint="READ FIRST — inductive chains drift deductive once a principle is sketched.">
    <reference-point>Each new node: reference is the OBSERVATION CLUSTER, not the last principle. Ask "DOES THIS ACCOUNT FOR THE OBSERVATIONS?" — NOT "what follows from the principle?"</reference-point>
    <failure-mode>You correctly sketch a principle fitting first observations, then derive new principle nodes as logical consequences of the first. Chain starts inductive, silently converts to deductive — generalising stops, theoretical extension begins.</failure-mode>
    <self-check>Every principle node earns its place by explaining observations, not by extending another principle.</self-check>
  </anchor-discipline>

  <observation-set-validation hint="Apply BEFORE sketching any principle.">
    <axis index="1" name="evidence-diversity">Observations must be STRUCTURALLY disparate (different actors, locations, stakes, mechanisms). Three near-identical cases = one pattern in three forms, not three independent witnesses. Require variance across at least one non-trivial axis per pair.</axis>
    <axis index="2" name="break-case-probe">Before committing: what observation would FALSIFY this principle? If none conceivable, principle is tautology or too loose. If conceivable, scan the corpus — counterexample-present-but-unsearched invalidates the induction.</axis>
    <axis index="3" name="pattern-alternative-retention">Hold at least ONE competing generalisation as a secondary node. Same evidence often supports multiple patterns; collapsing to first-fit is the signature induction bug. Secondary must be genuinely competitive, not strawman.</axis>
    <gate>Only after all three pass do you draw the principle edges.</gate>
  </observation-set-validation>

  <secondary-failure-mode>Induction locks onto the first coherent pattern. If you land one in the first few nodes, try to break it — what observation doesn't this account for?</secondary-failure-mode>

  <arrow-composition hint="Dominant, not exclusive.">
    <primary edges="requires, constrains">Backward arrows. \`A requires B\` = "observed A is explained by prior pattern B". \`constrains\` points from the rule back onto specific instances that obey it.</primary>
    <secondary edges="reveals, develops">Where the pattern has downstream implications worth naming.</secondary>
    <situational edges="causes, enables, risks, resolves">As the pattern calls.</situational>
  </arrow-composition>

  <node-order alignment="diverged" hint="Generation and presentation DIVERGE.">
    <plan-first>Emit plannedNodeCount BEFORE the nodes array — places the inferred principle at index 0 while emitted last.</plan-first>
    <generation>Start at the observation cluster, reason backward to the pattern. Emit observations first, principle last — scientist's assembly. Auto-captured as \`order\`.</generation>
    <presentation hint="\`index\` field — TOPOLOGICAL ORDER. Principle is causally prior to observations it explains.">
      <step index="1">Index 0 to the root principle — every observation traces back to it.</step>
      <step index="2">Each subsequent index: predecessors have lower indices. Observations come last.</step>
      <step index="3">Multiple principles: root-first (most-general lowest), sub-patterns after, observations last. Never scatter a principle between its cases.</step>
    </presentation>
    <signature>Generation runs up from observations; presentation runs down from the principle. \`order\` = scientist's path; \`index\` = rule cascading into cases.</signature>
    <example>3 observations generalised into 1 principle. Emit [obs-A, obs-B, obs-C, principle] with edges \`obs-X requires principle\`. Presentation: principle=0, obs at 1/2/3 in cascade order.</example>
  </node-order>

  <mindset>
    <rule>Observations are evidence, plural. A single observation is abduction.</rule>
    <rule>Goal is a PATTERN that generalises. A principle explaining one observation isn't inductive.</rule>
    <rule>Multiple plausible patterns: keep them both as competitors rather than collapsing.</rule>
  </mindset>

  <end-of-chain-self-check>
    <check>\`order\` and \`index\` DIVERGE: principle has LOWEST \`index\` (0) but HIGH \`order\` (emitted last). Aligned = sketched principle first then "found" observations to fit — rewrite from the observations.</check>
    <check>Walking ascending \`index\` reads as principle → its cases. Scattered = principles interleaved with unrelated observations.</check>
    <check>At least one pattern-alternative node survives. Sole winner = induction is premature.</check>
  </end-of-chain-self-check>

  <summary>The graph is a GENERALISATION — many observed states at the leaves converging on principle nodes that explain them all.</summary>
</reasoning-mode>`;

/**
 * Deduction mode — "if this premise is true, what must follow?"
 * Starts from a committed premise and forward-simulates consequences
 * with logical necessity. Deterministic in direction. Risk: only as
 * good as the premise — wrong starting assumption, wrong everything.
 */
const DEDUCTION_MODE_BLOCK = `<reasoning-mode name="deduction" position="forward+narrow" archetype="premise → necessary consequence">
  <position>FORWARD + NARROW — a premise generates necessary consequences in a tight linear chain. Shape: 1 → 1 → 1 → 1, low branching, a derivation.</position>
  <taxonomic-opposite mode="induction">Induction infers a rule backward from cases; deduction derives consequences forward from a rule.</taxonomic-opposite>
  <drift-neighbor mode="divergent">Collapses when a "necessary" consequence is actually one of several alternatives and the chain branches. Tell: "and therefore X" when the premise admits X, Y, or Z. High branching = divergent, not deductive. Stop and either (a) revise the premise to be genuinely narrow, or (b) admit the mode switch.</drift-neighbor>
  <full-2x2>
    <mode name="divergent">forward + expansive: one → many possibilities</mode>
    <mode name="deduction">forward + narrow: premise → necessary consequence</mode>
    <mode name="abduction">backward + selective: committed outcome ← best hypothesis</mode>
    <mode name="induction">backward + generalising: shared pattern ← many observations</mode>
  </full-2x2>

  <core-question>If this premise is true, what must follow? Each forward arrow represents a NECESSARY step.</core-question>

  <premise-validation critical="true" hint="READ FIRST — deduction's most dangerous failure: a plausible-looking chain from a bad premise produces confident garbage. Apply BEFORE deriving any consequence.">
    <axis index="1" name="groundedness">Premise anchored in an existing world/system/continuity node (committed thread, stated goal, accepted rule)? Or asserted freshly? Asserted premises fail — revise until the root cites a real node the reader has accepted.</axis>
    <axis index="2" name="specificity">Premise statable in ONE declarative sentence? If it needs clauses, lists, or "and also", it's several premises — split or narrow.</axis>
    <axis index="3" name="non-triviality">Premise generates AT LEAST THREE non-obvious consequences? Sketch them mentally first. Chain terminating after one step = premise self-executing, deduction has no work. Three obvious consequences = ornamental chain.</axis>
    <axis index="4" name="counterfactual-sensitivity">If the premise were slightly different (one word altered, one condition negated), would the chain look SUBSTANTIALLY different? If not, the chain is driven by smuggled background assumptions — rewrite so the premise is load-bearing, or name the smuggled assumption as a second root.</axis>
    <gate>Any axis fails, DO NOT BUILD THE CHAIN. A deductive chain on a failing premise produces false confidence — worse than no chain.</gate>
  </premise-validation>

  <secondary-failure-mode>If the chain produces an absurd conclusion, that's evidence the premise needs revision — don't patch the consequence, revise upstream.</secondary-failure-mode>

  <arrow-composition hint="Dominant, not exclusive.">
    <primary edges="causes, enables, requires, resolves">Tight logical arrows. Each must feel necessary, not optional. \`requires\` still points consequence → premise (state depends on premise) — tightens the chain.</primary>
    <secondary edges="constrains, develops">When the chain hits a rule or deepens a consequence, not as decoration.</secondary>
    <situational edges="reveals, risks">As the derivation calls.</situational>
  </arrow-composition>

  <node-order alignment="aligned">
    <plan-first>Emit plannedNodeCount BEFORE the nodes array. Commit to a specific chain length.</plan-first>
    <generation>Start at the premise, derive forward through necessary consequences in order.</generation>
    <presentation>Index 0 = premise. Later indices = derived consequences. Highest = final conclusion. \`order\` matches \`index\`.</presentation>
  </node-order>

  <mindset>
    <rule>Premise is load-bearing and has passed the four axes. Name it clearly at the root.</rule>
    <rule>Each node answers: "given the previous node, what MUST be true next?" If the answer is one-of-several, you're in divergent mode.</rule>
    <rule>Logical necessity over narrative interest. A flat-but-necessary consequence stays — flatness signals the premise isn't generative (revisit non-triviality).</rule>
  </mindset>

  <end-of-chain-self-check>
    <check>\`order\` matches \`index\` for every node. Diverged = JSON emission wandered; resort so premise is index 0.</check>
    <check>Four validation axes still hold after the chain is written. If a "real" node turned out to be asserted, revise the premise — don't patch.</check>
    <check>Any node with >1 outgoing causal arrow into a consequence = drift to divergent. Collapse to the single necessary consequence or admit the mode switch.</check>
  </end-of-chain-self-check>

  <summary>The graph is a DERIVATION — top-to-bottom, each step locks into the next, arriving at a conclusion the premise made inevitable.</summary>
</reasoning-mode>`;

/**
 * Dispatch the reasoning-mode block. Defaults to abduction.
 */
export function reasoningModeBlock(mode: ReasoningMode | undefined): string {
  switch (mode) {
    case "induction":
      return INDUCTION_MODE_BLOCK;
    case "deduction":
      return DEDUCTION_MODE_BLOCK;
    case "divergent":
      return DIVERGENT_MODE_BLOCK;
    case "abduction":
    default:
      return ABDUCTION_MODE_BLOCK;
  }
}
