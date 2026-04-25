/**
 * Multi-arc coordination plan prompt — peaks, valleys, moments, fate/entity/
 * system nodes, plus pattern/warning/chaos creative-agent nodes derived via
 * backward induction. Builder takes pre-built blocks (force-preference,
 * reasoning-mode) so the prompts module stays free of upstream dependencies.
 */

export type CoordPlanNodeGuidance = {
  totalMin: number;
  minSpineNodes: number;
  minReasoningNodes: number;
  minCharacterNodes: number;
  minLocationNodes: number;
  minArtifactNodes: number;
  minSystemNodes: number;
  minPatterns: number;
  minWarnings: number;
  minChaos: number;
};

export type CoordinationPlanArgs = {
  context: string;
  threadSummary: string;
  characters: string;
  locations: string;
  relationships: string;
  systemKnowledge: string;
  artifacts: string;
  recentScenes: string;
  patternsSection: string;
  antiPatternsSection: string;
  threadTargetsSection: string;
  userDirection: string;
  userConstraints: string;
  arcTarget: number;
  activeThreadCount: number;
  nodeGuidance: CoordPlanNodeGuidance;
  forcePreferenceBlockText: string;
  reasoningModeBlockText: string;
};

export function buildCoordinationPlanPrompt(args: CoordinationPlanArgs): string {
  const {
    context,
    threadSummary,
    characters,
    locations,
    relationships,
    systemKnowledge,
    artifacts,
    recentScenes,
    patternsSection,
    antiPatternsSection,
    threadTargetsSection,
    userDirection,
    userConstraints,
    arcTarget,
    activeThreadCount,
    nodeGuidance,
    forcePreferenceBlockText,
    reasoningModeBlockText,
  } = args;

  return `${context}

## NARRATIVE STATE

ACTIVE THREADS (compelling questions the story must answer):
${threadSummary || "No active threads"}

KEY CHARACTERS (with accumulated knowledge):
${characters || "None"}

KEY LOCATIONS:
${locations || "None"}

${relationships ? `KEY RELATIONSHIPS:\n${relationships}\n` : ""}
${systemKnowledge ? `SYSTEM KNOWLEDGE:\n${systemKnowledge}\n` : ""}
${artifacts ? `KEY ARTIFACTS:\n${artifacts}\n` : ""}
${recentScenes ? `RECENT STORY (what just happened):\n${recentScenes}\n` : ""}
${patternsSection}

${antiPatternsSection}

## PLAN REQUIREMENTS

${threadTargetsSection}
${userDirection}
${userConstraints}

ARC TARGET: ${arcTarget} arcs (plan exactly this many arcs)
${forcePreferenceBlockText}
## TASK

Build a COORDINATION PLAN using BACKWARD INDUCTION, organised around the narrative's STRUCTURAL SPINE.

The spine is the sequence of **peaks** (where forces converge, threads culminate, the story commits) and **valleys** (turning points where tension is seeded and the arc pivots into the next movement). Peaks and valleys are complementary: peaks are where the story lands, valleys are where it launches. Both are load-bearing — a story of only peaks is exhausting; a story of only valleys is all setup and no payoff.

1. Identify the SPINE — one **peak** OR one **valley** per arc, whichever is the arc's structural anchor. That anchor carries arcIndex and sceneCount (3-12). Do NOT set forceMode — it is DERIVED from each arc's node composition after generation:
   - **fate-dominant** — fate nodes + thread-bearing spine nodes dominate (the arc is driven by internal thread pressure)
   - **world-dominant** — character/location/artifact nodes dominate (the arc is driven by existing entities)
   - **system-dominant** — system nodes dominate (the arc is driven by world rules or mechanics)
   - **chaos-dominant** — chaos nodes dominate (the arc is driven by outside forces — HP's troll arc, HP's Norbert arc)
   - **balanced** — no single category dominates
2. Add **moments** — any other beat worth calling out at plan level (thread escalations, setpieces, reveals) that isn't itself the arc's peak or valley.
3. Work BACKWARDS from end-state peaks to derive the valleys and moments needed to earn them.
4. Determine OPTIMAL ARC COUNT — may be fewer than budget if the spine is coherent sooner.
5. Assign every node to an ARC SLOT.
6. Seed **chaos** nodes where the plan genuinely needs new entities — a fresh character, location, artifact, or thread that doesn't yet exist. The scene generator will honour chaos nodes by invoking world expansion when their arc arrives.

The plan orchestrates multiple arcs WITHOUT micromanaging. Each arc gets its own reasoning graph later; this plan sets trajectory through the peak/valley rhythm.

**EFFICIENCY PRINCIPLE**: If the spine closes in fewer arcs than the budget, use fewer arcs. Don't pad to fill.

${reasoningModeBlockText}

## ARC SIZING GUIDE

Each arc should be sized based on what its peak or valley anchor needs:

- **3-4 scenes (short)**: Valley-anchored pivots, quick transitions, aftermath beats
- **5-6 scenes (standard)**: Most arcs — a single peak or valley with supporting moments
- **7-9 scenes (extended)**: Major peaks where multiple threads converge, climactic sequences
- **10-12 scenes (epic)**: Act finales, massive setpieces, resolution of multiple threads

Consider:
- Peak-anchored arcs (convergence, resolution) typically need more scenes to earn the peak
- Valley-anchored arcs (pivot, seeding) tend to be shorter — they launch, they don't land
- World-dominant arcs tend to be shorter; fate-dominant arcs need enough scenes for proper payoff
- The total scene count across all arcs should feel appropriate for the story scope

## OUTPUT FORMAT

Return a JSON object with RICH, DIVERSE nodes. Example showing all node types working together:

**CRITICAL FORMAT REQUIREMENTS**:
- **IDs**: Use SEMANTIC slugs that carry the node's subject, prefixed by type. Format: \`<type>-<kebab-case-subject>\`. Examples: \`peak-empire-falls\`, \`valley-protagonist-loses-ally\`, \`moment-secret-revealed\`, \`reason-survival-demands-alliance\`, \`char-rival-governor\`, \`fate-dynastic-curse\`, \`loc-throne-hall\`, \`art-broken-crown\`, \`sys-imperial-succession\`, \`chaos-outsider-arrives\`, \`pattern-two-protagonists-converge\`, \`warn-third-resolution-by-force\`. Slug length: 3-6 words, lowercase, hyphenated. An edge \`{"from": "peak-empire-falls", "to": "fate-dynastic-curse"}\` is self-describing; the reader (and you, writing later edges) can see what each node is without scrolling back. Do NOT use opaque short codes like PK1, V1 — they force you to hold a mental table of what each code means.
- **Labels**: Must be PROPER ENGLISH descriptions (3-10 words). Describe what happens in natural language. NOT technical identifiers or codes.

{
  "summary": "1-2 sentence high-level plan summary grounded in specific world details",
  "arcCount": <number of arcs>,
  "plannedNodeCount": <-- commit first; locked once nodes begin. Sets the terminal's index (N-1) in backward modes.>,
  "nodes": [
    // ═══════════════════════════════════════════════════════════════
    // SPINE: peaks, valleys, and moments (one peak OR valley anchors each arc)
    // ═══════════════════════════════════════════════════════════════
    // PEAK that anchors an arc — carries arcIndex and sceneCount ONLY.
    // forceMode is DERIVED later from the arc's node mix. Don't set it.
    // The peak is the arc's structural commitment: forces converge, a thread culminates.
    {"id": "peak-glacier-confrontation", "index": 10, "type": "peak", "label": "The Glacier Confrontation", "detail": "WHY this arc needs N scenes — which forces converge and which thread culminates", "threadId": "thread-id", "targetStatus": "resolved", "arcIndex": 1, "sceneCount": 6, "arcSlot": 1},
    // VALLEY that anchors an arc — also carries arc metadata. A valley arc pivots rather than resolves: tension is seeded, a boundary is crossed.
    {"id": "valley-bai-enters-inheritance", "index": 20, "type": "valley", "label": "Bai Ning Bing enters the inheritance", "detail": "WHY this pivot is necessary before the next peak — what new tension is seeded", "threadId": "thread-id", "targetStatus": "escalating", "arcIndex": 2, "sceneCount": 4, "arcSlot": 2},
    // MOMENTS — plan-level beats that matter but aren't the arc's anchor.
    // Thread escalation moment (not the arc's peak/valley, but worth flagging):
    {"id": "moment-clan-betrayal-uncovered", "index": 1, "type": "moment", "label": "Fang Yuan uncovers the clan's betrayal", "detail": "WHY this intermediate beat matters for the next peak", "threadId": "thread-id", "targetStatus": "escalating", "arcSlot": 1},
    // Setpiece moment:
    {"id": "moment-tomb-first-glimpsed", "index": 2, "type": "moment", "label": "Gu master's tomb first glimpsed", "detail": "Plants information or raises stakes for a later peak", "arcSlot": 1},
    // CHAOS — outside-force injection (new character / location / artifact /
    // thread that didn't exist). Don't set entityId or threadId.
    {"id": "chaos-rival-scholar-arrives", "index": 17, "type": "chaos", "label": "A rival scholar arrives from a hidden order", "detail": "Spawned via world expansion — introduces a new character whose knowledge unblocks the Glacier approach", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // FATE NODES: thread pressure throughout the plan
    // ═══════════════════════════════════════════════════════════════
    {"id": "fate-survival-demands-action", "index": 2, "type": "fate", "label": "Survival thread demands immediate action", "detail": "How this thread's momentum shapes Arc 1 — reference thread log momentum", "threadId": "thread-id", "arcSlot": 1},

    // ═══════════════════════════════════════════════════════════════
    // CHARACTER NODES: WHO drives the plan (reference specific knowledge)
    // ═══════════════════════════════════════════════════════════════
    {"id": "char-fang-yuan-knows-gu", "index": 3, "type": "character", "label": "Fang Yuan knows the Gu's location", "detail": "Reference their accumulated knowledge from context — 'knows X, therefore can Y'", "entityId": "char-id", "arcSlot": 1},
    {"id": "char-bai-ambition-forces", "index": 4, "type": "character", "label": "Bai Ning Bing's ambition forces confrontation", "detail": "Their relationship with another character constrains options", "entityId": "char-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // LOCATION NODES: WHERE things must happen (reference continuity)
    // ═══════════════════════════════════════════════════════════════
    {"id": "loc-glacier-enables-secrecy", "index": 5, "type": "location", "label": "The Glacier's isolation enables secrecy", "detail": "Reference location's specific history or significance", "entityId": "loc-id", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // ARTIFACT NODES: items that shape outcomes (reference capabilities)
    // ═══════════════════════════════════════════════════════════════
    {"id": "art-cicada-time-manipulation", "index": 6, "type": "artifact", "label": "Spring Autumn Cicada enables time manipulation", "detail": "Reference specific capabilities from context", "entityId": "artifact-id", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // SYSTEM NODES: world rules that constrain (reference principles/systems/constraints)
    // ═══════════════════════════════════════════════════════════════
    {"id": "sys-gu-feeding-rules", "index": 7, "type": "system", "label": "Gu feeding rules require specific resources", "detail": "Reference specific principle/system/constraint from WORLD KNOWLEDGE", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 1},
    {"id": "sys-clan-hierarchy-blocks", "index": 8, "type": "system", "label": "Clan hierarchy prevents direct challenge", "detail": "Reference specific tension that can be exploited", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 3},

    // ═══════════════════════════════════════════════════════════════
    // REASONING NODES: causal chains (THE BACKBONE — use extensively)
    // ═══════════════════════════════════════════════════════════════
    {"id": "reason-resolution-needs-inheritance", "index": 9, "type": "reasoning", "label": "Resolution requires securing the inheritance first", "detail": "Backward induction step — reference specific system knowledge or relationships", "arcSlot": 2},
    {"id": "reason-inheritance-needs-knowledge", "index": 11, "type": "reasoning", "label": "Inheritance access requires Fang Yuan's knowledge", "detail": "Connect plot point to character agency", "arcSlot": 1},
    {"id": "reason-feeding-constrains-timing", "index": 12, "type": "reasoning", "label": "Gu feeding rules constrain the timing", "detail": "Connect character to system rule", "arcSlot": 1},
    {"id": "reason-glacier-enables-private", "index": 13, "type": "reasoning", "label": "Glacier setting enables private confrontation", "detail": "Connect constraint to location", "arcSlot": 2},

    // ═══════════════════════════════════════════════════════════════
    // PATTERN NODES: creative expansion (inject novelty and emergence)
    // ═══════════════════════════════════════════════════════════════
    {"id": "pattern-rivals-share-enemy", "index": 14, "type": "pattern", "label": "Two rivals discover shared enemy", "detail": "What EMERGENT property arises when these unrelated elements interact?"},
    {"id": "pattern-victory-hides-cost", "index": 15, "type": "pattern", "label": "Recent victory hides a hidden cost", "detail": "Second-order effect: what does X actually mean for Y that no one has realized?"},
    {"id": "pattern-rumored-ancient-tomb", "index": 16, "type": "pattern", "label": "Rumors of ancient Gu master's tomb", "detail": "What exists at the edge of the known world? New faction, location, or system implied but unexplored"},

    // ═══════════════════════════════════════════════════════════════
    // WARNING NODES: subvert predictability (challenge the obvious path)
    // ═══════════════════════════════════════════════════════════════
    {"id": "warn-convenient-alliance-needs-betrayal", "index": 17, "type": "warning", "label": "Alliance is too convenient—needs betrayal", "detail": "What's the LEAST obvious resolution that still feels inevitable? Subvert this."},
    {"id": "warn-protagonist-wins-too-easily", "index": 18, "type": "warning", "label": "Protagonist winning too easily", "detail": "What assumption should be challenged? What cost hasn't been paid?"}
  ],
  "edges": [
    // Dense connections showing causal flow through the spine
    {"id": "e1", "from": "peak-glacier-confrontation", "to": "reason-resolution-needs-inheritance", "type": "requires"},
    {"id": "e2", "from": "reason-resolution-needs-inheritance", "to": "valley-bai-enters-inheritance", "type": "requires"},
    {"id": "e3", "from": "valley-bai-enters-inheritance", "to": "moment-clan-betrayal-uncovered", "type": "develops"},
    {"id": "e4", "from": "moment-clan-betrayal-uncovered", "to": "reason-inheritance-needs-knowledge", "type": "requires"},
    {"id": "e5", "from": "reason-inheritance-needs-knowledge", "to": "char-fang-yuan-knows-gu", "type": "requires"},
    {"id": "e6", "from": "sys-gu-feeding-rules", "to": "reason-feeding-constrains-timing", "type": "constrains"},
    {"id": "e7", "from": "reason-feeding-constrains-timing", "to": "char-fang-yuan-knows-gu", "type": "constrains"},
    {"id": "e8", "from": "reason-glacier-enables-private", "to": "loc-glacier-enables-secrecy", "type": "enables"},
    {"id": "e9", "from": "fate-survival-demands-action", "to": "peak-glacier-confrontation", "type": "constrains"},
    {"id": "e10", "from": "art-cicada-time-manipulation", "to": "reason-glacier-enables-private", "type": "enables"},
    {"id": "e11", "from": "char-bai-ambition-forces", "to": "valley-bai-enters-inheritance", "type": "causes"},
    {"id": "e12", "from": "moment-tomb-first-glimpsed", "to": "peak-glacier-confrontation", "type": "develops"}
  ]
}

## NODE TYPES (all must be grounded in SPECIFIC context from above)

**FORMAT RULES (CRITICAL)**:
- **IDs**: Short alphanumeric codes only: PK1, V1, M1, R1, C1, F1, L1, AR1, S1, PT1, WN1, etc.
  - GOOD: "PK1", "V2", "M3", "R1", "C2", "PT1"
  - BAD: "PEAK_ARC2_T03", "THREAD_RESOLVE", "peak_resolution_1"
- **Labels**: Natural English phrases (3-10 words) describing WHAT happens.
  - GOOD: "Fang Yuan discovers the hidden tomb", "Alliance fractures over resource dispute"
  - BAD: "Peak node", "PK2_ESCALATE", "resolution mechanism"

**SPINE NODES** (structural skeleton — peaks, valleys, moments):
- **peak**: A scene where forces converge and a thread culminates — the story commits. Label: the concrete event (e.g., "The clan elder reveals the betrayal").
  - If this peak ANCHORS an arc: set arcIndex, sceneCount (3-12), and arcSlot = arcIndex. Detail: WHY N scenes and which forces converge.
  - May also carry threadId + targetStatus (resolved/subverted/critical) for the thread that culminates here.
- **valley**: A turning point where tension is seeded and the arc pivots — the story launches. Label: the pivot (e.g., "Bai Ning Bing crosses into the inheritance").
  - If this valley ANCHORS an arc: set arcIndex, sceneCount, and arcSlot. Detail: WHAT tension is seeded and WHICH boundary is crossed.
  - May carry threadId + targetStatus (typically escalating/active) for a thread the valley pivots.
- **moment**: A plan-level beat that isn't the arc's peak or valley but is worth flagging — thread escalation, setpiece, reveal, setup planted for a later payoff. Has arcSlot, may carry threadId + targetStatus. DOES NOT carry arcIndex or sceneCount.

**SPINE RULE (CRITICAL)**: Exactly ONE peak OR valley per arc carries the arc's arcIndex and sceneCount. Everything else worth mentioning at plan level is a moment. Do not mark two peaks for the same arc, and do not mark moments with arcIndex.

**FORCE MODE (DERIVED, NOT SET)**: Do NOT write forceMode in any node. It is computed from each arc's node mix:
- Fate + thread-bearing spine nodes dominant ⇒ **fate-dominant**
- Character + location + artifact dominant ⇒ **world-dominant**
- System dominant ⇒ **system-dominant**
- **Chaos dominant ⇒ chaos-dominant** — outside forces drive the arc
- No single category dominant ⇒ **balanced**

Shape an arc's force character through its node composition: a fate-dominant arc needs more fate nodes; a chaos-dominant arc (e.g., the troll-in-the-dungeon) needs a chaos node as its prime mover plus supporting reasoning about how the cast responds.

**FATE NODES** (thread pressure):
- **fate**: Thread pressure on specific arcs. Has threadId, arcSlot. Label: what the thread demands in plain English (e.g., "Survival thread demands sanctuary").

**ENTITY NODES** (grounding in specific system knowledge — USE ALL OF THESE):
- **character**: WHO drives this transition. MUST have entityId. Label: character + their key action/knowledge (e.g., "Fang Yuan exploits his memory of the future"). **Distribute agency across the cast** — a plan where only the protagonist appears as a character driver is under-representing the world. Secondary characters (rivals, allies, factions' leaders) should appear as agents with their own agendas across multiple arcs, not just as obstacles for the protagonist to overcome.
- **location**: WHERE things must happen. MUST have entityId. Label: location + what it enables (e.g., "The Glacier's isolation enables secret negotiation").
- **artifact**: WHAT item shapes outcomes. MUST have entityId. Label: artifact + its role (e.g., "Spring Autumn Cicada enables time reversal").
- **system**: HOW world rules constrain. Use systemNodeId to reference an existing SYS-XX node from SYSTEM KNOWLEDGE — copy the bracketed [SYS-XX] id verbatim. Omit systemNodeId only when introducing a brand-new rule. Label: the rule stated plainly (e.g., "Gu worms require regular feeding to survive").

**REASONING NODES** (causal chains — THE BACKBONE, use extensively):
- **reasoning**: Logical step in backward induction. Has arcSlot. Label: the inference in plain English (e.g., "Resolution requires controlling the inheritance first"). Detail: explain WHY this follows.

**CREATIVE AGENT NODES** (inject novelty and subvert expectations):
- **pattern**: NOVEL-PATTERN GENERATOR. Proposes a structural shape this plan has NOT used in prior arcs — a fresh arc cadence, a new relational geometry between threads, an unusual anchor type, a rhythm variation. Not generic creativity: a specific pattern the plan hasn't produced yet. Label: the new pattern (e.g., "First valley-anchored arc where the pivot comes from a peripheral character", "Two threads converge without either resolving — a shape no prior arc uses"). Before proposing, scan the plan's existing arcs for shapes already present, then propose something genuinely absent.
- **warning**: PATTERN-REPETITION DETECTOR. Flags where the plan is drifting toward shapes it has already used — three peak-anchored arcs in a row, two consecutive fate-dominant arcs, resolutions that follow the same rhythm. Humans detect structural repetition powerfully; once the plan's rhythm becomes predictable, each subsequent arc lands softer. Name the repetition concretely: "Arcs 2, 4, and 5 would all resolve via external force — reader will feel it", "Three valley-anchored arcs stacked — rhythm is flatlining".
- **chaos**: OUTSIDE FORCE — operates outside the existing fabric of fate, world, and system. Chaos has two faces: **deus-ex-machina** (brings an unexpected problem the cast must solve, or an unexpected solution the cast couldn't build — a troll crashes into the dungeon, a stranger arrives with the missing clue, a dormant artefact wakes), and **creative engine** (seeds new fate — opens threads that didn't exist, which later arcs develop and resolve). Balance is the key: a plan with a couple of chaos moments is alive; a plan without any is inert; a plan of nothing but chaos has no spine to hold onto. An arc can be CHAOS-ANCHORED when its core movement comes from outside the established world (HP's troll-in-the-dungeon and Norbert arcs are chaos-anchored; the welcoming feast is world-driven; the Quirrell climax is fate-driven). Label: what arrives and its role. DO NOT set entityId or threadId — the entity/thread is spawned via world expansion. Remember: chaos sits outside fate, but it SHAPES fate by creating new strands.

## EDGE TYPES

- **requires**: A depends on B (direction matters — A needs B, not B needs A; reversing this corrupts the graph silently)
- **enables**: A makes B possible (B could exist without A, but not here)
- **constrains**: A limits B
- **causes**: A leads to B (B would not exist without A)
- **develops**: A deepens B (use for character/thread arcs only, not generic logic steps)
- **resolves**: A concludes B

## REQUIREMENTS

1. **Backward induction**: Start from the final peak and work backwards — which valleys seed it, which moments carry it, which earlier peak made it possible.
2. **Arc count**: Plan exactly ${arcTarget} arcs
3. **Arc slots**: Every node (except pattern/warning) needs arcSlot (1-N) indicating when it's relevant
4. **CHRONOLOGICAL INDEXING**: Node indexes MUST be chronological by arc — Arc 1 nodes get indexes 0-N, Arc 2 nodes get N+1 to M, etc. Within each arc, order by causal flow.
5. **Progressive revelation**: Nodes with arcSlot > currentArc are hidden from arc generation
6. **One spine anchor per arc**: Exactly ${arcTarget} anchor nodes total. Each is a peak OR a valley (not both for the same arc) with arcIndex and sceneCount. Peak-anchor vs valley-anchor depends on whether the arc commits or pivots.
7. **Deliberate arc sizing**: Each anchor MUST have sceneCount (3-12) with reasoning in detail explaining WHY that length.
8. **Force rhythm via composition**: Shape each arc's force character through node mix — more fate nodes for a fate-dominant arc, more entities for a world-dominant arc, more system nodes for a system-dominant arc. Don't write forceMode; vary node composition.
9. **Peak/valley rhythm**: A plan of all peaks is exhausting; a plan of all valleys is all setup. Aim for alternation — roughly ~60/40 mix, with the final arc typically peak-anchored.
10. **Thread trajectories**: Each thread needs spine nodes (peaks for resolutions/culminations, valleys for pivots, moments for intermediate escalations) showing its progression.
11. **Chaos present**: Include chaos nodes where the plan benefits from something the existing world cannot produce — a fresh character arriving, a hidden location surfacing, a dormant artifact waking, a new thread emerging. Chaos nodes have arcSlot but NO entityId/threadId.
12. **Causal complexity**: story causation is a web — threads pull on many things, entities influence multiple lines, rules constrain several choices. Every node should connect to more than one point; a node touching the story only once is under-represented.
13. **Every entity, fully connected**: when a character, location, artifact, or system shapes the plan, show all the places it shapes — not just one role.
14. **Pacing balance**: mix arc sizes — not all arcs the same length.
15. **Grounded reasoning**: reference specific character knowledge, relationships, artifacts, or world rules in reasoning nodes.
16. **Character agency (CRITICAL)**: character nodes reference ≥3 distinct entityIds across the plan. At least one arc is driven by a non-protagonist (their character node has more outgoing edges than the protagonist's in that arc). Every named character has at least one OUTGOING edge — characters acted upon without agency are absorbed into reasoning, not rendered as scenery.
17. **System constraints**: include system nodes that show HOW world rules shape outcomes.
18. **Warning/pattern response (CRITICAL)**: warnings and patterns must structurally change the plan, not sit as ornaments. A warning's cross-arc repetition is broken by changing spine anchors, arc sizing, or composition; a pattern's proposed shape is adopted by at least one actual arc. Wire warning/pattern nodes to the arcs they're correcting via edges — orphaned ones are dead weight.
19. **Every thread lands**: each thread resolves in a specific arc, or is explicitly carried past the plan. Net open threads trend toward closure by the final arc, not backlog.
20. **No twin arcs**: each arc moves the story from a different state to a different state. Two arcs with the same subject are one arc — merge or cut.
21. **Terminal arc commits**: the final arc's anchor is a peak that closes threads, unless the summary explicitly declares the plan an opening movement.
22. **Novelty over recycling**: resolved threads mostly stay resolved — an arc that re-opens a closed question must earn it, not default to it. Prefer new threads of fate across the plan and new structural shapes across arcs. Sameness between arcs reads as drift.

## NODE COUNT TARGETS (MANDATORY MINIMUMS)

For this ${arcTarget}-arc plan with ${activeThreadCount} active threads, target **at least ${nodeGuidance.totalMin} nodes** across all types.

**Spine nodes** (peaks + valleys + moments):
- **Total spine nodes**: At least ${nodeGuidance.minSpineNodes} (one anchor per arc + thread progressions + supporting moments)
- **Arc anchors**: Exactly ${arcTarget} total — a mix of peaks and valleys, each with arcIndex and sceneCount
- **Moments**: Use freely — every thread needs 2-3 moment nodes showing its progression between peaks

**Reasoning backbone**:
- **Reasoning nodes**: At least ${nodeGuidance.minReasoningNodes}

**Entity grounding** (use all four types):
- **Character nodes**: At least ${nodeGuidance.minCharacterNodes}
- **Location nodes**: At least ${nodeGuidance.minLocationNodes}
- **Artifact nodes**: At least ${nodeGuidance.minArtifactNodes} (if artifacts exist in context)
- **System nodes**: At least ${nodeGuidance.minSystemNodes}

**Agent nodes**:
- **Pattern nodes**: At least ${nodeGuidance.minPatterns} — each introducing a structural shape absent from prior arcs in this plan
- **Warning nodes**: At least ${nodeGuidance.minWarnings} — each naming a specific repetition risk (e.g., "arcs X, Y, Z would share rhythm Q") so the plan actively routes around it
- **Chaos nodes**: At least ${nodeGuidance.minChaos} — outside-force injections spawning new entities or new fates (HP had troll, Norbert, mirror, Fluffy). DO NOT set entityId or threadId on chaos nodes.

## PER-ARC BALANCE (CRITICAL)

**Each arc must have meaningful reasoning.** Variation is natural, but avoid extreme disparities.

**Per-arc guidelines**:
- Early/mid arcs: 5-10 nodes each (setup, plot points, reasoning chains)
- Late arcs: 4-8 nodes each (convergence, escalation)
- Final arc: 3-6 nodes minimum (resolution plot points, final reasoning)

**Allowed variation**: Arc 1 having 8 nodes while Arc 3 has 6 is fine.
**Not allowed**: Arc 1 having 15 nodes while Arc 5 has 2 (extreme disparity).

**Bad (front-loaded)**:
- Arc 1: 15 nodes, Arc 2: 8 nodes, Arc 3: 4 nodes, Arc 4: 3 nodes, Arc 5: 2 nodes

**Good (balanced with natural variation)**:
- Arc 1: 8 nodes, Arc 2: 7 nodes, Arc 3: 6 nodes, Arc 4: 7 nodes, Arc 5: 5 nodes

## SHAPE OF A GOOD PLAN

A coordination plan is a **causal reasoning diagram**, not a proof outline. It represents how the story actually works: peaks don't just follow from one cause — they converge from several. Entities don't appear once — they matter in multiple places. Threads don't run straight — they pull on other threads and get pulled by systems and chaos.

A plan that looks like a vertical list of nodes each with a single cause and a single effect is failing to capture the story's complexity. A good plan has entities that are shared substrate across arcs, peaks that are the convergence of multiple setups, and threads that interact with rules, locations, and each other.

When you finish, scan the graph: do the key characters appear once and connect to several things? Does each peak feel like several pressures coming together? Or does every node live in isolation on a single line? If the latter, the plan is under-representing the story.

Return ONLY the JSON object.`;
}
