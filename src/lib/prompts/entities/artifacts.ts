/**
 * Artifact Usage Prompt — XML block injected into user prompts that reason
 * about artifacts.
 */

export const PROMPT_ARTIFACTS = `<artifacts hint="Concrete things an entity can USE, possess, cite, transfer, or invoke under the rules. Pick examples from the work's own palette; do not default to any single register.">
  <example type="good" kind="objects-and-tools">a ceremonial dagger, a jian, a talking drum, a rosary, a wax-seal, a treaty draft, a family heirloom manuscript, a recurring motif object — things wielded or carried.</example>
  <example type="good" kind="documents-and-records">a field notebook, an archival microfilm, a dossier, a court filing, a clinical record, a shipping manifest, a primary-source letter — concrete artefacts that can be cited or transferred.</example>
  <example type="good" kind="research-and-work-tools">GPT-4, TensorFlow, a WMT dataset, a P100 GPU, a spectrometer — software, hardware, and datasets that are USED.</example>
  <example type="good" kind="rule-bearing-instruments">a binding treaty that constrains state behaviour, a tariff schedule that gates trade flows, a calibrated measurement device that certifies a finding, a charter that defines an institution's powers, a cultivation pill or technique manual whose effect is fixed by the world's rules — concrete instruments whose use triggers stated mechanisms.</example>
  <example type="good" kind="simulation-scenario-inputs">a 1962 NSC briefing folder, a calibrated mobility table for São Paulo state, a redistribution-survey roster for a Bihar quadrant, a Politburo decision-rule playbook, a sect's succession charter — initial-condition inputs the scenario must run from.</example>
  <example type="good" kind="simulation-model-outputs">a forecast bulletin, an outbreak dashboard print, a modelled grain-price ticker, a cultivation status sheet, a wargame turn report — model outputs surfaced as diegetic artefacts when the work renders rule state directly (the simulation ProseFormat).</example>
  <example type="bad" reason="concepts belong in system knowledge">"Magic", "swordsmanship", "alchemy".</example>
  <example type="bad" reason="techniques/metrics belong in system knowledge">"Transformer architecture", "dropout", "BLEU score", "thermodynamics".</example>
  <example type="bad" reason="internal references, not standalone artifacts">"Figure 3", "Table 2", "footnote 14".</example>
  <rule name="ownership">parentId is a character, location, or null (world-owned for ubiquitous tools like AI, the internet, shared infrastructure, public archives, or universally-available rule instruments).</rule>
  <rule name="transfer">ownershipDelta when artifacts change hands.</rule>
  <rule name="usage">artifactUsage records who wielded or invoked it — every usage names a wielder. Where the artifact is rule-bearing, the usage entry should state which mechanism it triggered.</rule>
</artifacts>`;
