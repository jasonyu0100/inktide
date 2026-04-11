/**
 * Entity Integration Rules Prompt
 *
 * Shared between world generation and world expansion.
 */

export const PROMPT_ENTITY_INTEGRATION = `
INTEGRATION RULES:
- Characters are conscious beings with agency. Non-sentient AI is an artifact. Every new character MUST have at least 1 relationship to an existing character.
- Locations are spatial areas. Every new location SHOULD nest under an existing location via parentId (except top-level regions).
- Artifacts are CONCRETE TOOLS with specific utility — not abstract concepts. The test: can you invoke it to accomplish something? "GPT-4" = artifact. "Machine learning" = concept (system knowledge). Artifacts have parentId: character, location, or null (world-owned for ubiquitous tools like AI, internet).
- Thread participants MUST include at least one existing character or location.
- Names must match the cultural palette already established in the world.
`;
