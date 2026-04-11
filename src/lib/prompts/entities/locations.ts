/**
 * Locations Prompt
 */

export const PROMPT_LOCATIONS = `
LOCATIONS — PHYSICAL places you can stand in.
  ✓ Hogwarts, Stanford lab, the throne room — places you can walk into
  ✗ "The wizarding world", "academia", "NeurIPS" — abstract domains (system knowledge)

HIERARCHY: room → building → district → city → region (via parentId)
TIES: Character BELONGING — identity, not visiting. Removing = significant event.
`;
