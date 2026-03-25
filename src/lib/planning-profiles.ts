import type { PlanningProfile } from '@/types/narrative';

// ── Built-in Narrative Superstructure Profiles ──────────────────────────────
//
// Two categories:
//   COMPLETE — structures that tell a full, self-contained story
//   EPISODIC — structures for volumes within a long-running series
//
// Each profile defines a sequence of phases that populate the planning queue.

export const BUILT_IN_PROFILES: PlanningProfile[] = [

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETE STORIES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Three-Act Structure ─────────────────────────────────────────────────
  {
    id: 'three-act',
    name: 'Three-Act Structure',
    description: 'Setup, confrontation, resolution. The backbone of Western storytelling with two turning points.',
    category: 'complete',
    builtIn: true,
    phases: [
      {
        name: 'Act I — Setup',
        objective: 'Establish the dramatic world with such clarity that the reader could predict what a "normal day" looks like — then shatter it. Introduce the protagonist through action. Show relationships under mild stress to reveal character. Plant the thematic question. End with the first turning point: the protagonist is locked into the central conflict with no way back.',
        sceneAllocation: 7,
        constraints: 'The protagonist must not face the main antagonist directly yet.',
        worldExpansionHints: 'Core characters defined by desires and flaws, primary locations, social and physical rules that will be tested',
      },
      {
        name: 'Act II — Confrontation',
        objective: 'The protagonist pursues their goal against escalating opposition. Subplots develop as thematic echoes. The midpoint revelation reframes the entire conflict. Fun and games give way to tightening nooses. The protagonist\'s initial approach fails, forcing adaptation. End with the "all is lost" moment — the darkest point.',
        sceneAllocation: 9,
        constraints: 'Do not resolve the central conflict. The midpoint must reframe, not just escalate.',
        worldExpansionHints: 'Antagonist forces with depth, new locations, complications that pressure from new angles',
      },
      {
        name: 'Act III — Resolution',
        objective: 'Armed with truth learned at rock bottom, the protagonist makes their final stand. Every subplot, seed, and relationship pays off or subverts. The climax answers the thematic question through action. The final image mirrors the opening with profound contrast.',
        sceneAllocation: 7,
        constraints: 'ALL major threads must resolve. No deus ex machina — only what was established.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Kishōtenketsu (East Asian) ──────────────────────────────────────────
  {
    id: 'kishotenketsu',
    name: 'Kishōtenketsu',
    description: 'Introduction, development, twist, reconciliation. Achieves narrative satisfaction without conflict as the primary engine.',
    category: 'complete',
    builtIn: true,
    phases: [
      {
        name: 'Ki — Introduction',
        objective: 'Present the world as it IS. The reader settles into its rhythm — seasons, customs, quiet beauty. Characters are revealed through daily patterns and relationships. Every scene deepens atmosphere and emotional investment in the status quo. The world must feel so alive that any change will be felt.',
        sceneAllocation: 8,
        constraints: 'No major conflict or foreshadowing of disruption. Pure establishment.',
        worldExpansionHints: 'Characters defined by daily rhythms, locations rich in sensory detail, cultural traditions',
      },
      {
        name: 'Shō — Development',
        objective: 'Deepen without disrupting. Characters reveal new layers, relationships shift subtly, the world\'s details become richer. Patterns form that the reader expects and enjoys. The development feels organic — like watching a garden grow. Build the expectations that Ten will reframe.',
        sceneAllocation: 8,
        constraints: 'Maintain tone. Development must feel like natural deepening, not escalation.',
        worldExpansionHints: 'Deeper layers of existing locations, secondary characters who enrich the social fabric',
      },
      {
        name: 'Ten — Twist',
        objective: 'An element that makes the reader see everything differently — not through conflict but through juxtaposition, revelation, or perspective shift. The familiar becomes strange. This could be a character from outside, a discovery that recontextualises what came before, or a shift in time/perspective. The twist must honour Ki and Shō while fundamentally reframing them.',
        sceneAllocation: 7,
        constraints: 'The twist must reframe, not destroy. Deepen understanding, not invalidate it.',
        worldExpansionHints: 'The twist element — a perspective, character, or concept that casts everything in new light',
      },
      {
        name: 'Ketsu — Reconciliation',
        objective: 'Harmonise old understanding with new. Characters process and integrate the twist by finding how the original world and the surprising element coexist. Arrive at a richer understanding. The final image holds both the familiar and the strange in balance.',
        sceneAllocation: 7,
        constraints: 'No violent resolution. The ending must feel like arrival, not conquest.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Hero's Journey ──────────────────────────────────────────────────────
  {
    id: 'heros-journey',
    name: "Hero's Journey",
    description: 'Departure, initiation, return. The monomyth: a protagonist leaves the ordinary world, faces trials, and returns transformed.',
    category: 'complete',
    builtIn: true,
    phases: [
      {
        name: 'Ordinary World & Call',
        objective: 'The reader must feel the protagonist\'s ordinary life before it shatters. Establish routine, relationships, comfort zone. Plant one seed of the extraordinary that the protagonist dismisses. Then the call arrives — a disruption that cannot be ignored. The protagonist resists, but a mentor provides the final push. The threshold crossing is a point of no return.',
        sceneAllocation: 8,
        constraints: 'The protagonist must cross the threshold by end of phase. The mentor must not solve their problems.',
        worldExpansionHints: 'Home locations, daily-life characters, the mentor, the threshold between worlds',
      },
      {
        name: 'Tests & Allies',
        objective: 'The special world has different rules. The protagonist is a fish out of water. Allies are earned through trial. Enemies reveal themselves through action. The protagonist fails before succeeding — competence is built through humiliation. The rules of the new world are learned through experience, not explanation.',
        sceneAllocation: 9,
        constraints: 'Do not resolve the central thread. The protagonist should grow but not be ready for the ordeal.',
        worldExpansionHints: 'Allies with their own agendas, enemies who are sympathetic, locations that showcase the special world',
      },
      {
        name: 'Ordeal & Reward',
        objective: 'The innermost cave. Strip away allies, resources, confidence. The ordeal is death-and-rebirth: something must appear to die. Multiple threads reach crisis. The protagonist faces their deepest fear. Then seize the reward — but holding it burns. The elixir comes with unexpected cost. Alliances fracture under the weight of what was won.',
        sceneAllocation: 8,
        constraints: 'At least one thread must reach critical. The ordeal must feel genuinely threatening.',
        worldExpansionHints: 'The innermost cave location, the supreme antagonist revealed in full',
      },
      {
        name: 'Resurrection & Return',
        objective: 'The final test — not a repeat of the ordeal but its mirror. The protagonist uses everything they\'ve learned to face a challenge that requires who they\'ve become. The old self dies, the new self is born. Then return — carrying the elixir back. The ordinary world looks different through transformed eyes. All threads converge.',
        sceneAllocation: 8,
        constraints: 'ALL major threads must resolve. The transformation must be irreversible.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Tragedy ──────────────────────────────────────────────────────────────
  {
    id: 'tragedy',
    name: 'Tragedy',
    description: 'A protagonist undone by their own flaw. Rise, hubris, fall, catastrophe. The audience sees the crack before the character does.',
    category: 'complete',
    builtIn: true,
    phases: [
      {
        name: 'Greatness & Flaw',
        objective: 'Establish the protagonist at their peak — admired, capable, in control. But embed the fatal flaw so deeply that the reader can see it even when the character cannot. The flaw should be inseparable from their strength: ambition that becomes obsession, loyalty that becomes blindness, intelligence that becomes arrogance. Show the world they\'ve built and the people who depend on them.',
        sceneAllocation: 8,
        constraints: 'The protagonist must appear to be winning. The flaw should be visible to the reader but not to the character.',
        worldExpansionHints: 'The protagonist\'s domain, the people who admire and depend on them, the systems they control',
      },
      {
        name: 'Hubris & Warnings',
        objective: 'The protagonist makes the choice that will destroy them — and it looks like brilliance at the time. Warnings come from allies, omens, or consequences, but the protagonist dismisses them because their flaw won\'t let them see. Each scene tightens the noose while the protagonist celebrates. The audience should feel dread growing beneath the surface of success.',
        sceneAllocation: 8,
        constraints: 'The protagonist must actively ignore or dismiss at least two clear warnings. No self-awareness yet.',
        worldExpansionHints: 'Characters who see the danger and try to warn, the consequences beginning to form',
      },
      {
        name: 'Reversal & Recognition',
        objective: 'The reversal: everything built collapses because of the flaw. The recognition: the protagonist finally sees what the audience has seen all along. These two moments should be devastating and closely linked. Allies turn, structures crumble, the protagonist\'s self-image shatters. The recognition is not redemption — it\'s the horror of understanding too late.',
        sceneAllocation: 8,
        constraints: 'The reversal must be caused by the protagonist\'s own choices, not external bad luck.',
        worldExpansionHints: '',
      },
      {
        name: 'Catastrophe',
        objective: 'The final consequences play out. The protagonist faces the full weight of what their flaw has wrought — on themselves, on everyone they loved, on the world they built. There is no rescue. The ending should feel inevitable in retrospect — every seed planted in Act I blooms here. The final image should haunt.',
        sceneAllocation: 7,
        constraints: 'No redemptive twist. The tragedy must land with full weight. ALL threads reach terminal status.',
        worldExpansionHints: '',
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // EPISODIC SERIES
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Episodic Volume (Harry Potter model) ────────────────────────────────
  {
    id: 'episodic-volume',
    name: 'Episodic Volume',
    description: 'A self-contained volume within a larger series. Each volume has its own arc and antagonist while advancing the overarching story. Modelled after Harry Potter.',
    category: 'episodic',
    builtIn: true,
    phases: [
      {
        name: 'Return & Reorientation',
        objective: 'Reintroduce the world after the gap between volumes. Show how characters have changed since last time. Establish the status quo of THIS volume — new year, new setting, new dynamics. Reactivate dormant threads from previous volumes through small signals. Introduce the volume\'s unique hook — a mystery, a new character, an unusual event that will drive this particular story.',
        sceneAllocation: 7,
        constraints: 'Do not resolve overarching series threads. This phase re-establishes, not concludes.',
        worldExpansionHints: 'New characters specific to this volume, new locations or changes to familiar ones, the volume\'s unique element',
      },
      {
        name: 'Investigation & Escalation',
        objective: 'The volume\'s central mystery or conflict deepens. Characters investigate, train, experiment, and make mistakes. Red herrings and false leads create complexity. Relationships evolve — new alliances form, old ones are tested. The overarching series threat surfaces briefly but is misunderstood or dismissed. Subplots unique to this volume develop alongside the main thread.',
        sceneAllocation: 9,
        constraints: 'Do not reveal the volume\'s central truth yet. Keep the overarching threat in the background.',
        worldExpansionHints: 'Suspects and red herrings, new world-building elements unique to this volume\'s theme, locations that serve the investigation',
      },
      {
        name: 'Convergence & Revelation',
        objective: 'Everything crashes together. The volume\'s mystery is solved but the answer is worse than expected. The overarching series threat is directly connected to the volume\'s conflict — revealing a larger pattern. Allies are separated or compromised. The protagonist must face the volume\'s climax with limited support. Key relationships reach turning points.',
        sceneAllocation: 8,
        constraints: 'The volume\'s central conflict must reach crisis. At least one overarching thread must escalate.',
        worldExpansionHints: '',
      },
      {
        name: 'Climax & New Equilibrium',
        objective: 'The volume\'s antagonist or challenge is confronted. The protagonist wins but at cost — something is lost, learned, or irrevocably changed. The volume\'s threads resolve while the overarching series threads advance one step. End with a new equilibrium that is both satisfying (this volume\'s story is complete) and open (the series continues with higher stakes). Plant seeds for the next volume.',
        sceneAllocation: 7,
        constraints: 'Volume-specific threads must resolve. Series threads must advance but NOT resolve.',
        worldExpansionHints: '',
      },
    ],
  },

  // ── Escalation Arc (Reverend Insanity / progression model) ─────────────
  {
    id: 'escalation-arc',
    name: 'Escalation Arc',
    description: 'A volume within a power-progression series. Each arc raises the stakes, expands the world, and forces the MC to evolve. Modelled after Reverend Insanity and cultivation fiction.',
    category: 'episodic',
    builtIn: true,
    phases: [
      {
        name: 'Foundation & Scheming',
        objective: 'Establish the MC\'s current position, resources, and immediate goals. Show the power structure they must navigate — who controls what, who threatens them, what opportunities exist. The MC begins executing a plan that requires deception, patience, or hidden preparation. Introduce the arc\'s primary rival or obstacle. The world-building should reveal the RULES of this level — what power looks like here, what it costs, who has it.',
        sceneAllocation: 8,
        constraints: 'The MC must not achieve their main goal yet. Establish the power gap they need to close.',
        worldExpansionHints: 'The local power structure — factions, authorities, rivals. New locations showing this tier of the world. Systems and rules that govern advancement.',
      },
      {
        name: 'Manoeuvring & Conflict',
        objective: 'The MC\'s plans collide with opposition. Rivals make moves. Alliances are tested by competing interests. The MC must adapt — their initial plan is disrupted, forcing improvisation. Show the MC\'s intelligence and ruthlessness through how they handle setbacks. Resources are gained and spent. The arc\'s central conflict escalates through a series of confrontations, betrayals, and calculated risks.',
        sceneAllocation: 9,
        constraints: 'The MC should suffer real setbacks. Victories must come at cost. No one-sided dominance.',
        worldExpansionHints: 'Enemy factions in detail, contested locations, resources and treasures at stake',
      },
      {
        name: 'Crisis & Breakthrough',
        objective: 'Everything comes to a head. The MC faces their most dangerous situation in this arc — cornered, outnumbered, or outmatched. Survival requires using everything accumulated: knowledge, allies, hidden preparations, and desperate gambles. The MC breaks through to the next level — a power advancement, a crucial resource secured, or a rival eliminated. But the breakthrough attracts attention from higher powers.',
        sceneAllocation: 8,
        constraints: 'The MC must face genuine mortal danger. The breakthrough must feel earned by accumulated preparation.',
        worldExpansionHints: '',
      },
      {
        name: 'Consolidation & Departure',
        objective: 'The MC consolidates their gains — securing territory, allies, or knowledge. The aftermath of the crisis reshapes the local power structure. Loose threads from this arc resolve: debts are paid, enemies are handled, allies are rewarded or discarded. But the world expands — the MC glimpses the next level, the larger game, the more powerful players. End with departure toward the next arena, carrying everything learned.',
        sceneAllocation: 7,
        constraints: 'Arc-specific threads must resolve. The next arena must be established but not entered.',
        worldExpansionHints: 'Hints of the next tier — more powerful factions, larger territories, higher-level systems',
      },
    ],
  },

  // ── Ensemble Expansion (Game of Thrones model) ─────────────────────────
  {
    id: 'ensemble-expansion',
    name: 'Ensemble Expansion',
    description: 'A volume in a multi-POV series. Each arc weaves parallel storylines that slowly converge. Modelled after A Song of Ice and Fire.',
    category: 'episodic',
    builtIn: true,
    phases: [
      {
        name: 'Scattered Threads',
        objective: 'Establish 2-3 parallel storylines in different locations with different characters. Each POV has their own immediate goal, local conflict, and thematic concern. Show the world\'s breadth — each location has its own culture, politics, and dangers. Plant connections between storylines that the characters don\'t yet see. The reader builds a map of the world through multiple perspectives.',
        sceneAllocation: 9,
        constraints: 'Keep storylines separate. Characters from different threads should not meet yet. Build geographic and thematic distance.',
        worldExpansionHints: 'Multiple distinct locations with their own cast, politics, and atmosphere. Each POV needs 3-4 local characters.',
      },
      {
        name: 'Escalation & Echoes',
        objective: 'Each storyline intensifies independently. Decisions in one thread create ripple effects felt in others — a war declared here changes trade routes there, a betrayal in one court is echoed by loyalty in another. The thematic parallels between storylines become clear to the reader but not to the characters. Raise the stakes for each POV to the point where they can no longer solve their problems alone.',
        sceneAllocation: 9,
        constraints: 'Storylines should echo each other thematically but remain physically separate. No premature convergence.',
        worldExpansionHints: 'The connective tissue — messengers, rumours, trade goods, refugees that link separate worlds',
      },
      {
        name: 'Collision & Fallout',
        objective: 'Storylines begin to collide. Characters from separate threads meet, ally, or clash. The connections planted earlier pay off — the reader sees the full picture before the characters do. At least one storyline reaches its climax while others are mid-escalation. A major character death, betrayal, or revelation reshapes the landscape for everyone. The world feels smaller as distant events become personal.',
        sceneAllocation: 8,
        constraints: 'At least one POV thread must reach crisis. Not all storylines converge — some remain independent for future volumes.',
        worldExpansionHints: '',
      },
      {
        name: 'New Landscape',
        objective: 'The dust settles into a new configuration. Some characters are in better positions, others worse, some are gone. Each surviving storyline has a new trajectory informed by the collision. Plant the seeds of the next volume\'s conflicts — new alliances are fragile, new enemies are revealed, new territories become relevant. End with each POV facing their next challenge, leaving the reader unable to stop.',
        sceneAllocation: 7,
        constraints: 'Resolve at least one major thread completely. Leave 2-3 threads deliberately open for the next volume.',
        worldExpansionHints: 'The reshaped power map, new factions emerging from the collision, hints of threats beyond the current scope',
      },
    ],
  },

  // ── Mystery / Case Series ──────────────────────────────────────────────
  {
    id: 'mystery-case',
    name: 'Mystery / Case Series',
    description: 'Each volume is a self-contained case while a deeper conspiracy unfolds across the series. Modelled after detective fiction and procedurals.',
    category: 'episodic',
    builtIn: true,
    phases: [
      {
        name: 'The Hook',
        objective: 'A body drops, a crime is discovered, or an impossible situation presents itself. The case must be compelling enough to drive the volume on its own — a puzzle the reader wants solved. Introduce the case through its impact on real people, not as an abstract problem. Reintroduce the recurring cast through their reactions. Plant the first clue and the first red herring simultaneously.',
        sceneAllocation: 6,
        constraints: 'The solution must not be guessable yet. Establish the rules of this case\'s world.',
        worldExpansionHints: 'The victim and their world, the crime scene location, witnesses and suspects specific to this case',
      },
      {
        name: 'Investigation',
        objective: 'Follow the evidence. Each scene should reveal something — a clue, a lie, a connection — while raising new questions. The investigator\'s methods and personality drive the pacing. Suspects emerge with plausible motives. The case appears to be one thing but is actually another. Weave in the series-level thread: a detail from this case connects to the larger conspiracy, noticed but not yet understood.',
        sceneAllocation: 9,
        constraints: 'No premature solution. Each suspect must be genuinely plausible. The series thread must advance subtly.',
        worldExpansionHints: 'Suspects with depth and motive, locations tied to the investigation, the world of the victim',
      },
      {
        name: 'Complication & Reversal',
        objective: 'The initial theory is wrong. A twist reframes the evidence — what looked like motive was cover, what looked like alibi was deception. The case becomes personal: the investigator or someone close to them is drawn into danger. The series-level conspiracy surfaces enough to obstruct or complicate the case. Stakes escalate from "solve the puzzle" to "survive the truth."',
        sceneAllocation: 8,
        constraints: 'The reversal must be fair — clues for the real answer must have been planted. The case must become personal.',
        worldExpansionHints: '',
      },
      {
        name: 'Resolution & Unease',
        objective: 'The case is solved. The reveal should recontextualise everything — the reader sees how the clues fit together. Justice is served, partially or fully, but the series-level thread leaves a residue of unease. The investigator is changed by what they learned. End with satisfaction for this volume\'s mystery and dread for what\'s accumulating beneath the surface.',
        sceneAllocation: 7,
        constraints: 'The case must be fully resolved. The series conspiracy must advance but NOT resolve.',
        worldExpansionHints: 'Hints of the larger conspiracy — a name, a pattern, a connection to a previous volume',
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
