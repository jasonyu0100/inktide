/**
 * Multi-arc coordination plan prompt — peaks, valleys, moments, fate/entity/
 * system nodes, plus pattern/warning/chaos creative-agent nodes derived via
 * backward induction. Builder takes pre-built blocks (force-preference,
 * reasoning-mode) so the prompts module stays free of upstream dependencies.
 */

import { phaseGraphPriorityEntry } from "../phase/application";

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
  /** Pre-rendered <phase-graph> block (or "" when no phase graph is active). */
  phaseGraphSection: string;
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
    phaseGraphSection,
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

${phaseGraphSection ? `  ${phaseGraphSection.replace(/\n/g, '\n  ')}` : ""}
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

<integration-hierarchy hint="When inputs conflict, this is the priority order for plan-level decisions.">
  <priority rank="1">DIRECTION / CONSTRAINTS / THREAD TARGETS — explicit user guidance; the plan must serve these directly.</priority>
  <priority rank="2">NARRATIVE STATE — active threads, key characters/locations, system knowledge, recent scenes; the substrate the plan operates on.</priority>
  ${phaseGraphPriorityEntry(3, "reasoning-plan")}
  <priority rank="4">FORCE PREFERENCE / REASONING MODE — engine tilt applied within the constraints above.</priority>
</integration-hierarchy>

<spine-doctrine>
  The spine = peaks (forces converge, threads culminate, story commits) and valleys (tension seeded, arc pivots). Complementary: peaks land, valleys launch. All-peaks is exhausting; all-valleys is all-setup-no-payoff.
</spine-doctrine>

<procedure>
  <step index="1" name="identify-spine">Identify the SPINE — one peak OR valley per arc as structural anchor, carrying arcIndex + sceneCount (3-12). Do NOT set forceMode (DERIVED from node composition).
    <force-mode name="fate-dominant">Fate + thread-bearing spine nodes dominate.</force-mode>
    <force-mode name="world-dominant">Character/location/artifact nodes dominate.</force-mode>
    <force-mode name="system-dominant">System nodes dominate.</force-mode>
    <force-mode name="chaos-dominant">Chaos dominates (HP's troll/Norbert arcs).</force-mode>
    <force-mode name="balanced">No single category dominates.</force-mode>
  </step>
  <step index="2" name="add-moments">Add moments — plan-level beats (escalations, setpieces, reveals) that aren't the arc's anchor.</step>
  <step index="3" name="backwards">Work BACKWARDS from end-state peaks to derive valleys and moments that earn them.</step>
  <step index="4" name="optimal-arc-count">Determine OPTIMAL count — may be fewer than budget if the spine closes sooner.</step>
  <step index="5" name="assign-slots">Assign every node to an arcSlot.</step>
  <step index="6" name="seed-chaos">Seed chaos where the plan needs new entities the existing world can't produce. Scene generator invokes world expansion when chaos arcs arrive.</step>
</procedure>

<orchestration-principle>Orchestrate multiple arcs WITHOUT micromanaging. Each arc gets its own reasoning graph later; this plan sets trajectory.</orchestration-principle>

<efficiency-principle>If the spine closes in fewer arcs than the budget, use fewer. Don't pad.</efficiency-principle>

<arc-sizing-guide hint="Size by what the anchor needs.">
  <size scenes="3-4" name="short">Valley-anchored pivots, quick transitions, aftermath.</size>
  <size scenes="5-6" name="standard">Single peak/valley with supporting moments — most arcs.</size>
  <size scenes="7-9" name="extended">Major peaks where multiple threads converge.</size>
  <size scenes="10-12" name="epic">Act finales, massive setpieces, multiple-thread resolution.</size>
  <consider>
    <factor>Peak-anchored arcs (convergence, resolution) typically need more scenes.</factor>
    <factor>Valley-anchored arcs (pivot, seeding) tend shorter — they launch, don't land.</factor>
    <factor>World-dominant tend shorter; fate-dominant need scenes for payoff.</factor>
  </consider>
</arc-sizing-guide>

<output-format>
Return a JSON object with RICH, DIVERSE nodes.

<format-requirements>
  <ids>SEMANTIC slugs prefixed by type: \`<type>-<kebab-case-subject>\`. 3-6 words, lowercase, hyphenated. Examples: \`peak-empire-falls\`, \`valley-protagonist-loses-ally\`, \`moment-secret-revealed\`, \`char-rival-governor\`, \`chaos-outsider-arrives\`, \`pattern-two-protagonists-converge\`, \`warn-third-resolution-by-force\`. Do NOT use opaque codes like PK1, V1.</ids>
  <labels>PROPER ENGLISH (3-10 words), natural language. NOT technical identifiers or codes.</labels>
</format-requirements>

<example>
{
  "summary": "1-2 sentence plan summary grounded in specific world details",
  "arcCount": <number of arcs>,
  "plannedNodeCount": <-- commit first; sets terminal index = N-1 in backward modes>,
  "nodes": [
    // SPINE — one peak OR valley anchors each arc (carries arcIndex + sceneCount; forceMode is DERIVED later from node mix).
    // PEAK = arc's structural commitment (forces converge, thread culminates).
    {"id": "peak-glacier-confrontation", "index": 10, "type": "peak", "label": "The Glacier Confrontation", "detail": "WHY this arc needs N scenes; which forces converge and which thread culminates", "threadId": "thread-id", "targetStatus": "resolved", "arcIndex": 1, "sceneCount": 6, "arcSlot": 1},
    // VALLEY = pivot, not resolution (tension seeded, boundary crossed).
    {"id": "valley-bai-enters-inheritance", "index": 20, "type": "valley", "label": "Bai Ning Bing enters the inheritance", "detail": "WHY this pivot precedes the next peak; what tension is seeded", "threadId": "thread-id", "targetStatus": "escalating", "arcIndex": 2, "sceneCount": 4, "arcSlot": 2},
    // MOMENTS — plan-level beats that aren't the arc's anchor.
    {"id": "moment-clan-betrayal-uncovered", "index": 1, "type": "moment", "label": "Fang Yuan uncovers the clan's betrayal", "detail": "Why this intermediate beat matters for the next peak", "threadId": "thread-id", "targetStatus": "escalating", "arcSlot": 1},
    {"id": "moment-tomb-first-glimpsed", "index": 2, "type": "moment", "label": "Gu master's tomb first glimpsed", "detail": "Plants information for a later peak", "arcSlot": 1},
    // CHAOS — outside-force; spawned via world expansion (no entityId/threadId).
    {"id": "chaos-rival-scholar-arrives", "index": 17, "type": "chaos", "label": "A rival scholar arrives from a hidden order", "detail": "Introduces a new character whose knowledge unblocks the Glacier approach", "arcSlot": 3},
    // FATE NODES — thread pressure throughout the plan.
    {"id": "fate-survival-demands-action", "index": 2, "type": "fate", "label": "Survival thread demands immediate action", "detail": "Reference thread log momentum", "threadId": "thread-id", "arcSlot": 1},
    // CHARACTER NODES — drivers (reference specific knowledge).
    {"id": "char-fang-yuan-knows-gu", "index": 3, "type": "character", "label": "Fang Yuan knows the Gu's location", "detail": "Knows X, therefore can Y", "entityId": "char-id", "arcSlot": 1},
    {"id": "char-bai-ambition-forces", "index": 4, "type": "character", "label": "Bai Ning Bing's ambition forces confrontation", "detail": "Relationship constrains options", "entityId": "char-id", "arcSlot": 2},
    // LOCATION NODES.
    {"id": "loc-glacier-enables-secrecy", "index": 5, "type": "location", "label": "The Glacier's isolation enables secrecy", "entityId": "loc-id", "arcSlot": 2},
    // ARTIFACT NODES.
    {"id": "art-cicada-time-manipulation", "index": 6, "type": "artifact", "label": "Spring Autumn Cicada enables time manipulation", "entityId": "artifact-id", "arcSlot": 3},
    // SYSTEM NODES — reuse existing SYS-XX where possible.
    {"id": "sys-gu-feeding-rules", "index": 7, "type": "system", "label": "Gu feeding rules require specific resources", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 1},
    {"id": "sys-clan-hierarchy-blocks", "index": 8, "type": "system", "label": "Clan hierarchy prevents direct challenge", "systemNodeId": "actual-SYS-id-from-narrative", "arcSlot": 3},
    // REASONING NODES — the backbone; each detail = the inference's own causal logic, not graph attribution.
    {"id": "reason-resolution-needs-inheritance", "index": 9, "type": "reasoning", "label": "Resolution requires securing the inheritance first", "detail": "The Glacier confrontation can only land its peak if the protagonist arrives with the inheritance already in hand — without it the rival's leverage holds and the confrontation collapses into another deferral. The inheritance is the only asset that flips the power balance at the table. Hands off to the valley arc where the inheritance is actually secured.", "arcSlot": 2},
    {"id": "reason-inheritance-needs-knowledge", "index": 11, "type": "reasoning", "label": "Inheritance access requires Fang Yuan's knowledge", "detail": "The inheritance is sealed behind a verification rite only the original line can pass; Fang Yuan's accumulated knowledge from the previous life is the only key any living character holds. Without him the valley arc has no opening move. Hands off to the timing constraint imposed by Gu feeding rules.", "arcSlot": 1},
    {"id": "reason-feeding-constrains-timing", "index": 12, "type": "reasoning", "label": "Gu feeding rules constrain the timing", "detail": "Fang Yuan's primary Gu must be fed within a fixed window or its capabilities collapse — that window expires before the natural opportunity to attempt the inheritance. The arc must therefore force the attempt earlier than is comfortable, putting him under pressure he can't bargain away. Hands off to the location choice that buys him cover.", "arcSlot": 1},
    {"id": "reason-glacier-enables-private", "index": 13, "type": "reasoning", "label": "Glacier setting enables private confrontation", "detail": "The Glacier is the only location no clan elder will witness in person — the cold and altitude keep observers off, leaving only the rival faction. That isolation is what makes a peak-grade confrontation possible without it spiralling into a clan-level incident. Hands off to the confrontation peak.", "arcSlot": 2},
    // PATTERN NODES — emergent shapes / second-order effects.
    {"id": "pattern-rivals-share-enemy", "index": 14, "type": "pattern", "label": "Two rivals discover shared enemy", "detail": "Emergent property when these elements interact"},
    {"id": "pattern-victory-hides-cost", "index": 15, "type": "pattern", "label": "Recent victory hides a hidden cost"},
    {"id": "pattern-rumored-ancient-tomb", "index": 16, "type": "pattern", "label": "Rumors of ancient Gu master's tomb"},
    // WARNING NODES — challenge the obvious resolution.
    {"id": "warn-convenient-alliance-needs-betrayal", "index": 17, "type": "warning", "label": "Alliance is too convenient—needs betrayal"},
    {"id": "warn-protagonist-wins-too-easily", "index": 18, "type": "warning", "label": "Protagonist winning too easily"}
  ],
  "edges": [
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
</example>
</output-format>

<node-types hint="All nodes grounded in SPECIFIC context from inputs above.">
  <spine-nodes hint="Structural skeleton.">
    <type name="peak">Scene where forces converge and a thread culminates — story commits. If it ANCHORS an arc: set arcIndex, sceneCount (3-12), arcSlot=arcIndex. Detail: WHY N scenes, which forces converge. May carry threadId + targetStatus (resolved/subverted/critical). Label = concrete event.</type>
    <type name="valley">Turning point where tension is seeded and the arc pivots — story launches. If anchor: set arcIndex, sceneCount, arcSlot. Detail: what tension seeded, which boundary crossed. May carry threadId + targetStatus (typically escalating/active). Label = the pivot.</type>
    <type name="moment">Plan-level beat that isn't the arc's anchor — thread escalation, setpiece, reveal, setup. Has arcSlot, may carry threadId + targetStatus. DOES NOT carry arcIndex or sceneCount.</type>
    <spine-rule>Exactly ONE peak OR valley per arc carries arcIndex+sceneCount. Don't mark two anchors for one arc; don't mark moments with arcIndex.</spine-rule>
    <force-mode-rule>Do NOT write forceMode — derived from node mix. Shape force character through composition: fate-dominant = more fate nodes; chaos-dominant (troll-in-dungeon) = chaos as prime mover with supporting reasoning.</force-mode-rule>
  </spine-nodes>

  <fate-nodes>
    <type name="fate">Thread pressure on specific arcs. Has threadId, arcSlot. Label = what the thread demands.</type>
  </fate-nodes>

  <entity-nodes hint="Grounding — USE ALL OF THESE.">
    <type name="character">WHO drives the transition. MUST have entityId. Label = character + key action/knowledge. DISTRIBUTE AGENCY — protagonist-only plans under-represent the world. Secondary characters as agents with their own agendas across multiple arcs.</type>
    <type name="location">WHERE things must happen. MUST have entityId. Label = location + what it enables.</type>
    <type name="artifact">WHAT item shapes outcomes. MUST have entityId. Label = artifact + role.</type>
    <type name="system">HOW rules constrain. Use systemNodeId for existing [SYS-XX] (verbatim). Omit only for brand-new rules. Label = the rule plainly.</type>
  </entity-nodes>

  <reasoning-nodes>
    <type name="reasoning">Logical step in backward induction. Has arcSlot. Label = inference (3-8 words). Detail = REQUIRED, 1-3 sentences: the causal logic of the inference itself — given the prereqs (entities, rules, prior reasoning visible to this arcSlot), why does this step follow, and what does it make possible for the next? Do NOT use detail to attribute graph position ("backward induction step", "step in the chain"). Walking the plan's reasoning nodes by index should read as a coherent argumentative chain — each detail picks up where the previous left off.</type>
  </reasoning-nodes>

  <creative-agent-nodes>
    <type name="pattern">NOVEL-PATTERN GENERATOR. A structural shape this plan has NOT used — fresh arc cadence, new relational geometry, unusual anchor, rhythm variation. Scan prior arcs first; propose what's genuinely absent.</type>
    <type name="warning">PATTERN-REPETITION DETECTOR. Flags drift toward used shapes — three peak-anchored arcs in a row, two consecutive fate-dominant arcs, same resolution rhythm. Name concretely.</type>
    <type name="chaos">OUTSIDE FORCE. Two faces: deus-ex-machina (unexpected problem/solution — troll crashes in, stranger arrives, artefact wakes); creative engine (seeds new fate threads later arcs develop). An arc can be CHAOS-ANCHORED. DO NOT set entityId or threadId — spawned via world expansion.</type>
  </creative-agent-nodes>
</node-types>

<edge-types>
  <edge name="requires">A depends on B (direction matters — A needs B, not B needs A; reversing corrupts the graph silently).</edge>
  <edge name="enables">A makes B possible (B could exist without A, but not here).</edge>
  <edge name="constrains">A limits B.</edge>
  <edge name="risks">A creates danger for B.</edge>
  <edge name="causes">A leads to B (B would not exist without A).</edge>
  <edge name="reveals">A exposes information in B.</edge>
  <edge name="develops">A deepens B (use for character/thread arcs only, not generic logic steps).</edge>
  <edge name="resolves">A concludes B.</edge>
  <edge name="supersedes">A replaces/overrides B — the older claim, rule, plan, or commitment is no longer load-bearing; A is what the plan now operates on. Use when a new arc's anchor displaces an earlier one, when a system rule overrides a prior one, when a chaos event makes a prior reasoning step obsolete. Direction: A is the new/current, B is the old/displaced.</edge>
</edge-types>

<requirements>
  <requirement index="1" name="backward-induction">Start from the final peak, work backwards — which valleys seed it, which moments carry it, which earlier peak made it possible.</requirement>
  <requirement index="2" name="arc-count">Plan exactly ${arcTarget} arcs.</requirement>
  <requirement index="3" name="arc-slots-and-indexing">Every node (except pattern/warning) needs arcSlot (1-N). Indexes are chronological by arc — Arc 1 gets 0..N, Arc 2 N+1..M, etc. Within each arc, order by causal flow. Nodes with arcSlot &gt; currentArc are hidden from arc generation.</requirement>
  <requirement index="4" name="one-spine-anchor-per-arc">Exactly ${arcTarget} anchor nodes total — one peak OR valley per arc (not both) carrying arcIndex + sceneCount (3-12). Detail must explain WHY that length.</requirement>
  <requirement index="5" name="force-rhythm-via-composition">Shape each arc's force character through node mix — more fate for fate-dominant, more entities for world-dominant, more system for system-dominant. Don't write forceMode; vary composition.</requirement>
  <requirement index="6" name="peak-valley-rhythm">All-peaks is exhausting; all-valleys is all-setup. Aim for ~60/40 alternation, with the final arc typically peak-anchored.</requirement>
  <requirement index="7" name="thread-trajectories">Each thread needs spine nodes showing progression (peaks for culminations, valleys for pivots, moments for intermediate escalations).</requirement>
  <requirement index="8" name="chaos-present">Include chaos nodes where the plan benefits from something the existing world cannot produce. Chaos has arcSlot but NO entityId/threadId.</requirement>
  <requirement index="9" name="causal-web">Story causation is a web. Every node connects to multiple points. When an entity shapes the plan, show all the places it shapes. Single-touch nodes are under-represented.</requirement>
  <requirement index="10" name="pacing-balance">Mix arc sizes — not all the same length.</requirement>
  <requirement index="11" name="grounded-reasoning">Reasoning nodes reference specific character knowledge, relationships, artifacts, or world rules from context.</requirement>
  <requirement index="12" name="character-agency" critical="true">Character nodes reference ≥3 distinct entityIds across the plan. At least one arc driven by a non-protagonist. Every named character has at least one OUTGOING edge — acted-upon-without-agency = scenery, not character node.</requirement>
  <requirement index="13" name="system-constraints">Include system nodes showing HOW world rules shape outcomes.</requirement>
  <requirement index="14" name="warning-pattern-response" critical="true">Warnings and patterns structurally change the plan, not sit as ornaments. Warning's repetition broken by changing spine anchors, arc sizing, or composition; pattern's proposed shape adopted by at least one actual arc. Wire via edges — orphaned = dead weight.</requirement>
  <requirement index="15" name="every-thread-lands">Each thread resolves in a specific arc, or is explicitly carried past the plan. Net open threads trend toward closure by the final arc, not backlog.</requirement>
  <requirement index="16" name="no-twin-arcs">Each arc moves the story state-to-state. Two arcs with the same subject = one arc; merge or cut.</requirement>
  <requirement index="17" name="terminal-arc-commits">Final arc's anchor is a peak that closes threads, unless the summary explicitly declares the plan an opening movement.</requirement>
  <requirement index="18" name="novelty-over-recycling">Resolved threads mostly stay resolved — re-opening must be earned. Prefer new threads and new structural shapes across arcs. Sameness reads as drift.</requirement>
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

<per-arc-balance hint="Variation natural, extreme disparities not.">
  <guideline scope="early-mid">5-10 nodes (setup, plot, reasoning chains).</guideline>
  <guideline scope="late">4-8 nodes (convergence, escalation).</guideline>
  <guideline scope="final">3-6 nodes minimum (resolution, final reasoning).</guideline>
  <example type="good">Arc 1: 8, Arc 2: 7, Arc 3: 6, Arc 4: 7, Arc 5: 5 — balanced.</example>
  <example type="bad">Arc 1: 15, Arc 2: 8, Arc 3: 4, Arc 4: 3, Arc 5: 2 — front-loaded.</example>
</per-arc-balance>

<shape-of-good-plan>
  CAUSAL REASONING DIAGRAM, not a proof outline. Peaks converge from several causes. Entities matter in multiple places. Threads pull on other threads, get pulled by systems and chaos. Vertical-list-of-single-cause-single-effect = under-representing complexity. Good plans share entities across arcs, build peaks from multiple setups, let threads interact with rules and locations.
</shape-of-good-plan>

<final-instruction>Return ONLY the JSON object.</final-instruction>`;
}
