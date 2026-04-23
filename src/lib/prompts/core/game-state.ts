/**
 * Arc metadata guidance — directionVector (forward) and worldState (backward).
 *
 * Shared across arc-creation prompts (manual generation, initial world gen,
 * corpus analysis) so the same domain-adaptive framing is used everywhere.
 *
 * worldState is the "chess-board position" at the end of an arc: a compact
 * ground-truth snapshot in the NATIVE FORM of the work's domain. A narrative
 * describes itself differently from a chess position, a poker hand, a paper,
 * or a stock log — the prompt forces the model to identify the domain first
 * and use that domain's native compact representation.
 */

export const PROMPT_ARC_STATE_GUIDANCE = `
ARC METADATA — DIRECTION VECTOR (forward) & WORLD STATE (backward)

These two fields frame every arc. Direction looks forward — what this arc drives toward. World State looks backward — the compact, objective position after the arc resolves, from which a downstream reasoner can pick up WITHOUT replaying the scene deltas.

directionVector — single sentence (10-15 words), uses ENTITY NAMES, states what changes, who drives it, what's at stake.

worldState — 50-90 words, terse and structured, ground truth only, no speculation, no narration. It is the "chess-board position" as of the END OF THIS ARC.

DOMAIN-ADAPTIVE — identify the TYPE OF WORK first, then emit state in that domain's NATIVE compact form:
  - Fiction / novel / screenplay: character positions (who is where NOW), live thread markets with their top outcome + probability ("T-Rivalry: Meng betrays 0.72"), artifacts and who holds them, alliances and rivalries, standing reveals, unresolved questions.
  - Chess or strategic game: piece positions, side-to-move, castling/special rights, material balance, active threats, pawn structure.
  - Poker or imperfect-information game: stack sizes, pot size, hole cards if known, community cards, action position, inferred ranges.
  - Academic paper / non-fiction / research: claims established, evidence anchored, open questions, unresolved dependencies, remaining work.
  - Stock tracker / systems log / investigation: entities tracked, latest metric values, recent trends, open positions, active signals, alerts.

Do NOT force narrative shape onto a chess position, or stats onto a story — use the representation NATIVE to the domain you detect.
- Use ENTITY NAMES, never raw IDs.
- No speculation about what happens next (that belongs in directionVector).
- No narration or scene retelling — STATE ONLY.
- Prefer compact structured phrasing ("Fang Yuan at Green Lotus Peak; holds Liquor worm; T-Rivalry escalating; alliance with Meng Song seeded") over flowing prose.
`;
