import type { PlanningProfile } from '@/types/narrative';

// ── Built-in Narrative Superstructure Profiles ──────────────────────────────
// Each profile defines a sequence of phases that populate the planning queue.
// Phase allocations are in scenes (6-9 per phase).
// Users can modify after populating.

export const BUILT_IN_PROFILES: PlanningProfile[] = [
  // ── The Hero's Journey (Campbell / Vogler) ──────────────────────────────
  {
    id: 'heros-journey',
    name: "Hero's Journey",
    description: 'The classic monomyth: departure, initiation, and return. A protagonist leaves the ordinary world, faces trials, and returns transformed.',
    builtIn: true,
    phases: [
      {
        name: 'Ordinary World',
        objective: 'The reader must FEEL the protagonist\'s ordinary life before it shatters. Establish deep routine — the morning rituals, the relationships that define them, the small frustrations that hint at something missing. Show the community, the rules they live by, the comfort zone they\'ll ache to return to. Plant at least one seed of the extraordinary (a rumour, an artifact, a dream) that the protagonist dismisses. The ordinary world must be vivid enough that its loss carries real weight.',
        sceneAllocation: 7,
        constraints: 'No direct encounter with the main conflict. The protagonist must not yet know what\'s coming.',
        worldExpansionHints: 'Home locations with sensory richness, daily-life characters who embody the status quo, mundane systems and social hierarchies the protagonist navigates',
      },
      {
        name: 'Call to Adventure',
        objective: 'A herald arrives — literally or metaphorically. The ordinary world is disrupted by an event, message, or encounter that cannot be ignored. The protagonist\'s reaction reveals their character: curiosity, fear, denial, excitement. The central thread is born. Other characters react differently to the same disruption, showing the stakes from multiple angles. The call must feel both terrifying and irresistible.',
        sceneAllocation: 6,
        constraints: 'The protagonist must NOT accept or commit to the journey yet. Resistance is essential.',
        worldExpansionHints: 'The herald/messenger character, the source of the call, the first glimpse of the extraordinary world',
      },
      {
        name: 'Refusal & Threshold',
        objective: 'The protagonist refuses, hesitates, or bargains. Show WHY — what they\'d lose, who depends on them, what terrifies them about the unknown. A mentor figure emerges to provide wisdom, tools, or the final push. The threshold crossing is a point of no return — burn the boats. The old world physically or emotionally closes behind them. This is the death of who they were.',
        sceneAllocation: 7,
        constraints: 'The protagonist MUST cross the threshold by the final scene. The mentor must not solve their problems — only equip them.',
        worldExpansionHints: 'The mentor character with depth and history, the threshold location (a literal boundary between worlds), the first glimpse of the special world beyond',
      },
      {
        name: 'Tests, Allies & Enemies',
        objective: 'The special world has different rules. Every scene should make the protagonist feel like a fish out of water learning to swim. Allies are earned through shared trial, not given freely. Enemies reveal themselves through action, not exposition. The protagonist fails tests before passing them — competence is built through humiliation. Subplots bloom as the ensemble deepens. The rules of this new world are learned through painful experience, not explanation.',
        sceneAllocation: 9,
        constraints: 'Do not resolve the central thread. The protagonist should grow but not yet be ready for the ordeal.',
        worldExpansionHints: 'Ally characters with their own agendas, enemy characters who are sympathetic, new locations that showcase the special world\'s beauty and danger, systems and rules that contrast with the ordinary world',
      },
      {
        name: 'Approach & Ordeal',
        objective: 'The innermost cave. Tension ratchets as the protagonist approaches the supreme challenge — the thing they\'ve been building toward. Strip away allies, resources, and confidence. The ordeal is a death-and-rebirth: the protagonist or something they love must appear to die (literally, symbolically, or spiritually). Multiple threads reach crisis simultaneously. The protagonist faces their deepest fear and is fundamentally broken open by it.',
        sceneAllocation: 8,
        constraints: 'At least one major thread must reach critical status. The ordeal must feel genuinely threatening — no easy victories.',
        worldExpansionHints: 'The innermost cave location (the most dangerous/sacred place in the special world), the supreme antagonist or obstacle revealed in full',
      },
      {
        name: 'Reward & Road Back',
        objective: 'The protagonist seizes the reward — but holding it burns. The elixir, knowledge, or power gained from surviving the ordeal comes with unexpected cost. The road back is not a victory lap — it\'s a chase, a countdown, or a dawning realisation that the reward has changed them in ways they didn\'t want. Alliances fracture under the weight of what was won. The ordinary world calls, but the protagonist is no longer the person who left it.',
        sceneAllocation: 7,
        constraints: 'The protagonist must not return home yet. New complications must arise from the reward itself.',
        worldExpansionHints: '',
      },
      {
        name: 'Resurrection & Return',
        objective: 'The final climactic test — not a repeat of the ordeal but its mirror. The protagonist must use everything they\'ve learned (from allies, from failure, from the ordeal) to face a challenge that requires who they\'ve BECOME, not who they were. This is the resurrection: the old self dies completely, the new self is born in fire. Then the return — carrying the elixir back to the ordinary world, which now looks different through transformed eyes. All threads converge and resolve. The final image should mirror the opening but with profound contrast.',
        sceneAllocation: 8,
        constraints: 'ALL major threads must reach terminal status. The transformation must be irreversible.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Three-Act Structure ─────────────────────────────────────────────────
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    description: 'The backbone of Western storytelling: setup, confrontation, resolution. Clean dramatic structure with two turning points.',
    builtIn: true,
    phases: [
      {
        name: 'Act I — Setup',
        objective: 'Establish the dramatic world with such clarity that the reader could predict what a "normal day" looks like — then shatter it. Introduce the protagonist through action, not description. Show relationships under mild stress to reveal character. Plant the thematic question the story will answer. The inciting incident must be a door that locks behind them. End Act I with the first turning point: the protagonist is locked into the central conflict with no way back. The reader must feel the click of the trap.',
        sceneAllocation: 7,
        constraints: 'The protagonist must not face the main antagonist directly yet.',
        worldExpansionHints: 'Core characters defined by their desires and flaws, primary locations that embody the thematic world, social and physical rules that will be tested',
      },
      {
        name: 'Act II — Confrontation',
        objective: 'The long middle. The protagonist pursues their goal against escalating opposition that is ALWAYS smarter than expected. Subplots develop fully — each one a thematic echo of the main thread. The midpoint revelation doesn\'t just raise stakes — it reframes the entire conflict. Fun and games give way to tightening nooses. The protagonist\'s initial approach fails catastrophically, forcing painful adaptation. Relationships deepen, betray, and transform. End with the "all is lost" moment — the darkest point where the reader genuinely believes the protagonist might not make it.',
        sceneAllocation: 9,
        constraints: 'Do not resolve the central conflict before the final act. The midpoint must genuinely reframe, not just escalate.',
        worldExpansionHints: 'Antagonist forces with depth and motivation, new locations that expand the world\'s reach, complications and secondary characters who pressure the protagonist from new angles',
      },
      {
        name: 'Act III — Resolution',
        objective: 'Armed with the truth learned at the "all is lost" moment, the protagonist makes their final stand. Every subplot, every planted seed, every relationship pays off or subverts. The climax is the thematic argument made visceral — the story\'s central question answered through action. The resolution establishes the new equilibrium and lets the reader feel the weight of everything that changed. The final image answers the opening image.',
        sceneAllocation: 7,
        constraints: 'ALL major threads must resolve. No deus ex machina — the climax must use only what was established.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Kishōtenketsu (East Asian) ──────────────────────────────────────────
  {
    id: 'kishotenketsu',
    name: 'Kishōtenketsu',
    description: 'A four-act structure from East Asian tradition. Introduction, development, twist, reconciliation. Notable for achieving narrative satisfaction without conflict as the primary engine.',
    builtIn: true,
    phases: [
      {
        name: 'Ki — Introduction',
        objective: 'Present the world as it IS, without judgement or foreshadowing of conflict. The reader settles into the rhythm of this world — its seasons, its customs, its quiet beauty. Characters are revealed through their daily patterns, their relationships, their small kindnesses and irritations. Every scene should deepen atmosphere and build the reader\'s emotional investment in the status quo. The world must feel so complete and alive that any change to it will be felt as significant.',
        sceneAllocation: 8,
        constraints: 'NO major conflict, antagonism, or foreshadowing of disruption. Pure establishment. The reader must feel the world is stable.',
        worldExpansionHints: 'Characters defined by their daily rhythms, locations rich in sensory and cultural detail, cultural systems and traditions that give the world its texture',
      },
      {
        name: 'Shō — Development',
        objective: 'Deepen without disrupting. Build on what Ki established — characters reveal new layers, relationships shift subtly, the world\'s details become richer. Patterns form that the reader comes to expect and enjoy. The development feels organic, not forced — like watching a garden grow. Introduce secondary characters and locations that add complexity without introducing conflict. The reader\'s understanding becomes layered and nuanced, creating expectations that Ten will later reframe.',
        sceneAllocation: 8,
        constraints: 'Maintain the established tone. Development must feel like natural deepening, not escalation. No dramatic shifts yet.',
        worldExpansionHints: 'Deeper layers of existing locations, secondary characters who enrich the social fabric, new details about existing systems and customs',
      },
      {
        name: 'Ten — Twist',
        objective: 'Introduce an element that makes the reader see EVERYTHING differently — not through conflict but through juxtaposition, revelation, or perspective shift. The familiar becomes strange. This could be a character from outside the established world, a discovery that recontextualises what came before, or a shift in time/perspective that reveals hidden dimensions. The twist must honour what was built in Ki and Shō while fundamentally reframing it. The reader should feel wonder, not betrayal.',
        sceneAllocation: 7,
        constraints: 'The twist must REFRAME, not destroy. It should deepen the reader\'s understanding of the world, not invalidate it. Avoid conflict-driven twists.',
        worldExpansionHints: 'The twist element — a perspective, character, location, or world concept that casts everything in new light',
      },
      {
        name: 'Ketsu — Reconciliation',
        objective: 'Harmonise the old understanding with the new. Characters process and integrate the twist — not by fighting it but by finding how the original world and the surprising element coexist. Arrive at a new understanding that is richer than either perspective alone. The world the reader loved in Ki is still there, but seen with new eyes. Resolution comes through acceptance and synthesis, not through victory or defeat. The final image should hold both the familiar and the strange in balance.',
        sceneAllocation: 7,
        constraints: 'No violent resolution. The ending must feel like arrival, not conquest.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Dan Harmon's Story Circle ───────────────────────────────────────────
  {
    id: 'story-circle',
    name: 'Story Circle',
    description: 'Dan Harmon\'s 8-step simplification of Campbell: You → Need → Go → Search → Find → Take → Return → Change. Cyclical and character-driven.',
    builtIn: true,
    phases: [
      {
        name: 'Comfort Zone',
        objective: 'Show the protagonist in their element so vividly that the reader understands their identity. This is who they ARE — their habits, their coping mechanisms, their blind spots, their small joys. The comfort zone is not just a place but a way of being. Establish what they think they want versus what they actually need (these must be different). The gap between want and need is the engine of the entire story.',
        sceneAllocation: 7,
        constraints: 'The protagonist must not yet recognise their need. Comfort is genuine, not ironic.',
        worldExpansionHints: 'The protagonist\'s familiar world — home, routine spaces, the people who enable their comfort zone',
      },
      {
        name: 'Need & Departure',
        objective: 'Something breaks the comfort zone — an external event that activates the internal need. The protagonist is pulled (or pushed) across a boundary into unfamiliar territory. The departure is messy, reluctant, and consequential. They bring their old coping mechanisms with them, which will fail spectacularly in the new context. Show what they leave behind — the departure must cost something real.',
        sceneAllocation: 7,
        constraints: 'The protagonist must cross into unfamiliar territory by end of phase. Their old approach must already show cracks.',
        worldExpansionHints: 'The catalyst that breaks the comfort zone, the unfamiliar world they enter, characters who embody what they need',
      },
      {
        name: 'Search & Adaptation',
        objective: 'The protagonist struggles because their old tools don\'t work here. Every attempt to use comfort-zone strategies fails. They search for what they want but keep stumbling into what they need. Relationships form through shared vulnerability, not shared competence. The new world\'s rules are learned through failure. Slowly, painfully, they begin to adapt — but each adaptation requires letting go of a piece of who they were.',
        sceneAllocation: 9,
        constraints: 'The protagonist must not find what they\'re looking for yet. Adaptation must feel costly.',
        worldExpansionHints: 'New allies who challenge the protagonist\'s assumptions, obstacles that specifically target their weaknesses, systems that reward new behaviour',
      },
      {
        name: 'Find & Pay',
        objective: 'The protagonist finds what they were looking for — and the price is devastating. Getting what they wanted requires becoming someone they\'re not sure they want to be. The cost reverberates through every relationship. This is the story\'s crucible: the moment where the protagonist must choose between their want and their need. The payment is not just sacrifice but transformation — they cannot unpay this price.',
        sceneAllocation: 7,
        constraints: 'There MUST be a meaningful, irreversible cost. No painless victories.',
        worldExpansionHints: '',
      },
      {
        name: 'Return & Change',
        objective: 'The protagonist returns to where they started — but they are fundamentally changed, and so is how they see the familiar world. The comfort zone that once defined them now feels too small. Relationships that once sustained them must be renegotiated from the position of who they\'ve become. The return is not a regression but a completion of the circle — the same place, a different person. All threads resolve in light of the transformation.',
        sceneAllocation: 7,
        constraints: 'The protagonist must be demonstrably and irreversibly different. The return must feel like completion, not repetition.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Save the Cat (Snyder) ──────────────────────────────────────────────
  {
    id: 'save-the-cat',
    name: 'Save the Cat',
    description: 'Blake Snyder\'s 15-beat screenplay structure condensed into key phases. Designed for tight, audience-tested pacing.',
    builtIn: true,
    phases: [
      {
        name: 'Opening & Theme',
        objective: 'Open with an image that captures the protagonist\'s world BEFORE the story changes it. Within these scenes, someone states the theme — the lesson the protagonist needs to learn — but the protagonist dismisses or doesn\'t understand it. The "save the cat" moment: show the protagonist doing something that makes the reader root for them despite their flaws. Establish the six things that need fixing in the protagonist\'s life.',
        sceneAllocation: 6,
        constraints: 'The theme must be stated explicitly by a character, but the protagonist must not understand it yet.',
        worldExpansionHints: 'The protagonist\'s world with its specific problems, supporting cast who embody the theme, the "stasis = death" elements',
      },
      {
        name: 'Catalyst & Debate',
        objective: 'The catalyst is a single, clear event that changes everything — a letter, a death, a meeting, a discovery. Then the DEBATE: the protagonist argues with themselves and others about whether to act. This is not passive — it\'s active resistance, bargaining, investigating alternatives. The debate reveals character through the specific reasons for hesitation. The audience should understand both the pull of the new path and the cost of taking it.',
        sceneAllocation: 6,
        constraints: 'The catalyst must be a single identifiable moment. The debate must end with a definitive break into Act II.',
        worldExpansionHints: 'The catalyst character or event, what\'s at stake if the protagonist acts AND if they don\'t',
      },
      {
        name: 'Fun & Games',
        objective: 'The PROMISE OF THE PREMISE delivered. If the premise is "a chef opens a restaurant" — show the cooking. If it\'s "a detective solves murders" — show the detecting. This is why the audience bought the ticket. Early victories, montages of competence, the joy of the new situation. The B-story (usually a love interest or friendship) begins here and carries the theme. The protagonist appears to be winning using their old approach, which makes the coming fall more devastating.',
        sceneAllocation: 8,
        constraints: 'Keep it fun and engaging. The protagonist should appear to be succeeding. Don\'t introduce the real threat yet.',
        worldExpansionHints: 'The new world the protagonist has entered, B-story characters who carry the theme, the fun of the premise made concrete and specific',
      },
      {
        name: 'Midpoint & Bad Guys Close In',
        objective: 'The MIDPOINT is a false victory or false defeat that raises the REAL stakes — the protagonist gets what they want (but not what they need) or loses everything (revealing what they actually need). Then the walls close in. External enemies tighten the noose while internal enemies (doubt, jealousy, ego) fracture the team from within. The protagonist\'s flaws, which were charming in Fun & Games, now become destructive. Every scene should feel like the situation is getting worse despite the protagonist\'s best efforts.',
        sceneAllocation: 9,
        constraints: 'The midpoint must genuinely REFRAME the conflict, not just escalate. The "bad guys" include internal flaws, not just external threats.',
        worldExpansionHints: 'Antagonist forces intensify and become personal, the real threat behind the surface threat becomes clear',
      },
      {
        name: 'All Is Lost & Dark Night',
        objective: 'Rock bottom. The mentor dies, the plan fails, the team splinters, hope evaporates. The "whiff of death" — something literally or figuratively dies to mark the gravity of the moment. The DARK NIGHT OF THE SOUL: the protagonist sits alone with the wreckage and must find the answer within themselves. The B-story delivers the theme\'s message one final time. The protagonist finally understands what they NEED (not what they want) — and the understanding hurts.',
        sceneAllocation: 6,
        constraints: 'The protagonist must face genuine despair. The thematic revelation must come from within, not from external rescue.',
        worldExpansionHints: '',
      },
      {
        name: 'Finale & Final Image',
        objective: 'Armed with the theme\'s truth, the protagonist STORMS THE CASTLE — both literally (executing a plan to defeat the external threat) and figuratively (applying the lesson to their internal flaw). The plan has high stakes and multiple components. Subplots converge. Every character gets their moment. The protagonist proves they\'ve changed by choosing differently than they would have at the start. The FINAL IMAGE mirrors the OPENING IMAGE but shows the transformation. The audience should feel the distance travelled.',
        sceneAllocation: 8,
        constraints: 'ALL major threads must resolve. The final image MUST contrast with the opening. The climax must test the theme.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Seven-Point Structure ──────────────────────────────────────────────
  {
    id: 'seven-point',
    name: 'Seven-Point Structure',
    description: 'Hook, Plot Turn 1, Pinch 1, Midpoint, Pinch 2, Plot Turn 2, Resolution. A tight framework for escalation and reversal.',
    builtIn: true,
    phases: [
      {
        name: 'Hook',
        objective: 'Show the protagonist in the OPPOSITE state from where they\'ll end. If the resolution is strength, the hook is weakness. If the resolution is isolation, the hook is connection. Make the contrast as stark as possible — the entire story is the journey between these two states. The hook must also be compelling on its own: the protagonist\'s current state must generate enough dramatic tension to pull the reader forward.',
        sceneAllocation: 7,
        constraints: 'The protagonist must embody the opposite of their final state. Do not hint at the resolution.',
        worldExpansionHints: 'The protagonist in their starting state, the world that enables/traps them there, the people who define this state',
      },
      {
        name: 'Plot Turn 1',
        objective: 'The event that sets the story in motion — the protagonist is thrust from their hook state into the conflict. This is the "call to adventure" but framed as a TURNING POINT: the story literally turns from one direction to another. The protagonist must react, and their reaction reveals character. The central dramatic question crystallises: will they achieve X or not? New forces, new stakes, new urgency.',
        sceneAllocation: 6,
        constraints: 'The turn must be a clear, identifiable moment that changes the trajectory.',
        worldExpansionHints: 'The inciting force, new characters or locations that embody the new direction',
      },
      {
        name: 'Pinch 1 & Midpoint',
        objective: 'PINCH 1: Pressure from antagonistic forces compels the protagonist to act — they can no longer passively react. Something bad happens that raises stakes and eliminates options. Then the MIDPOINT: the protagonist shifts from REACTIVE to PROACTIVE. They stop running and start fighting. They stop avoiding and start pursuing. This is the story\'s fulcrum — everything before was setup, everything after is payoff. The protagonist commits fully to their goal for the first time.',
        sceneAllocation: 9,
        constraints: 'The protagonist must visibly transition from reactive to proactive. The midpoint must feel like a point of no return.',
        worldExpansionHints: 'The source of pinch pressure, what enables and demands the protagonist\'s shift to proactive',
      },
      {
        name: 'Pinch 2 & Plot Turn 2',
        objective: 'PINCH 2: Maximum pressure. Everything falls apart. Allies are lost, plans fail, the antagonist seems unstoppable. The protagonist is at their lowest. Then PLOT TURN 2: the final piece of the puzzle falls into place. The protagonist discovers the key — a piece of knowledge, a hidden strength, a sacrifice they\'re willing to make — that enables the climax. They now have everything they need, but the cost of using it is clear.',
        sceneAllocation: 8,
        constraints: 'The "key" that enables the climax must have been planted earlier. No new elements in the final turn.',
        worldExpansionHints: '',
      },
      {
        name: 'Resolution',
        objective: 'The climax: the protagonist uses everything they\'ve gained to face the final challenge. They are now in the OPPOSITE state from the hook — the transformation is complete and visible. All threads resolve. The resolution isn\'t just "they won" — it\'s "they became someone who COULD win." The new normal is established and the consequences are felt across every relationship and thread.',
        sceneAllocation: 7,
        constraints: 'ALL major threads must resolve. The protagonist\'s final state must clearly mirror/contrast the hook.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Freytag's Pyramid ─────────────────────────────────────────────────
  {
    id: 'freytags-pyramid',
    name: "Freytag's Pyramid",
    description: 'The classic five-act dramatic structure: exposition, rising action, climax, falling action, denouement.',
    builtIn: true,
    phases: [
      {
        name: 'Exposition',
        objective: 'Lay every foundation the rising action will test. Introduce characters through their desires and fears, not through description. Establish the world\'s rules so the audience knows what "normal" looks like and can feel when things go wrong. Plant the seeds of every thread that will pay off later — Chekhov\'s guns loaded and placed. The dramatic situation must be clear: who wants what, and what stands in their way.',
        sceneAllocation: 7,
        constraints: 'No major conflict escalation yet. Every element introduced must serve the rising action.',
        worldExpansionHints: 'Core characters with clear desires, primary locations that will become contested spaces, the world\'s rules and tensions that will be exploited',
      },
      {
        name: 'Rising Action',
        objective: 'Complications multiply with each scene. The protagonist\'s initial approach meets resistance, forcing adaptation. Each complication raises stakes AND closes escape routes. Subplots interweave with the main thread — pressure from multiple directions simultaneously. The pace of escalation should feel inexorable: each scene\'s ending creates the next scene\'s problem. Tension builds not just in plot but in relationships, in the world\'s systems, in the protagonist\'s psyche.',
        sceneAllocation: 9,
        constraints: 'Each scene must escalate tension. No relief or resolution until the climax.',
        worldExpansionHints: 'Complications with faces and names, secondary characters who embody different pressures, new locations where stakes play out',
      },
      {
        name: 'Climax',
        objective: 'The PEAK of the pyramid. Maximum tension, maximum stakes, maximum consequence. Every thread reaches its crisis point simultaneously. The protagonist makes the defining choice — the one that reveals who they truly are. The outcome is uncertain until the final moment. Multiple threads collide at maximum intensity. This is not just the biggest action sequence — it\'s the moment where the story\'s central question is answered through irreversible action.',
        sceneAllocation: 7,
        constraints: 'At least one major thread must reach terminal status. The climax must feel like the inevitable result of everything that came before.',
        worldExpansionHints: '',
      },
      {
        name: 'Falling Action',
        objective: 'The consequences of the climactic choice ripple outward through every relationship and thread. Characters react, adjust, grieve, celebrate. The new order begins to take shape, but it\'s not yet stable. Remaining conflicts resolve not with bangs but with the quiet weight of aftermath. Show what was won and what was lost — the cost of the climax made visible in human terms.',
        sceneAllocation: 6,
        constraints: 'No new major complications. This is processing and resolution, not escalation.',
        worldExpansionHints: '',
      },
      {
        name: 'Denouement',
        objective: 'Final resolution. Every loose end tied with care. The new normal is established — and it must feel EARNED, not just stated. Characters are shown in their new equilibrium: changed, scarred, wiser, or broken. The final moments should resonate with thematic weight. The story reaches its conclusion not with a period but with a breath — the reader should feel the story settling into its final shape.',
        sceneAllocation: 6,
        constraints: 'ALL threads must reach terminal status. No ambiguity in resolution — the story must feel complete.',
        worldExpansionHints: '',
      },
    ],
  },
];

/** Look up a built-in profile by ID */
export function getProfile(id: string): PlanningProfile | undefined {
  return BUILT_IN_PROFILES.find((p) => p.id === id);
}

/** Create a PlanningQueue from a profile */
export function profileToQueue(profile: PlanningProfile): import('@/types/narrative').PlanningQueue {
  return {
    profileId: profile.id,
    phases: profile.phases.map((p, i) => ({
      id: `phase-${i}`,
      name: p.name,
      objective: p.objective,
      sceneAllocation: p.sceneAllocation,
      scenesCompleted: 0,
      status: i === 0 ? 'active' : 'pending',
      constraints: p.constraints,
      direction: '',
      worldExpansionHints: p.worldExpansionHints,
    })),
    activePhaseIndex: 0,
  };
}
