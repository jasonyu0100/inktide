/**
 * Game-theoretic helpers — derive Nash equilibria, best responses, and
 * dominant strategies from a BeatGame's payoff matrix.
 *
 * Everything here is deterministic and cheap. Runs in the UI on demand.
 */

import type { BeatGame, NarrativeState } from "@/types/narrative";

/**
 * Resolve a player ID to its current display name by looking up the entity
 * registry (characters / locations / artifacts). Falls back to the stored
 * name on the BeatGame only if the entity has been deleted — which keeps
 * renames live without breaking historical analyses.
 */
export function resolvePlayerName(
  narrative: NarrativeState,
  id: string,
  storedFallback?: string,
): string {
  return (
    narrative.characters[id]?.name ??
    narrative.locations[id]?.name ??
    narrative.artifacts[id]?.name ??
    storedFallback ??
    id
  );
}

export type CellKey = "cc" | "cd" | "dc" | "dd";
export const CELL_KEYS: CellKey[] = ["cc", "cd", "dc", "dd"];

type Cell = { outcome: string; payoffA: number; payoffB: number };

/**
 * For a 2×2 game, a cell (row, col) is a Nash equilibrium if:
 *  - A's payoff in (row, col) is >= A's payoff in the other row, same col
 *  - B's payoff in (row, col) is >= B's payoff in the other col, same row
 *
 * Row index: c → row 0, d → row 1. Col index: c → col 0, d → col 1.
 * Corresponding cells: cc=(0,0), cd=(0,1), dc=(1,0), dd=(1,1).
 */
export function nashEquilibria(game: BeatGame): Set<CellKey> {
  const cells: Record<CellKey, Cell> = {
    cc: game.cc,
    cd: game.cd,
    dc: game.dc,
    dd: game.dd,
  };
  const result = new Set<CellKey>();

  // cc: A compares cc vs dc (B plays c). B compares cc vs cd (A plays c).
  if (cells.cc.payoffA >= cells.dc.payoffA && cells.cc.payoffB >= cells.cd.payoffB) result.add("cc");
  // cd: A compares cd vs dd (B plays d). B compares cd vs cc (A plays c).
  if (cells.cd.payoffA >= cells.dd.payoffA && cells.cd.payoffB >= cells.cc.payoffB) result.add("cd");
  // dc: A compares dc vs cc (B plays c). B compares dc vs dd (A plays d).
  if (cells.dc.payoffA >= cells.cc.payoffA && cells.dc.payoffB >= cells.dd.payoffB) result.add("dc");
  // dd: A compares dd vs cd (B plays d). B compares dd vs dc (A plays d).
  if (cells.dd.payoffA >= cells.cd.payoffA && cells.dd.payoffB >= cells.dc.payoffB) result.add("dd");

  return result;
}

/**
 * For each column (B's action), which row maximises A's payoff?
 * Returns the A-best-response cell for each column.
 * If tied, both ties are marked.
 */
export function aBestResponses(game: BeatGame): Set<CellKey> {
  const out = new Set<CellKey>();
  // B plays c → compare cc.payoffA vs dc.payoffA
  if (game.cc.payoffA >= game.dc.payoffA) out.add("cc");
  if (game.dc.payoffA >= game.cc.payoffA) out.add("dc");
  // B plays d → compare cd.payoffA vs dd.payoffA
  if (game.cd.payoffA >= game.dd.payoffA) out.add("cd");
  if (game.dd.payoffA >= game.cd.payoffA) out.add("dd");
  return out;
}

/**
 * For each row (A's action), which col maximises B's payoff?
 */
export function bBestResponses(game: BeatGame): Set<CellKey> {
  const out = new Set<CellKey>();
  // A plays c → compare cc.payoffB vs cd.payoffB
  if (game.cc.payoffB >= game.cd.payoffB) out.add("cc");
  if (game.cd.payoffB >= game.cc.payoffB) out.add("cd");
  // A plays d → compare dc.payoffB vs dd.payoffB
  if (game.dc.payoffB >= game.dd.payoffB) out.add("dc");
  if (game.dd.payoffB >= game.dc.payoffB) out.add("dd");
  return out;
}

export type DominantSide = "A" | "B" | "both" | null;

/** Returns which players, if any, have a strictly/weakly dominant strategy. */
export function dominantStrategy(game: BeatGame): {
  player: DominantSide;
  aAction?: "c" | "d";
  bAction?: "c" | "d";
} {
  // A's C dominates D: cc >= dc AND cd >= dd
  const aCDom = game.cc.payoffA >= game.dc.payoffA && game.cd.payoffA >= game.dd.payoffA;
  const aDDom = game.dc.payoffA >= game.cc.payoffA && game.dd.payoffA >= game.cd.payoffA;
  // B's C dominates D: cc >= cd AND dc >= dd
  const bCDom = game.cc.payoffB >= game.cd.payoffB && game.dc.payoffB >= game.dd.payoffB;
  const bDDom = game.cd.payoffB >= game.cc.payoffB && game.dd.payoffB >= game.dc.payoffB;

  // Strict version (can't have both C and D dominate — that would mean indifferent)
  const aHas = (aCDom && !aDDom) || (aDDom && !aCDom);
  const bHas = (bCDom && !bDDom) || (bDDom && !bCDom);

  const aAction = aHas ? (aCDom ? "c" : "d") : undefined;
  const bAction = bHas ? (bCDom ? "c" : "d") : undefined;

  const player: DominantSide = aHas && bHas ? "both" : aHas ? "A" : bHas ? "B" : null;
  return { player, aAction, bAction };
}

/**
 * Classify the strategic shape of a game:
 * - zero-sum: payoffA + payoffB is constant across cells
 * - coordination: cc is strictly best for both
 * - dilemma: mutual coop is good but each is tempted to defect
 * - conflict: no dominant pair, players prefer different cells
 */
export function classifyGame(game: BeatGame): string[] {
  const tags: string[] = [];
  const sums = [
    game.cc.payoffA + game.cc.payoffB,
    game.cd.payoffA + game.cd.payoffB,
    game.dc.payoffA + game.dc.payoffB,
    game.dd.payoffA + game.dd.payoffB,
  ];
  if (sums.every((s) => s === sums[0])) tags.push("zero-sum");

  const ccBestA = game.cc.payoffA >= Math.max(game.cd.payoffA, game.dc.payoffA, game.dd.payoffA);
  const ccBestB = game.cc.payoffB >= Math.max(game.cd.payoffB, game.dc.payoffB, game.dd.payoffB);
  if (ccBestA && ccBestB) tags.push("coordination");

  // Dilemma: cc Pareto-optimal but DD is Nash (both have dominant D)
  const ne = nashEquilibria(game);
  const ccParetoOk = ccBestA && ccBestB;
  const ddOnlyNash = ne.has("dd") && !ne.has("cc");
  if (ccParetoOk && ddOnlyNash) tags.push("social dilemma");

  if (tags.length === 0) tags.push("mixed");
  return tags;
}

/** Did the chosen cell match a Nash equilibrium? */
export function isOptimalPlay(game: BeatGame): boolean {
  return nashEquilibria(game).has(game.chosenCell);
}

// ── ELO rating computation ──────────────────────────────────────────────────

/** Initial rating assigned to every player before their first game. */
export const ELO_INITIAL = 1500;
/** K-factor — how much each game moves the rating. */
export const ELO_K = 32;

/**
 * Score for Player A in a BeatGame, derived from the chosen cell's payoffs.
 * Returns 1 if A "won" (higher payoff), 0 if A "lost", 0.5 on tie.
 */
export function gameScoreA(game: BeatGame): number {
  const cell = game[game.chosenCell];
  if (cell.payoffA > cell.payoffB) return 1;
  if (cell.payoffA < cell.payoffB) return 0;
  return 0.5;
}

/** Standard ELO expected-score formula. */
export function expectedScore(ra: number, rb: number): number {
  return 1 / (1 + Math.pow(10, (rb - ra) / 400));
}

/**
 * Apply ELO update for a single game and return the two new ratings.
 * scoreA is 1 (win), 0 (loss), or 0.5 (tie) from A's perspective.
 */
export function eloUpdate(
  ra: number,
  rb: number,
  scoreA: number,
  k: number = ELO_K,
): [number, number] {
  const expectedA = expectedScore(ra, rb);
  const newRa = ra + k * (scoreA - expectedA);
  const newRb = rb + k * (1 - scoreA - (1 - expectedA));
  return [newRa, newRb];
}

/**
 * Compute ELO histories for every player across a sequence of games.
 * Games should be passed in narrative order (earliest first).
 * Returns a map from player ID to their full rating timeline.
 */
export function computeEloHistories(
  games: BeatGame[],
): Map<string, { ratings: number[]; games: number[] }> {
  const current = new Map<string, number>();
  const histories = new Map<string, { ratings: number[]; games: number[] }>();

  const ensure = (id: string): void => {
    if (!current.has(id)) {
      current.set(id, ELO_INITIAL);
      histories.set(id, { ratings: [ELO_INITIAL], games: [] });
    }
  };

  games.forEach((g, idx) => {
    ensure(g.playerAId);
    ensure(g.playerBId);
    const ra = current.get(g.playerAId)!;
    const rb = current.get(g.playerBId)!;
    const [newRa, newRb] = eloUpdate(ra, rb, gameScoreA(g));
    current.set(g.playerAId, newRa);
    current.set(g.playerBId, newRb);

    const ha = histories.get(g.playerAId)!;
    ha.ratings.push(newRa);
    ha.games.push(idx);

    const hb = histories.get(g.playerBId)!;
    hb.ratings.push(newRb);
    hb.games.push(idx);
  });

  return histories;
}

/**
 * Given the Nash equilibrium cells of a game, return which action (c/d) a
 * player should have played to align with equilibrium. Returns null when
 * the player's equilibrium action is ambiguous (multiple NEs with conflicting
 * actions for this player) or when no pure Nash exists.
 */
export function equilibriumAction(
  game: BeatGame,
  player: "A" | "B",
): "c" | "d" | null {
  const ne = nashEquilibria(game);
  if (ne.size === 0) return null;
  const actions = new Set<"c" | "d">();
  for (const cell of ne) {
    actions.add((player === "A" ? cell[0] : cell[1]) as "c" | "d");
  }
  return actions.size === 1 ? [...actions][0] : null;
}
