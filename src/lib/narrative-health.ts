/**
 * Narrative health diagnostics.
 *
 * Scores a narrative across six dimensions — threads, cast, locations,
 * artifacts, systems, balance — and surfaces a ranked list of deficits.
 * Powers the Diagnose quick-action in the canvas palette and drives the
 * `health` expansion mode (a maintenance top-up that restores the portfolio
 * to working condition rather than committing to a size).
 *
 * Design: pure composition. Reuses `computePortfolioSnapshot` (threads) and
 * the pressure analyzers from `evaluateNarrativeState` (stale threads, shallow
 * characters, neglected anchors, knowledge growth, balance). Derives cast /
 * location / artifact usage directly from scene metadata so the diagnostic
 * captures the same signal the UsageAnalytics modal surfaces.
 */
import type { AutoConfig, Character, NarrativeState, Scene } from '@/types/narrative';
import { isScene } from '@/types/narrative';
import { computePortfolioSnapshot } from '@/lib/portfolio-analytics';
import { evaluateNarrativeState } from '@/lib/auto-engine';

// ── Types ────────────────────────────────────────────────────────────────────

export type HealthBand = 'healthy' | 'watch' | 'needs_maintenance' | 'critical';

export type HealthDimensionScore = {
  /** 0..1 — 1 is ideal, 0 is critical. */
  score: number;
  band: HealthBand;
  /** Short one-liner describing the current state. */
  summary: string;
  /** Concrete deficits this dimension is flagging. */
  deficits: string[];
};

export type HealthReport = {
  /** Weighted aggregate — 0..1. */
  overall: number;
  band: HealthBand;
  /** One-sentence top-line diagnosis. */
  headline: string;
  dimensions: {
    threads: HealthDimensionScore;
    cast: HealthDimensionScore;
    locations: HealthDimensionScore;
    artifacts: HealthDimensionScore;
    systems: HealthDimensionScore;
    balance: HealthDimensionScore;
  };
  /** Deficits ranked by severity across dimensions (top-first). */
  topDeficits: string[];
  /** Whether a health expansion would help. True when band is needs_maintenance or worse. */
  needsMaintenance: boolean;
  /** Structured thread-portfolio signals — drives the recommendedAction and
   *  can be consumed directly by UI for fine-grained warnings. */
  portfolioSignals: PortfolioSignals;
  /** Prescriptive directive — the "recommended action" the health expansion
   *  runs against when launched as a quick action. Derived from the
   *  portfolioSignals; the system prescribes the fix rather than requiring
   *  the user to write a directive. */
  recommendedAction: string;
};

// Weights — threads carry the most signal (they ARE the prediction-market
// engine); cast / locations / artifacts together add up to the entity layer;
// systems is world rules; balance is the three-force distribution.
const WEIGHTS = {
  threads: 0.25,
  cast: 0.2,
  locations: 0.12,
  artifacts: 0.08,
  systems: 0.2,
  balance: 0.15,
} as const;

// ── Thresholds ──────────────────────────────────────────────────────────────

/** Bands derived from raw score. */
function bandOf(score: number): HealthBand {
  if (score >= 0.75) return 'healthy';
  if (score >= 0.55) return 'watch';
  if (score >= 0.35) return 'needs_maintenance';
  return 'critical';
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

// ── Thread dimension ────────────────────────────────────────────────────────

/** Structured portfolio signals driving the thread-dimension score and
 *  feeding the recommendedAction directive. The three-axis frame: NEWNESS
 *  (fresh markets opening), VARIETY (breadth of coverage across entities /
 *  horizons / outcome shapes), DIRECTION (movement toward resolution vs
 *  stuck). Zombies (stale threads) are counted but not penalised — some
 *  threads are meant to fade, and the bloat they add is harmless. */
export type PortfolioSignals = {
  // Size sanity
  starved: boolean;                 // active < 2 — engine dead
  thin: boolean;                    // active < 3 — narrow portfolio
  bloated: boolean;                 // active > 8 — reader overload

  // NEWNESS — is the story introducing new questions?
  recentOpensCount: number;         // threads opened in last 8 scenes
  lowNewness: boolean;              // 0 opens in 8+ scenes of narrative age

  // DIRECTION — is anything moving toward resolution?
  nearClosedCount: number;
  scenesSinceLastClose: number;     // infinity-safe: capped at sceneCount
  noForwardSignal: boolean;         // no near-closed AND no recent closures AND 8+ scenes elapsed
  stagnant: boolean;                // high avg entropy across open + no near-closed + 8+ scenes

  // VARIETY — breadth of coverage
  uncoveredAnchorNames: string[];   // anchor / recurring characters with no stake
  concentrated: boolean;            // one thread holds ≥60% of market cap
  topVolumeShare: number;           // [0, 1]

  // Informational (not penalised — zombies are fine)
  staleCount: number;
  abandonedCount: number;
};

function scoreThreads(
  narrative: NarrativeState,
  snapshot: ReturnType<typeof computePortfolioSnapshot>,
  pressure: ReturnType<typeof evaluateNarrativeState>['pressure']['threads'],
  resolvedKeys: string[],
  currentIndex: number,
): HealthDimensionScore & { signals: PortfolioSignals } {
  const deficits: string[] = [];
  const active = snapshot.activeThreads;
  const stale = pressure.stale.length;
  const abandoned = snapshot.abandonedThreads;
  const closed = snapshot.closedThreads;
  const nearClosed = snapshot.nearClosedThreads;
  const sceneCount = Object.values(narrative.scenes).filter(isScene).length;

  // Recent visible scenes (by resolved-key index up to the reader's position).
  // Used to measure NEWNESS (recent opens) and DIRECTION (recent closures).
  const visibleRecentKeys = new Set(
    resolvedKeys.slice(Math.max(0, currentIndex - 7), currentIndex + 1),
  );

  // NEWNESS — threads opened in the last 8 visible scenes.
  let recentOpensCount = 0;
  for (const t of Object.values(narrative.threads)) {
    if (t.openedAt && visibleRecentKeys.has(t.openedAt)) recentOpensCount++;
  }

  // DIRECTION — scenes since the last closure (∞ if never closed).
  let scenesSinceLastClose = Number.POSITIVE_INFINITY;
  for (let i = currentIndex; i >= 0; i--) {
    const scene = narrative.scenes[resolvedKeys[i]];
    if (!scene) continue;
    const closedHere = Object.values(narrative.threads).some((t) => t.closedAt === scene.id);
    if (closedHere) {
      scenesSinceLastClose = currentIndex - i;
      break;
    }
  }

  const signals: PortfolioSignals = {
    starved: false,
    thin: false,
    bloated: false,
    recentOpensCount,
    lowNewness: false,
    nearClosedCount: nearClosed,
    scenesSinceLastClose: Number.isFinite(scenesSinceLastClose)
      ? scenesSinceLastClose
      : sceneCount,
    noForwardSignal: false,
    stagnant: false,
    uncoveredAnchorNames: [],
    concentrated: false,
    topVolumeShare: 0,
    staleCount: stale,
    abandonedCount: abandoned,
  };

  let score = 1;

  // SIZE SANITY
  if (active < 2) {
    score -= 0.5;
    signals.starved = true;
    deficits.push(`DANGER — only ${active} active thread${active === 1 ? '' : 's'}; fate engine is starved.`);
  } else if (active < 3) {
    score -= 0.2;
    signals.thin = true;
    deficits.push(`Thin thread portfolio (${active} active) — stakes feel narrow.`);
  } else if (active > 8) {
    score -= 0.1;
    signals.bloated = true;
    deficits.push(`${active} active threads — reader bandwidth stretched; prefer consolidation over more openings.`);
  }

  // DIRECTION — no movement toward resolution in a long stretch.
  const noRecentClose = !Number.isFinite(scenesSinceLastClose) || scenesSinceLastClose >= 8;
  if (active >= 2 && nearClosed === 0 && noRecentClose && sceneCount >= 8) {
    score -= 0.18;
    signals.noForwardSignal = true;
    deficits.push(`DANGER — no near-closed threads and no closures in ${Number.isFinite(scenesSinceLastClose) ? scenesSinceLastClose + '+ scenes' : 'the story so far'}; the portfolio has stopped moving toward resolution.`);
  }

  // STAGNATION — contested but frozen. Related but distinct from noForwardSignal.
  if (active >= 3 && nearClosed === 0 && snapshot.averageEntropy >= 0.85 && sceneCount >= 8) {
    score -= 0.1;
    signals.stagnant = true;
    deficits.push('Every open market is contested and none is pushing toward resolution — pressure has nowhere to discharge.');
  }

  // NEWNESS — no recent opens in a mature story.
  if (sceneCount >= 10 && recentOpensCount === 0) {
    score -= 0.12;
    signals.lowNewness = true;
    deficits.push('No new markets opened in the last 8 scenes — the story has stopped introducing fresh questions.');
  }

  // VARIETY — attention concentration across the portfolio.
  if (active >= 3 && snapshot.marketCap > 0) {
    const volumes = Object.values(narrative.threads)
      .filter((t) => !t.closedAt)
      .map((t) => t.beliefs?.[Object.keys(t.beliefs)[0] ?? '']?.volume ?? 0);
    const maxVol = volumes.length > 0 ? Math.max(...volumes) : 0;
    const share = snapshot.marketCap > 0 ? maxVol / snapshot.marketCap : 0;
    signals.topVolumeShare = share;
    if (share >= 0.6) {
      score -= 0.1;
      signals.concentrated = true;
      deficits.push(
        `Attention is ${Math.round(share * 100)}% concentrated on a single thread — the rest of the portfolio is atmospheric.`,
      );
    }
  }

  // VARIETY — peripheral-agent coverage (anchor/recurring with no stake).
  const activeThreadParticipantIds = new Set<string>();
  for (const t of Object.values(narrative.threads)) {
    if (t.closedAt) continue;
    for (const p of t.participants ?? []) {
      if (p.type === 'character') activeThreadParticipantIds.add(p.id);
    }
  }
  const uncoveredAnchors: string[] = [];
  for (const c of Object.values(narrative.characters)) {
    if (c.role === 'anchor' || c.role === 'recurring') {
      if (!activeThreadParticipantIds.has(c.id)) uncoveredAnchors.push(c.name);
    }
  }
  signals.uncoveredAnchorNames = uncoveredAnchors;
  if (active > 0 && uncoveredAnchors.length >= 3) {
    score -= 0.12;
    deficits.push(
      `${uncoveredAnchors.length} anchor/recurring characters have no stake in any open market (e.g. ${uncoveredAnchors.slice(0, 3).join(', ')}) — the world around the protagonist is decorative.`,
    );
  } else if (active > 0 && uncoveredAnchors.length >= 1) {
    score -= 0.04;
    deficits.push(
      `${uncoveredAnchors.length} named character${uncoveredAnchors.length === 1 ? '' : 's'} uncovered by any market (${uncoveredAnchors.slice(0, 2).join(', ')}).`,
    );
  }

  score = clamp01(score);
  const summary =
    active === 0
      ? 'No active threads.'
      : `${active} active · ${nearClosed} near-closed · ${closed} closed · ${recentOpensCount} opened-recently · ${stale} stale · ${uncoveredAnchors.length} NPCs uncovered`;
  return { score, band: bandOf(score), summary, deficits, signals };
}

/** Compose the inbuilt directive for the health expansion — the "recommended
 *  action" the user reads in the diagnostic and the expansion runs against.
 *  Written as a strategic analyst's brief organised around three axes:
 *  NEWNESS (is the story introducing new questions?), VARIETY (is coverage
 *  spread across entities and stakes?), DIRECTION (is anything moving toward
 *  resolution?). Zombies and abandoned threads are reported but not flagged
 *  as problems — some threads are meant to fade. */
export function buildRecommendedAction(signals: PortfolioSignals): string {
  const observations: string[] = [];
  const moves: string[] = [];

  // NEWNESS diagnosis
  if (signals.starved) {
    observations.push('the fate engine is near-empty');
    moves.push('open 2-3 new markets — the top priority is fresh questions, ideally contested ones with real stakes for the central agent');
  } else if (signals.lowNewness) {
    observations.push('no new markets have opened in the last 8 scenes — the story has stopped introducing fresh questions');
    moves.push('open 1-2 new markets that bring a piece of the world into focus the story hasn\'t engaged yet (new agent, new domain, new consequence class)');
  }

  // DIRECTION diagnosis
  if (signals.noForwardSignal) {
    observations.push(`no closures or near-closed markets in ${signals.scenesSinceLastClose >= 100 ? 'the story so far' : signals.scenesSinceLastClose + ' scenes'} — the portfolio has stopped delivering resolution`);
    moves.push('force a near-closure on a ripe thread (use a saturating- or committed-category candidate) AND open a short-horizon market whose resolution lands inside the next few scenes');
  } else if (signals.stagnant) {
    observations.push('every open market is contested but none is pushing toward resolution');
    moves.push('discharge pressure on one contested market via a twist that flips its lean, then let the cascade re-price the coupled threads');
  }

  // VARIETY diagnosis
  if (signals.concentrated) {
    observations.push(`${Math.round(signals.topVolumeShare * 100)}% of attention is concentrated on a single thread`);
    moves.push('open 1-2 peripheral-agent or cost-ledger markets to diversify the pressure');
  }
  if (signals.uncoveredAnchorNames.length >= 3) {
    const sample = signals.uncoveredAnchorNames.slice(0, 3).join(', ');
    const more = signals.uncoveredAnchorNames.length > 3
      ? ` (plus ${signals.uncoveredAnchorNames.length - 3} others)`
      : '';
    observations.push(`${signals.uncoveredAnchorNames.length} named characters without any stake in an open market (${sample}${more})`);
    moves.push(`open peripheral-agent markets covering ${signals.uncoveredAnchorNames.slice(0, 2).join(' and ')} so the world feels responsive rather than decorative`);
  } else if (signals.uncoveredAnchorNames.length >= 1) {
    observations.push(`${signals.uncoveredAnchorNames.slice(0, 2).join(' / ')} currently uncovered`);
    moves.push('consider a short-horizon market for one of them so the cast is active, not backdrop');
  }

  // SIZE caveat
  if (signals.bloated) {
    moves.push('do NOT open more than 1-2 new markets this pass — the portfolio is already stretched; priority is consolidation (force payoffs on ripe threads) over addition');
  }

  // Compose the brief
  if (moves.length === 0) {
    return 'Portfolio is structurally clean — variety, direction, and newness all present. Treat this expansion as forward-planning: open one surprise-capacity market (an outcome the audience couldn\'t predict from the premise) and one cost-ledger market that forces the next bold action to carry weight. The story has room to push, not repair.';
  }

  const diagnosis = observations.length > 0
    ? `Diagnosis: ${observations.join('; ')}.`
    : '';
  const prescription = `Recommended moves (in order of leverage): ${moves.map((m, i) => `(${i + 1}) ${m}`).join('; ')}.`;
  const closer = `Keep zombies alone unless a specific one is getting in the way — attrition retires them over time and they don\'t harm anything live.`;

  return [diagnosis, prescription, closer].filter(Boolean).join(' ');
}

// ── Cast dimension ──────────────────────────────────────────────────────────

function scoreCast(
  narrative: NarrativeState,
  scenes: Scene[],
  pressure: ReturnType<typeof evaluateNarrativeState>['pressure']['entities'],
): HealthDimensionScore {
  const deficits: string[] = [];
  const characters = Object.values(narrative.characters);
  const totalChars = characters.length;
  const anchors = characters.filter((c) => c.role === 'anchor');
  const totalScenes = scenes.length;
  const STALE_CUTOFF = Math.max(5, Math.floor(totalScenes * 0.3));

  // Usage index: scenes per character + staleness.
  const sceneUsage = new Map<string, { count: number; last: number }>();
  scenes.forEach((s, i) => {
    const ids = new Set<string>(s.participantIds ?? []);
    if (s.povId) ids.add(s.povId);
    for (const id of ids) {
      const cur = sceneUsage.get(id) ?? { count: 0, last: -1 };
      sceneUsage.set(id, { count: cur.count + 1, last: i });
    }
  });
  const usedChars = Array.from(sceneUsage.keys()).filter((id) => narrative.characters[id]);
  const usageShare = totalChars > 0 ? usedChars.length / totalChars : 0;

  const staleChars = characters.filter((c) => {
    const u = sceneUsage.get(c.id);
    if (!u) return totalScenes > 0;
    return totalScenes - 1 - u.last >= STALE_CUTOFF;
  });

  // Concentration — top character's share of scenes. >0.6 means one POV is
  // eating the story.
  const topShare = (() => {
    let top = 0;
    for (const { count } of sceneUsage.values()) top = Math.max(top, count);
    return totalScenes > 0 ? top / totalScenes : 0;
  })();

  let score = 1;

  if (totalChars === 0) {
    return {
      score: 0,
      band: 'critical',
      summary: 'No characters.',
      deficits: ['No cast — nothing to centre the story on.'],
    };
  }

  if (anchors.length === 0) {
    score -= 0.35;
    deficits.push('No anchor characters — the cast has no centre of gravity.');
  }

  if (usageShare < 0.5 && totalChars >= 4) {
    score -= 0.15;
    deficits.push(
      `Only ${usedChars.length} of ${totalChars} characters appear in scenes — cast is under-utilised.`,
    );
  }

  if (pressure.shallow.length > 0 && anchors.length > 0) {
    const share = pressure.shallow.length / anchors.length;
    if (share >= 0.5) {
      score -= 0.25;
      deficits.push(`${pressure.shallow.length} of ${anchors.length} anchors are shallow (insufficient world depth).`);
    } else {
      score -= 0.1 * share * 2;
      deficits.push(`${pressure.shallow.length} anchor${pressure.shallow.length === 1 ? '' : 's'} underdeveloped.`);
    }
  }

  if (pressure.neglected.length > 0 && anchors.length > 0) {
    const share = pressure.neglected.length / anchors.length;
    if (share >= 0.5) {
      score -= 0.2;
      deficits.push(`${pressure.neglected.length} anchor${pressure.neglected.length === 1 ? '' : 's'} missing from recent scenes.`);
    }
  }

  const staleShare = totalChars > 0 ? staleChars.length / totalChars : 0;
  if (staleShare >= 0.5 && totalScenes >= 5) {
    score -= 0.15;
    deficits.push(`${staleChars.length} of ${totalChars} characters haven't appeared for 5+ scenes.`);
  }

  if (topShare > 0.7 && totalScenes >= 8) {
    score -= 0.1;
    deficits.push(
      `One character dominates ${Math.round(topShare * 100)}% of scenes — cast rotation is lopsided.`,
    );
  }

  score = clamp01(score);
  const summary = `${anchors.length} anchor${anchors.length === 1 ? '' : 's'} · ${usedChars.length}/${totalChars} used · ${staleChars.length} stale`;
  return { score, band: bandOf(score), summary, deficits };
}

// ── Locations dimension ─────────────────────────────────────────────────────

function scoreLocations(
  narrative: NarrativeState,
  scenes: Scene[],
): HealthDimensionScore {
  const deficits: string[] = [];
  const locations = Object.values(narrative.locations);
  const totalLocs = locations.length;
  const totalScenes = scenes.length;
  const STALE_CUTOFF = Math.max(5, Math.floor(totalScenes * 0.3));

  const usage = new Map<string, { count: number; last: number }>();
  scenes.forEach((s, i) => {
    if (!s.locationId) return;
    const cur = usage.get(s.locationId) ?? { count: 0, last: -1 };
    usage.set(s.locationId, { count: cur.count + 1, last: i });
  });

  const usedLocs = Array.from(usage.keys()).filter((id) => narrative.locations[id]);
  const staleLocs = locations.filter((l) => {
    const u = usage.get(l.id);
    if (!u) return totalScenes > 0;
    return totalScenes - 1 - u.last >= STALE_CUTOFF;
  });
  const topLocShare = (() => {
    let top = 0;
    for (const { count } of usage.values()) top = Math.max(top, count);
    return totalScenes > 0 ? top / totalScenes : 0;
  })();

  let score = 1;

  if (totalLocs === 0) {
    return {
      score: 0,
      band: 'critical',
      summary: 'No locations.',
      deficits: ['No locations — scenes have no physical anchor.'],
    };
  }

  if (totalLocs < 3) {
    score -= 0.2;
    deficits.push(`Only ${totalLocs} location${totalLocs === 1 ? '' : 's'} — world feels constricted.`);
  }

  const usageShare = totalLocs > 0 ? usedLocs.length / totalLocs : 0;
  if (usageShare < 0.5 && totalLocs >= 4) {
    score -= 0.15;
    deficits.push(`${totalLocs - usedLocs.length} of ${totalLocs} locations never appear in a scene.`);
  }

  const staleShare = totalLocs > 0 ? staleLocs.length / totalLocs : 0;
  if (staleShare >= 0.5 && totalScenes >= 5) {
    score -= 0.15;
    deficits.push(`${staleLocs.length} of ${totalLocs} locations haven't been visited recently.`);
  }

  if (topLocShare > 0.7 && totalScenes >= 8) {
    score -= 0.15;
    deficits.push(
      `One location hosts ${Math.round(topLocShare * 100)}% of scenes — setting rotation is narrow.`,
    );
  }

  score = clamp01(score);
  const summary = `${usedLocs.length}/${totalLocs} used · ${staleLocs.length} stale`;
  return { score, band: bandOf(score), summary, deficits };
}

// ── Artifacts dimension ─────────────────────────────────────────────────────

function scoreArtifacts(
  narrative: NarrativeState,
  scenes: Scene[],
): HealthDimensionScore {
  const deficits: string[] = [];
  const artifacts = Object.values(narrative.artifacts ?? {});
  const totalArtifacts = artifacts.length;

  // Usage via artifactUsages on scenes.
  const usage = new Map<string, { count: number; last: number }>();
  scenes.forEach((s, i) => {
    for (const au of s.artifactUsages ?? []) {
      if (!au.artifactId) continue;
      const cur = usage.get(au.artifactId) ?? { count: 0, last: -1 };
      usage.set(au.artifactId, { count: cur.count + 1, last: i });
    }
  });
  const usedArtifacts = Array.from(usage.keys()).filter(
    (id) => narrative.artifacts?.[id],
  );
  const unusedCount = Math.max(0, totalArtifacts - usedArtifacts.length);

  let score = 1;

  if (totalArtifacts === 0) {
    // Not a hard fail — some narratives don't need artifacts. Score at a
    // neutral 0.7 (healthy-watch boundary) and flag softly.
    return {
      score: 0.7,
      band: 'watch',
      summary: 'No artifacts.',
      deficits: [],
    };
  }

  const usageShare = totalArtifacts > 0 ? usedArtifacts.length / totalArtifacts : 0;
  if (usageShare < 0.5) {
    score -= 0.25;
    deficits.push(`${unusedCount} of ${totalArtifacts} artifact${totalArtifacts === 1 ? '' : 's'} never used — objects are decorative, not operative.`);
  } else if (unusedCount > 0 && totalArtifacts >= 4) {
    score -= 0.1;
    deficits.push(`${unusedCount} artifact${unusedCount === 1 ? '' : 's'} never used.`);
  }

  // Key/notable artifacts that have never been used are worse than minor ones.
  const keyUnused = artifacts.filter(
    (a) => (a.significance === 'key' || a.significance === 'notable') && !usage.has(a.id),
  );
  if (keyUnused.length > 0) {
    score -= 0.1 * Math.min(keyUnused.length, 3) / 3;
    deficits.push(`${keyUnused.length} high-significance artifact${keyUnused.length === 1 ? '' : 's'} unused — promised capability not delivered.`);
  }

  score = clamp01(score);
  const summary = `${usedArtifacts.length}/${totalArtifacts} used${unusedCount > 0 ? ` · ${unusedCount} unused` : ''}`;
  return { score, band: bandOf(score), summary, deficits };
}

// ── Systems dimension (world rules) ─────────────────────────────────────────

function scoreSystems(
  narrative: NarrativeState,
  pressure: ReturnType<typeof evaluateNarrativeState>['pressure']['knowledge'],
): HealthDimensionScore {
  const deficits: string[] = [];
  const systemNodeCount = Object.keys(narrative.systemGraph?.nodes ?? {}).length;
  let score = 1;

  if (systemNodeCount < 3) {
    score -= 0.35;
    deficits.push('System knowledge graph is sparse — world rules are under-articulated.');
  } else if (systemNodeCount < 6) {
    score -= 0.1;
    deficits.push('System knowledge graph is thin — more rules worth articulating.');
  }

  if (pressure.isStagnant) {
    score -= 0.2;
    deficits.push('System growth stagnant in the recent window — no new rules being surfaced.');
  }

  score = clamp01(score);
  const summary = `${systemNodeCount} concept${systemNodeCount === 1 ? '' : 's'} · recent growth ${pressure.recentGrowth.toFixed(1)}`;
  return { score, band: bandOf(score), summary, deficits };
}

// ── Balance dimension ───────────────────────────────────────────────────────

function scoreBalance(
  pressure: ReturnType<typeof evaluateNarrativeState>['pressure']['balance'],
): HealthDimensionScore {
  const deficits: string[] = [];
  let score = 1;
  if (pressure.dominant !== 'balanced') {
    score -= 0.2;
    deficits.push(`${pressure.dominant[0].toUpperCase()}${pressure.dominant.slice(1)}-dominant — other forces under-delivered.`);
  }
  return { score, band: bandOf(score), summary: pressure.recommendation, deficits };
}

// ── Public entry point ─────────────────────────────────────────────────────

export function computeNarrativeHealth(
  narrative: NarrativeState,
  resolvedKeys: string[],
  currentIndex: number,
  config?: AutoConfig,
): HealthReport {
  const snapshot = computePortfolioSnapshot(narrative);
  const effectiveConfig: AutoConfig = config ?? {
    endConditions: [],
    minArcLength: 2,
    maxArcLength: 5,
    maxActiveThreads: 5,
    threadStagnationThreshold: 5,
    direction: '',
    toneGuidance: '',
    narrativeConstraints: '',
    characterRotationEnabled: false,
    minScenesBetweenCharacterFocus: 0,
  };
  const auto = evaluateNarrativeState(narrative, resolvedKeys, currentIndex, effectiveConfig);

  // Scenes visible up to the reader's current position — we score the
  // perceived story, not the whole buffer.
  const sceneList: Scene[] = resolvedKeys
    .slice(0, currentIndex + 1)
    .map((k) => narrative.scenes[k])
    .filter(Boolean)
    .filter(isScene);

  const threadsResult = scoreThreads(narrative, snapshot, auto.pressure.threads, resolvedKeys, currentIndex);
  const { signals: portfolioSignals, ...threads } = threadsResult;
  const recommendedAction = buildRecommendedAction(portfolioSignals);
  const cast = scoreCast(narrative, sceneList, auto.pressure.entities);
  const locations = scoreLocations(narrative, sceneList);
  const artifacts = scoreArtifacts(narrative, sceneList);
  const systems = scoreSystems(narrative, auto.pressure.knowledge);
  const balance = scoreBalance(auto.pressure.balance);

  const overall =
    threads.score * WEIGHTS.threads +
    cast.score * WEIGHTS.cast +
    locations.score * WEIGHTS.locations +
    artifacts.score * WEIGHTS.artifacts +
    systems.score * WEIGHTS.systems +
    balance.score * WEIGHTS.balance;

  const band = bandOf(overall);
  const needsMaintenance = band === 'needs_maintenance' || band === 'critical';

  // Rank deficits by dimension severity × dimension weight.
  const ranked: Array<{ weight: number; text: string }> = [];
  const collect = (d: HealthDimensionScore, w: number) => {
    for (const t of d.deficits) ranked.push({ weight: (1 - d.score) * w, text: t });
  };
  collect(threads, WEIGHTS.threads);
  collect(cast, WEIGHTS.cast);
  collect(locations, WEIGHTS.locations);
  collect(artifacts, WEIGHTS.artifacts);
  collect(systems, WEIGHTS.systems);
  collect(balance, WEIGHTS.balance);
  ranked.sort((a, b) => b.weight - a.weight);
  const topDeficits = ranked.slice(0, 6).map((r) => r.text);

  let headline: string;
  switch (band) {
    case 'healthy':
      headline = 'Narrative is running clean — no maintenance needed.';
      break;
    case 'watch':
      headline = 'Narrative is stable; minor friction worth monitoring.';
      break;
    case 'needs_maintenance':
      headline = 'Narrative is running low — a health top-up would restore flow.';
      break;
    case 'critical':
      headline = 'Narrative engine is starved — maintenance expansion strongly recommended.';
      break;
  }

  return {
    overall,
    band,
    headline,
    dimensions: { threads, cast, locations, artifacts, systems, balance },
    topDeficits,
    needsMaintenance,
    portfolioSignals,
    recommendedAction,
  };
}

/** Render the report as a compact plain-text block for LLM prompts. */
export function renderHealthReportForPrompt(report: HealthReport): string {
  const dim = (label: string, d: HealthDimensionScore) =>
    `${label}: ${d.band} (${(d.score * 100).toFixed(0)}%) — ${d.summary}` +
    (d.deficits.length > 0 ? `\n  ${d.deficits.map((x) => `· ${x}`).join('\n  ')}` : '');

  // Portfolio-first ordering. The thread dimension IS the fate engine — when
  // this is broken, nothing else matters, and the health expansion exists
  // primarily to repair it. Other dimensions are supporting context, not
  // peers. Deficits flagged as DANGER are surfaced at the top so the
  // expansion prompt sees the critical signals first.
  const t = report.dimensions.threads;
  const portfolioDangers = t.deficits.filter((d) => d.startsWith('DANGER'));
  const portfolioWarnings = t.deficits.filter((d) => !d.startsWith('DANGER'));

  return [
    `NARRATIVE HEALTH REPORT — overall: ${report.band} (${(report.overall * 100).toFixed(0)}%)`,
    report.headline,
    '',
    'RECOMMENDED ACTION (built-in directive — execute this)',
    `  ${report.recommendedAction}`,
    '',
    `PORTFOLIO AUDIT (priority #1 — thread markets are the fate engine)`,
    `  state: ${t.band} (${(t.score * 100).toFixed(0)}%) — ${t.summary}`,
    ...(portfolioDangers.length > 0
      ? ['  DANGERS:', ...portfolioDangers.map((d) => `  · ${d.replace(/^DANGER[—\s-]*/i, '')}`)]
      : []),
    ...(portfolioWarnings.length > 0
      ? ['  WARNINGS:', ...portfolioWarnings.map((d) => `  · ${d}`)]
      : []),
    '',
    'SUPPORTING DIMENSIONS (context for the expansion, not the priority)',
    dim('Cast', report.dimensions.cast),
    dim('Locations', report.dimensions.locations),
    dim('Artifacts', report.dimensions.artifacts),
    dim('Systems', report.dimensions.systems),
    dim('Balance', report.dimensions.balance),
    '',
    'TOP DEFICITS (ranked across dimensions):',
    ...report.topDeficits.map((d, i) => `${i + 1}. ${d}`),
  ].join('\n');
}

// Re-exports that keep the type surface tidy without leaking helpers.
export type { Character };
