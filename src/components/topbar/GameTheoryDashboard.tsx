"use client";

/**
 * GameTheoryDashboard — a focused, high-level view of the narrative's
 * strategic structure. Surfaces player rankings via ELO (with inline
 * sparklines of each player's rating over time) plus narrative insights
 * like dominant rivalries, biggest upsets, and playstyle profiles.
 */

import { useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "@/components/Modal";
import {
  computeEloHistories,
  dominantStrategy,
  ELO_INITIAL,
  equilibriumAction,
  gameScoreA,
  isOptimalPlay,
  nashEquilibria,
  resolvePlayerName,
} from "@/lib/game-theory";
import { resolveEntry, isScene } from "@/types/narrative";
import type {
  BeatGame,
  NarrativeState,
  Scene,
  SceneGameAnalysis,
} from "@/types/narrative";

type Props = {
  narrative: NarrativeState;
  resolvedKeys: string[];
  onClose: () => void;
  onSelectScene?: (sceneIndex: number) => void;
};

// ── Aggregation — player profiles + insights ───────────────────────────────

type GameWithContext = {
  game: BeatGame;
  sceneIndex: number;
  scene: Scene;
};

type PlayerProfile = {
  id: string;
  name: string;
  // ELO
  currentElo: number;
  peakElo: number;
  troughElo: number;
  eloHistory: number[];
  eloVolatility: number; // std dev of per-game elo changes
  // Games
  games: number;
  wins: number;
  losses: number;
  draws: number;
  // Playstyle
  advances: number;   // played C
  blocks: number;     // played D
  avgPayoff: number;
  nashMoves: number;      // games where their action matched NE action
  nashAvailable: number;  // games with a uniquely-determined NE action for them
  dominantStrategiesHeld: number;
  // Role preference
  asRoleA: number;
  asRoleB: number;
  // Social
  opponentCounts: Map<string, number>;
  biggestUpset: { opponentName: string; ratingGain: number; sceneIndex: number } | null;
};

type Rivalry = {
  aId: string;
  bId: string;
  aName: string;
  bName: string;
  games: number;
  aWins: number;
  bWins: number;
};

type Aggregate = {
  orderedGames: GameWithContext[];
  totalDecisions: number;
  scenesAnalysed: number;
  nashCompliance: number;
  profiles: PlayerProfile[];
  rivalries: Rivalry[];
  offEquilibriumGames: GameWithContext[];
  biggestSingleUpset: {
    gameCtx: GameWithContext;
    swinger: string;
    ratingGain: number;
  } | null;
};

function aggregate(
  narrative: NarrativeState,
  resolvedKeys: string[],
): Aggregate {
  // Collect games in narrative order
  const ordered: GameWithContext[] = [];
  resolvedKeys.forEach((key, i) => {
    const entry = resolveEntry(narrative, key);
    if (!entry || !isScene(entry)) return;
    const scene = entry;
    const analysis: SceneGameAnalysis | undefined = scene.gameAnalysis;
    if (!analysis) return;
    for (const g of analysis.games) {
      ordered.push({ game: g, sceneIndex: i, scene });
    }
  });

  const histories = computeEloHistories(ordered.map((o) => o.game));

  // Pass 2 — fill player profiles using histories and game state
  const profiles = new Map<string, PlayerProfile>();
  const ensure = (id: string, name: string): PlayerProfile => {
    let p = profiles.get(id);
    if (!p) {
      const h = histories.get(id);
      const ratings = h?.ratings ?? [ELO_INITIAL];
      p = {
        id,
        name,
        currentElo: ratings[ratings.length - 1] ?? ELO_INITIAL,
        peakElo: Math.max(...ratings),
        troughElo: Math.min(...ratings),
        eloHistory: ratings,
        eloVolatility: 0,
        games: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        advances: 0,
        blocks: 0,
        avgPayoff: 0,
        nashMoves: 0,
        nashAvailable: 0,
        dominantStrategiesHeld: 0,
        asRoleA: 0,
        asRoleB: 0,
        opponentCounts: new Map(),
        biggestUpset: null,
      };
      // Compute volatility = std-dev of per-step rating changes
      if (ratings.length > 1) {
        const deltas: number[] = [];
        for (let i = 1; i < ratings.length; i++) deltas.push(ratings[i] - ratings[i - 1]);
        const mean = deltas.reduce((s, d) => s + d, 0) / deltas.length;
        const variance = deltas.reduce((s, d) => s + (d - mean) ** 2, 0) / deltas.length;
        p.eloVolatility = Math.sqrt(variance);
      }
      profiles.set(id, p);
    }
    return p;
  };

  let totalPayoffA = 0;
  let totalPayoffB = 0;
  let optimalPlays = 0;
  const offEq: GameWithContext[] = [];
  const rivalryMap = new Map<string, Rivalry>();
  const pairKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // Track biggest single ELO swing
  let biggestSwing: Aggregate["biggestSingleUpset"] = null;
  const runningElo = new Map<string, number>();

  ordered.forEach((ctx, idx) => {
    const g = ctx.game;
    const pA = ensure(g.playerAId, resolvePlayerName(narrative, g.playerAId, g.playerAName));
    const pB = ensure(g.playerBId, resolvePlayerName(narrative, g.playerBId, g.playerBName));
    pA.games++;
    pB.games++;
    pA.asRoleA++;
    pB.asRoleB++;

    const cell = g[g.chosenCell];
    pA.avgPayoff += cell.payoffA;
    pB.avgPayoff += cell.payoffB;
    totalPayoffA += cell.payoffA;
    totalPayoffB += cell.payoffB;

    const scoreA = gameScoreA(g);
    if (scoreA === 1) { pA.wins++; pB.losses++; }
    else if (scoreA === 0) { pA.losses++; pB.wins++; }
    else { pA.draws++; pB.draws++; }

    // Actions played: chosenCell[0] = A's action, chosenCell[1] = B's action
    if (g.chosenCell[0] === "c") pA.advances++; else pA.blocks++;
    if (g.chosenCell[1] === "c") pB.advances++; else pB.blocks++;

    // Equilibrium-action compliance (per-player, independent of opponent)
    const aEq = equilibriumAction(g, "A");
    if (aEq) {
      pA.nashAvailable++;
      if (aEq === g.chosenCell[0]) pA.nashMoves++;
    }
    const bEq = equilibriumAction(g, "B");
    if (bEq) {
      pB.nashAvailable++;
      if (bEq === g.chosenCell[1]) pB.nashMoves++;
    }

    // Nash-cell optimality (legacy definition for top-level compliance)
    if (isOptimalPlay(g)) optimalPlays++;
    else offEq.push(ctx);

    // Dominant strategies
    const dom = dominantStrategy(g);
    if (dom.player === "A" || dom.player === "both") pA.dominantStrategiesHeld++;
    if (dom.player === "B" || dom.player === "both") pB.dominantStrategiesHeld++;

    // Opponents
    pA.opponentCounts.set(g.playerBId, (pA.opponentCounts.get(g.playerBId) ?? 0) + 1);
    pB.opponentCounts.set(g.playerAId, (pB.opponentCounts.get(g.playerAId) ?? 0) + 1);

    // Rivalry
    const rk = pairKey(g.playerAId, g.playerBId);
    let rv = rivalryMap.get(rk);
    if (!rv) {
      rv = {
        aId: g.playerAId,
        bId: g.playerBId,
        aName: resolvePlayerName(narrative, g.playerAId, g.playerAName),
        bName: resolvePlayerName(narrative, g.playerBId, g.playerBName),
        games: 0,
        aWins: 0,
        bWins: 0,
      };
      rivalryMap.set(rk, rv);
    }
    rv.games++;
    if (scoreA === 1) rv.aWins++;
    else if (scoreA === 0) rv.bWins++;

    // Single-game ELO swing tracking
    const prevA = runningElo.get(g.playerAId) ?? ELO_INITIAL;
    const prevB = runningElo.get(g.playerBId) ?? ELO_INITIAL;
    const histA = histories.get(g.playerAId);
    const histB = histories.get(g.playerBId);
    // Find this game's post-rating in each history by game index alignment
    const idxA = histA?.games.indexOf(idx);
    const idxB = histB?.games.indexOf(idx);
    const postA = idxA !== undefined && idxA >= 0 ? histA!.ratings[idxA + 1] : prevA;
    const postB = idxB !== undefined && idxB >= 0 ? histB!.ratings[idxB + 1] : prevB;
    const swingA = postA - prevA;
    const swingB = postB - prevB;
    runningElo.set(g.playerAId, postA);
    runningElo.set(g.playerBId, postB);

    const bigger = Math.abs(swingA) > Math.abs(swingB)
      ? { id: g.playerAId, name: resolvePlayerName(narrative, g.playerAId, g.playerAName), swing: swingA }
      : { id: g.playerBId, name: resolvePlayerName(narrative, g.playerBId, g.playerBName), swing: swingB };
    if (!biggestSwing || Math.abs(bigger.swing) > Math.abs(biggestSwing.ratingGain)) {
      biggestSwing = {
        gameCtx: ctx,
        swinger: bigger.name,
        ratingGain: bigger.swing,
      };
    }

    // Per-player biggest upset (single-game positive gain)
    const updatePlayerUpset = (p: PlayerProfile, swing: number, opponentName: string) => {
      if (swing <= 0) return;
      if (!p.biggestUpset || swing > p.biggestUpset.ratingGain) {
        p.biggestUpset = { opponentName, ratingGain: swing, sceneIndex: ctx.sceneIndex };
      }
    };
    updatePlayerUpset(pA, swingA, resolvePlayerName(narrative, g.playerBId, g.playerBName));
    updatePlayerUpset(pB, swingB, resolvePlayerName(narrative, g.playerAId, g.playerAName));
  });

  // Finalise averages
  for (const p of profiles.values()) {
    if (p.games > 0) p.avgPayoff /= p.games;
  }

  const profileList = Array.from(profiles.values()).sort((a, b) => b.currentElo - a.currentElo);
  const rivalries = Array.from(rivalryMap.values())
    .filter((r) => r.games >= 2)
    .sort((a, b) => b.games - a.games);

  // Count scenes (not games) that have analyses
  const sceneSet = new Set(ordered.map((o) => o.scene.id));

  return {
    orderedGames: ordered,
    totalDecisions: ordered.length,
    scenesAnalysed: sceneSet.size,
    nashCompliance: ordered.length > 0 ? optimalPlays / ordered.length : 0,
    profiles: profileList,
    rivalries,
    offEquilibriumGames: offEq,
    biggestSingleUpset: biggestSwing,
  };
}

// ── Main component ──────────────────────────────────────────────────────────

export function GameTheoryDashboard({ narrative, resolvedKeys, onClose, onSelectScene }: Props) {
  const agg = useMemo(() => aggregate(narrative, resolvedKeys), [narrative, resolvedKeys]);

  return (
    <Modal onClose={onClose} size="6xl">
      <ModalHeader onClose={onClose}>
        <div className="flex items-baseline gap-3">
          <h2 className="text-[13px] font-semibold text-text-primary">
            Game Theory Dashboard
          </h2>
          <span className="text-[10px] text-text-dim/60">
            player ratings + narrative insights
          </span>
        </div>
      </ModalHeader>
      <ModalBody className="p-0">
        {agg.totalDecisions === 0 ? (
          <EmptyDashboard />
        ) : (
          <div className="p-6 flex flex-col gap-8">
            <KeyMetrics agg={agg} />
            <PlayerRankings
              agg={agg}
              onClose={onClose}
              onSelectScene={onSelectScene}
            />
            <NarrativeInsights agg={agg} narrative={narrative} onClose={onClose} onSelectScene={onSelectScene} />
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <p className="text-[12px] text-text-dim">No game analyses yet.</p>
      <p className="text-[10px] text-text-dim/50 max-w-md text-center leading-relaxed">
        Analyse one or more scenes from the{" "}
        <span className="font-mono text-text-dim/80">Game</span> scene mode, or
        use the palette&apos;s Auto button to analyse every scene at once.
      </p>
    </div>
  );
}

// ── Header metrics ──────────────────────────────────────────────────────────

function KeyMetrics({ agg }: { agg: Aggregate }) {
  const top = agg.profiles[0];
  const nashPct = (agg.nashCompliance * 100).toFixed(0);
  const nashColor =
    agg.nashCompliance > 0.7 ? "text-emerald-400" :
    agg.nashCompliance > 0.4 ? "text-amber-400" :
    "text-red-400";

  return (
    <div className="grid grid-cols-4 gap-3">
      <Stat
        label="Top player"
        value={top?.name ?? "—"}
        sub={top ? `${Math.round(top.currentElo)} ELO` : undefined}
        color="text-emerald-300"
      />
      <Stat label="Players" value={agg.profiles.length} sub={`across ${agg.scenesAnalysed} scenes`} />
      <Stat label="Decisions" value={agg.totalDecisions} sub="games recorded" />
      <Stat
        label="Nash compliance"
        value={`${nashPct}%`}
        color={nashColor}
        sub="chose equilibrium cell"
      />
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5">
      <div
        className={`text-[18px] font-semibold tabular-nums truncate ${
          color ?? "text-text-primary"
        }`}
        title={String(value)}
      >
        {value}
      </div>
      <div className="text-[9px] uppercase tracking-wider text-text-dim/60 font-semibold mt-1">
        {label}
      </div>
      {sub && <div className="text-[9px] text-text-dim/50 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Player rankings table ──────────────────────────────────────────────────

function PlayerRankings({
  agg,
  onClose,
  onSelectScene,
}: {
  agg: Aggregate;
  onClose: () => void;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const rows = agg.profiles;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold">
          Player Rankings
        </h3>
        <span className="text-[9px] text-text-dim/50">ELO starts at {ELO_INITIAL}</span>
      </div>
      <div className="rounded-lg border border-white/8 overflow-hidden">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="bg-white/3 text-text-dim/70 text-[9px] uppercase tracking-wider">
              <th className="text-left py-2 px-3 font-semibold w-8">#</th>
              <th className="text-left py-2 px-3 font-semibold">Player</th>
              <th className="text-right py-2 px-3 font-semibold">ELO</th>
              <th className="text-left py-2 px-3 font-semibold w-40">Trajectory</th>
              <th className="text-right py-2 px-3 font-semibold">W/L/D</th>
              <th className="text-center py-2 px-3 font-semibold">Playstyle</th>
              <th className="text-right py-2 px-3 font-semibold">Payoff</th>
              <th className="text-right py-2 px-3 font-semibold">Nash</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => {
              const totalMoves = p.advances + p.blocks;
              const advancePct = totalMoves > 0 ? (p.advances / totalMoves) * 100 : 0;
              const blockPct = totalMoves > 0 ? (p.blocks / totalMoves) * 100 : 0;
              const nashPct = p.nashAvailable > 0 ? (p.nashMoves / p.nashAvailable) * 100 : null;
              const eloDelta = p.currentElo - ELO_INITIAL;

              return (
                <tr key={p.id} className="border-t border-white/5 hover:bg-white/3 transition-colors">
                  <td className="py-2.5 px-3 text-text-dim/50 tabular-nums">{i + 1}</td>
                  <td className="py-2.5 px-3">
                    <div className="text-text-primary font-medium truncate max-w-[180px]" title={p.name}>
                      {p.name}
                    </div>
                    <div className="text-[9px] text-text-dim/50 mt-0.5">
                      {p.games} games · peak {Math.round(p.peakElo)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <div className={`font-semibold tabular-nums ${
                      eloDelta > 50 ? "text-emerald-400" :
                      eloDelta < -50 ? "text-red-400" :
                      "text-text-primary"
                    }`}>
                      {Math.round(p.currentElo)}
                    </div>
                    <div className={`text-[9px] tabular-nums ${
                      eloDelta > 0 ? "text-emerald-400/70" :
                      eloDelta < 0 ? "text-red-400/70" :
                      "text-text-dim/50"
                    }`}>
                      {eloDelta > 0 ? "+" : ""}{Math.round(eloDelta)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <Sparkline values={p.eloHistory} width={140} height={28} />
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums">
                    <span className="text-emerald-400/80">{p.wins}</span>
                    <span className="text-text-dim/40 mx-0.5">/</span>
                    <span className="text-red-400/80">{p.losses}</span>
                    <span className="text-text-dim/40 mx-0.5">/</span>
                    <span className="text-text-dim/60">{p.draws}</span>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <div className="flex gap-px h-1.5 rounded-full overflow-hidden bg-white/5 w-32">
                        {advancePct > 0 && (
                          <div className="bg-emerald-400/70 h-full" style={{ width: `${advancePct}%` }} />
                        )}
                        {blockPct > 0 && (
                          <div className="bg-red-400/70 h-full" style={{ width: `${blockPct}%` }} />
                        )}
                      </div>
                      <div className="text-[9px] text-text-dim/60">
                        {playstyleLabel(advancePct)}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-text-secondary">
                    {p.avgPayoff.toFixed(1)}
                  </td>
                  <td className={`py-2.5 px-3 text-right tabular-nums font-medium ${
                    nashPct === null ? "text-text-dim/40" :
                    nashPct > 70 ? "text-emerald-400" :
                    nashPct > 40 ? "text-amber-400" :
                    "text-red-400"
                  }`}>
                    {nashPct === null ? "—" : `${nashPct.toFixed(0)}%`}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Column explanations */}
      <div className="flex items-center gap-4 mt-3 text-[9px] text-text-dim/50">
        <span><span className="text-emerald-400/80">advance</span> vs <span className="text-red-400/80">block</span> distribution</span>
        <span>· Payoff: mean 0-4 from chosen cells</span>
        <span>· Nash: % of games where the player&apos;s action matched their equilibrium action</span>
      </div>
    </div>
  );
}

function playstyleLabel(advancePct: number): string {
  if (advancePct >= 80) return "cooperator";
  if (advancePct >= 60) return "lean coop";
  if (advancePct >= 40) return "balanced";
  if (advancePct >= 20) return "lean block";
  return "blocker";
}

// ── Sparkline — inline ELO timeline ────────────────────────────────────────

function Sparkline({
  values,
  width = 96,
  height = 24,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return (
      <div
        className="flex items-center text-[9px] text-text-dim/40"
        style={{ width, height }}
      >
        no change
      </div>
    );
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const step = w / (values.length - 1);
  const points = values.map((v, i) => {
    const x = pad + i * step;
    const y = pad + h - ((v - min) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const last = values[values.length - 1];
  const first = values[0];
  const up = last >= first;
  const color = up ? "rgb(52, 211, 153)" : "rgb(248, 113, 113)"; // emerald-400 / red-400

  // Last-point marker
  const [lastX, lastY] = points[points.length - 1].split(",").map(Number);

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Baseline at initial rating for reference */}
      <line
        x1={pad}
        x2={width - pad}
        y1={pad + h - ((ELO_INITIAL - min) / range) * h}
        y2={pad + h - ((ELO_INITIAL - min) / range) * h}
        stroke="rgba(255,255,255,0.12)"
        strokeDasharray="2,2"
      />
      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Endpoint dot */}
      <circle cx={lastX} cy={lastY} r={2} fill={color} />
    </svg>
  );
}

// ── Narrative insights — callout cards ─────────────────────────────────────

function NarrativeInsights({
  agg,
  narrative,
  onClose,
  onSelectScene,
}: {
  agg: Aggregate;
  narrative: NarrativeState;
  onClose: () => void;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  // Most consistent player = lowest volatility (with at least 5 games)
  const consistent = agg.profiles
    .filter((p) => p.games >= 5)
    .sort((a, b) => a.eloVolatility - b.eloVolatility)[0];

  // Most volatile = highest volatility
  const volatile = agg.profiles
    .filter((p) => p.games >= 5)
    .sort((a, b) => b.eloVolatility - a.eloVolatility)[0];

  // Most aggressive (highest block rate)
  const aggressive = agg.profiles
    .filter((p) => p.advances + p.blocks >= 3)
    .sort((a, b) => {
      const ra = a.blocks / Math.max(a.advances + a.blocks, 1);
      const rb = b.blocks / Math.max(b.advances + b.blocks, 1);
      return rb - ra;
    })[0];

  // Most cooperative
  const cooperative = agg.profiles
    .filter((p) => p.advances + p.blocks >= 3)
    .sort((a, b) => {
      const ra = a.advances / Math.max(a.advances + a.blocks, 1);
      const rb = b.advances / Math.max(b.advances + b.blocks, 1);
      return rb - ra;
    })[0];

  // Best tactician — highest nash-move rate
  const tactician = agg.profiles
    .filter((p) => p.nashAvailable >= 3)
    .sort((a, b) => {
      const ra = a.nashMoves / Math.max(a.nashAvailable, 1);
      const rb = b.nashMoves / Math.max(b.nashAvailable, 1);
      return rb - ra;
    })[0];

  // Top rivalry
  const topRivalry = agg.rivalries[0];

  const cards: Array<{ label: string; value: string; sub?: string; accent: string }> = [];
  if (consistent) {
    cards.push({
      label: "Most consistent",
      value: consistent.name,
      sub: `σ = ${consistent.eloVolatility.toFixed(1)} per game`,
      accent: "text-sky-300",
    });
  }
  if (volatile) {
    cards.push({
      label: "Most volatile",
      value: volatile.name,
      sub: `σ = ${volatile.eloVolatility.toFixed(1)} per game`,
      accent: "text-orange-300",
    });
  }
  if (aggressive) {
    const rate = (aggressive.blocks / Math.max(aggressive.advances + aggressive.blocks, 1)) * 100;
    cards.push({
      label: "Most aggressive",
      value: aggressive.name,
      sub: `blocks ${rate.toFixed(0)}% of moves`,
      accent: "text-red-300",
    });
  }
  if (cooperative) {
    const rate = (cooperative.advances / Math.max(cooperative.advances + cooperative.blocks, 1)) * 100;
    cards.push({
      label: "Most cooperative",
      value: cooperative.name,
      sub: `advances ${rate.toFixed(0)}% of moves`,
      accent: "text-emerald-300",
    });
  }
  if (tactician) {
    const rate = (tactician.nashMoves / Math.max(tactician.nashAvailable, 1)) * 100;
    cards.push({
      label: "Best tactician",
      value: tactician.name,
      sub: `${rate.toFixed(0)}% equilibrium-aligned`,
      accent: "text-amber-300",
    });
  }
  if (topRivalry) {
    cards.push({
      label: "Top rivalry",
      value: `${topRivalry.aName} × ${topRivalry.bName}`,
      sub: `${topRivalry.games} games · ${topRivalry.aWins}-${topRivalry.bWins}`,
      accent: "text-white",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-[10px] uppercase tracking-[0.15em] text-text-dim/70 font-semibold">
        Narrative Insights
      </h3>

      {/* Insight cards */}
      {cards.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {cards.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/8 bg-white/3 px-3 py-2.5"
            >
              <div className="text-[9px] uppercase tracking-wider text-text-dim/60 font-semibold mb-1">
                {c.label}
              </div>
              <div className={`text-[13px] font-semibold truncate ${c.accent}`} title={c.value}>
                {c.value}
              </div>
              {c.sub && (
                <div className="text-[9px] text-text-dim/50 mt-0.5">{c.sub}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Biggest upset — single clickable callout */}
      {agg.biggestSingleUpset && (
        <BiggestUpset
          upset={agg.biggestSingleUpset}
          onClose={onClose}
          onSelectScene={onSelectScene}
        />
      )}

      {/* Off-equilibrium moments — condensed */}
      {agg.offEquilibriumGames.length > 0 && (
        <OffEquilibrium
          games={agg.offEquilibriumGames}
          narrative={narrative}
          onClose={onClose}
          onSelectScene={onSelectScene}
        />
      )}
    </div>
  );
}

function BiggestUpset({
  upset,
  onClose,
  onSelectScene,
}: {
  upset: NonNullable<Aggregate["biggestSingleUpset"]>;
  onClose: () => void;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const gain = upset.ratingGain;
  const up = gain >= 0;
  return (
    <button
      onClick={() => {
        onSelectScene?.(upset.gameCtx.sceneIndex);
        onClose();
      }}
      className="text-left rounded-lg border border-white/8 bg-white/3 px-3 py-2.5 hover:bg-white/5 transition-colors"
    >
      <div className="text-[9px] uppercase tracking-wider text-text-dim/60 font-semibold mb-1">
        Biggest ELO swing
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-semibold text-text-primary">
          {upset.swinger}
        </span>
        <span className={`text-[12px] font-mono font-semibold ${up ? "text-emerald-400" : "text-red-400"}`}>
          {up ? "+" : ""}{Math.round(gain)} ELO
        </span>
        <span className="text-[9px] text-text-dim/50 ml-auto">
          scene {upset.gameCtx.sceneIndex + 1}
        </span>
      </div>
      <div className="text-[10px] text-text-dim/60 mt-1 truncate">
        {upset.gameCtx.game.beatExcerpt || upset.gameCtx.game.rationale}
      </div>
    </button>
  );
}

// ── Off-equilibrium list ───────────────────────────────────────────────────

function OffEquilibrium({
  games,
  narrative,
  onClose,
  onSelectScene,
}: {
  games: GameWithContext[];
  narrative: NarrativeState;
  onClose: () => void;
  onSelectScene?: (sceneIndex: number) => void;
}) {
  const top = games.slice(0, 5);
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <h4 className="text-[9px] uppercase tracking-[0.15em] text-text-dim/60 font-semibold">
          Off-equilibrium moments
        </h4>
        <span className="text-[9px] text-text-dim/40">
          {games.length} total · chosen cell ≠ Nash
        </span>
      </div>
      <div className="flex flex-col gap-1">
        {top.map(({ game, sceneIndex }, i) => {
          const ne = nashEquilibria(game);
          const ideal = ne.size > 0 ? [...ne].join("/") : "—";
          const aName = resolvePlayerName(narrative, game.playerAId, game.playerAName);
          const bName = resolvePlayerName(narrative, game.playerBId, game.playerBName);
          return (
            <button
              key={i}
              onClick={() => {
                onSelectScene?.(sceneIndex);
                onClose();
              }}
              className="text-left flex items-center gap-3 px-3 py-2 rounded-md border border-white/5 hover:bg-white/3 transition-colors"
            >
              <span className="text-[9px] font-mono tabular-nums text-text-dim/50 w-10 shrink-0">
                S{sceneIndex + 1}
              </span>
              <span className="text-[9px] font-mono font-semibold text-amber-300 uppercase w-8 shrink-0">
                {game.chosenCell}
              </span>
              <span className="text-[9px] text-text-dim/40 w-12 shrink-0">
                → {ideal}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-text-secondary truncate">
                  {aName} × {bName}
                </div>
                {game.rationale && (
                  <div className="text-[9px] text-text-dim/60 truncate mt-0.5">
                    {game.rationale}
                  </div>
                )}
              </div>
            </button>
          );
        })}
        {games.length > top.length && (
          <div className="text-[9px] text-text-dim/50 italic pl-3 pt-1">
            +{games.length - top.length} more
          </div>
        )}
      </div>
    </div>
  );
}
