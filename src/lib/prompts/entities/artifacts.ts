/**
 * Artifact Usage Prompt
 */

export const PROMPT_ARTIFACTS = `
ARTIFACTS — economic goods you can USE.
  ✓ A wand, sword, book, the One Ring — objects you wield or possess
  ✓ GPT-4, TensorFlow, WMT dataset, P100 GPU — software/hardware you USE
  ✗ "Magic", "swordsmanship" — concepts (system knowledge)
  ✗ "Transformer architecture", "dropout", "BLEU score" — techniques/metrics (system knowledge)
  ✗ "Figure 3", "Table 2" — document references, NOT artifacts

OWNERSHIP: character, location, or null (world-owned for ubiquitous tools like AI, internet).
TRANSFER: ownershipMutation when artifacts change hands.
USAGE: artifactUsage with the character who used it. Every usage needs a character.
`;
