/**
 * Time delta helpers.
 *
 * Scenes are instants; the gap between consecutive scenes is a TimeDelta
 * ({value, unit}). `value: 0` marks a concurrent scene (same moment as the
 * prior scene — parallel POV, cutaway, or simultaneous vantage).
 *
 * Time is tracked relative to the first scene only — there is no absolute
 * calendar anchor. Offsets give scale ("T+2 weeks") without claiming real-
 * world dates.
 *
 * Months and years use average lengths (30.44 days / 365.25 days) — good
 * enough for narrative pacing and financial bucket alignment, but do not
 * treat the seconds value as an exact wall-clock duration.
 */

import type { Scene, TimeDelta, TimeUnit } from "@/types/narrative";

/** Average seconds per unit. Months = 30.44 days, years = 365.25 days. */
export const SECONDS_PER_UNIT: Record<TimeUnit, number> = {
  minute: 60,
  hour: 60 * 60,
  day: 60 * 60 * 24,
  week: 60 * 60 * 24 * 7,
  month: Math.round(60 * 60 * 24 * 30.44),
  year: Math.round(60 * 60 * 24 * 365.25),
};

/** Units ordered small → large, for picking a readable display unit. */
export const TIME_UNITS_ASCENDING: TimeUnit[] = [
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
];

export function timeDeltaToSeconds(d: TimeDelta): number {
  return d.value * SECONDS_PER_UNIT[d.unit];
}

/** Validate a parsed timeDelta from LLM output. Returns null for missing /
 *  malformed entries. Accepts plural unit forms ("weeks", "days") and
 *  lowercases them so downstream code always sees a canonical singular unit.
 *  Use at every LLM boundary — generation, analysis, reconstruction. */
export function normalizeTimeDelta(raw: unknown): TimeDelta | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { value?: unknown; unit?: unknown };
  const value = typeof r.value === "number" ? r.value : Number(r.value);
  if (!Number.isFinite(value) || value < 0) return null;
  if (typeof r.unit !== "string") return null;
  const singular = r.unit.toLowerCase().replace(/s$/, "");
  if (
    singular !== "minute" &&
    singular !== "hour" &&
    singular !== "day" &&
    singular !== "week" &&
    singular !== "month" &&
    singular !== "year"
  ) {
    return null;
  }
  return { value: Math.round(value), unit: singular };
}

/** Format a time delta as "3 days", "2 hours", "concurrent" (value=0),
 *  or "—" when unspecified. Pluralises naively (s-suffix). Tolerates LLM
 *  output where the unit is already plural ("weeks") by stripping a trailing
 *  "s" before re-pluralising. */
export function formatTimeDelta(
  d: TimeDelta | null | undefined,
): string {
  if (!d) return "—";
  if (d.value === 0) return "concurrent";
  const singular = d.unit.endsWith("s")
    ? (d.unit.slice(0, -1) as TimeUnit)
    : d.unit;
  const unit = d.value === 1 ? singular : `${singular}s`;
  return `${d.value} ${unit}`;
}

/** Format a cumulative offset (seconds from origin) by picking the largest
 *  unit whose value is ≥ 1. "0s" collapses to "origin". */
export function formatCumulative(seconds: number): string {
  if (seconds <= 0) return "origin";
  for (let i = TIME_UNITS_ASCENDING.length - 1; i >= 0; i--) {
    const unit = TIME_UNITS_ASCENDING[i];
    const per = SECONDS_PER_UNIT[unit];
    if (seconds >= per) {
      const value = seconds / per;
      const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
      const label = rounded === 1 ? unit : `${unit}s`;
      return `${rounded} ${label}`;
    }
  }
  return "origin";
}

/** Human-readable description of the time gap into a scene, with
 *  storytelling guidance the planner and prose writer can act on. The gap
 *  shapes opening beats: concurrent scenes shouldn't re-establish setting,
 *  multi-week jumps need a kicker, year-scale gaps may want a montage.
 *  Surfaced through sceneContext so every downstream LLM call sees it. */
export function describeTimeGap(d: TimeDelta | null | undefined): string {
  if (!d) {
    return "Unspecified — treat as ordinary scene continuity.";
  }
  if (d.value === 0) {
    return "Concurrent or opening. Same moment as the prior scene (parallel POV / cutaway) OR the very first scene of the work. Do NOT re-establish setting from scratch; open mid-action or anchor the opening as the scene demands.";
  }
  const seconds = timeDeltaToSeconds(d);
  const elapsed = formatTimeDelta(d);
  // < 1 hour
  if (seconds < 60 * 60) {
    return `${elapsed} since the prior scene. Continuous time — same scene fabric, immediate continuation. Setting may shift to an adjacent space, but the day, weather, and emotional momentum carry over. No re-orientation beat needed.`;
  }
  // < 1 day
  if (seconds < 60 * 60 * 24) {
    return `${elapsed} since the prior scene. Same day. Place may have changed; light, mood, or pace may have shifted. A brief sensory cue (light, sound, fatigue, hunger) anchors the new moment without a hard scene break.`;
  }
  // < 1 week
  if (seconds < 60 * 60 * 24 * 7) {
    return `${elapsed} since the prior scene. Soft scene break — open with a short kicker that anchors the new day (weather, routine, an arriving message). Characters' emotional state may have settled; small status changes are plausible.`;
  }
  // < 1 month
  if (seconds < 60 * 60 * 24 * 30) {
    return `${elapsed} since the prior scene. Significant gap. Setting may have visibly shifted (weather, season turning, project progress, healing wounds). Characters may have aged subtly; relationships have had time to evolve; promises and threats have ripened. Open with an orienting beat that signals the gap.`;
  }
  // < 1 year
  if (seconds < 60 * 60 * 24 * 365) {
    return `${elapsed} since the prior scene. Major gap. Status quo has shifted — wounds healed, plans matured, alliances tested, news spread. The world moved on without the reader. Open with a kicker that re-anchors the new now (a montage paragraph, a season cue, a status-change reveal).`;
  }
  // ≥ 1 year
  return `${elapsed} since the prior scene. Generational gap. Open with a strong anchor — a montage, an aged-up character description, an environmental change that visibly shows time has passed. Prior emotional momentum is mostly cool; reframe stakes for the new era before re-engaging the active threads.`;
}

/** Compute cumulative seconds-from-origin for a sequence of scenes in branch
 *  order. Scenes with null/absent deltas contribute 0 to the cumulative
 *  offset (they inherit the prior scene's timestamp). The first scene is
 *  always at offset 0. */
export function computeSceneOffsets(scenes: Scene[]): number[] {
  const offsets: number[] = [];
  let acc = 0;
  for (let i = 0; i < scenes.length; i++) {
    if (i === 0) {
      offsets.push(0);
      continue;
    }
    const d = scenes[i].timeDelta;
    if (d) acc += timeDeltaToSeconds(d);
    offsets.push(acc);
  }
  return offsets;
}
