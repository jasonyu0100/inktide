/**
 * Entity Integration Rules Prompt
 *
 * Shared between world generation and world expansion.
 */

export const PROMPT_ENTITY_INTEGRATION = `
INTEGRATION RULES:
- Characters are conscious beings with agency. Non-sentient AI is an artifact. Every new character MUST have at least 1 relationship to an existing character.
- Locations are spatial areas. Every new location SHOULD nest under an existing location via parentId (except top-level regions).
- Artifacts are anything that delivers utility — active tools, not passive concepts. Concepts belong in world knowledge. Artifacts MUST have parentId referencing a character, location, or null for world-owned.
- Thread participants MUST include at least one existing character or location.
- Names must match the cultural palette already established in the world.
`;
