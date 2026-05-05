/**
 * Market briefing data types — shared between the prompt builder, the AI
 * call, the canvas view, and the persistent storage on NarrativeState. Kept
 * here (and not in prompts/ or ai/) to break the cycle:
 * NarrativeState.lastBriefing references MarketBriefing, and
 * prompts/briefing + ai/market-brief both reference NarrativeState.
 */

export const MOVE_PRIORITIES = ['high', 'medium', 'low'] as const;
export type MovePriority = (typeof MOVE_PRIORITIES)[number];

export const MOVE_TYPES = [
  'open',         // open a new market — fresh contested question
  'escalate',     // raise stakes / volume on an existing market
  'subvert',      // introduce evidence that inverts the leading outcome
  'foreshadow',   // plant low-evidence seed for future payoff
  'redirect',     // shift focus to a neglected entity / market
  'consolidate',  // merge / combine to build compound stakes
  'release',      // discharge accumulated pressure — closure with quality
  'destabilise',  // break a saturated market open
  'sustain',      // keep tension active without committing
] as const;
export type MoveType = (typeof MOVE_TYPES)[number];

export const EXPANSION_KINDS = ['character', 'location', 'artifact', 'thread', 'system'] as const;
export type ExpansionKind = (typeof EXPANSION_KINDS)[number];

export type SuggestedMove = {
  label: string;
  priority: MovePriority;
  moveType: MoveType;
  target: string;
  rationale: string;
  direction: string;
};

export type WorldExpansion = {
  label: string;
  kind: ExpansionKind;
  rationale: string;
  direction: string;
};

export type WatchItem = {
  title: string;
  analysis: string;
};

export type MarketBriefing = {
  headline: string;
  situation: string;
  watch: WatchItem[];
  moves: SuggestedMove[];
  expansions: WorldExpansion[];
  outlook: {
    nearTerm: string;
    phaseEnd: string;
  };
};

/**
 * Persisted on a narrative: the most recent briefing the operator
 * generated, plus the head index and branch it was generated against.
 * Used to hydrate the brief view on tab-switch and to flag staleness when
 * the active branch's head has moved on (or the active branch changed).
 */
export type StoredBriefing = {
  briefing: MarketBriefing;
  /** Branch the briefing was generated against. Used to flag staleness when
   *  the active branch changes. */
  branchId: string;
  /** Index in resolvedEntryKeys at which the briefing was generated.
   *  Briefings always read from the head of the branch, so this is the
   *  head index at generation time. */
  sceneIndex: number;
  /** Wall-clock timestamp at generation time. */
  timestamp: number;
};
