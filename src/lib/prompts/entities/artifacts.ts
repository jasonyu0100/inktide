/**
 * Artifact Usage Prompt
 */

export const PROMPT_ARTIFACTS = `<artifacts hint="Things you can USE or possess. Pick examples from the work's own palette; do not default to Western-fantasy or Western-academic tokens.">
  <example type="good" kind="objects-and-tools">a ceremonial dagger, a jian, a talking drum, a rosary, a cultivation pill, a wax-seal, the One Ring, a family heirloom manuscript — things you wield or carry.</example>
  <example type="good" kind="research-and-work-tools">GPT-4, TensorFlow, a WMT dataset, a P100 GPU, a spectrometer, a field notebook, an archival microfilm — software/hardware/instruments you USE.</example>
  <example type="bad" reason="concepts belong in system knowledge">"Magic", "swordsmanship", "qi cultivation".</example>
  <example type="bad" reason="techniques/metrics belong in system knowledge">"Transformer architecture", "dropout", "BLEU score", "thermodynamics".</example>
  <example type="bad" reason="document references, not artifacts">"Figure 3", "Table 2", "footnote 14".</example>
  <rule name="ownership">character, location, or null (world-owned for ubiquitous tools like AI, the internet, shared infrastructure).</rule>
  <rule name="transfer">ownershipDelta when artifacts change hands.</rule>
  <rule name="usage">artifactUsage with the character (or author/investigator) who used it. Every usage needs a wielder.</rule>
</artifacts>`;
