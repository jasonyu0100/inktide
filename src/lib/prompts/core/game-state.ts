/**
 * Arc metadata guidance — XML block injected into user prompts that produce
 * arc-level metadata (directionVector + worldState).
 *
 * worldState is the "chess-board position" at the end of an arc: a compact
 * ground-truth snapshot in the NATIVE FORM of the work's domain. The block
 * forces the model to identify the work type first, then emit state in that
 * domain's native compact form.
 */

export const PROMPT_ARC_STATE_GUIDANCE = `<arc-metadata hint="DIRECTION VECTOR (forward) & WORLD STATE (backward) frame every arc.">
  <description>Direction looks forward — what this arc drives toward. World State looks backward — the compact, objective position after the arc resolves, from which a downstream reasoner can pick up WITHOUT replaying the scene deltas.</description>

  <field name="directionVector" length="10-15 words" hint="Single sentence; uses ENTITY NAMES; states what changes, who drives it, what's at stake." />
  <field name="worldState" length="50-90 words" hint="Terse and structured, ground truth only, no speculation, no narration. The 'chess-board position' as of the END OF THIS ARC." />

  <domain-adaptive hint="Identify the TYPE OF WORK first, then emit state in that domain's NATIVE compact form. Do NOT force narrative shape onto a chess position, or stats onto a story.">
    <domain kind="fiction-novel-screenplay">character positions (who is where NOW), live thread markets with their top outcome + probability ("T-Rivalry: Meng betrays 0.72"), artifacts and who holds them, alliances and rivalries, standing reveals, unresolved questions.</domain>
    <domain kind="chess-or-strategic-game">piece positions, side-to-move, castling/special rights, material balance, active threats, pawn structure.</domain>
    <domain kind="poker-or-imperfect-info">stack sizes, pot size, hole cards if known, community cards, action position, inferred ranges.</domain>
    <domain kind="paper-non-fiction-research">claims established, evidence anchored, open questions, unresolved dependencies, remaining work.</domain>
    <domain kind="stock-tracker-systems-log-investigation">entities tracked, latest metric values, recent trends, open positions, active signals, alerts.</domain>
  </domain-adaptive>

  <rules>
    <rule>Use ENTITY NAMES, never raw IDs.</rule>
    <rule>No speculation about what happens next — that belongs in directionVector.</rule>
    <rule>No narration or scene retelling — STATE ONLY.</rule>
    <rule>Prefer compact structured phrasing ("Fang Yuan at Green Lotus Peak; holds Liquor worm; T-Rivalry escalating; alliance with Meng Song seeded") over flowing prose.</rule>
  </rules>
</arc-metadata>`;
