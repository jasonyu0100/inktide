/**
 * World Prompt (narrative consistency rules)
 */

export const PROMPT_WORLD = `<world-consistency>
  <rule name="character-movement">Character movement should be legible to the reader. Record it in characterMovements; prefer revisiting established locations. Non-literal translocation (dream-logic, ceremonial, stage-play-derived, or fabulist forms) is valid when the declared form supports it; literal teleportation in a realist register is a continuity break.</rule>
  <rule name="persistent-state">Injuries, exhaustion, and consequences persist scene to scene.</rule>
  <rule name="information-discipline">Characters cannot act on information they haven't learned.</rule>
  <rule name="time-gaps">Signal time gaps clearly — "Three days later", "By morning".</rule>
</world-consistency>`;
