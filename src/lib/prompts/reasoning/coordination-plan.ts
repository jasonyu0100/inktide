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

  return `<inputs>
  <narrative-context>
${context}
  </narrative-context>

  <narrative-state>
    <active-threads hint="Compelling questions the story must answer.">
${threadSummary || "No active threads"}
    </active-threads>
    <key-characters hint="With accumulated knowledge.">
${characters || "None"}
    </key-characters>
    <key-locations>
${locations || "None"}
    </key-locations>
${relationships ? `    <key-relationships>\n${relationships}\n    </key-relationships>` : ""}
${systemKnowledge ? `    <system-knowledge>\n${systemKnowledge}\n    </system-knowledge>` : ""}
${artifacts ? `    <key-artifacts>\n${artifacts}\n    </key-artifacts>` : ""}
${recentScenes ? `    <recent-story hint="What just happened.">\n${recentScenes}\n    </recent-story>` : ""}
  </narrative-state>

${patternsSection ? `  <patterns hint="Positive commandments.">\n${patternsSection}\n  </patterns>` : ""}
${antiPatternsSection ? `  <anti-patterns hint="Pitfalls to avoid.">\n${antiPatternsSection}\n  </anti-patterns>` : ""}

  <plan-requirements>
${threadTargetsSection ? `    <thread-targets>\n${threadTargetsSection}\n    </thread-targets>` : ""}
${userDirection ? `    <direction hint="End fate goals to achieve.">${userDirection}</direction>` : ""}
${userConstraints ? `    <constraints hint="What must NOT happen.">${userConstraints}</constraints>` : ""}
    <arc-target>${arcTarget}</arc-target>
${forcePreferenceBlockText ? `    ${forcePreferenceBlockText.replace(/\n/g, '\n    ')}` : ""}
${reasoningModeBlockText ? `    ${reasoningModeBlockText.replace(/\n/g, '\n    ')}` : ""}
  </plan-requirements>
</inputs>

<task>Build a COORDINATION PLAN using BACKWARD INDUCTION, organised around the narrative's STRUCTURAL SPINE.</task>

<spine-doctrine>
  The spine is the sequence of peaks (where forces converge, threads culminate, the story commits) and valleys (turning points where tension is seeded and the arc pivots into the next movement). Peaks and valleys are complementary: peaks are where the story lands, valleys are where it launches. Both are load-bearing — a story of only peaks is exhausting; a story of only valleys is all setup and no payoff.
</spine-doctrine>

<procedure>
  <step index="1" name="identify-spine">Identify the SPINE — one peak OR one valley per arc, whichever is the arc's structural anchor. That anchor carries arcIndex and sceneCount (3-12). Do NOT set forceMode — it is DERIVED from each arc's node composition.
    <force-mode name="fate-dominant">Fate nodes + thread-bearing spine nodes dominate (driven by internal thread pressure).</force-mode>
    <force-mode name="world-dominant">Character/location/artifact nodes dominate (driven by existing entities).</force-mode>
    <force-mode name="system-dominant">System nodes dominate (driven by world rules or mechanics).</force-mode>
    <force-mode name="chaos-dominant">Chaos nodes dominate (driven by outside forces — HP's troll arc, HP's Norbert arc).</force-mode>
    <force-mode name="balanced">No single category dominates.</force-mode>
  </step>
  <step index="2" name="add-moments">Add moments — any other beat worth calling out at plan level (thread escalations, setpieces, reveals) that isn't itself the arc's peak or valley.</step>
  <step index="3" name="backwards">Work BACKWARDS from end-state peaks to derive the valleys and moments needed to earn them.</step>
  <step index="4" name="optimal-arc-count">Determine OPTIMAL ARC COUNT — may be fewer than budget if the spine is coherent sooner.</step>
  <step index="5" name="assign-slots">Assign every node to an ARC SLOT.</step>
  <step index="6" name="seed-chaos">Seed chaos nodes where the plan genuinely needs new entities — a fresh character, location, artifact, or thread that doesn't yet exist. The scene generator will honour chaos nodes by invoking world expansion when their arc arrives.</step>
</procedure>

<orchestration-principle>The plan orchestrates multiple arcs WITHOUT micromanaging. Each arc gets its own reasoning graph later; this plan sets trajectory through the peak/valley rhythm.</orchestration-principle>

<efficiency-principle>If the spine closes in fewer arcs than the budget, use fewer arcs. Don't pad to fill.</efficiency-principle>

<arc-sizing-guide hint="Each arc should be sized based on what its peak or valley anchor needs.">
  <size scenes="3-4" name="short">Valley-anchored pivots, quick transitions, aftermath beats.</size>
  <size scenes="5-6" name="standard">Most arcs — a single peak or valley with supporting moments.</size>
  <size scenes="7-9" name="extended">Major peaks where multiple threads converge, climactic sequences.</size>
  <size scenes="10-12" name="epic">Act finales, massive setpieces, resolution of multiple threads.</size>
  <consider>
    <factor>Peak-anchored arcs (convergence, resolution) typically need more scenes to earn the peak.</factor>
    <factor>Valley-anchored arcs (pivot, seeding) tend to be shorter — they launch, they don't land.</factor>
    <factor>World-dominant arcs tend to be shorter; fate-dominant arcs need enough scenes for proper payoff.</factor>
    <factor>The total scene count across all arcs should feel appropriate for the story scope.</factor>
  </consider>
</arc-sizing-guide>

<output-format>
Return a JSON object with RICH, DIVERSE nodes. Example showing all node types working together.

CRITICAL FORMAT REQUIREMENTS:
- IDs: Use SEMANTIC slugs that carry the node's subject, prefixed by type. Format: \`<type>-<kebab-case-subject>\`. Examples: \`peak-empire-falls\`, \`valley-protagonist-loses-ally\`, \`moment-secret-revealed\`, \`reason-survival-demands-alliance\`, \`char-rival-governor\`, \`fate-dynastic-curse\`, \`loc-throne-hall\`, \`art-broken-crown\`, \`sys-imperial-succession\`, \`chaos-outsider-arrives\`, \`pattern-two-protagonists-converge\`, \`warn-third-resolution-by-force\`. Slug length: 3-6 words, lowercase, hyphenated. Do NOT use opaque short codes like PK1, V1 — they force you to hold a mental table of what each code means.
- Labels: Must be PROPER ENGLISH descriptions (3-10 words). Describe what happens in natural language. NOT technical identifiers or codes.

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
</output-format>

<node-types hint="All nodes must be grounded in SPECIFIC context from inputs above.">

  <spine-nodes hint="Structural skeleton — peaks, valleys, moments.">
    <type name="peak">A scene where forces converge and a thread culminates — the story commits. Label: the concrete event (e.g., "The clan elder reveals the betrayal"). If it ANCHORS an arc: set arcIndex, sceneCount (3-12), arcSlot = arcIndex. Detail: WHY N scenes and which forces converge. May also carry threadId + targetStatus (resolved/subverted/critical).</type>
    <type name="valley">A turning point where tension is seeded and the arc pivots — the story launches. Label: the pivot (e.g., "Bai Ning Bing crosses into the inheritance"). If it ANCHORS an arc: set arcIndex, sceneCount, arcSlot. Detail: WHAT tension is seeded and WHICH boundary is crossed. May carry threadId + targetStatus (typically escalating/active).</type>
    <type name="moment">A plan-level beat that isn't the arc's peak or valley but is worth flagging — thread escalation, setpiece, reveal, setup planted for a later payoff. Has arcSlot, may carry threadId + targetStatus. DOES NOT carry arcIndex or sceneCount.</type>
    <spine-rule>Exactly ONE peak OR valley per arc carries the arc's arcIndex and sceneCount. Everything else worth mentioning at plan level is a moment. Do not mark two peaks for the same arc, and do not mark moments with arcIndex.</spine-rule>
    <force-mode-rule>Do NOT write forceMode in any node — it is computed from each arc's node mix. Shape an arc's force character through its node composition: a fate-dominant arc needs more fate nodes; a chaos-dominant arc (e.g., the troll-in-the-dungeon) needs a chaos node as its prime mover plus supporting reasoning about how the cast responds.</force-mode-rule>
  </spine-nodes>

  <fate-nodes hint="Thread pressure.">
    <type name="fate">Thread pressure on specific arcs. Has threadId, arcSlot. Label: what the thread demands in plain English (e.g., "Survival thread demands sanctuary").</type>
  </fate-nodes>

  <entity-nodes hint="Grounding in specific context — USE ALL OF THESE.">
    <type name="character">WHO drives this transition. MUST have entityId. Label: character + their key action/knowledge (e.g., "Fang Yuan exploits his memory of the future"). DISTRIBUTE AGENCY across the cast — a plan where only the protagonist appears is under-representing the world. Secondary characters (rivals, allies, faction leaders) should appear as agents with their own agendas across multiple arcs.</type>
    <type name="location">WHERE things must happen. MUST have entityId. Label: location + what it enables (e.g., "The Glacier's isolation enables secret negotiation").</type>
    <type name="artifact">WHAT item shapes outcomes. MUST have entityId. Label: artifact + its role (e.g., "Spring Autumn Cicada enables time reversal").</type>
    <type name="system">HOW world rules constrain. Use systemNodeId to reference an existing SYS-XX node from SYSTEM KNOWLEDGE — copy the bracketed [SYS-XX] id verbatim. Omit systemNodeId only when introducing a brand-new rule. Label: the rule stated plainly (e.g., "Gu worms require regular feeding to survive").</type>
  </entity-nodes>

  <reasoning-nodes hint="Causal chains — THE BACKBONE; use extensively.">
    <type name="reasoning">Logical step in backward induction. Has arcSlot. Label: the inference in plain English (e.g., "Resolution requires controlling the inheritance first"). Detail: explain WHY this follows.</type>
  </reasoning-nodes>

  <creative-agent-nodes hint="Inject novelty and subvert expectations.">
    <type name="pattern">NOVEL-PATTERN GENERATOR. Proposes a structural shape this plan has NOT used in prior arcs — a fresh arc cadence, a new relational geometry between threads, an unusual anchor type, a rhythm variation. Specific pattern the plan hasn't produced yet. Before proposing, scan the plan's existing arcs for shapes already present, then propose something genuinely absent.</type>
    <type name="warning">PATTERN-REPETITION DETECTOR. Flags where the plan is drifting toward shapes it has already used — three peak-anchored arcs in a row, two consecutive fate-dominant arcs, resolutions following the same rhythm. Name the repetition concretely.</type>
    <type name="chaos">OUTSIDE FORCE — operates outside the existing fabric of fate, world, and system. Two faces: deus-ex-machina (brings an unexpected problem or unexpected solution — troll crashes into dungeon, stranger arrives with missing clue, dormant artefact wakes), and creative engine (seeds new fate — opens threads that didn't exist, later arcs develop and resolve). Balance is key. An arc can be CHAOS-ANCHORED. DO NOT set entityId or threadId — the entity/thread is spawned via world expansion.</type>
  </creative-agent-nodes>
</node-types>

<edge-types>
  <edge name="requires">A depends on B (direction matters — A needs B, not B needs A; reversing corrupts the graph silently).</edge>
  <edge name="enables">A makes B possible (B could exist without A, but not here).</edge>
  <edge name="constrains">A limits B.</edge>
  <edge name="causes">A leads to B (B would not exist without A).</edge>
  <edge name="develops">A deepens B (use for character/thread arcs only, not generic logic steps).</edge>
  <edge name="resolves">A concludes B.</edge>
</edge-types>

<requirements>
  <requirement index="1" name="backward-induction">Start from the final peak and work backwards — which valleys seed it, which moments carry it, which earlier peak made it possible.</requirement>
  <requirement index="2" name="arc-count">Plan exactly ${arcTarget} arcs.</requirement>
  <requirement index="3" name="arc-slots">Every node (except pattern/warning) needs arcSlot (1-N) indicating when it's relevant.</requirement>
  <requirement index="4" name="chronological-indexing">Node indexes MUST be chronological by arc — Arc 1 nodes get indexes 0-N, Arc 2 nodes get N+1 to M, etc. Within each arc, order by causal flow.</requirement>
  <requirement index="5" name="progressive-revelation">Nodes with arcSlot &gt; currentArc are hidden from arc generation.</requirement>
  <requirement index="6" name="one-spine-anchor-per-arc">Exactly ${arcTarget} anchor nodes total. Each is a peak OR a valley (not both for the same arc) with arcIndex and sceneCount.</requirement>
  <requirement index="7" name="deliberate-arc-sizing">Each anchor MUST have sceneCount (3-12) with reasoning in detail explaining WHY that length.</requirement>
  <requirement index="8" name="force-rhythm-via-composition">Shape each arc's force character through node mix — more fate nodes for fate-dominant, more entities for world-dominant, more system nodes for system-dominant. Don't write forceMode; vary composition.</requirement>
  <requirement index="9" name="peak-valley-rhythm">A plan of all peaks is exhausting; a plan of all valleys is all setup. Aim for alternation — roughly ~60/40 mix, with the final arc typically peak-anchored.</requirement>
  <requirement index="10" name="thread-trajectories">Each thread needs spine nodes showing its progression (peaks for resolutions/culminations, valleys for pivots, moments for intermediate escalations).</requirement>
  <requirement index="11" name="chaos-present">Include chaos nodes where the plan benefits from something the existing world cannot produce. Chaos nodes have arcSlot but NO entityId/threadId.</requirement>
  <requirement index="12" name="causal-complexity">Story causation is a web. Every node should connect to more than one point; a node touching the story only once is under-represented.</requirement>
  <requirement index="13" name="entity-fully-connected">When a character, location, artifact, or system shapes the plan, show all the places it shapes.</requirement>
  <requirement index="14" name="pacing-balance">Mix arc sizes — not all arcs the same length.</requirement>
  <requirement index="15" name="grounded-reasoning">Reference specific character knowledge, relationships, artifacts, or world rules in reasoning nodes.</requirement>
  <requirement index="16" name="character-agency" critical="true">Character nodes reference ≥3 distinct entityIds across the plan. At least one arc is driven by a non-protagonist. Every named character has at least one OUTGOING edge — characters acted upon without agency are absorbed into reasoning, not rendered as scenery.</requirement>
  <requirement index="17" name="system-constraints">Include system nodes that show HOW world rules shape outcomes.</requirement>
  <requirement index="18" name="warning-pattern-response" critical="true">Warnings and patterns must structurally change the plan, not sit as ornaments. A warning's cross-arc repetition is broken by changing spine anchors, arc sizing, or composition; a pattern's proposed shape is adopted by at least one actual arc. Wire warning/pattern nodes to the arcs they're correcting via edges — orphaned ones are dead weight.</requirement>
  <requirement index="19" name="every-thread-lands">Each thread resolves in a specific arc, or is explicitly carried past the plan. Net open threads trend toward closure by the final arc, not backlog.</requirement>
  <requirement index="20" name="no-twin-arcs">Each arc moves the story from a different state to a different state. Two arcs with the same subject are one arc — merge or cut.</requirement>
  <requirement index="21" name="terminal-arc-commits">The final arc's anchor is a peak that closes threads, unless the summary explicitly declares the plan an opening movement.</requirement>
  <requirement index="22" name="novelty-over-recycling">Resolved threads mostly stay resolved — an arc that re-opens a closed question must earn it. Prefer new threads of fate across the plan and new structural shapes across arcs. Sameness between arcs reads as drift.</requirement>
</requirements>

<node-count-targets total-min="${nodeGuidance.totalMin}" hint="For this ${arcTarget}-arc plan with ${activeThreadCount} active threads.">
  <spine-nodes-min>${nodeGuidance.minSpineNodes} (one anchor per arc + thread progressions + supporting moments)</spine-nodes-min>
  <arc-anchors>${arcTarget} total — a mix of peaks and valleys, each with arcIndex and sceneCount</arc-anchors>
  <moments hint="Use freely — every thread needs 2-3 moment nodes showing its progression between peaks." />
  <reasoning-min>${nodeGuidance.minReasoningNodes}</reasoning-min>
  <character-min>${nodeGuidance.minCharacterNodes}</character-min>
  <location-min>${nodeGuidance.minLocationNodes}</location-min>
  <artifact-min>${nodeGuidance.minArtifactNodes} (if artifacts exist in context)</artifact-min>
  <system-min>${nodeGuidance.minSystemNodes}</system-min>
  <pattern-min>${nodeGuidance.minPatterns} — each introducing a structural shape absent from prior arcs in this plan</pattern-min>
  <warning-min>${nodeGuidance.minWarnings} — each naming a specific repetition risk so the plan actively routes around it</warning-min>
  <chaos-min>${nodeGuidance.minChaos} — outside-force injections spawning new entities or new fates (HP had troll, Norbert, mirror, Fluffy). DO NOT set entityId or threadId on chaos nodes.</chaos-min>
</node-count-targets>

<per-arc-balance hint="Each arc must have meaningful reasoning. Variation is natural, but avoid extreme disparities.">
  <guideline scope="early-mid">5-10 nodes each (setup, plot points, reasoning chains).</guideline>
  <guideline scope="late">4-8 nodes each (convergence, escalation).</guideline>
  <guideline scope="final">3-6 nodes minimum (resolution plot points, final reasoning).</guideline>
  <example type="allowed">Arc 1 having 8 nodes while Arc 3 has 6 is fine.</example>
  <example type="not-allowed">Arc 1 having 15 nodes while Arc 5 has 2 (extreme disparity).</example>
  <example type="bad">Arc 1: 15 nodes, Arc 2: 8 nodes, Arc 3: 4 nodes, Arc 4: 3 nodes, Arc 5: 2 nodes (front-loaded).</example>
  <example type="good">Arc 1: 8 nodes, Arc 2: 7 nodes, Arc 3: 6 nodes, Arc 4: 7 nodes, Arc 5: 5 nodes (balanced with natural variation).</example>
</per-arc-balance>

<shape-of-good-plan>
  A coordination plan is a CAUSAL REASONING DIAGRAM, not a proof outline. It represents how the story actually works: peaks don't just follow from one cause — they converge from several. Entities don't appear once — they matter in multiple places. Threads don't run straight — they pull on other threads and get pulled by systems and chaos.

  A plan that looks like a vertical list of nodes each with a single cause and a single effect is failing to capture the story's complexity. A good plan has entities that are shared substrate across arcs, peaks that are the convergence of multiple setups, and threads that interact with rules, locations, and each other.

  When you finish, scan the graph: do the key characters appear once and connect to several things? Does each peak feel like several pressures coming together? Or does every node live in isolation on a single line? If the latter, the plan is under-representing the story.
</shape-of-good-plan>

<final-instruction>Return ONLY the JSON object.</final-instruction>`;
}
