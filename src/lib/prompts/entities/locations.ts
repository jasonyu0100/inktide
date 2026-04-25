/**
 * Locations Prompt — shared text block (used in both system and user prompt
 * contexts; kept plain text so it works in either).
 */

export const PROMPT_LOCATIONS = `LOCATIONS — PHYSICAL places you can stand in. Draw examples from the work's own cultural palette.

Good examples: a throne room, a madrasa courtyard, a Stanford lab, a Song dynasty teahouse, a favela stairwell, a longhouse, a kiln floor — places you can walk into.

Bad examples (abstract domains belong in system knowledge): "the wizarding world", "academia", "NeurIPS", "the diaspora", "late capitalism".

Rules:
- HIERARCHY: room → building → district → city → region (via parentId).
- TIES: entity BELONGING — identity, not visiting. Removing = significant event. (Entities can be characters, or collective bodies in non-fiction: a research group, a village, a guild.) Use tieDeltas for belonging shifts.`;
