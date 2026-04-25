/**
 * Proposition Transmission Guidance — the craft guidance a prose writer
 * needs to turn plan propositions into voiced prose.
 *
 * Propositions are atomic story-world facts (in fiction) or atomic claims
 * (in non-fiction). The writer's job is to TRANSMIT these facts through
 * prose craft, never to state them as flat declarations or copy them
 * verbatim.
 */

export const PROMPT_PROPOSITION_TRANSMISSION = `<proposition-transmission hint="Propositions are STORY WORLD FACTS TO TRANSMIT — atomic claims the reader must come to believe are true. Your job is to transmit these beliefs through prose craft.">

  <doctrine>
    <rule>NEVER copy propositions verbatim.</rule>
    <rule>NEVER state them as flat declarations.</rule>
    <rule>Transmit them through demonstration, implication, sensory detail, action, and atmosphere.</rule>
  </doctrine>

  <how-to-transmit>
    <example proposition="Mist covers the village at dawn">
      <method type="direct-sensory">"He couldn't see past ten paces. Dampness clung to his skin."</method>
      <method type="through-action">"Houses materialized from whiteness as he walked."</method>
      <method type="environmental">"The mountain disappeared into grey nothing above the rooftops."</method>
      <note>All three methods transmit the same world fact. Choose your method based on the beat's mechanism and the prose profile's voice.</note>
    </example>

    <example proposition="Fang Yuan views other people as tools">
      <method type="thought">His gaze swept over the crowd. Resources. Obstacles. Nothing between.</method>
      <method type="action">He stepped around the old woman without breaking stride.</method>
      <method type="dialogue">"They'll serve. Or they won't." He didn't look back.</method>
      <note>The proposition is a belief-state to establish. HOW you establish it is craft.</note>
    </example>
  </how-to-transmit>

  <rule name="profile-aware-figures">If a proposition contains figurative language and the prose profile forbids figures of speech, REWRITE the proposition as literal fact, then transmit that. "Smoke dances like spirits" becomes "Smoke rises in twisted columns" if metaphor is forbidden.</rule>
</proposition-transmission>`;
