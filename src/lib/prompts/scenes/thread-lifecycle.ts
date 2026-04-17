/**
 * Thread Lifecycle Prompts and Helper Functions
 *
 * CONCEPTUAL MODEL: Threads are CONTESTED GAMES.
 * Each thread is a question with multiple participants who have different
 * optimal answers. The lifecycle tracks the game state; the log tracks
 * the moves. Resolution is the equilibrium — the answer the game
 * converges toward. Subversion is an equilibrium break.
 */

import { THREAD_TERMINAL_STATUSES } from '@/types/narrative';
import type { NarrativeState } from '@/types/narrative';
import { THREAD_LIFECYCLE_DOC } from '@/lib/ai/context';
import { ENTITY_LOG_CONTEXT_LIMIT } from '@/lib/constants';

/**
 * Generate thread lifecycle documentation prompt.
 */
export function promptThreadLifecycle(): string {
  return `
THREADS ARE CONTESTED GAMES — each thread is a question whose participants want different answers.
A compelling thread has STAKES (what's at risk), UNCERTAINTY (outcome not obvious), INVESTMENT (we care about the answer), and ASYMMETRY (participants have different optimal outcomes).
The register of the question adapts to the work:
  - Narrative (fiction, memoir): dramatic questions about consequence, identity, choice.
  - Argument (paper, essay, criticism): claims whose truth, scope, or priority is in contention.
  - Inquiry (investigation, reportage, exploration): questions about what happened, how it works, what follows.
  Weak (any register): "Will [Name] go to the store?" — too plain to carry an arc unless the form deliberately rewards such flatness (picaresque, satirical, ironic open-inquiry).
  Strong (narrative): "Can Ayesha clear her grandfather's name before the tribunal ends?" (stakes, uncertainty, investment)
  Strong (narrative, lyric register): "What does the river remember of the flood, and does the narrator want to know?"
  Strong (argument): "Does the proposed mechanism explain the anomalies the prior model cannot?" (falsifiable, non-obvious)
  Strong (argument, criticism): "Can poststructuralist close reading account for silence as resistance in this corpus?" (disputed, high investment)
  Strong (inquiry): "What role did diaspora networks play in the movement before digital coordination?" (open, evidence-driven)
Frame threads as questions. Thread logs track incremental answers — the moves in the game — over time.

GAME-THEORETIC THINKING — every thread is a game between its participants.

  Each participant wants a different resolution. The register determines who the players are:
  - Narrative: characters with incompatible goals. In "Can Fang Yuan navigate the shifting political landscape?", Fang Yuan wants freedom of action; Chi Lian wants clan control; Fang Zheng wants moral vindication. Incompatible equilibria.
  - Argument: competing claims, methods, or frameworks. In "Does the proposed mechanism explain the anomalies?", the new model and the prior model are players — evidence that supports one weakens the other. The thread resolves when one framework dominates or a synthesis reconciles both.
  - Inquiry: hypotheses, evidence streams, or stakeholders. In "What role did diaspora networks play?", different explanatory threads compete — economic, cultural, political accounts each pull toward a different conclusion.

  The thread resolves when one player's strategy dominates, a coalition forces a compromise, or a synthesis absorbs the competing positions.

  COOPERATION vs DEFECTION within threads:
  - Two participants COOPERATE when both benefit from the thread advancing (two characters sharing resources for different reasons; two lines of evidence converging on the same conclusion; two methods producing consistent results).
  - A participant DEFECTS when they benefit from the thread stalling or subverting (a character sabotaging progress; a counterexample that undermines the emerging thesis; a stakeholder blocking inquiry to protect interests).
  - The richest threads have MIXED equilibria — participants cooperate on some dimensions and defect on others simultaneously. A character gives aid while quietly gathering intelligence against the recipient. A piece of evidence supports the main claim but introduces a qualifier that weakens a supporting argument. A method validates the hypothesis but reveals a boundary condition the framework can't explain.

  INFORMATION ASYMMETRY — the most powerful game-theoretic force:
  - Who knows what? An agent acting on private information is making a strategic move others can't counter. In fiction: hidden knowledge, secrets, concealed motives. In argument: evidence not yet presented, unpublished findings, unstated assumptions. In inquiry: sources not yet consulted, data not yet analysed.
  - Hidden knowledge creates LEVERAGE — possessing what others lack changes the payoff matrix.
  - Reveals and twists are symmetry-breaking events — suddenly all players see the same board, and the equilibrium shifts. In fiction: a secret exposed. In argument: a decisive experiment published. In inquiry: a key document surfacing.

  COMMITMENT as strategic move — escalating isn't just "stakes rising", it's a player making an IRREVERSIBLE investment. In fiction: a public declaration, a burned bridge, a sacrifice. In argument: a strong claim that narrows future positions ("we argue X is the ONLY explanation"). In inquiry: a methodological choice that forecloses alternative approaches. The commitment constrains the player's OWN future moves (which paradoxically strengthens their position by making threats or claims credible).

  COALITION and DEFECTION across threads — participants in overlapping threads form implicit alliances. Advancing one thread may affect the game state of another where participants overlap. Defection is when a coalition partner breaks alignment for private gain — in fiction, betrayal; in argument, an author's own evidence undermining their earlier claim; in inquiry, a source contradicting their prior testimony.

PAIRWISE PAYOFF THINKING — every thread decomposes into pairwise 2-player games. Each player has two concrete actions (not abstract "cooperate/defect" — real choices in context). The four combinations create a 2×2 payoff matrix. Each player scores each outcome 0-4.

  FICTION — players are characters with competing or aligned goals:
    Thread: "Can Ruo Lan uncover Fang Yuan's secret?"
    Fang Yuan: "maintains concealment" vs "reveals voluntarily"
    Ruo Lan: "trusts appearances" vs "investigates actively"
    The payoff matrix captures what happens under each combination — deception succeeds, investigation pays off, redundant effort, or cat-and-mouse escalation.

  NON-FICTION — players are claims, methods, frameworks, or stakeholders:
    Thread: "Does attention outperform recurrence for sequence modelling?"
    Attention mechanism: "demonstrates clear advantage" vs "fails on edge cases"
    Recurrence: "concedes limitations" vs "presents compensating strengths"
    The matrix captures the evidence landscape — clean paradigm shift, contested result, mixed findings, or inconclusive fragmentation.

    Thread: "Can the proposed taxonomy capture the full range of narrative structures?"
    New taxonomy: "covers all observed cases" vs "misses critical edge cases"
    Prior framework: "acknowledged as incomplete" vs "shown to handle what new one misses"

  In both registers: the payoff ordering IS the strategic structure. Don't label the game — reason about who prefers which outcomes and why. The structure may SHIFT across the lifecycle — an escalation changes the cost of each action.

  A single-participant thread (player vs environment/difficulty) is NOT a game — it's a challenge. No strategic opponent, only obstacles.

THREAD LIFECYCLE AS GAME STATE: latent → seeded → active → escalating → critical → resolved/subverted
${THREAD_LIFECYCLE_DOC}
Terminal: ${THREAD_TERMINAL_STATUSES.map((s) => `"${s}"`).join(', ')}.

STAGES (as game progression):
  latent (game defined, not yet played)  → the strategic situation exists but players haven't engaged
  seeded (opening moves made)            → players have taken initial positions; the game is live
  active (mid-game, moves accumulating)  → strategies are being pursued, payoffs are becoming visible
  escalating (COMMITTED, high stakes)    → players have invested enough that retreat is costlier than pressing on
  critical (endgame, resolution imminent) → the equilibrium is about to be determined
Terminal: resolved = stable equilibrium reached (one strategy dominated, or players settled on a cooperative outcome);
subverted = equilibrium broken (a defection, twist, or information reveal overturned what seemed settled).

COMMITMENT: Below escalating = players can exit cheaply (abandon). At escalating+ = exit costs exceed continuation costs; must resolve.
  Prune stale threads (5+ scenes silent, below escalating). Keep 3-6 committed; 10+ = noise.
  Touch 2-4 threads per scene. Committed threads have priority.

THREAD LOG PRIMITIVES AS GAME MOVES:
  pulse       → position maintained (no player moved; tension holds)
  transition  → game state changed (a player made a move that shifted the board)
  setup       → a player is investing in future payoff (forward-looking commitment)
  escalation  → stakes raised (a player is making retreat costlier for everyone)
  payoff      → a prior investment pays off (cooperative return on commitment)
  twist       → information asymmetry exploited or revealed (the board changes shape)
  callback    → reputation effect (a past move constraining present options)
  resistance  → defensive play (a player is blocking another's strategy)
  stall       → deadlock (no player has a profitable move; the game is stuck)
`;
}

/**
 * Build a bandwidth-based thread health report for the LLM.
 * Surfaces activeArcs, staleness, and lifecycle stage to guide
 * which threads should receive narrative bandwidth in the next arc.
 */
export function buildThreadHealthPrompt(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): string {
  const terminalStatuses = new Set(THREAD_TERMINAL_STATUSES as readonly string[]);

  // Count total arcs in the narrative so far
  const totalArcs = Object.keys(narrative.arcs).length || 1;

  // Compute per-thread metrics from scene history
  const threadFirstSeen: Record<string, number> = {};
  const threadLastSeen: Record<string, number> = {};
  const threadArcSets: Record<string, Set<string>> = {};
  let sceneCount = 0;

  for (let i = 0; i <= currentIndex && i < resolvedKeys.length; i++) {
    const scene = narrative.scenes[resolvedKeys[i]];
    if (!scene) continue;
    sceneCount++;
    for (const tm of scene.threadDeltas) {
      if (threadFirstSeen[tm.threadId] === undefined) threadFirstSeen[tm.threadId] = sceneCount;
      threadLastSeen[tm.threadId] = sceneCount;
      if (!threadArcSets[tm.threadId]) threadArcSets[tm.threadId] = new Set();
      threadArcSets[tm.threadId].add(scene.arcId);
    }
  }

  const allThreads = Object.values(narrative.threads);
  const resolved = allThreads.filter((t) => terminalStatuses.has(t.status));
  const active = allThreads.filter((t) => !terminalStatuses.has(t.status));

  if (active.length === 0 && resolved.length === 0) return '';

  const lines: string[] = [
    `THREAD BANDWIDTH — ${active.length} active, ${resolved.length} resolved, ${totalArcs} arcs elapsed`,
    '',
  ];

  // Sort by staleness (lowest bandwidth ratio first = most neglected)
  const sorted = active
    .map((t) => {
      const activeArcs = threadArcSets[t.id]?.size ?? 0;
      const bandwidthRatio = totalArcs > 0 ? activeArcs / totalArcs : 0;
      const scenesSinceLast = threadLastSeen[t.id] !== undefined ? sceneCount - threadLastSeen[t.id] : sceneCount;
      const age = threadFirstSeen[t.id] !== undefined ? sceneCount - threadFirstSeen[t.id] + 1 : 0;
      return { ...t, bandwidthRatio, scenesSinceLast, age };
    })
    .sort((a, b) => a.bandwidthRatio - b.bandwidthRatio);

  for (const t of sorted) {
    const stale = t.bandwidthRatio < 0.3;
    const critical = stale && (t.status === 'active' || t.status === 'critical');
    const discardCandidate = stale && (t.status === 'latent' || t.status === 'seeded');
    const flag = critical ? ' [!] EMERGENCY — active/critical thread starved of bandwidth'
      : discardCandidate ? ' [?] STALE — consider discarding or advancing'
      : '';

    lines.push(`"${t.description}" [${t.id}] ${t.status}`);
    lines.push(`  activeArcs: ${threadArcSets[t.id]?.size ?? 0}/${totalArcs} (${Math.round(t.bandwidthRatio * 100)}%) | age: ${t.age} scenes | silent: ${t.scenesSinceLast} scenes${flag}`);

    // Recent thread log nodes
    const logNodes = Object.values(t.threadLog?.nodes ?? {});
    const recentNodes = logNodes.slice(-ENTITY_LOG_CONTEXT_LIMIT);
    if (recentNodes.length > 0) {
      lines.push(`  log: ${recentNodes.map((n) => `[${n.type}] ${n.content.slice(0, 60)}`).join(' | ')}`);
    }

    if (t.dependents.length > 0) {
      const depDescs = t.dependents.map((depId) => narrative.threads[depId]).filter(Boolean).map((dep) => `[${dep.id}]`);
      if (depDescs.length > 0) lines.push(`  ↔ Converges: ${depDescs.join(', ')}`);
    }
    lines.push('');
  }

  lines.push(`Progress: ${resolved.length}/${allThreads.length} resolved`);
  return lines.join('\n');
}

/**
 * Extract irreversible state transitions from scene history and format them
 * as a "SPENT BEATS" prompt section. This tells the LLM what narrative
 * territory is already cashed in and must not be restaged.
 */
export function buildCompletedBeatsPrompt(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
): string {
  const terminalStatuses = new Set(THREAD_TERMINAL_STATUSES as readonly string[]);

  type Beat = { sceneIdx: number; from: string; to: string; summary: string; events: string[] };
  const threadBeats: Record<string, Beat[]> = {};

  let sceneIdx = 0;
  for (let i = 0; i <= currentIndex && i < resolvedKeys.length; i++) {
    const scene = narrative.scenes[resolvedKeys[i]];
    if (!scene) continue;
    sceneIdx++;

    for (const tm of scene.threadDeltas) {
      if (tm.from === tm.to) continue;
      if (!threadBeats[tm.threadId]) threadBeats[tm.threadId] = [];
      threadBeats[tm.threadId].push({
        sceneIdx,
        from: tm.from,
        to: tm.to,
        summary: scene.summary?.slice(0, 100) ?? '',
        events: scene.events?.slice(0, 3) ?? [],
      });
    }
  }

  const threadIds = Object.keys(threadBeats).filter((id) => threadBeats[id].length > 0);
  if (threadIds.length === 0) return '';

  const lines: string[] = [
    'SPENT BEATS — these transitions are CLOSED. Do NOT restage, re-discover, or write "deepening" scenes.',
    'Next scene for any thread MUST change state: new complication, reversal, cost, or consequence.',
    '',
  ];

  for (const tid of threadIds) {
    const thread = narrative.threads[tid];
    if (!thread) continue;
    const beats = threadBeats[tid];

    const chain = beats.map((b) => `${b.to} (${b.sceneIdx})`).join(' → ');
    const currentStatus = beats.length > 0 ? beats[beats.length - 1].to : thread.status;
    const isTerminal = terminalStatuses.has(currentStatus);
    const label = isTerminal ? `[${currentStatus.toUpperCase()}]` : `[${currentStatus}]`;

    lines.push(`"${thread.description.slice(0, 50)}" [${tid}] ${label}`);
    lines.push(`  ${beats[0].from} → ${chain}`);

    for (const b of beats) {
      if (b.summary) {
        lines.push(`  S${b.sceneIdx}: ${b.summary}${b.events.length ? ` [${b.events.join(', ')}]` : ''}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}
