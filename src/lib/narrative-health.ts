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

function scoreThreads(
  narrative: NarrativeState,
  snapshot: ReturnType<typeof computePortfolioSnapshot>,
  pressure: ReturnType<typeof evaluateNarrativeState>['pressure']['threads'],
): HealthDimensionScore {
  const deficits: string[] = [];
  const active = snapshot.activeThreads;
  const stale = pressure.stale.length;
  const abandoned = snapshot.abandonedThreads;
  const closed = snapshot.closedThreads;
  const nearClosed = snapshot.nearClosedThreads;

  let score = 1;
  if (active < 2) {
    score -= 0.5;
    deficits.push(`Only ${active} active thread${active === 1 ? '' : 's'} — narrative engine is starved.`);
  } else if (active < 3) {
    score -= 0.2;
    deficits.push(`Thin thread portfolio (${active} active) — stakes feel narrow.`);
  } else if (active > 8) {
    score -= 0.15;
    deficits.push(`${active} active threads — reader bandwidth overloaded.`);
  }

  const staleShare = active > 0 ? stale / active : 0;
  if (staleShare >= 0.5) {
    score -= 0.3;
    deficits.push(`${stale} of ${active} active threads are stale (no delta in 5+ scenes).`);
  } else if (staleShare >= 0.25) {
    score -= 0.15;
    deficits.push(`${stale} stale threads drifting toward abandonment.`);
  }

  if (abandoned > active && abandoned > 0) {
    score -= 0.15;
    deficits.push(`Abandoned count (${abandoned}) exceeds active — portfolio is thinning.`);
  }

  const sceneCount = Object.values(narrative.scenes).filter(isScene).length;
  if (sceneCount >= 10 && closed === 0 && nearClosed === 0 && active > 0) {
    score -= 0.1;
    deficits.push('No threads have closed or saturated — nothing is paying off.');
  }

  score = clamp01(score);
  const summary =
    active === 0
      ? 'No active threads.'
      : `${active} active · ${stale} stale · ${closed} closed · ${abandoned} abandoned`;
  return { score, band: bandOf(score), summary, deficits };
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

  const threads = scoreThreads(narrative, snapshot, auto.pressure.threads);
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
  };
}

/** Render the report as a compact plain-text block for LLM prompts. */
export function renderHealthReportForPrompt(report: HealthReport): string {
  const dim = (label: string, d: HealthDimensionScore) =>
    `${label}: ${d.band} (${(d.score * 100).toFixed(0)}%) — ${d.summary}` +
    (d.deficits.length > 0 ? `\n  ${d.deficits.map((x) => `· ${x}`).join('\n  ')}` : '');
  return [
    `NARRATIVE HEALTH REPORT — overall: ${report.band} (${(report.overall * 100).toFixed(0)}%)`,
    report.headline,
    '',
    dim('Threads', report.dimensions.threads),
    dim('Cast', report.dimensions.cast),
    dim('Locations', report.dimensions.locations),
    dim('Artifacts', report.dimensions.artifacts),
    dim('Systems', report.dimensions.systems),
    dim('Balance', report.dimensions.balance),
    '',
    'TOP DEFICITS (ranked):',
    ...report.topDeficits.map((d, i) => `${i + 1}. ${d}`),
  ].join('\n');
}

// Re-exports that keep the type surface tidy without leaking helpers.
export type { Character };
