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
const DIVERGENT_MODE_BLOCK = `## MODE OF THINKING — DIVERGENT (branching, solution-space expansion)

**REASONING POSITION (2×2 axis: direction × shape).**
Divergent is FORWARD + EXPANSIVE — one source branches into many
possibilities. Shape archetype (evocative, not a validation target):
a tree fanning outward, 1 → N → N².

Taxonomic opposite: **ABDUCTION** (backward + selective) — where
divergent GENERATES alternatives forward, abduction PICKS among
alternatives backward from a committed outcome.

**DRIFT NEIGHBOR: ABDUCTION (not the opposite, but the actual failure
mode).** Divergent doesn't usually collapse into its diagonal — it
collapses when the first coherent branch becomes attractive and you
start selecting rather than generating. The tell: you started
comparing branches (hallmark of abduction) before you finished
producing them. Counter: complete the full planned set BEFORE
scoring any branch.

The full 2×2:
- DIVERGENT   (forward + expansive):   one → many possibilities
- DEDUCTION   (forward + narrow):      premise → necessary consequence
- ABDUCTION   (backward + selective):  committed outcome ← best hypothesis
- INDUCTION   (backward + generalising): shared pattern ← many observations

Divergent reasoning asks: **what else could be true from here?**

It starts from the current state and branches OUTWARD — generating
multiple possible extensions without committing to any. The goal is
not to find the one correct answer; it is to EXPAND the solution
space so alternatives exist to choose between.

BRANCH-SET QUALITY CHECK (apply once after all branches are generated —
the divergent analogue of abduction's scoring axes, evaluated over the
SET of branches, not each branch individually):

1. **Qualitative distinctness** — are any branches paraphrases of each
   other? Two options that differ only in surface vocabulary count as
   one branch, not two. Collapse or replace.
2. **Force-space spread** — do the branches distribute across the
   narrative forces (System / World / Fate), or do they cluster in
   one? A set of five Fate-flavoured branches has the branching factor
   of one. If >70% of branches share a dominant force, regenerate the
   underweight forces.
3. **Pairwise compatibility** — for each pair, note whether they are
   mutually exclusive or mutually compatible. This matters because
   downstream abduction needs to know which branches can coexist. A
   set that is entirely mutually-exclusive is a fork; a set that is
   entirely compatible is actually a single future with accessories.
   Healthy sets have both.
4. **Retroactive regret** — imagine the true outcome is revealed. How
   many branches would you regret NOT having generated? If the answer
   is zero (every possibility you would have predicted is in the set),
   you may have stopped at the obvious and missed the tail. Add at
   least one low-probability branch before finalising.

TERMINATION CRITERION: stop when all four checks pass at the planned
branching factor — NOT when you hit a node count. If a check fails,
regenerate the offending branches rather than padding. "Each node
either opens a branch or gives a downstream node reason to exist" is
a guide during generation; the four checks are the actual gate.

HOW TO THINK ABOUT THE GRAPH:

Picture the graph as a delta — many channels spreading outward from
a shared source. A single node at the present often forks into two,
three, four possible consequences. Those consequences fork again.
Convergent arrows (two branches recombining into one) appear only
where the divergence genuinely meets — never to force coherence.

ARROW COMPOSITION (dominant, not exclusive):
- **Primary** — \`causes\`, \`enables\`, \`reveals\`, \`develops\`: forward
  arrows, used at HIGH branching factor. A single source node should
  often carry 2–4 outgoing forward arrows into distinct possibilities.
  The shape is not a chain; it is a tree.
- **Secondary** — \`requires\`, \`constrains\`: use sparingly and only
  when a branch genuinely surfaces a prerequisite. These arrows should
  feel like late discoveries, not the engine.
- **Situational** — \`risks\`, \`resolves\`: as the branches call for
  them.

NODE ORDER — generation and presentation ALIGN:
- PLAN FIRST: Decide the total node count (emit it as plannedNodeCount
  BEFORE the nodes array). This forces you to scope your branching up
  front.
- GENERATION: You start THINKING at the present state and branch
  outward, thinking forward to consequences.
- PRESENTATION (the \`index\` field — this is what downstream consumers
  use): Index 0 is the present-state source. Later indices are the
  consequences and branches flowing outward. Highest index is the
  furthest-downstream consequence.
- Here generation and presentation point the SAME direction. Nodes
  appear in the JSON in the order you thought of them, and each
  node's \`index\` matches its presentation position — they coincide.
- \`order\` (which the parser auto-assigns from JSON
  position) will match \`index\` in this mode — useful as a visible
  signature that divergent thinking was forward-aligned.

MINDSET:
- Treat the current state as a source, not a target spec. Your job is
  to reveal what it COULD generate, not to pick a winner.
- Prefer producing branches over elaborating one chain deeply.
- Contradictory branches are welcome — they are the point. Two
  incompatible consequences both following from the same premise is a
  wider solution space, not a flaw.
- If you start scoring branches against each other before all are
  written, you have drifted toward abduction (your drift neighbor).
  If you start committing to a single narrative through-line, you
  have drifted into deduction. Either way: back off and branch.

END-OF-CHAIN SELF-CHECK (before finalising the JSON):
- Confirm \`order\` matches \`index\` for every node. Divergent thinking
  runs forward, so emission order and presentation order coincide. If
  they diverge, your JSON emission wandered — resort the array so the
  earliest-in-story-time source is first and consequences follow.
- Confirm the four quality-check axes pass. If any fail, fix before
  emitting, not after.

The graph is an EXPANSION, not a solution. A reader should see many
possible futures hanging off the current state, with the arc free to
select among them later.
`;

/**
 * Abduction mode — "what prior configuration best explains this
 * outcome?" Reasons backward from a committed terminal (fate node) to
 * the specific prior setup that makes it feel inevitable. Generates
 * competing hypotheses, scores them, selects the best. Backward and
 * specific. Risk: post-hoc rationalisation.
 */
const ABDUCTION_MODE_BLOCK = `## MODE OF THINKING — ABDUCTION (inference to best explanation)

**REASONING POSITION (2×2 axis: direction × shape).**
Abduction is BACKWARD + SELECTIVE — a committed outcome is explained
by picking the best among competing prior configurations. Shape
archetype (evocative, not a validation target): multiple hypothesis
chains converging on a terminal, with ONE chain selected and the
others rejected.

Taxonomic opposite: **DIVERGENT** (forward + expansive) — where
divergent generates many possibilities forward without committing,
abduction picks one explanation backward from a committed outcome.
A single hypothesis is not abduction — abduction REQUIRES competitors
scored against each other.

**DRIFT NEIGHBOR: DEDUCTION (not the opposite, but the actual failure
mode).** The empirical risk is not that your abduction becomes
divergent — it is that your abduction silently flips to forward
derivation once the first prior is committed. The ANCHOR DISCIPLINE
section below is the countermeasure and is the most important part
of this block. Read it carefully.

The full 2×2:
- DIVERGENT   (forward + expansive):   one → many possibilities
- DEDUCTION   (forward + narrow):      premise → necessary consequence
- ABDUCTION   (backward + selective):  committed outcome ← best hypothesis
- INDUCTION   (backward + generalising): shared pattern ← many observations

Abductive reasoning asks: **what prior configuration best explains
this outcome?**

ANCHOR DISCIPLINE (READ BEFORE YOU DO ANYTHING ELSE — abductive
chains silently drift deductive mid-chain if you don't enforce this
from the first node you plan):

At every new node, your reference point is the FATE TERMINAL, not
the previously generated node. Ask "WHAT EXPLAINS THE FATE?" — NOT
"what follows from the last node I generated?"

The failure mode this prevents: you correctly generate node N-1 by
reasoning back from the terminal, but then you generate N-2 by
reasoning FORWARD from N-1. The chain starts abductive and silently
converts to deductive halfway through. The terminal stops anchoring
anything. The result looks like an explanation but is actually a
forward derivation dressed as one.

Every time you add a node, ask yourself: does this new node still
directly help explain the TERMINAL FATE, or has it become a
consequence of the last prior I wrote? If the latter, discard it
and reanchor to the fate.

With that discipline established, the rest of the mode follows:

You reason BACKWARD from terminal states (fate nodes) to prior
configurations. You do NOT simulate forward. You do NOT generate
consequences. You generate EXPLANATIONS. Every fate node is treated
as already TRUE — the only question is what prior setup makes it
feel inevitable given what currently exists.

Secondary failure mode (also guard against): abduction can
degenerate into post-hoc rationalisation ("it happened because it
was meant to"). Guard against this by generating COMPETING
hypotheses (at least 2–3 per fate node) and scoring them explicitly
before selecting one. An explanation that doesn't survive comparison
is not an explanation.

THE ABDUCTIVE PROCEDURE (apply to every fate node):

1. TREAT THE FATE AS COMMITTED. Do not question whether it occurs. It
   will. Your only question is what makes it feel inevitable.
2. GENERATE 2–3 COMPETING HYPOTHESES. Label them H1, H2, H3. Each is
   a candidate reasoning node or chain explaining the fate.
3. SCORE EACH ON FOUR AXES:
   - **Coherence**: does it contradict any existing node or edge?
   - **Sufficiency**: does it fully account for the fate without gaps?
   - **Minimality**: does it introduce the fewest new nodes?
   - **Retroactive inevitability**: would a reader, seeing the setup
     AFTER knowing the outcome, feel it was engineered rather than
     accidental?
4. SELECT the highest-scoring hypothesis; record WHY the others were
   rejected (cite specific axis failures, not generic reasons).
5. ANOMALIES FIRST. Chaos and warning nodes are the highest-priority
   evidence. Any hypothesis that fails to explain them is incomplete,
   regardless of other scores.
6. CHECK INFORMATION ASYMMETRY. Tag each node in the selected chain
   as VISIBLE (observable by any character) or HIDDEN (only by
   characters with specific knowledge or foreknowledge). A valid
   abductive chain must have at least one HIDDEN node — if every
   node is visible, any intelligent character could have predicted
   the outcome, which eliminates dramatic tension.

### THE RI TEST (apply after scoring)

After selecting your highest-scoring hypothesis, ask:

    "Could this setup have been deliberately arranged by someone
     who already knew the outcome?"

YES → valid. NO → revise or reject; it's accidental, not inevitable.

**Engineered inevitability is the target.** Logical coherence is
necessary but not sufficient — a hypothesis that passes the other
three axes but fails RI produces narrative that feels lucky rather
than fated.

HOW TO THINK ABOUT THE GRAPH:

Picture the graph as a detective's evidence board read in reverse.
You start with the outcome (the fate node) and trace backward to the
specific prior configuration that produced it. Unlike induction (which
generalises to a principle), abduction settles on ONE specific prior
— the particular setup, the particular character, the particular
artefact — that best explains this particular outcome.

ARROW COMPOSITION (dominant, not exclusive):
- **Primary** — \`requires\`, \`develops\`, \`causes\`: the abductive
  backward arrows. \`requires\` encodes "the fate depends on this
  prior"; \`develops\` encodes "this configuration matured into the
  fate"; \`causes\` encodes "this prior state produced the fate".
- **Avoid** \`enables\` as the terminal edge into a fate — it implies
  optionality, and abductive conclusions are not optional.
- **Secondary** — \`constrains\`, \`reveals\`: used where the selected
  hypothesis genuinely leans on a rule or information disclosure.
- **Situational** — \`risks\`, \`resolves\`: as the chain calls.

NODE ORDER — generation and presentation DIVERGE. Presentation must
be coherent, not scattered:

PLAN FIRST: Decide the total node count (emit it as plannedNodeCount
BEFORE the nodes array). This is load-bearing for abduction: you need
N so you can give the TERMINAL fate node index N-1 while generating it
first in the JSON.

GENERATION (the order you emit nodes in the JSON array, auto-captured
as \`order\`): You start THINKING at the terminal fate and
reason backward. Emit the terminal first, then the priors you
hypothesise, in discovery order.

PRESENTATION (the \`index\` field — what every downstream consumer uses
for display, scene generation, and reasoning walks): This must follow
a TOPOLOGICAL ORDER over the edges. Concretely:
  1. Read the causal direction of each edge you emit. \`A requires B\`
     means B is causally prior to A; \`A causes B\` means A is prior
     to B; \`S constrains E\` means S is prior to E.
  2. Assign index 0 to a node with NO causal predecessors under your
     chosen edges — the earliest-in-story-time prior.
  3. Assign each subsequent index to a node ALL of whose predecessors
     already have lower indices. Continue until the terminal fate
     node, which should be the LAST node (highest index, N-1),
     because every prior feeds into it.
  4. When two nodes are causally parallel (neither precedes the
     other), order them by which naturally introduces its shared
     downstream consequence first. Avoid scattering — a reader
     walking the graph by ascending index should feel a single
     coherent sweep from earliest prior to the terminal fate.

Generation runs backward (terminal first) while presentation runs
forward (terminal last). This inversion is the visible signature of
abductive thinking: \`order\` shows the detective's path
from outcome back to cause; \`index\` shows the chronology the graph
actually presents.

DO NOT SCATTER — if walking ascending indices requires jumping between
unrelated subgraphs, your presentation order is wrong. Re-sort so each
step flows naturally from the last.

Example: 4-node abductive chain. You emit in JSON order
[fate, prior-A, prior-B, prior-C]. If edges read
\`fate requires prior-A\`, \`prior-A requires prior-B\`,
\`prior-A requires prior-C\` — then B and C are both causally prior
to A, which is prior to fate. Valid presentation indices:
[fate=3, A=2, B=0, C=1] or [fate=3, A=2, B=1, C=0]. Walking 0→3
reads: earliest prior → the other parallel prior → A which they
both enable → the fate they together produce.

MINDSET:
- Fate is input, not output. You receive it; you explain it.
- Your primary output is new reasoning nodes that bridge existing
  nodes to fate nodes.
- Node count is bounded by the MINIMALITY axis in the scoring step —
  if a chain needs many new elements it is failing minimality, which
  is your signal to revise, not a separate hard cap.
- Two fate nodes that share an explanation should share a single
  reasoning node with edges to both — do not duplicate.

END-OF-CHAIN SELF-CHECK (before finalising the JSON):
- Confirm \`order\` and \`index\` DIVERGE: the terminal fate should have
  the HIGHEST \`index\` but the LOWEST \`order\` (emitted first, walked
  last). If \`order\` aligns with \`index\` for every node, you drifted
  into forward derivation mid-chain — rewrite the chain starting from
  the fate and discard any node that you can't rejustify as explaining
  the fate directly.
- Confirm walking ascending \`index\` reads as a single coherent
  chronology, earliest prior to terminal fate. Scattered reads mean
  the topological order is wrong.
- Confirm at least one node in every selected chain is tagged HIDDEN.
  An all-visible chain eliminates dramatic tension.

The graph is a DETECTIVE'S RECONSTRUCTION, not an exploration. A
reader should see fate nodes with backward chains leading to specific
prior configurations — each chain chosen over competitors and
annotated with what it explains.
`;

/**
 * Induction mode — "what general pattern explains these observations?"
 * Reasons backward from multiple observed states to the shared
 * principle underlying them. Backward and general. Risk: locks onto
 * the first coherent pattern and stops exploring.
 */
const INDUCTION_MODE_BLOCK = `## MODE OF THINKING — INDUCTION (pattern across observations)

**REASONING POSITION (2×2 axis: direction × shape).**
Induction is BACKWARD + GENERALISING — many observations converge on
a shared principle or pattern. Shape archetype (evocative, not a
validation target): a watershed — many leaves at the bottom feeding
one root at the top.

Taxonomic opposite: **DEDUCTION** (forward + narrow) — where
deduction derives specific consequences forward from a rule,
induction INFERS the rule backward from many cases. A single
observation is not induction — induction REQUIRES multiple cases
that share a pattern.

**DRIFT NEIGHBOR: DEDUCTION (here the opposite and the drift happen
to coincide, which is why induction drift is especially treacherous
— it feels like a natural move toward the same direction, not a
genuine collapse).** The empirical failure: once a principle is
sketched, further "principle" nodes become forward derivations from
the first principle rather than inductions from fresh evidence. The
ANCHOR DISCIPLINE section below is the countermeasure.

The full 2×2:
- DIVERGENT   (forward + expansive):   one → many possibilities
- DEDUCTION   (forward + narrow):      premise → necessary consequence
- ABDUCTION   (backward + selective):  committed outcome ← best hypothesis
- INDUCTION   (backward + generalising): shared pattern ← many observations

Inductive reasoning asks: **what general pattern explains these
observations?**

ANCHOR DISCIPLINE (READ BEFORE YOU DO ANYTHING ELSE — inductive
chains silently drift deductive once a principle is sketched):

At every new node, your reference point is the OBSERVATION CLUSTER,
not the last principle you sketched. Ask "DOES THIS ACCOUNT FOR THE
OBSERVATIONS?" — NOT "what follows from the principle I just wrote?"

The failure mode this prevents: you correctly sketch a principle
that fits the first observations, then you start deriving new
principle nodes as logical consequences of the first. The chain
starts inductive and silently converts to deductive — you stop
generalising from evidence and start extending a theoretical frame.
Every principle node must earn its place by explaining observations,
not by extending another principle.

With that discipline established, the rest of the mode follows:

It starts from MULTIPLE observed states — several scenes, several
arcs, several character behaviours, several world events — and
reasons backward to the SHARED principle or structural pattern
underlying them. Abduction explains one outcome with a specific
prior; induction explains several outcomes with a general rule.

OBSERVATION-SET VALIDATION (apply BEFORE sketching any principle —
the inductive analogue of deduction's premise validation):

1. **Evidence diversity** — are the observations STRUCTURALLY disparate
   (different actors, locations, stakes, mechanisms), or are they
   variations on a single case dressed in different costumes? Three
   near-identical cases support "one pattern in three forms", not
   "one pattern across three independent witnesses". Require
   structural variance across at least one non-trivial axis per pair.
2. **Break-case probe** — before committing to a principle, name
   explicitly: what observation, if it existed, would FALSIFY this
   principle? If no such observation is conceivable, the principle
   is either a tautology or too loose to be inductive. If such an
   observation is conceivable, scan the existing corpus before
   concluding — a counterexample present but unsearched invalidates
   the induction.
3. **Pattern-alternative retention** — hold at least ONE competing
   generalisation explicitly as a secondary node in the graph. The
   same evidence often supports multiple patterns; collapsing to the
   first fit (the "locking-on" failure) is the signature induction
   bug. The secondary need not be selected, but it must exist, and
   it must be genuinely competitive (not a strawman).

Only after all three checks pass should you draw the principle edges.

Secondary failure mode (also guard against): induction locks onto
the first coherent pattern and stops exploring. Pattern-alternative
retention above is the structural fix; this is the behavioural one.
If you land a coherent pattern in the first few nodes, try to break
it — what observation doesn't this pattern account for?

HOW TO THINK ABOUT THE GRAPH:

Picture the graph as many rivers traced back to their shared
watershed. Multiple observed nodes (events, behaviours, outcomes)
converge on a small number of principle nodes that explain them
collectively. The pattern is valuable precisely because it
generalises — it predicts similar outcomes in situations not yet
observed.

ARROW COMPOSITION (dominant, not exclusive):
- **Primary** — \`requires\`, \`constrains\`: the backward arrows that
  carry the induction. \`A requires B\` encodes "observed A is
  explained by the prior pattern B". \`constrains\` points from the
  general rule back onto the specific instances that obey it.
- **Secondary** — \`reveals\`, \`develops\`: used where the pattern
  itself has downstream implications worth naming.
- **Situational** — \`causes\`, \`enables\`, \`risks\`, \`resolves\`: as
  the pattern calls.

NODE ORDER — generation and presentation DIVERGE. Presentation must
be coherent, not scattered:

PLAN FIRST: Decide the total node count (emit it as plannedNodeCount
BEFORE the nodes array). You need N to place the inferred principle
at index 0 while emitting it last in the JSON.

GENERATION (auto-captured as \`order\`): You start THINKING
at the cluster of observations and reason backward to the pattern.
Emit observations first, principle last — the scientist's assembly
of the argument.

PRESENTATION (the \`index\` field — what every downstream consumer uses
for display and reasoning walks): This must follow a TOPOLOGICAL ORDER
over the edges. The principle is causally prior to the observations it
explains (\`principle constrains observation\` or \`observation requires
principle\`), so:
  1. Read the causal direction of each edge. A principle that
     \`constrains\` or is \`required by\` an observation is prior.
  2. Assign index 0 to the root principle — the node every
     observation ultimately traces back to.
  3. Assign each subsequent index so a node's predecessors all have
     lower indices. The observations come last, in whatever order
     best shows the pattern cascading into its manifestations.
  4. If you inferred multiple principles, order them root-first:
     most-general at the lowest index, sub-patterns after, then
     observations. Never scatter a principle between its cases.

Generation runs up from observations; presentation runs down from the
principle. \`order\` shows the scientist's path; \`index\`
shows the rule producing its cases in order.

DO NOT SCATTER — if walking ascending indices requires jumping between
the principle and unrelated observations, your presentation order is
wrong. Re-sort so the graph reads principle → manifestations
coherently.

Example: 4-node inductive chain with 3 observations generalised into
1 principle. Emit JSON order [obs-A, obs-B, obs-C, principle]. If
edges read \`obs-A requires principle\`, \`obs-B requires principle\`,
\`obs-C requires principle\` — the principle is prior to all three.
Presentation indices: principle=0, then obs-A, obs-B, obs-C at 1/2/3
in whatever order the pattern naturally cascades.

MINDSET:
- Observations are EVIDENCE, in plural. Induction needs multiple
  cases; a single observation is abduction, not induction.
- The goal is a PATTERN that generalises, not an explanation that
  fits one case. If your proposed principle only explains one
  observation, it isn't inductive.
- When evidence points to multiple possible patterns, keep them both
  in the graph as competing generalisations rather than collapsing.

END-OF-CHAIN SELF-CHECK (before finalising the JSON):
- Confirm \`order\` and \`index\` DIVERGE: the principle should have the
  LOWEST \`index\` (0, root) but a HIGH \`order\` (emitted last, after
  the observations). If \`order\` aligns with \`index\`, you sketched the
  principle first and then "found" observations to fit — that's
  forward derivation dressed as induction. Rewrite starting from the
  observations.
- Confirm walking ascending \`index\` reads as principle → its cases,
  coherently. Scattered reads mean you interleaved principles with
  unrelated observations.
- Confirm at least one pattern-alternative node survives in the graph.
  If you collapsed to the sole winning principle, you haven't held
  open the space of rival generalisations and the induction is
  premature.

The graph is a GENERALISATION, not an explanation of a single event.
A reader should see many observed states at the leaves converging
on a small number of principle nodes that explain them all.
`;

/**
 * Deduction mode — "if this premise is true, what must follow?"
 * Starts from a committed premise and forward-simulates consequences
 * with logical necessity. Deterministic in direction. Risk: only as
 * good as the premise — wrong starting assumption, wrong everything.
 */
const DEDUCTION_MODE_BLOCK = `## MODE OF THINKING — DEDUCTION (premise → necessary consequence)

**REASONING POSITION (2×2 axis: direction × shape).**
Deduction is FORWARD + NARROW — a premise generates its necessary
consequences in a tight linear chain. Shape archetype (evocative,
not a validation target): a chain 1 → 1 → 1 → 1, low branching
factor, a derivation.

Taxonomic opposite: **INDUCTION** (backward + generalising) —
where induction infers a rule backward from many cases, deduction
derives specific consequences forward from a rule.

**DRIFT NEIGHBOR: DIVERGENT (not the opposite, but the actual failure
mode).** Deduction does not usually collapse into induction — it
collapses when a "necessary" consequence quietly turns out to be one
of several alternatives, and the chain branches. The tell: you wrote
"and therefore X" when honestly the premise admits X, Y, or Z. High
branching factor is a red flag here — that is divergent, not
deductive. If you're picking among consequences rather than deriving
THE consequence, stop and either (a) revise the premise so the chain
is genuinely narrow, or (b) switch modes to divergent and admit it.

The full 2×2:
- DIVERGENT   (forward + expansive):   one → many possibilities
- DEDUCTION   (forward + narrow):      premise → necessary consequence
- ABDUCTION   (backward + selective):  committed outcome ← best hypothesis
- INDUCTION   (backward + generalising): shared pattern ← many observations

Deductive reasoning asks: **if this premise is true, what must follow?**

PREMISE VALIDATION (READ BEFORE YOU DO ANYTHING ELSE — deduction is
the most dangerous mode in the module because a plausible-looking
chain from a bad premise produces confident garbage. The axes below
are the upstream check, parallel to abduction's scoring on hypotheses
and induction's observation-set validation. Apply BEFORE deriving any
consequence):

1. **Groundedness** — is the premise anchored in an existing world /
   system / continuity node (a committed thread, a stated character
   goal, a world rule the graph already holds), or is it asserted
   freshly for this chain? Asserted premises fail; revise until the
   root cites a real node the reader has already accepted.
2. **Specificity** — can you state the premise in ONE declarative
   sentence? If it needs a cluster of clauses, a list, or "and also",
   it is actually several premises and each needs its own chain.
   Split it, or narrow it.
3. **Non-triviality** — does the premise generate AT LEAST THREE
   non-obvious consequences? Sketch them mentally before committing.
   If the chain terminates after one step, the premise is trivially
   self-executing and the deduction has no work to do. If the three
   consequences are all obvious from the premise alone (no
   intermediate reasoning), the chain is ornamental.
4. **Counterfactual sensitivity** — if the premise were slightly
   different (one word altered, one condition negated), would the
   chain look SUBSTANTIALLY different? If not, the chain is being
   driven by background assumptions you are smuggling in, not by the
   premise you named. Rewrite so the premise is actually load-bearing,
   or name the smuggled assumption as a second root node.

If any axis fails, DO NOT BUILD THE CHAIN. Revise the premise first.
A deductive chain built on a failing premise is worse than no chain —
it produces false confidence.

Secondary failure mode (downstream of the above): deduction is only
as good as its premise. Even after validation, if the chain produces
an absurd or unworkable conclusion, that is useful — it's evidence
the premise needs revision. Do not patch the consequence to avoid the
absurdity; revise upstream instead.

HOW TO THINK ABOUT THE GRAPH:

Picture the graph as a logical chain or narrow tree. Start with the
premise node. Each forward arrow must represent a NECESSARY step —
"given the premise, this must follow". Low branching with tight
causal linkage is the evocative archetype; high branching is the
drift-neighbor warning already covered above.

ARROW COMPOSITION (dominant, not exclusive):
- **Primary** — \`causes\`, \`enables\`, \`requires\`, \`resolves\`: the
  tight logical arrows of deduction. Each arrow should feel
  necessary, not optional. A deductive \`requires\` still points from
  consequence to premise (the derived state depends on the premise)
  but here it tightens the chain rather than reversing it.
- **Secondary** — \`constrains\`, \`develops\`: used when the logical
  chain genuinely hits a rule or deepens a consequence, not as
  decoration.
- **Situational** — \`reveals\`, \`risks\`: as the derivation calls.

NODE ORDER — generation and presentation ALIGN:
- PLAN FIRST: Decide the total node count (emit it as plannedNodeCount
  BEFORE the nodes array). A deductive chain should have a specific
  length; commit to it.
- GENERATION: You start THINKING at the premise and derive forward,
  thinking through each necessary consequence in order.
- PRESENTATION (the \`index\` field): Index 0 is the premise. Later
  indices are the derived consequences, in the order they are
  necessarily entailed. Highest index is the final conclusion.
- Here generation and presentation ALIGN. \`order\` will
  match \`index\` — a visible signature that deductive thinking
  walked premise-to-conclusion.

MINDSET:
- The premise is load-bearing and has already passed the four
  validation axes. Name it clearly at the root.
- Each node should answer: "given the previous node, what MUST be
  true next?" If the answer is "something from a list of options",
  you are in divergent mode, not deductive.
- Logical necessity over narrative interestingness. If a consequence
  feels flat but follows necessarily, keep it — the flatness may be
  signalling that the premise isn't generative enough (which the
  non-triviality axis should have caught; revisit it).

END-OF-CHAIN SELF-CHECK (before finalising the JSON):
- Confirm \`order\` matches \`index\` for every node. Deductive thinking
  runs forward, so emission order and presentation order coincide. If
  they diverge, your JSON emission wandered — resort so the premise
  is index 0 and each consequence follows.
- Re-confirm the four premise-validation axes still hold after the
  chain is written. If the chain's shape exposed a weakness in the
  premise (e.g. groundedness fails in hindsight because a "real"
  node turned out to be asserted), revise the premise and rerun, do
  not patch the chain.
- Count branching. If any node has more than one outgoing causal
  arrow into a consequence, you drifted toward divergent. Either
  collapse to the single necessary consequence or admit the mode
  switch.

The graph is a DERIVATION, not an exploration. A reader should be
able to read it top-to-bottom and feel each step lock into the next,
arriving at a conclusion the premise made inevitable.
`;

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
