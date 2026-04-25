/**
 * World Prompt (narrative consistency rules) — shared text block (used in both
 * system and user prompt contexts; kept plain text so it works in either).
 */

export const PROMPT_WORLD = `WORLD CONSISTENCY:
- CHARACTER MOVEMENT: should be legible to the reader. Record it in characterMovements; prefer revisiting established locations. Non-literal translocation (dream-logic, ceremonial, stage-play-derived, or fabulist forms) is valid when the declared form supports it; literal teleportation in a realist register is a continuity break.
- PERSISTENT STATE: injuries, exhaustion, and consequences persist scene to scene.
- INFORMATION DISCIPLINE: characters cannot act on information they haven't learned.
- TIME GAPS: signal time gaps clearly — "Three days later", "By morning".`;
