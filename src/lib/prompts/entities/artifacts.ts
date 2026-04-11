/**
 * Artifact Usage Prompt
 */

export const PROMPT_ARTIFACTS = `
ARTIFACTS — anything that delivers UTILITY. Active tools, not passive objects.

OWNERSHIP TIERS:
  Character-owned — controlled by one entity (wand, company, portfolio)
  Location-owned — bound to place (forge, library, courtroom). Must be present to use.
  World-owned (parentId: null) — universally accessible (internet, natural law, market)

USAGE: When artifact delivers utility (not just mentioned), generate artifactUsage.
  Generate continuityMutations for BOTH artifact AND user.

VALUE: Characters scheme to acquire, protect, control, destroy.
COST: Power comes with consequences — depletion, corruption, dependency.
`;
