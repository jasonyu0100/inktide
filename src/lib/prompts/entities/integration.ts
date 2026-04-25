/**
 * Entity Integration Rules Prompt
 *
 * Shared between world generation and world expansion.
 */

export const PROMPT_ENTITY_INTEGRATION = `<entity-integration>
  <integration-rules>
    <rule name="characters">Characters are conscious beings with agency. Non-sentient AI is an artifact. Every new character MUST have at least 1 relationship to an existing character.</rule>
    <rule name="locations">Locations are spatial areas. Every new location SHOULD nest under an existing location via parentId (except top-level regions).</rule>
    <rule name="artifacts" hint="The test: can you invoke it to accomplish something? 'GPT-4' = artifact. 'Machine learning' = concept (system knowledge).">Artifacts are CONCRETE TOOLS with specific utility — not abstract concepts. Artifacts have parentId: character, location, or null (world-owned for ubiquitous tools like AI, internet).</rule>
    <rule name="thread-participants">Thread participants MUST include at least one existing character or location.</rule>
    <rule name="naming">Names must match the cultural palette already established in the world.</rule>
  </integration-rules>

  <initialization-requirement hint="HARD RULE — NO EXCEPTIONS. A blank entity has no readable history and silently zeros out force contributions.">
    <rule name="entity-seed">Every new character, location, and artifact MUST ship with at least 1 node in its world.nodes array at the moment of creation. Empty world graphs are invalid output. Even a transient character or margin location needs one grounding fact (15-25 words, PRESENT tense).</rule>
    <rule name="thread-seed">Every new thread MUST open with a threadDelta on the scene that introduces it, and that threadDelta MUST contain at least 1 addedNode (type "setup") recording the seed moment. A thread whose introducing scene carries no log entry is invalid output.</rule>
    <rule name="seed-purpose">These seed entries define the entity's starting position in its own graph.</rule>
  </initialization-requirement>
</entity-integration>`;
