/**
 * Beat profile system — Markov chains for prose plan generation.
 *
 * Parallel to markov.ts (which handles pacing cube corners),
 * this handles beat function transitions and mechanism distributions
 * for prose plan generation.
 *
 * Default profile derived from empirical analysis of 1,448 beats
 * across 10 published works (HP, RI, 1984, Gatsby, Dickens,
 * Shakespeare, Alice, Wealth of Nations).
 */

import type { BeatFn, BeatMechanism, BeatTransitionMatrix, ProseProfile, NarrativeState } from '@/types/narrative';
import { BEAT_FN_LIST, BEAT_MECHANISM_LIST } from '@/types/narrative';

// ── Default Beat Transition Matrix ──────────────────────────────────────────
// "Storyteller" equivalent for beats — balanced fiction profile.
// Derived from global averages across all fiction works.
//
// Read as: from row → to column probability
// e.g. breathe→inform: 0.52 means after a breathe beat, 52% chance of inform next.

export const DEFAULT_BEAT_MATRIX: BeatTransitionMatrix = {
  breathe:    { inform: 0.52, advance: 0.19, bond: 0.05, turn: 0.04, reveal: 0.04, expand: 0.05, foreshadow: 0.03, resolve: 0.03, shift: 0.02, breathe: 0.03 },
  inform:     { advance: 0.41, breathe: 0.15, inform: 0.12, bond: 0.08, turn: 0.06, reveal: 0.05, expand: 0.04, foreshadow: 0.04, resolve: 0.03, shift: 0.02 },
  advance:    { inform: 0.21, advance: 0.23, breathe: 0.14, bond: 0.08, turn: 0.08, reveal: 0.07, expand: 0.05, foreshadow: 0.05, resolve: 0.05, shift: 0.04 },
  bond:       { inform: 0.23, advance: 0.16, breathe: 0.15, bond: 0.12, turn: 0.08, reveal: 0.07, expand: 0.05, foreshadow: 0.05, resolve: 0.05, shift: 0.04 },
  turn:       { advance: 0.27, inform: 0.24, resolve: 0.18, breathe: 0.10, reveal: 0.06, bond: 0.05, expand: 0.04, foreshadow: 0.03, shift: 0.02, turn: 0.01 },
  reveal:     { advance: 0.25, inform: 0.25, breathe: 0.12, bond: 0.10, turn: 0.07, reveal: 0.05, expand: 0.05, foreshadow: 0.04, resolve: 0.04, shift: 0.03 },
  shift:      { advance: 0.31, resolve: 0.17, breathe: 0.10, inform: 0.10, foreshadow: 0.10, bond: 0.07, turn: 0.05, reveal: 0.04, expand: 0.04, shift: 0.02 },
  expand:     { advance: 0.28, inform: 0.19, breathe: 0.17, bond: 0.08, turn: 0.07, reveal: 0.06, expand: 0.05, foreshadow: 0.04, resolve: 0.04, shift: 0.02 },
  foreshadow: { advance: 0.21, inform: 0.16, breathe: 0.13, turn: 0.13, resolve: 0.10, bond: 0.07, reveal: 0.06, expand: 0.05, foreshadow: 0.05, shift: 0.04 },
  resolve:    { breathe: 0.31, advance: 0.26, foreshadow: 0.13, inform: 0.10, bond: 0.05, expand: 0.05, reveal: 0.04, turn: 0.03, shift: 0.02, resolve: 0.01 },
};

// ── Default Mechanism Distribution ──────────────────────────────────────────
// How prose should be distributed across delivery mechanisms.

export const DEFAULT_MECHANISM_DIST: Partial<Record<BeatMechanism, number>> = {
  dialogue: 0.32,
  action: 0.23,
  narration: 0.18,
  environment: 0.14,
  thought: 0.11,
  document: 0.01,
  memory: 0.005,
  comic: 0.005,
};

// ── Default Prose Profile ───────────────────────────────────────────────────

export const DEFAULT_PROSE_PROFILE: ProseProfile = {
  id: 'default',
  name: 'Storyteller',
  source: 'Balanced fiction average (10 works)',
  scenesAnalyzed: 100,
  totalBeats: 1448,
  beatsPerKWord: 12,
  register: 'conversational',
  stance: 'close_third',
  devices: ['free_indirect_discourse', 'dramatic_irony'],
  rules: ['Show emotion through physical reaction, never name it'],
  beatDistribution: {
    advance: 0.25, inform: 0.22, breathe: 0.16, reveal: 0.08,
    bond: 0.07, expand: 0.06, turn: 0.06, resolve: 0.04,
    foreshadow: 0.04, shift: 0.03,
  },
  mechanismDistribution: DEFAULT_MECHANISM_DIST,
  markov: DEFAULT_BEAT_MATRIX,
  builtIn: true,
};

// ── Preset management ───────────────────────────────────────────────────────

export type BeatProfilePreset = {
  key: string;
  name: string;
  description: string;
  profile: ProseProfile;
};

/** Mutable preset list — populated at runtime from analysed works. */
export let BEAT_PROFILE_PRESETS: BeatProfilePreset[] = [];

/** Populate beat profile presets from loaded work narratives. */
export function initBeatProfilePresets(works: { key: string; name: string; narrative: NarrativeState }[]) {
  const presets: BeatProfilePreset[] = [
    { key: 'storyteller', name: 'Storyteller', description: 'Balanced fiction — derived from 10 published works', profile: DEFAULT_PROSE_PROFILE },
  ];

  for (const { key, name, narrative } of works) {
    if (narrative.proseProfile) {
      presets.push({
        key,
        name,
        description: `${narrative.proseProfile.register} ${narrative.proseProfile.stance} — ${narrative.proseProfile.scenesAnalyzed} scenes analysed`,
        profile: narrative.proseProfile,
      });
    }
  }

  BEAT_PROFILE_PRESETS = presets;
}

/** Sample a beat sequence from a profile's Markov chain. */
export function sampleBeatSequence(
  profile: ProseProfile,
  length: number,
  startFn: BeatFn = 'breathe',
): BeatFn[] {
  const sequence: BeatFn[] = [];
  let current = startFn;

  for (let i = 0; i < length; i++) {
    sequence.push(current);
    const row = profile.markov[current];
    if (!row) { current = 'advance'; continue; }

    // Weighted random sample
    const r = Math.random();
    let cumulative = 0;
    let next: BeatFn = 'advance';
    for (const [fn, prob] of Object.entries(row)) {
      cumulative += prob;
      if (r <= cumulative) { next = fn as BeatFn; break; }
    }
    current = next;
  }

  return sequence;
}

/** Sample a mechanism for a given beat fn based on the profile's mechanism distribution. */
export function sampleMechanism(profile: ProseProfile): BeatMechanism {
  const dist = profile.mechanismDistribution;
  const r = Math.random();
  let cumulative = 0;
  for (const [mech, prob] of Object.entries(dist)) {
    cumulative += prob ?? 0;
    if (r <= cumulative) return mech as BeatMechanism;
  }
  return 'action';
}

/** Resolve which profile to use based on story settings. */
export function resolveProfile(narrative: NarrativeState): ProseProfile {
  const preset = narrative.storySettings?.beatProfilePreset;

  // 'self' = this story's own profile
  if (preset === 'self' && narrative.proseProfile) return narrative.proseProfile;

  // Named preset
  if (preset) {
    const found = BEAT_PROFILE_PRESETS.find((p) => p.key === preset);
    if (found) return found.profile;
  }

  // Story's own profile if it has one
  if (narrative.proseProfile) return narrative.proseProfile;

  // Global default
  return DEFAULT_PROSE_PROFILE;
}
