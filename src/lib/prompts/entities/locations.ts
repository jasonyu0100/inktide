/**
 * Locations Prompt
 */

export const PROMPT_LOCATIONS = `
LOCATIONS — PHYSICAL places you can stand in. Test: could a character walk there?

NOT locations: abstract domains, institutions, frameworks → world knowledge or artifacts.
  Hospital = location. Medical system = knowledge. Organisation = artifact. HQ = location.

CONTINUITY: Locations accumulate history, state, rules. Rules constrain characters.
HIERARCHY: room → building → district → city → region (via parentId)
TIES: Character's belonging to a place — identity, not just visiting.
  Removing a tie = significant event (exile, departure). Temporary visits don't remove ties.
`;
