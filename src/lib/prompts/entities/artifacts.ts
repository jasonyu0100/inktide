/**
 * Artifact Usage Prompt — shared text block (used in both system and user
 * prompt contexts; kept plain text so it works in either).
 */

export const PROMPT_ARTIFACTS = `ARTIFACTS — things you can USE or possess. Pick examples from the work's own palette; do not default to Western-fantasy or Western-academic tokens.

Good examples:
- Objects and tools: a ceremonial dagger, a jian, a talking drum, a rosary, a cultivation pill, a wax-seal, the One Ring, a family heirloom manuscript — things you wield or carry.
- Research / work tools: GPT-4, TensorFlow, a WMT dataset, a P100 GPU, a spectrometer, a field notebook, an archival microfilm — software/hardware/instruments you USE.

Bad examples (these belong elsewhere):
- "Magic", "swordsmanship", "qi cultivation" — concepts belong in system knowledge.
- "Transformer architecture", "dropout", "BLEU score", "thermodynamics" — techniques/metrics belong in system knowledge.
- "Figure 3", "Table 2", "footnote 14" — document references, not artifacts.

Rules:
- OWNERSHIP: character, location, or null (world-owned for ubiquitous tools like AI, the internet, shared infrastructure).
- TRANSFER: ownershipDelta when artifacts change hands.
- USAGE: artifactUsage with the character (or author/investigator) who used it. Every usage needs a wielder.`;
